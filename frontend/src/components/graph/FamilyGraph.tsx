import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background, BackgroundVariant, Controls, Handle, MarkerType, MiniMap, Position, ReactFlow, ReactFlowProvider, useReactFlow,
  type Edge, type Node, type NodeProps, type NodeChange,
} from '@xyflow/react'
import { animate } from 'motion'
import { AlertTriangle, Box, CarFront, CheckCircle2, Flag, HelpCircle, Home, User, Zap } from 'lucide-react'
import type { Assignment, Disruption, Household, ImpactCategory, ImpactNode, SimulationResult } from '../../types'
import { buildEdges, computeLayout, entityLabel, TIER_SHORT, type EdgeType, type Pos } from '../../lib/graph'
import { fmtRange } from '../../lib/time'
import { useStore } from '../../state/store'

type VisState = 'direct' | 'risk' | 'recoverable' | 'restored' | 'unresolved' | undefined
type NData = {
  kind: 'person' | 'task' | 'resource' | 'milestone' | 'disruption' | 'label'
  title: string; sub?: string; badge?: string; state?: VisState; stateText?: string; dim?: boolean; selected?: boolean
  changed?: boolean; aria: string
}

const STATE_TEXT: Record<Exclude<VisState, undefined>, string> = {
  direct: 'Directly disrupted', risk: 'At risk through dependency', recoverable: 'Recoverable', restored: 'Restored', unresolved: 'Unresolved',
}
const STATE_ICON = { direct: Zap, risk: AlertTriangle, recoverable: CheckCircle2, restored: CheckCircle2, unresolved: HelpCircle }

function Handles() {
  const sides: [Position, string][] = [[Position.Top, 'T'], [Position.Bottom, 'B'], [Position.Left, 'L'], [Position.Right, 'R']]
  return <>{sides.map(([p, k]) => (
    <span key={k}>
      <Handle type="source" id={`s${k}`} position={p} style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="target" id={`t${k}`} position={p} style={{ opacity: 0, pointerEvents: 'none' }} />
    </span>))}</>
}

function GNode({ data }: NodeProps<Node<NData>>) {
  const d = data
  const Icon = d.kind === 'person' ? User : d.kind === 'resource' ? (d.sub?.includes('vehicle') ? CarFront : Home) : d.kind === 'milestone' ? Flag : d.kind === 'disruption' ? Zap : Box
  const SIcon = d.state ? STATE_ICON[d.state] : null
  return (
    <div className={`gnode ${d.kind}`} data-state={d.state} data-dim={d.dim ? 'true' : undefined} data-selected={d.selected ? 'true' : undefined}
      data-changed={d.changed ? 'true' : undefined} aria-label={d.aria} role="group">
      <Handles />
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <Icon size={15} style={{ marginTop: 1, flex: 'none', color: '#82b2d6' }} aria-hidden />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="t">{d.title}</div>
          {d.sub && <div className="s">{d.sub}</div>}
        </div>
        {d.badge && <span className="badge">{d.badge}</span>}
      </div>
      {d.state && SIcon && (
        <div className="s" style={{ marginTop: 5, display: 'flex', gap: 5, alignItems: 'center', color: '#fff' }}>
          <SIcon size={12} aria-hidden /> {d.stateText}
        </div>
      )}
    </div>
  )
}

function LabelNode({ data }: NodeProps<Node<NData>>) {
  return <div className="lane-label" aria-hidden>{data.title}</div>
}
const nodeTypes = { gnode: GNode, label: LabelNode }

const EDGE_STYLE: Record<EdgeType, { stroke: string; dash?: string; width: number; label: string }> = {
  assigned_to: { stroke: '#82b2d6', width: 2, label: 'assigned to' },
  requires_resource: { stroke: '#5b8db8', dash: '6 5', width: 1.5, label: 'uses' },
  requires_permission: { stroke: '#9fd0b8', dash: '2 4', width: 1.5, label: 'needs permission' },
  depends_on: { stroke: '#c9b06e', dash: '2 5', width: 2, label: 'depends on' },
  enables: { stroke: '#a7c3dc', width: 2, label: 'enables' },
  serves_dependent: { stroke: '#7fa5c8', dash: '1 4', width: 1.5, label: 'serves' },
  disrupted_by: { stroke: '#e08a8e', width: 2.5, label: 'disrupts' },
}
const handlesFor = (t: EdgeType, sourceIsTask: boolean): [string, string] => {
  if (t === 'assigned_to' || t === 'requires_permission') return ['sT', 'tB']
  if (t === 'disrupted_by') return ['sR', 'tL']
  return sourceIsTask ? ['sR', 'tL'] : ['sB', 'tT']
}

export interface GraphProps {
  h: Household
  assignments: Assignment[]
  events?: Disruption[]
  sim?: SimulationResult | null
  cursor?: number | null          // cascade reveal depth (null ⇒ no cascade styling)
  showDirect?: boolean
  showIndirect?: boolean
  resolution?: Record<string, ImpactCategory> | null
  uncovered?: string[]
  changedTaskIds?: string[]       // tasks whose edge detaches/reconnects during the animation
  badgeTaskIds?: string[]         // tasks badged REASSIGNED (vs. baseline)
  baselineForGhosts?: Assignment[] | null
  replayKey?: number
  draggable?: boolean
  showPermissionEdges?: boolean
  height?: number
  minimap?: boolean
  onSelect?: (id: string | null) => void
  selectedId?: string | null
}

const overrides = new Map<string, Record<string, Pos>>()

function Inner(p: GraphProps) {
  const reduced = useStore((s) => s.reducedMotion)
  const rf = useReactFlow()
  const target = useMemo(() => computeLayout(p.h, p.assignments), [p.h, p.assignments])
  const [pos, setPos] = useState<Record<string, Pos>>(target)
  const posRef = useRef(pos)
  posRef.current = pos
  const [phase, setPhase] = useState<'idle' | 'detach' | 'move' | 'settle'>('idle')
  // controlled flow: node sizes reported by React Flow must be fed back, otherwise fitView has nothing to measure
  const [dims, setDims] = useState<Record<string, { width: number; height: number }>>({})
  const needFit = useRef(true)
  const first = useRef(true)
  const ov = (overrides.get(p.h.id) ?? {})

  // animate node coordinates toward the new layout (magnetic reconnect); coordinates are never re-randomised
  useEffect(() => {
    const t0 = target
    if (first.current || reduced) { first.current = false; setPos(t0); setPhase('idle'); return }
    const from = posRef.current
    const moving = Object.keys(t0).some((k) => from[k] && (from[k].x !== t0[k].x || from[k].y !== t0[k].y))
    if (!moving) { setPos(t0); return }
    let ctl: { stop: () => void } | null = null
    const hasGhosts = !!p.baselineForGhosts
    setPhase(hasGhosts ? 'detach' : 'move')
    const t1 = setTimeout(() => {
      setPhase('move')
      ctl = animate(0, 1, {
        duration: 0.95, ease: [0.22, 1, 0.36, 1],
        onUpdate: (v: number) => {
          const next: Record<string, Pos> = {}
          for (const k of Object.keys(t0)) {
            const a = from[k] ?? t0[k]
            next[k] = { x: a.x + (t0[k].x - a.x) * v, y: a.y + (t0[k].y - a.y) * v }
          }
          setPos(next)
        },
        onComplete: () => { setPos(t0); setPhase('settle'); setTimeout(() => setPhase('idle'), 900) },
      }) as unknown as { stop: () => void }
    }, hasGhosts ? 520 : 0)
    return () => { clearTimeout(t1); ctl?.stop() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, p.replayKey])

  const impact = useMemo(() => new Map<string, ImpactNode>((p.sim?.nodes ?? []).map((n) => [n.id, n])), [p.sim])
  const cascadeOn = p.cursor !== null && p.cursor !== undefined && !!p.sim
  const lit = (n?: ImpactNode) => !!n && n.category !== 'unaffected' && n.depth <= (p.cursor ?? -1)
  const asg = useMemo(() => new Map(p.assignments.map((a) => [a.taskId, a])), [p.assignments])

  const stateFor = (id: string): VisState => {
    if (p.resolution && p.resolution[id]) {
      const r = p.resolution[id]
      return r === 'recoverable' ? 'recoverable' : r === 'restored' ? 'restored' : r === 'unresolved' ? 'unresolved' : undefined
    }
    if (cascadeOn) {
      const n = impact.get(id)
      if (!lit(n)) return undefined
      if (n!.category === 'directly_disrupted' && (p.showDirect ?? true)) return 'direct'
      if (n!.category === 'at_risk_dependency' && (p.showIndirect ?? true)) return 'risk'
    }
    return undefined
  }

  const nodes: Node<NData>[] = useMemo(() => {
    const out: Node<NData>[] = []
    const mk = (id: string, data: Omit<NData, 'selected' | 'aria'> & { aria?: string }, kindClass = 'gnode', draggable = p.draggable) => {
      const state = data.kind === 'label' ? undefined : stateFor(id)
      const dim = cascadeOn && !state && data.kind !== 'label' && data.kind !== 'disruption' && (p.cursor ?? 0) > 0
      out.push({
        id, ...(dims[id] ? { measured: dims[id] } : {}), type: kindClass === 'label' ? 'label' : 'gnode', position: ov[id] ?? pos[id] ?? { x: 0, y: 0 }, draggable: !!draggable && kindClass !== 'label',
        selectable: kindClass !== 'label', focusable: kindClass !== 'label', ariaLabel: data.aria ?? data.title,
        data: { ...data, state, stateText: state ? STATE_TEXT[state] : undefined, dim, selected: p.selectedId === id, aria: data.aria ?? data.title },
      })
    }
    const personBusy = (id: string) => p.assignments.filter((a) => a.memberId === id).length
    for (const m of p.h.members) {
      const dis = (p.events ?? []).find((e) => e.affectedEntityIds.includes(m.id))
      const state0 = m.isDependent ? undefined : stateFor(m.id)
      mk(m.id, {
        kind: 'person', title: m.name, sub: m.isDependent ? `${m.role} · dependent` : `${m.role} · ${personBusy(m.id)} task${personBusy(m.id) === 1 ? '' : 's'}`,
        badge: m.isDependent ? 'DEP' : undefined,
        aria: `${m.name}, ${m.role}${m.isDependent ? ', dependent' : ''}, ${personBusy(m.id)} assigned tasks${dis ? ', unavailable ' + fmtRange(dis.startMin, dis.endMin) : ''}`,
      })
      void state0
    }
    for (const t of p.h.tasks) {
      const a = asg.get(t.id)
      const unassigned = !a
      const unres = unassigned && (p.uncovered?.includes(t.id) ?? false)
      const node = out.length
      mk(t.id, {
        kind: 'task', title: t.title, sub: a ? `${fmtRange(a.startMin, a.endMin)} · ${p.h.members.find((m) => m.id === a.memberId)?.name}` : unassigned ? 'UNCOVERED' : '',
        badge: TIER_SHORT[t.tier], changed: (p.badgeTaskIds ?? p.changedTaskIds)?.includes(t.id) && !unassigned,
        aria: `${t.title}, tier ${t.tier}, ${a ? `assigned to ${entityLabel(p.h, a.memberId)} ${fmtRange(a.startMin, a.endMin)}` : 'not covered'}`,
      })
      if (unres && !out[node].data.state) { out[node].data.state = 'unresolved'; out[node].data.stateText = 'Uncovered — needs a human' }
    }
    for (const r of p.h.resources) mk(r.id, { kind: 'resource', title: r.name, sub: `${r.type} · cap ${r.capacity}${r.exclusive ? ' · exclusive' : ''}`, aria: `${r.name}, resource` })
    for (const m of p.h.milestones) mk(m.id, { kind: 'milestone', title: m.title, sub: 'milestone', aria: `Milestone: ${m.title}` })
    for (const e of p.events ?? []) {
      const i = (p.events ?? []).indexOf(e)
      out.push({
        id: e.id, ...(dims[e.id] ? { measured: dims[e.id] } : {}), type: 'gnode', position: ov[e.id] ?? { x: 20, y: -10 + i * 96 }, draggable: false, selectable: true,
        data: { kind: 'disruption', title: e.reason || e.type.replace(/_/g, ' '), sub: fmtRange(e.startMin, e.endMin), badge: 'EVENT', aria: `Disruption: ${e.reason ?? e.type}`, state: undefined },
      })
    }
    const xs = Object.values(pos)
    if (xs.length) {
      out.push({ id: 'lbl-un', type: 'label', position: { x: 28, y: 112 }, data: { kind: 'label', title: 'Unassigned', aria: '' }, selectable: false, draggable: false })
      const sideX = Math.min(...p.h.milestones.map((m) => pos[m.id]?.x ?? 1e9), ...p.h.members.filter((m) => m.isDependent).map((m) => pos[m.id]?.x ?? 1e9))
      if (sideX < 1e9) out.push({ id: 'lbl-ms', type: 'label', position: { x: sideX, y: 112 }, data: { kind: 'label', title: 'Prerequisites', aria: '' }, selectable: false, draggable: false })
      const rx = Math.min(...p.h.resources.map((r) => pos[r.id]?.x ?? 1e9))
      if (rx < 1e9) out.push({ id: 'lbl-res', type: 'label', position: { x: rx, y: 80 }, data: { kind: 'label', title: 'Resources', aria: '' }, selectable: false, draggable: false })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.h, pos, p.assignments, p.events, p.sim, p.cursor, p.showDirect, p.showIndirect, p.resolution, p.uncovered, p.changedTaskIds, p.badgeTaskIds, p.selectedId, p.draggable, ov, dims])

  const edges: Edge[] = useMemo(() => {
    const out: Edge[] = []
    const changedSet = new Set(p.changedTaskIds ?? [])
    const hideNewFor = phase === 'detach' || phase === 'move' ? changedSet : new Set<string>()
    const litPairs = new Set<string>()
    if (cascadeOn) for (const st of p.sim!.cascade) if (st.depth <= (p.cursor ?? -1)) for (const [u, v] of st.edges) { litPairs.add(`${u}|${v}`); litPairs.add(`${v}|${u}`) }
    for (const e of buildEdges(p.h, p.assignments)) {
      if (e.type === 'requires_permission' && !p.showPermissionEdges) continue
      if (e.type === 'assigned_to' && hideNewFor.has(e.source)) continue
      const isTask = !!p.h.tasks.find((t) => t.id === e.source)
      const [sh, th] = handlesFor(e.type, isTask)
      const st = EDGE_STYLE[e.type]
      const hot = litPairs.has(`${e.source}|${e.target}`)
      const justSnapped = phase === 'settle' && changedSet.has(e.source) && e.type === 'assigned_to'
      const stroke = justSnapped ? '#6fcaa0' : hot ? '#f0a3a6' : st.stroke
      out.push({
        id: e.id, source: e.source, target: e.target, sourceHandle: sh, targetHandle: th, type: 'default',
        label: justSnapped ? 'verified' : p.draggable || hot ? st.label : undefined,
        labelStyle: { fill: '#dcebf7', fontSize: 10, fontFamily: 'IBM Plex Mono' }, labelBgStyle: { fill: '#0c2442' },
        style: { stroke, strokeWidth: hot || justSnapped ? st.width + 1.5 : st.width, strokeDasharray: st.dash, opacity: cascadeOn && !hot && (p.cursor ?? 0) > 0 ? 0.35 : 1, transition: 'stroke 0.3s, opacity 0.3s' },
        markerEnd: ['depends_on', 'enables', 'serves_dependent', 'requires_resource'].includes(e.type) ? { type: MarkerType.ArrowClosed, color: stroke, width: 14, height: 14 } : undefined,
        ariaLabel: `${entityLabel(p.h, e.source)} ${st.label} ${entityLabel(p.h, e.target)}`,
      })
    }
    // ghost edges: the old assignment detaching (red, dashed, fading) before the node travels
    if ((phase === 'detach' || phase === 'move') && p.baselineForGhosts) {
      const cur = new Map(p.assignments.map((a) => [a.taskId, a]))
      for (const b of p.baselineForGhosts) {
        const c = cur.get(b.taskId)
        if (changedSet.has(b.taskId) && (!c || c.memberId !== b.memberId)) {
          out.push({
            id: `ghost:${b.taskId}>${b.memberId}`, source: b.taskId, target: b.memberId, sourceHandle: 'sT', targetHandle: 'tB', type: 'default',
            style: { stroke: '#ff8a8f', strokeWidth: 2.5, strokeDasharray: '5 6', opacity: phase === 'detach' ? 0.95 : 0.25, transition: 'opacity 0.8s' }, animated: phase === 'detach',
            label: phase === 'detach' ? 'detaching' : undefined, labelStyle: { fill: '#ffd0d2', fontSize: 10 }, labelBgStyle: { fill: '#3a1b22' },
          })
        }
      }
    }
    for (const e of p.events ?? []) {
      for (const id of e.affectedEntityIds) {
        out.push({
          id: `dis:${e.id}>${id}`, source: e.id, target: id, sourceHandle: 'sR', targetHandle: 'tL', type: 'default',
          style: { stroke: '#e08a8e', strokeWidth: 2.2, strokeDasharray: '4 4', opacity: cascadeOn && (p.cursor ?? 0) < 1 ? 0.5 : 1 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#e08a8e', width: 12, height: 12 },
        })
      }
    }
    return out
  }, [p.h, p.assignments, p.events, p.sim, p.cursor, p.showPermissionEdges, p.draggable, phase, p.changedTaskIds, p.baselineForGhosts, cascadeOn])

  const onNodesChange = useCallback((chs: NodeChange[]) => {
    const measured = chs.filter((c) => c.type === 'dimensions' && c.dimensions)
    if (measured.length) {
      setDims((prev) => {
        const next = { ...prev }
        let changed = false
        for (const c of measured) {
          if (c.type !== 'dimensions' || !c.dimensions) continue
          const o = prev[c.id]
          if (!o || o.width !== c.dimensions.width || o.height !== c.dimensions.height) { next[c.id] = c.dimensions; changed = true }
        }
        return changed ? next : prev
      })
    }
    if (!p.draggable) return
    for (const c of chs) {
      if (c.type === 'position' && c.position) {
        const cur = overrides.get(p.h.id) ?? {}
        cur[c.id] = c.position
        overrides.set(p.h.id, cur)
        setPos((prev) => ({ ...prev, [c.id]: c.position! }))
      }
    }
  }, [p.draggable, p.h.id])

  useEffect(() => { needFit.current = true }, [p.h.id, p.h.tasks.length, p.events?.length])
  const nDims = Object.keys(dims).length
  useEffect(() => {
    if (!needFit.current || nDims === 0) return
    const t = setTimeout(() => { needFit.current = false; void rf.fitView({ padding: 0.12, duration: reduced ? 0 : 350 }) }, 80)
    return () => clearTimeout(t)
  }, [rf, nDims, reduced, p.h.id, p.h.tasks.length, p.events?.length])

  return (
    <ReactFlow
      nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} minZoom={0.25} maxZoom={1.6}
      nodesDraggable={!!p.draggable} nodesConnectable={false} elementsSelectable
      onNodeClick={(_, n) => p.onSelect?.(n.type === 'label' ? null : n.id)} onPaneClick={() => p.onSelect?.(null)}
      proOptions={{ hideAttribution: false }} fitView aria-label="Family dependency graph" colorMode="dark"
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="#3d6a97" />
      <Controls position="bottom-left" showInteractive={false} />
      {p.minimap && <MiniMap pannable zoomable nodeColor={() => '#47789f'} maskColor="rgba(8,24,46,0.7)" />}
    </ReactFlow>
  )
}

export function FamilyGraph(p: GraphProps) {
  return (
    <div className="graph-field" style={{ height: p.height ?? 560 }} role="region" aria-label="Interactive family dependency graph (a text alternative is available below)">
      <ReactFlowProvider><Inner {...p} /></ReactFlowProvider>
    </div>
  )
}

export function GraphLegend({ mode }: { mode: 'network' | 'cascade' | 'recovery' }) {
  const sw = (c: string, t: string) => <span><i style={{ borderColor: c, background: c + '33' }} />{t}</span>
  return (
    <div className="legend" aria-label="Legend">
      {mode !== 'network' && sw('#e08a8e', 'Directly disrupted (⚡)')}
      {mode === 'cascade' && sw('#e6b756', 'At risk via dependency (⚠)')}
      {mode === 'recovery' && sw('#6fcaa0', 'Recoverable / restored (✓)')}
      {mode !== 'network' && sw('#ff8a8f', 'Unresolved (?) — dashed')}
      <span style={{ marginLeft: 'auto', opacity: 0.8 }}>Solid = assigned/enables · dashed = uses resource · dotted = depends on</span>
    </div>
  )
}

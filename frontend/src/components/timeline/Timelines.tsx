import { LayoutGroup, motion } from 'motion/react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import type { Assignment, Disruption, Household, ImpactNode, SimulationResult } from '../../types'
import { fmt, fmtRange } from '../../lib/time'
import { buildEdges, entityLabel } from '../../lib/graph'
import { useStore } from '../../state/store'

/* ------------------------------------------------------------------ schedule (Gantt) with continuity */
export function ScheduleStrip({ h, assignments, baseline, uncovered = [], events = [], changedTaskIds = [], selectedId, onSelect, compact }: {
  h: Household; assignments: Assignment[]; baseline?: Assignment[]; uncovered?: string[]; events?: Disruption[]
  changedTaskIds?: string[]; selectedId?: string | null; onSelect?: (id: string) => void; compact?: boolean
}) {
  const reduced = useStore((s) => s.reducedMotion)
  const lo = h.planningStartMin, hi = h.planningEndMin, span = hi - lo
  const pct = (m: number) => `${(Math.max(0, Math.min(span, m - lo)) / span) * 100}%`
  const wpct = (a: number, b: number) => `${(Math.max(0, Math.min(span, b - a)) / span) * 100}%`
  const workers = h.members.filter((m) => !m.isDependent)
  const ticks: number[] = []
  for (let m = Math.ceil(lo / 30) * 30; m <= hi; m += 30) ticks.push(m)
  const title = (id: string) => h.tasks.find((t) => t.id === id)?.title ?? id
  const ghost = (baseline ?? []).filter((b) => {
    const c = assignments.find((a) => a.taskId === b.taskId)
    return !c || c.memberId !== b.memberId || c.startMin !== b.startMin
  })
  return (
    <div className="gantt" role="table" aria-label="Schedule by family member">
      <div className="row" style={{ borderBottom: '1px solid var(--line-2)' }} role="row">
        <div />
        <div style={{ position: 'relative', height: 20 }} aria-hidden>
          {ticks.map((m) => <span key={m} className="mono muted" style={{ position: 'absolute', left: pct(m), fontSize: 10, transform: 'translateX(-50%)' }}>{fmt(m)}</span>)}
        </div>
      </div>
      <LayoutGroup>
        {workers.map((m) => {
          const mine = assignments.filter((a) => a.memberId === m.id)
          const away = events.filter((e) => (e.type === 'member_unavailable') && e.affectedEntityIds.includes(m.id))
          return (
            <div className="row" key={m.id} role="row" style={compact ? { minHeight: 38 } : undefined}>
              <div style={{ fontWeight: 700, fontSize: 13 }} role="rowheader">{m.name}<div className="muted" style={{ fontSize: 10.5, fontWeight: 500 }}>{m.role}</div></div>
              <div className="lane" role="cell">
                {m.availability.map((w, i) => (
                  <div key={i} aria-hidden style={{ position: 'absolute', left: pct(w.startMin), width: wpct(w.startMin, w.endMin), top: 0, bottom: 0, background: '#eaf3fa', borderRadius: 6 }} />
                ))}
                {away.map((e) => (
                  <div key={e.id} title={`Unavailable ${fmtRange(e.startMin, e.endMin)}`} style={{
                    position: 'absolute', left: pct(e.startMin), width: wpct(e.startMin, e.endMin), top: 0, bottom: 0, borderRadius: 6,
                    background: 'repeating-linear-gradient(135deg,#f3d0d1,#f3d0d1 5px,#fbe9ea 5px,#fbe9ea 10px)', border: '1px solid #e7bcbd',
                  }} />
                ))}
                {mine.map((a) => (
                  <motion.button key={a.taskId} layout={!reduced} layoutId={`bar-${a.taskId}`} transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                    className={`gbar ${changedTaskIds.includes(a.taskId) ? 'changed' : ''}`} onClick={() => onSelect?.(a.taskId)}
                    style={{ left: pct(a.startMin), width: wpct(a.startMin, a.endMin), border: selectedId === a.taskId ? '2px solid #0d1624' : 'none', cursor: 'pointer' }}
                    aria-label={`${title(a.taskId)} ${fmtRange(a.startMin, a.endMin)}${changedTaskIds.includes(a.taskId) ? ', reassigned' : ''}`}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{title(a.taskId)}</span>
                    {!compact && <span className="mono" style={{ opacity: 0.85, fontWeight: 500 }}>{fmt(a.startMin)}</span>}
                  </motion.button>
                ))}
                {ghost.filter((b) => b.memberId === m.id).map((b) => (
                  <div key={'g' + b.taskId} className="gbar ghost" style={{ left: pct(b.startMin), width: wpct(b.startMin, b.endMin), top: 3, opacity: 0.85, pointerEvents: 'none' }} aria-hidden>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>was: {title(b.taskId)}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        {(uncovered.length > 0 || compact === false) && (
          <div className="row" role="row">
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--bad)' }} role="rowheader">Uncovered</div>
            <div className="lane" role="cell">
              {uncovered.length === 0 && <span className="muted" style={{ fontSize: 12 }}>None — every responsibility is covered.</span>}
              {uncovered.map((tid) => {
                const b = (baseline ?? h.baselineAssignments).find((a) => a.taskId === tid)
                const t = h.tasks.find((x) => x.id === tid)
                const s = b?.startMin ?? t?.earliestStartMin ?? lo
                const e = b?.endMin ?? s + (t?.durationMin ?? 30)
                return (
                  <button key={tid} className="gbar bad" onClick={() => onSelect?.(tid)} style={{ left: pct(s), width: wpct(s, e), border: '2px dashed #fff', outline: '2px solid var(--bad)', cursor: 'pointer' }}
                    aria-label={`${title(tid)} uncovered`}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>⚠ {title(tid)}</span></button>
                )
              })}
            </div>
          </div>
        )}
      </LayoutGroup>
    </div>
  )
}

/* ------------------------------------------------------------------ cinematic cascade timeline */
export const STEP_MS = 650
const kindOf = (n: ImpactNode) => (n.category === 'directly_disrupted' ? 'direct' : 'risk')

export function CascadeTimeline({ sim, h }: { sim: SimulationResult; h: Household }) {
  const c = useStore((s) => s.cascade)
  const setC = useStore((s) => s.setCascade)
  const select = useStore((s) => s.select)
  const max = Math.max(1, sim.maxDepth)
  const steps = sim.cascade
  const byId = new Map(sim.nodes.map((n) => [n.id, n]))
  const x = (d: number) => `${6 + (d / max) * 88}%`
  const cur = Math.min(max, c.cursor)
  const stepIdx = Math.floor(cur + 1e-6)
  const names = (d: number) => steps.find((s) => s.depth === d)?.nodeIds.map((id) => entityLabel(h, id)).join(', ') ?? ''
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className="cinema-track" role="group" aria-label="Cascade timeline">
        {steps.map((s) => (
          <div key={s.depth} className="tick" style={{ left: x(s.depth) }}><span>{s.depth === 0 ? 'EVENT' : `STEP ${s.depth}`}</span></div>
        ))}
        {steps.flatMap((s) => {
          const nodes = s.nodeIds.map((id) => byId.get(id)!).filter((n) => n && n.category !== 'unaffected' && n.nodeType !== 'disruption')
          return nodes.map((n, i) => (
            <button key={n.id} className="marker" data-lit={s.depth <= cur ? 'true' : 'false'} data-kind={kindOf(n)} onClick={() => select(n.id)}
              style={{ left: x(s.depth), bottom: 10 + i * 24, opacity: s.depth <= cur ? 1 : 0.5, cursor: 'pointer', transition: 'all 0.3s' }}
              title={n.explanation}>{n.label}</button>
          ))
        })}
        <motion.div className="playhead" animate={{ left: x(cur) }} transition={{ duration: c.playing ? 0 : 0.15 }} aria-hidden />
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn primary" onClick={() => setC({ playing: !c.playing, cursor: c.cursor >= max ? 0 : c.cursor })} aria-label={c.playing ? 'Pause cascade' : 'Play cascade'}>
          {c.playing ? <Pause size={15} /> : <Play size={15} />} {c.playing ? 'Pause' : 'Play cascade'}
        </button>
        <button className="btn" onClick={() => setC({ cursor: 0, playing: true })}><RotateCcw size={14} /> Replay</button>
        <label style={{ flex: 1, minWidth: 220, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="sr-only">Scrub cascade timeline</span>
          <input type="range" min={0} max={max} step={0.01} value={cur} style={{ flex: 1, accentColor: '#255e99' }}
            onChange={(e) => setC({ cursor: Number(e.target.value), playing: false })}
            aria-valuetext={`Step ${stepIdx} of ${max}: ${names(stepIdx) || 'start'}`} />
        </label>
        <label className="lbl" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>Speed
          <select className="input" style={{ width: 80, minHeight: 32 }} value={c.speed} onChange={(e) => setC({ speed: Number(e.target.value) })}>
            {[0.5, 1, 2, 4].map((v) => <option key={v} value={v}>{v}×</option>)}</select></label>
        <span className="mono muted" style={{ fontSize: 12 }} aria-live="polite">step {stepIdx}/{max} · {Math.round(STEP_MS / c.speed)} ms/level</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ text alternative to the graph */
export function GraphTextAlternative({ h, assignments, sim }: { h: Household; assignments: Assignment[]; sim?: SimulationResult | null }) {
  const edges = buildEdges(h, assignments).filter((e) => e.type !== 'requires_permission')
  const cat = new Map((sim?.nodes ?? []).map((n) => [n.id, n.category]))
  const label = (c?: string) => (c && c !== 'unaffected' ? c.replace(/_/g, ' ') : '—')
  return (
    <details className="card card-pad" style={{ marginTop: 12 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Text alternative to the graph ({h.members.length + h.tasks.length + h.resources.length + h.milestones.length} entities, {edges.length} relationships)</summary>
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl" style={{ marginTop: 10 }}>
          <thead><tr><th>Entity</th><th>Type</th><th>Impact</th><th>Relationships</th></tr></thead>
          <tbody>
            {[...h.members.map((m) => ({ id: m.id, type: m.isDependent ? 'dependent' : 'person' })), ...h.tasks.map((t) => ({ id: t.id, type: 'task' })),
              ...h.resources.map((r) => ({ id: r.id, type: 'resource' })), ...h.milestones.map((m) => ({ id: m.id, type: 'milestone' }))].map((n) => (
              <tr key={n.id}>
                <td><b>{entityLabel(h, n.id)}</b> <span className="mono muted">{n.id}</span></td><td>{n.type}</td><td>{label(cat.get(n.id))}</td>
                <td>{edges.filter((e) => e.source === n.id).map((e) => `${e.type.replace(/_/g, ' ')} → ${entityLabel(h, e.target)}`).join('; ') || '—'}</td>
              </tr>))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

import { useEffect, useRef } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'
import { FamilyGraph, GraphLegend } from '../components/graph/FamilyGraph'
import { CascadeTimeline, GraphTextAlternative, STEP_MS } from '../components/timeline/Timelines'
import { Banner, Empty, PageHeader, Stat } from '../components/ui/ui'
import { entityLabel } from '../lib/graph'
import { useStore } from '../state/store'
import type { ImpactNode } from '../types'

const CAT_LABEL: Record<string, string> = {
  unaffected: 'Unaffected', directly_disrupted: 'Directly disrupted ⚡', at_risk_dependency: 'At risk through dependency ⚠',
  recoverable: 'Recoverable ✓', unresolved: 'Unresolved ?', restored: 'Restored ✓',
}

export default function CascadeLab() {
  const { draft: h, events, sim, cascade, selectedNodeId, reducedMotion } = useStore()
  const { setCascade, select, go, runScenario } = useStore.getState()
  const raf = useRef(0)
  const data = sim.data

  // autoplay once per simulation (never when reduced motion is requested: jump to the end state)
  useEffect(() => {
    if (!data) return
    if (reducedMotion) setCascade({ cursor: data.maxDepth, playing: false })
    else setCascade({ cursor: 0, playing: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.simulationId, reducedMotion])

  useEffect(() => {
    if (!cascade.playing || !data) return
    let last = performance.now()
    const tick = (now: number) => {
      const dt = now - last; last = now
      const st = useStore.getState().cascade
      const next = Math.min(data.maxDepth, st.cursor + (dt / STEP_MS) * st.speed)
      if (next >= data.maxDepth) { setCascade({ cursor: data.maxDepth, playing: false }); return }
      setCascade({ cursor: next })
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cascade.playing, data?.simulationId])

  if (!h) return null
  if (sim.status === 'calculating') return (
    <div style={{ display: 'grid', gap: 12 }}><PageHeader eyebrow="04 · Cascade Laboratory" title="Tracing consequences…" />
      <div className="skeleton" style={{ height: 460 }} aria-hidden /><p role="status"><Loader2 size={15} className="spin" /> Analyzing the dependency graph and probing recoverability with the solver.</p></div>)
  if (sim.status === 'error') return (
    <Empty title="Simulation failed" action={<button className="btn primary" onClick={() => void runScenario()}>Retry</button>}>{sim.error}</Empty>)
  if (!data) return (
    <Empty title="No scenario has been run" action={<button className="btn primary" onClick={() => go('studio')}>Open Disruption Studio</button>}>
      {events.length ? 'Your scenario changed (or is not confirmed yet). Run it from the Disruption Studio to see the cascade.' : 'Stage and confirm a disruption first.'}</Empty>)

  const affected = data.nodes.filter((n) => n.category !== 'unaffected' && n.nodeType !== 'disruption')
  const direct = affected.filter((n) => n.category === 'directly_disrupted')
  const indirect = affected.filter((n) => n.category === 'at_risk_dependency')
  const sel = data.nodes.find((n) => n.id === selectedNodeId)
  const pathText = (ids: string[]) => ids.map((i) => (events.find((e) => e.id === i) ? 'Disruption' : entityLabel(h, i))).join(' → ')
  const none = affected.length === 0

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <PageHeader eyebrow="04 · Cascade Laboratory" title="How the disruption propagates">
        <button className="btn primary" onClick={() => go('recovery')}>Continue to Recovery Studio <ArrowRight size={15} /></button>
      </PageHeader>

      <div className="card" style={{ display: 'flex', flexWrap: 'wrap' }}>
        <Stat label="Directly disrupted" value={direct.length} tone={direct.length ? 'bad' : undefined} sub={direct.map((n) => n.label).slice(0, 3).join(', ')} />
        <Stat label="At risk (indirect)" value={indirect.length} tone={indirect.length ? 'warn' : undefined} sub={indirect.map((n) => n.label).slice(0, 3).join(', ')} />
        <Stat label="Affected tasks" value={`${data.affectedTaskIds.length}/${h.tasks.length}`} />
        <Stat label="Coverage after disruption" value={`${Math.round(data.postDisruptionCoverage.weightedCoverage * 100)}%`} sub={`baseline ${Math.round(data.baselineCoverage.weightedCoverage * 100)}%`} tone="warn" />
        <Stat label="Cascade depth" value={data.maxDepth} sub={`${data.durationMs} ms`} />
        {data.recoverabilityProbe && <Stat label="Recoverable?" value={data.recoverabilityProbe.criticalRecovery ? 'yes' : 'no'} tone={data.recoverabilityProbe.criticalRecovery ? 'ok' : 'bad'}
          sub={`solver ${data.recoverabilityProbe.solverStatus}`} />}
      </div>

      {none && <Banner kind="info">This scenario does not invalidate any assignment — nothing is affected, and no recovery is needed. (Computed, not assumed.)</Banner>}
      {data.warnings.map((w) => <Banner key={w} kind="warn">{w}</Banner>)}

      <div className="grid-3">
        <div style={{ minWidth: 0, display: 'grid', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', gap: 14, marginBottom: 8, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={cascade.showDirect} onChange={(e) => setCascade({ showDirect: e.target.checked })} /> Show direct effects</label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={cascade.showIndirect} onChange={(e) => setCascade({ showIndirect: e.target.checked })} /> Show indirect effects</label>
            </div>
            <FamilyGraph h={h} assignments={h.baselineAssignments} events={events} sim={data} cursor={cascade.cursor} showDirect={cascade.showDirect} showIndirect={cascade.showIndirect}
              selectedId={selectedNodeId} onSelect={select} height={520} />
            <GraphLegend mode="cascade" />
          </div>
          <CascadeTimeline sim={data} h={h} />
          <GraphTextAlternative h={h} assignments={h.baselineAssignments} sim={data} />
        </div>

        <aside className="card card-pad" aria-label="Causal inspector" style={{ position: 'sticky', top: 70, maxHeight: 'calc(100vh - 90px)', overflow: 'auto' }}>
          <h3>Why is this affected?</h3>
          {!sel && <p className="muted">Select an affected node in the graph or timeline to read its causal explanation. Explanations are generated from the computed dependency records, not by a language model.</p>}
          {sel && <NodePanel n={sel} pathText={pathText} />}
          <div className="eyebrow" style={{ marginTop: 14 }}>Affected entities by depth</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0', display: 'grid', gap: 4 }}>
            {affected.sort((a, b) => a.depth - b.depth).map((n) => (
              <li key={n.id}><button className="btn sm" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => select(n.id)}>
                <span className="mono muted">d{n.depth}</span> {n.label} <span className={`chip ${n.category === 'directly_disrupted' ? 'bad' : 'warn'}`} style={{ marginLeft: 'auto' }}>{n.category === 'directly_disrupted' ? '⚡ direct' : '⚠ risk'}</span></button></li>))}
            {affected.length === 0 && <li className="muted">Nothing affected.</li>}
          </ul>
          <div className="eyebrow">Unaffected</div>
          <p style={{ margin: '4px 0', fontSize: 12.5 }}>{data.nodes.filter((n) => n.category === 'unaffected' && n.nodeType === 'task').map((n) => n.label).join(', ') || 'No tasks'}</p>
        </aside>
      </div>
    </div>
  )

  function NodePanel({ n, pathText }: { n: ImpactNode; pathText: (ids: string[]) => string }) {
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        <div className="eyebrow">{n.nodeType} · {n.id}</div>
        <h3 style={{ fontSize: 18 }}>{n.label}</h3>
        <div><span className={`chip ${n.category === 'directly_disrupted' ? 'bad' : n.category === 'at_risk_dependency' ? 'warn' : ''}`}>{CAT_LABEL[n.category]}</span>
          {n.recoverable != null && n.category !== 'unaffected' && <span className={`chip ${n.recoverable ? 'ok' : 'bad'}`} style={{ marginLeft: 6 }}>{n.recoverable ? '✓ recovery possible' : '✗ no valid recovery'}</span>}</div>
        <p style={{ margin: 0 }}>{n.explanation}</p>
        {n.reasonCodes.length > 0 && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{n.reasonCodes.map((c) => <span key={c} className="chip mono">{c}</span>)}</div>}
        {n.causalPaths.length > 0 && (<div><div className="eyebrow">Causal paths ({n.causalPaths.length})</div>
          <ol style={{ margin: '4px 0', paddingLeft: 18, fontSize: 12.5 }}>{n.causalPaths.map((p, i) => <li key={i}>{pathText(p.nodeIds)} <span className="mono muted">[{p.edgeTypes.join(' › ')}]</span></li>)}</ol></div>)}
      </div>
    )
  }
}

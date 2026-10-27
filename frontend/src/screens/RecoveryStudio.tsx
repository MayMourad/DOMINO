import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, CheckCircle2, Layers, Loader2, RefreshCw, Shuffle, Undo2 } from 'lucide-react'
import { FamilyGraph, GraphLegend } from '../components/graph/FamilyGraph'
import { GraphTextAlternative, ScheduleStrip } from '../components/timeline/Timelines'
import { ApprovalDialog, AssignmentList, CoverageSummary, ExplanationDrawer, StatusPill, VerificationPanel, planTone } from '../components/plans/Plans'
import { Banner, Empty, PageHeader } from '../components/ui/ui'
import { memberName } from '../lib/graph'
import { selectedPlan, useStore } from '../state/store'
import type { Assignment, Household, RecoveryPlan } from '../types'

export default function RecoveryStudio() {
  const { draft: h, events, sim, rec, rejections, pins, excluded, selectedNodeId, receipt, reducedMotion } = useStore()
  const plan = useStore(selectedPlan)
  const { generateRecovery, selectPlan, select, clearConstraints, go } = useStore.getState()
  const [view, setView] = useState<'plan' | 'baseline'>('plan')
  const [approve, setApprove] = useState(false)
  const [cmp, setCmp] = useState<string>('baseline')
  const [explainTask, setExplainTask] = useState<string | null>(null)
  const baseline = h?.baselineAssignments ?? []

  // The graph shows the original schedule first; once a *verified* plan exists it animates into it.
  const target: Assignment[] = view === 'baseline' || !plan ? baseline : plan.assignments
  const [shown, setShown] = useState<Assignment[]>(baseline)
  const prev = useRef<Assignment[]>(baseline)
  const [replay, setReplay] = useState(0)
  const key = useMemo(() => JSON.stringify(target.map((a) => [a.taskId, a.memberId, a.startMin])), [target])
  useEffect(() => {
    const cur = JSON.stringify(shown.map((a) => [a.taskId, a.memberId, a.startMin]))
    if (cur === key) return
    const t = setTimeout(() => { prev.current = shown; setShown(target); setReplay((r) => r + 1) }, reducedMotion ? 0 : 450)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    if (sim.status === 'ready' && rec.status === 'idle') void generateRecovery()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim.status, rec.status])

  if (!h) return null
  if (sim.status !== 'ready' && rec.status === 'idle') return <Empty title="Run a scenario first" action={<button className="btn primary" onClick={() => go('studio')}>Open Disruption Studio</button>}>Recovery plans are calculated for a confirmed disruption.</Empty>

  const data = rec.data
  const calculating = rec.status === 'calculating'
  const moved = shown.filter((a) => { const p = prev.current.find((x) => x.taskId === a.taskId); return !p || p.memberId !== a.memberId }).map((a) => a.taskId)
    .concat(prev.current.filter((p) => !shown.some((a) => a.taskId === p.taskId)).map((p) => p.taskId))
  const plans = data?.plans ?? []
  const other: RecoveryPlan | null = cmp === 'baseline' ? null : plans.find((p) => p.planId === cmp) ?? null

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <PageHeader eyebrow="05 · Recovery Studio" title="Calculated recovery">
        <button className="btn" onClick={() => setView(view === 'plan' ? 'baseline' : 'plan')}><Undo2 size={15} /> {view === 'plan' ? 'Return to original schedule' : 'Show recovery plan'}</button>
        <button className="btn" disabled={calculating} onClick={() => void generateRecovery({ rejections, pins })}><RefreshCw size={15} /> Rerun optimization</button>
        <button className="btn primary" disabled={!plan || plan.validation.overallStatus !== 'valid'} onClick={() => setApprove(true)}><CheckCircle2 size={15} /> Review &amp; approve</button>
      </PageHeader>

      {rec.status === 'error' && <Banner kind="bad"><b>Recovery failed:</b> {rec.error} <button className="btn sm" onClick={() => void generateRecovery()}>Retry</button></Banner>}
      {calculating && <Banner kind="info"><Loader2 size={15} className="spin" aria-hidden /> <b>Evaluating feasible assignments.</b> CP-SAT is solving each strategy; the graph will update once the result is independently verified.</Banner>}
      {(rejections.length > 0 || pins.length > 0 || excluded.length > 0) && (
        <Banner kind="info" action={<button className="btn sm" onClick={clearConstraints}>Clear constraints</button>}>
          <b>Active constraints:</b> {rejections.map((r) => `reject ${memberName(h, r.memberId)} for ${h.tasks.find((t) => t.id === r.taskId)?.title}`).concat(pins.map((p) => `pin ${h.tasks.find((t) => t.id === p.taskId)?.title} → ${memberName(h, p.memberId)}`)).concat(excluded.length ? ['showing an alternative arrangement'] : []).join(' · ')}
        </Banner>)}
      {data?.duplicateStrategyNote && <Banner kind="info">{data.duplicateStrategyNote}</Banner>}
      {data?.warnings.map((w) => <Banner key={w} kind="warn">{w}</Banner>)}
      {plan && plan.uncoveredCriticalTaskIds.length > 0 && (
        <Banner kind="bad"><b>Critical responsibilities uncovered:</b> {plan.uncoveredCriticalTaskIds.map((t) => h.tasks.find((x) => x.id === t)?.title).join(', ')}. No legal assignee exists; DOMINO will not invent one. Human review required.</Banner>)}

      {plans.length > 0 && (
        <div role="radiogroup" aria-label="Recovery plans" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 10 }}>
          {plans.map((p, i) => {
            const tone = planTone(p)
            return (
              <button key={p.planId} role="radio" aria-checked={p.planId === plan?.planId} onClick={() => { selectPlan(p.planId); setView('plan') }} className="card card-pad"
                style={{ textAlign: 'left', cursor: 'pointer', outline: p.planId === plan?.planId ? '3px solid var(--primary)' : 'none', borderColor: tone === 'bad' ? '#e0b4b5' : undefined }}>
                <div className="eyebrow">Plan {String.fromCharCode(65 + i)} · {p.strategyIds.length > 1 ? `${p.strategyIds.length} strategies agree` : 'strategy'}</div>
                <div style={{ fontWeight: 800, fontSize: 15, margin: '2px 0 6px' }}>{p.label}</div>
                <StatusPill plan={p} />
                <div className="mono muted" style={{ fontSize: 12, marginTop: 8 }}>{p.metrics.coveredCount}/{p.metrics.totalCount} covered · {p.metrics.reassignmentCount} reassigned · {p.solverStatus} {p.solverElapsedMs} ms</div>
              </button>)
          })}
        </div>
      )}

      {plans.length === 0 && !calculating && rec.status !== 'error' && <Empty title="No plan yet"><button className="btn primary" onClick={() => void generateRecovery()}>Generate recovery</button></Empty>}

      {plan && (
        <div className="grid-3">
          <div style={{ minWidth: 0, display: 'grid', gap: 14 }}>
            <div style={{ position: 'relative' }}>
              <FamilyGraph h={h} assignments={shown} events={events} uncovered={view === 'plan' ? plan.uncoveredTaskIds : []} resolution={view === 'plan' ? plan.impactResolution : null}
                changedTaskIds={moved} badgeTaskIds={view === 'plan' ? plan.changedTaskIds : []} baselineForGhosts={prev.current} replayKey={replay} selectedId={selectedNodeId}
                onSelect={(id) => { select(id); if (id && h.tasks.some((t) => t.id === id)) setExplainTask(id) }} height={500} />
              <GraphLegend mode="recovery" />
              {calculating && <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'rgba(16,43,78,0.55)', display: 'grid', placeItems: 'center', color: '#fff', borderRadius: 16 }}>Evaluating feasible assignments…</div>}
            </div>
            <div className="card card-pad">
              <h3 style={{ marginBottom: 8 }}>Schedule · {view === 'plan' ? plan.label : 'original'}</h3>
              <ScheduleStrip h={h} assignments={view === 'plan' ? plan.assignments : baseline} baseline={baseline} uncovered={view === 'plan' ? plan.uncoveredTaskIds : []} events={events}
                changedTaskIds={view === 'plan' ? plan.changedTaskIds : []} onSelect={(id) => { setExplainTask(id); select(id) }} selectedId={explainTask} compact={false} />
            </div>
            <div className="card card-pad">
              <h3 style={{ marginBottom: 6 }}>Assignments</h3>
              <AssignmentList plan={plan} h={h} baselineH={h} selectedId={explainTask} onSelect={(id) => { setExplainTask(id); select(id) }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <button className="btn" disabled={calculating} onClick={() => void generateRecovery({ exclude: [...excluded, plan.signature], strategies: ['priority_first'] })}><Shuffle size={14} /> Find another distinct arrangement</button>
                {excluded.length > 0 && <button className="btn" onClick={clearConstraints}>Back to all strategies</button>}
              </div>
            </div>
            <GraphTextAlternative h={h} assignments={shown} sim={sim.data} />
          </div>

          <aside style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
            <div className="card card-pad"><h3 style={{ marginBottom: 8 }}>Coverage</h3><CoverageSummary m={plan.metrics} uncoveredCritical={plan.uncoveredCriticalTaskIds} />
              <dl className="kv" style={{ marginTop: 10 }}><dt>Reassignments</dt><dd>{plan.metrics.reassignmentCount}</dd><dt>Time displacement</dt><dd>{plan.metrics.displacementMin} min</dd>
                <dt>Workload (min)</dt><dd className="mono" style={{ fontSize: 12 }}>{Object.entries(plan.metrics.workloadMinutes).map(([m, v]) => `${memberName(h, m)} ${v}`).join(' · ')}</dd>
                <dt>Workload Gini</dt><dd className="mono">{plan.metrics.workloadGini}</dd></dl></div>
            <div className="card card-pad"><h3 style={{ marginBottom: 8 }}>Why?</h3><ExplanationDrawer plan={plan} h={h} taskId={explainTask} /></div>
            <VerificationPanel plan={plan} />
            {receipt && receipt.planId === plan.planId && <Banner kind="ok"><b>Approved (simulation).</b> Receipt {receipt.receiptId}. No one was notified.</Banner>}
          </aside>
        </div>
      )}

      {plan && plans.length > 0 && (
        <div className="card card-pad">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
            <Layers size={16} aria-hidden /><h3 style={{ flex: 1 }}>Compare</h3>
            <label className="lbl">Compare {plan.label} with{' '}
              <select className="input" style={{ width: 'auto', display: 'inline-block' }} value={cmp} onChange={(e) => setCmp(e.target.value)}>
                <option value="baseline">Original schedule (before disruption)</option>
                {plans.filter((p) => p.planId !== plan.planId).map((p) => <option key={p.planId} value={p.planId}>{p.label}</option>)}</select></label>
          </div>
          <CompareTable h={h} a={plan} b={other} sim={sim.data?.postDisruptionCoverage.weightedCoverage} />
        </div>
      )}

      {plan && <ApprovalDialog plan={plan} open={approve} onClose={() => setApprove(false)} h={h as Household} />}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="btn primary" onClick={() => go('futures')}>Explore alternate futures <ArrowRight size={15} /></button></div>
    </div>
  )
}

function CompareTable({ h, a, b }: { h: Household; a: RecoveryPlan; b: RecoveryPlan | null; sim?: number }) {
  const baseCov = { 0: 0, 1: 0, 2: 0, 3: 0 } as Record<number, number>
  for (const t of h.tasks) if (h.baselineAssignments.some((x) => x.taskId === t.id)) baseCov[t.tier]++
  const row = (label: string, av: string | number, bv: string | number) => (
    <tr><td>{label}</td><td className="mono">{av}</td><td className="mono">{bv}</td><td className="mono" style={{ color: String(av) === String(bv) ? 'var(--ink-3)' : 'var(--primary)', fontWeight: 700 }}>{String(av) === String(bv) ? '=' : 'differs'}</td></tr>)
  const m = a.metrics, n = b?.metrics
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="tbl">
        <thead><tr><th>Metric</th><th>{a.label}</th><th>{b ? b.label : 'Original schedule'}</th><th /></tr></thead>
        <tbody>
          {row('Tier 0 covered', `${m.coveredByTier['0']}/${m.totalByTier['0']}`, n ? `${n.coveredByTier['0']}/${n.totalByTier['0']}` : `${baseCov[0]}/${m.totalByTier['0']}`)}
          {row('Tier 1 covered', `${m.coveredByTier['1']}/${m.totalByTier['1']}`, n ? `${n.coveredByTier['1']}/${n.totalByTier['1']}` : `${baseCov[1]}/${m.totalByTier['1']}`)}
          {row('Total covered', `${m.coveredCount}/${m.totalCount}`, n ? `${n.coveredCount}/${n.totalCount}` : `${h.baselineAssignments.length}/${m.totalCount}`)}
          {row('Uncovered critical', a.uncoveredCriticalTaskIds.length, b ? b.uncoveredCriticalTaskIds.length : 0)}
          {row('Reassignments', m.reassignmentCount, n ? n.reassignmentCount : 0)}
          {row('Displacement (min)', m.displacementMin, n ? n.displacementMin : 0)}
          {row('Max workload (min)', m.maxWorkloadMin, n ? n.maxWorkloadMin : Math.max(...h.members.filter((x) => !x.isDependent).map((x) => x.baselineWorkloadMinutes + h.baselineAssignments.filter((y) => y.memberId === x.id).reduce((s, y) => s + y.endMin - y.startMin, 0))))}
          {row('Solver', `${a.solverStatus} ${a.solverElapsedMs} ms`, b ? `${b.solverStatus} ${b.solverElapsedMs} ms` : '—')}
          {row('Verification violations', a.validation.hardViolations, b ? b.validation.hardViolations : 0)}
        </tbody>
      </table>
    </div>
  )
}

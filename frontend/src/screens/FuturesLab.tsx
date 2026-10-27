import { useRef, useState } from 'react'
import { ArrowLeft, Check, FlaskConical, Loader2, Play, RotateCcw } from 'lucide-react'
import { ScheduleStrip } from '../components/timeline/Timelines'
import { CoverageSummary, StatusPill } from '../components/plans/Plans'
import { Banner, Empty, NumField, PageHeader, TimeField } from '../components/ui/ui'
import { api, ApiFailure } from '../services/api'
import { buildPresets, EVENT_TYPE_LABEL } from '../lib/presets'
import { entityLabel, memberName } from '../lib/graph'
import { fmt, fmtRange, uid } from '../lib/time'
import { selectedPlan, useStore } from '../state/store'
import type { Disruption, Household, RecoveryPlan, SimulationResult } from '../types'

interface Mod { h: Household; events: Disruption[] }
interface Result { plans: RecoveryPlan[]; sim: SimulationResult; ms: number }

export default function FuturesLab() {
  const { draft: h, events, rec, sim, selectedPlanId } = useStore()
  const refPlan = useStore(selectedPlan)
  const { selectPlan, go, editHousehold, setEvents, runScenario, toast } = useStore.getState()
  const [mod, setMod] = useState<Mod | null>(null)
  const [res, setRes] = useState<{ status: 'idle' | 'running' | 'ready' | 'error'; data?: Result; error?: string }>({ status: 'idle' })
  const [pick, setPick] = useState(0)
  const seq = useRef(0)
  const [v, setV] = useState({ member: '', from: 0, to: 0, resource: '', task: '', tier: 0, flex: 30, cap: 1, perm: 'drive', preset: '' })
  if (!h) return null
  if (rec.status !== 'ready' || !refPlan) return (
    <Empty title="A reference recovery is needed" action={<button className="btn primary" onClick={() => go(sim.status === 'ready' ? 'recovery' : 'studio')}>{sim.status === 'ready' ? 'Open Recovery Studio' : 'Open Disruption Studio'}</button>}>
      The Futures Laboratory compares a modified world against a calculated reference plan. Run a scenario and generate recovery first.</Empty>)

  const cur: Mod = mod ?? { h, events }
  const workers = h.members.filter((m) => !m.isDependent)
  const vehicle = h.resources.filter((r) => r.type === 'vehicle')
  const presets = buildPresets(h)
  const changed = mod !== null
  const stage = (fn: (m: Mod) => Mod) => { setMod(fn(structuredClone(cur))); setRes({ status: 'idle' }) }
  const addEv = (e: Omit<Disruption, 'id' | 'confirmed'>) => stage((m) => ({ ...m, events: [...m.events, { ...e, id: uid('cf'), confirmed: true }] }))
  const member = v.member || workers[0]?.id || ''
  const resource = v.resource || h.resources[0]?.id || ''
  const task = v.task || h.tasks[0]?.id || ''
  const t0 = h.tasks.find((t) => t.id === task)

  const run = async () => {
    const m = cur
    const s = ++seq.current
    setRes({ status: 'running' })
    const t = performance.now()
    try {
      const sm = await api.simulate(m.h, 1, m.events, 1)
      const rc = await api.recover(m.h, 1, m.events, 1, { simulationHash: sm.inputHash })
      if (s !== seq.current) return // a newer run superseded this one
      setRes({ status: 'ready', data: { plans: rc.plans, sim: sm, ms: Math.round(performance.now() - t) } }); setPick(0)
    } catch (e) {
      if (s !== seq.current) return
      setRes({ status: 'error', error: (e as ApiFailure).message })
    }
  }
  const out = res.data?.plans[pick] ?? null
  const apply = async () => {
    if (!mod) return
    editHousehold(() => mod.h); setEvents(mod.events)
    toast('info', 'Modified world applied to the main scenario. Recalculating…')
    if (await runScenario()) { setMod(null); setRes({ status: 'idle' }); go('recovery') }
  }
  const evList = cur.events

  const diffRows = out ? h.tasks.map((t) => {
    const a = refPlan.assignments.find((x) => x.taskId === t.id), b = out.assignments.find((x) => x.taskId === t.id)
    const fa = a ? `${memberName(h, a.memberId)} ${fmtRange(a.startMin, a.endMin)}` : 'UNCOVERED'
    const fb = b ? `${memberName((mod?.h ?? h), b.memberId)} ${fmtRange(b.startMin, b.endMin)}` : 'UNCOVERED'
    return { t, fa, fb, diff: fa !== fb }
  }) : []
  const newlyUncovered = out ? out.uncoveredCriticalTaskIds.filter((t) => !refPlan.uncoveredCriticalTaskIds.includes(t)) : []

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <PageHeader eyebrow="06 · Family Futures Laboratory" title="What if…?">
        <button className="btn" onClick={() => { setMod(null); setRes({ status: 'idle' }) }} disabled={!changed}><RotateCcw size={15} /> Reset</button>
        <button className="btn" onClick={() => go('recovery')}><ArrowLeft size={15} /> Return to recovery</button>
        <button className="btn primary" disabled={res.status === 'running'} onClick={() => void run()}>{res.status === 'running' ? <Loader2 size={15} className="spin" /> : <Play size={15} />} Run counterfactual</button>
      </PageHeader>
      <Banner kind="info">Nothing here overwrites your real scenario. The modified world is cloned, re-simulated, re-optimized by CP-SAT and independently re-verified. Use “Apply scenario” only if you want to adopt it.</Banner>

      <div className="card card-pad" aria-labelledby="vars">
        <h3 id="vars"><FlaskConical size={15} aria-hidden /> Change a variable</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginTop: 10 }}>
          <fieldset className="card card-pad" style={{ margin: 0 }}><legend className="lbl">Caregiver availability</legend>
            <div className="field"><label htmlFor="f-m">Member</label><select id="f-m" className="input" value={member} onChange={(e) => setV({ ...v, member: e.target.value })}>{workers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
              <TimeField label="Unavailable from" value={v.from || 880} onChange={(m) => setV({ ...v, from: m })} /><TimeField label="until" value={v.to || 940} onChange={(m) => setV({ ...v, to: m })} /></div>
            <button className="btn sm" style={{ marginTop: 8 }} disabled={(v.to || 940) <= (v.from || 880)} onClick={() => addEv({ type: 'member_unavailable', affectedEntityIds: [member], startMin: v.from || 880, endMin: v.to || 940, reason: `${memberName(h, member)} unavailable ${fmt(v.from || 880)}–${fmt(v.to || 940)}` })}>Add unavailability</button></fieldset>
          <fieldset className="card card-pad" style={{ margin: 0 }}><legend className="lbl">Vehicle availability &amp; resource capacity</legend>
            <div className="field"><label htmlFor="f-r">Resource</label><select id="f-r" className="input" value={resource} onChange={(e) => setV({ ...v, resource: e.target.value })}>{(vehicle.length ? h.resources : h.resources).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'end' }}>
              <button className="btn sm" onClick={() => addEv({ type: 'resource_unavailable', affectedEntityIds: [resource], startMin: h.planningStartMin, endMin: h.planningEndMin, reason: `${entityLabel(h, resource)} unavailable` })}>Make unavailable</button>
              <div style={{ width: 90 }}><NumField label="Capacity" value={v.cap} max={20} onChange={(n) => setV({ ...v, cap: n })} /></div>
              <button className="btn sm" onClick={() => addEv({ type: 'resource_capacity_changed', affectedEntityIds: [resource], startMin: h.planningStartMin, endMin: h.planningEndMin, value: v.cap, reason: `${entityLabel(h, resource)} capacity ${v.cap}` })}>Set capacity</button></div></fieldset>
          <fieldset className="card card-pad" style={{ margin: 0 }}><legend className="lbl">Task urgency &amp; time-window flexibility</legend>
            <div className="field"><label htmlFor="f-t">Task</label><select id="f-t" className="input" value={task} onChange={(e) => setV({ ...v, task: e.target.value })}>{h.tasks.map((t) => <option key={t.id} value={t.id}>{t.title} (tier {t.tier})</option>)}</select></div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'end', flexWrap: 'wrap' }}>
              <div className="field"><label htmlFor="f-tier">New tier</label><select id="f-tier" className="input" value={v.tier} onChange={(e) => setV({ ...v, tier: Number(e.target.value) })}>{[0, 1, 2, 3].map((n) => <option key={n}>{n}</option>)}</select></div>
              <button className="btn sm" onClick={() => stage((m) => ({ ...m, h: { ...m.h, tasks: m.h.tasks.map((t) => (t.id === task ? { ...t, tier: v.tier as 0 | 1 | 2 | 3 } : t)) } }))}>Change priority</button></div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'end', flexWrap: 'wrap' }}>
              <div style={{ width: 110 }}><NumField label="± minutes" value={v.flex} max={180} onChange={(n) => setV({ ...v, flex: n })} /></div>
              <button className="btn sm" onClick={() => stage((m) => ({ ...m, h: { ...m.h, tasks: m.h.tasks.map((t) => (t.id === task ? { ...t, earliestStartMin: Math.max(0, t.earliestStartMin - v.flex), latestEndMin: Math.min(1440, t.latestEndMin + v.flex) } : t)) } }))}>Widen window</button>
              <button className="btn sm" onClick={() => stage((m) => ({ ...m, h: { ...m.h, tasks: m.h.tasks.map((t) => (t.id === task ? { ...t, earliestStartMin: Math.min(t.latestEndMin - 5, t.earliestStartMin + v.flex), latestEndMin: Math.max(t.earliestStartMin + 5, t.latestEndMin - v.flex) } : t)) } }))}>Narrow window</button></div>
            {t0 && <div className="mono muted" style={{ fontSize: 11.5, marginTop: 6 }}>current window {fmtRange((mod?.h ?? h).tasks.find((x) => x.id === task)!.earliestStartMin, (mod?.h ?? h).tasks.find((x) => x.id === task)!.latestEndMin)}</div>}</fieldset>
          <fieldset className="card card-pad" style={{ margin: 0 }}><legend className="lbl">Assignment restrictions &amp; secondary disruption</legend>
            <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
              <div className="field"><label htmlFor="f-p">Permission</label><select id="f-p" className="input" value={v.perm} onChange={(e) => setV({ ...v, perm: e.target.value })}><option>drive</option><option>pickup_authorized</option></select></div>
              <button className="btn sm" onClick={() => stage((m) => ({ ...m, h: { ...m.h, members: m.h.members.map((x) => (x.id === member ? { ...x, permissions: x.permissions.filter((p) => p !== v.perm) } : x)) } }))}>Remove from {memberName(h, member)}</button></div>
            <div className="field" style={{ marginTop: 10 }}><label htmlFor="f-pre">Secondary disruption</label>
              <select id="f-pre" className="input" value={v.preset} onChange={(e) => setV({ ...v, preset: e.target.value })}><option value="">— choose —</option>{presets.map((p) => <option key={p.key} value={p.key}>{p.title}</option>)}</select></div>
            <button className="btn sm" style={{ marginTop: 8 }} disabled={!v.preset} onClick={() => { const p = presets.find((x) => x.key === v.preset)!; stage((m) => ({ ...m, events: [...m.events, ...p.events.map((e) => ({ ...e, id: uid('cf'), confirmed: true }))] })) }}>Add secondary disruption</button></fieldset>
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="eyebrow">Modified scenario events ({evList.length}){changed ? ' · modified' : ' · same as reference'}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            {evList.map((e) => { const isNew = !events.some((x) => x.id === e.id); return (
              <span key={e.id} className={`chip ${isNew ? 'warn' : ''}`}>{isNew ? '+ ' : ''}{EVENT_TYPE_LABEL[e.type]}: {e.affectedEntityIds.map((i) => entityLabel(cur.h, i)).join(', ')} {fmtRange(e.startMin, e.endMin)}
                {isNew && <button aria-label="Remove" onClick={() => stage((m) => ({ ...m, events: m.events.filter((x) => x.id !== e.id) }))}>×</button>}</span>) })}
            {JSON.stringify(cur.h) !== JSON.stringify(h) && <span className="chip warn">Household variables modified</span>}
          </div>
        </div>
      </div>

      {res.status === 'error' && <Banner kind="bad">Counterfactual failed: {res.error} <button className="btn sm" onClick={() => void run()}>Retry</button></Banner>}
      {res.status === 'running' && <Banner kind="info"><Loader2 size={15} className="spin" /> Re-simulating and re-optimizing the modified world…</Banner>}
      {newlyUncovered.length > 0 && out && (
        <Banner kind="bad"><b>Different result:</b> {newlyUncovered.map((t) => h.tasks.find((x) => x.id === t)?.title).join(', ')} {newlyUncovered.length === 1 ? 'is' : 'are'} now uncovered. {out.explanations.find((e) => e.taskId === newlyUncovered[0] && e.kind === 'task_uncovered')?.text}</Banner>)}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 14 }}>
        <section className="card card-pad" aria-label="Reference scenario">
          <div className="eyebrow">Reference scenario</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '4px 0 8px' }}>
            {rec.data && rec.data.plans.length > 1 ? (
              <label className="lbl">Reference plan <select className="input" style={{ width: 'auto' }} value={selectedPlanId ?? ''} onChange={(e) => selectPlan(e.target.value)}>{rec.data.plans.map((p) => <option key={p.planId} value={p.planId}>{p.label}</option>)}</select></label>
            ) : <b>{refPlan.label}</b>}
            <StatusPill plan={refPlan} /></div>
          <ScheduleStrip h={h} assignments={refPlan.assignments} uncovered={refPlan.uncoveredTaskIds} events={events} changedTaskIds={refPlan.changedTaskIds} compact />
          <div style={{ marginTop: 10 }}><CoverageSummary m={refPlan.metrics} uncoveredCritical={refPlan.uncoveredCriticalTaskIds} /></div>
        </section>
        <section className="card card-pad" aria-label="Modified future scenario">
          <div className="eyebrow">Modified future scenario</div>
          {!out && <p className="muted" style={{ marginTop: 8 }}>{res.status === 'running' ? 'Calculating…' : changed ? 'Press “Run counterfactual” to calculate this world.' : 'Change a variable above, then run.'}</p>}
          {out && res.data && (<>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '4px 0 8px' }}>
              {res.data.plans.length > 1 ? <label className="lbl">Plan <select className="input" style={{ width: 'auto' }} value={pick} onChange={(e) => setPick(Number(e.target.value))}>{res.data.plans.map((p, i) => <option key={p.planId} value={i}>{p.label}</option>)}</select></label> : <b>{out.label}</b>}
              <StatusPill plan={out} /></div>
            <ScheduleStrip h={mod?.h ?? h} assignments={out.assignments} uncovered={out.uncoveredTaskIds} events={cur.events} changedTaskIds={out.changedTaskIds} compact />
            <div style={{ marginTop: 10 }}><CoverageSummary m={out.metrics} uncoveredCritical={out.uncoveredCriticalTaskIds} /></div>
            <p className="mono muted" style={{ fontSize: 11.5 }}>solver {out.solverStatus} · {out.solverElapsedMs} ms · verification {out.validation.overallStatus} ({out.validation.hardViolations} violations) · round trip {res.data.ms} ms</p>
          </>)}
        </section>
      </div>

      {out && (
        <section className="card card-pad" aria-label="Differences">
          <h3 style={{ marginBottom: 8 }}>What changed between the two worlds</h3>
          <table className="tbl"><thead><tr><th>Responsibility</th><th>Reference</th><th>Modified</th><th /></tr></thead>
            <tbody>{diffRows.map((r) => <tr key={r.t.id}><td><b>{r.t.title}</b></td><td className="mono">{r.fa}</td><td className="mono">{r.fb}</td><td>{r.diff ? <span className="chip warn">differs</span> : <span className="chip">same</span>}</td></tr>)}</tbody></table>
          <dl className="kv mono" style={{ marginTop: 10, fontSize: 12 }}>
            <dt>Weighted coverage</dt><dd>{Math.round(refPlan.metrics.weightedCoverage * 100)}% → {Math.round(out.metrics.weightedCoverage * 100)}%</dd>
            <dt>Uncovered critical</dt><dd>{refPlan.uncoveredCriticalTaskIds.length} → {out.uncoveredCriticalTaskIds.length}</dd>
            <dt>Reassignments</dt><dd>{refPlan.metrics.reassignmentCount} → {out.metrics.reassignmentCount}</dd>
            <dt>Workload Gini</dt><dd>{refPlan.metrics.workloadGini} → {out.metrics.workloadGini}</dd>
            <dt>Max workload</dt><dd>{refPlan.metrics.maxWorkloadMin} → {out.metrics.maxWorkloadMin} min</dd>
          </dl>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn primary" disabled={!changed} onClick={() => void apply()}><Check size={15} /> Apply scenario</button>
            <span className="muted" style={{ alignSelf: 'center', fontSize: 12.5 }}>Applying replaces your current household and scenario with the modified one and recalculates.</span>
          </div>
        </section>
      )}
    </div>
  )
}

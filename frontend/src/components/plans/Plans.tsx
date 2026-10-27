import { useMemo, useState } from 'react'
import { AlertTriangle, BadgeCheck, CheckCircle2, ChevronRight, Hand, Pin, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react'
import type { Household, PlanMetrics, RecoveryPlan, ValidationReport } from '../../types'
import { entityLabel, memberName } from '../../lib/graph'
import { fmt, fmtRange } from '../../lib/time'
import { useStore } from '../../state/store'
import { Modal } from '../ui/ui'

export function planTone(p: { validation: ValidationReport; solverStatus: string }): 'ok' | 'warn' | 'bad' {
  if (p.validation.overallStatus === 'invalid' || p.solverStatus === 'MODEL_INVALID' || p.solverStatus === 'UNKNOWN' || p.solverStatus === 'INFEASIBLE') return 'bad'
  return p.validation.completeness === 'partial' ? 'warn' : 'ok'
}

export function StatusPill({ plan }: { plan: RecoveryPlan }) {
  const tone = planTone(plan)
  const Icon = tone === 'ok' ? ShieldCheck : tone === 'warn' ? AlertTriangle : ShieldAlert
  return <span className={`chip ${tone}`} style={{ fontSize: 12.5, padding: '4px 11px' }}><Icon size={14} aria-hidden /> {plan.statusLabel}</span>
}

export function VerificationPanel({ plan }: { plan: RecoveryPlan }) {
  const v = plan.validation
  const groups = useMemo(() => {
    const m = new Map<string, typeof v.checks>()
    for (const c of v.checks) m.set(c.ruleId, [...(m.get(c.ruleId) ?? []), c])
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [v])
  return (
    <div className="card card-pad" aria-label="Independent verification">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <BadgeCheck size={18} color="var(--primary)" aria-hidden />
        <h3>Independent verification</h3>
        <span className={`chip ${v.overallStatus === 'valid' ? 'ok' : 'bad'}`}>{v.overallStatus === 'valid' ? '✓ 0 hard violations' : `✗ ${v.hardViolations} hard violation(s)`}</span>
      </div>
      <dl className="kv mono" style={{ margin: '10px 0', fontSize: 12 }}>
        <dt>input hash</dt><dd>{v.inputHash}</dd>
        <dt>current hash</dt><dd>{v.expectedHash} {v.inputHash === v.expectedHash ? '✓ match' : '✗ STALE'}</dd>
        <dt>verified at</dt><dd>{v.verifiedAt}</dd>
        <dt>completeness</dt><dd>{v.completeness.replace('_', ' ')}</dd>
        <dt>solver</dt><dd>{plan.solverStatus} · {plan.solverElapsedMs} ms</dd>
      </dl>
      <p className="muted" style={{ fontSize: 12, margin: '0 0 8px' }}>
        A separate module re-checks every rule from raw household data — it shares no code with the CP-SAT model. Expand a rule to read its evidence.
      </p>
      <div style={{ display: 'grid', gap: 4 }}>
        {groups.map(([rule, cs]) => {
          const fails = cs.filter((c) => !c.passed)
          return (
            <details key={rule} open={fails.length > 0} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '6px 10px', background: fails.length ? 'var(--bad-bg)' : '#fff' }}>
              <summary style={{ cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center', listStyle: 'none' }}>
                {fails.length ? <XCircle size={15} color="var(--bad)" aria-label="failed" /> : <CheckCircle2 size={15} color="var(--ok)" aria-label="passed" />}
                <span className="mono" style={{ fontWeight: 600 }}>{rule}</span>
                <span style={{ fontSize: 12.5, flex: 1 }}>{cs[0].description}</span>
                <span className="mono muted" style={{ fontSize: 11 }}>{cs.length - fails.length}/{cs.length}</span>
              </summary>
              <ul style={{ margin: '6px 0 2px', paddingLeft: 20, fontSize: 12 }}>
                {cs.map((c, i) => <li key={i} style={{ color: c.passed ? 'var(--ink-2)' : 'var(--bad)' }}>{c.passed ? '✓' : '✗'} {c.evidence}{c.errorCode ? <span className="mono"> [{c.errorCode}]</span> : null}</li>)}
              </ul>
            </details>
          )
        })}
      </div>
      {v.warnings.map((w) => <p key={w} className="chip warn" style={{ marginTop: 8 }}>{w}</p>)}
    </div>
  )
}

export function CoverageSummary({ m, uncoveredCritical }: { m: PlanMetrics; uncoveredCritical: string[] }) {
  const tiers = ['0', '1', '2', '3']
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {tiers.map((t) => {
        const tot = m.totalByTier[t], cov = m.coveredByTier[t]
        if (!tot) return null
        return (
          <div key={t} style={{ display: 'grid', gridTemplateColumns: '86px 1fr 46px', gap: 8, alignItems: 'center', fontSize: 12.5 }}>
            <span className="mono">Tier {t}</span>
            <div style={{ height: 10, background: '#e6ebf1', borderRadius: 6, overflow: 'hidden' }} role="img" aria-label={`Tier ${t}: ${cov} of ${tot} covered`}>
              <div style={{ width: `${(cov / tot) * 100}%`, height: '100%', background: cov === tot ? 'var(--ok)' : Number(t) <= 1 ? 'var(--bad)' : 'var(--warn)' }} />
            </div>
            <span className="mono">{cov}/{tot}</span>
          </div>
        )
      })}
      <div className="mono muted" style={{ fontSize: 11.5 }}>weighted coverage {(m.weightedCoverage * 100).toFixed(0)}% · uncovered critical: {uncoveredCritical.length}</div>
    </div>
  )
}

export function AssignmentList({ plan, h, baselineH, selectedId, onSelect }: {
  plan: RecoveryPlan; h: Household; baselineH: Household; selectedId: string | null; onSelect: (id: string) => void
}) {
  const reject = useStore((s) => s.rejectAssignment)
  const pin = useStore((s) => s.pinAssignment)
  const busy = useStore((s) => s.rec.status === 'calculating')
  const [modify, setModify] = useState<string | null>(null)
  const [mm, setMm] = useState('')
  const base = new Map(baselineH.baselineAssignments.map((a) => [a.taskId, a]))
  const rows = [...h.tasks].sort((a, b) => (base.get(a.id)?.startMin ?? a.earliestStartMin) - (base.get(b.id)?.startMin ?? b.earliestStartMin))
  const asg = new Map(plan.assignments.map((a) => [a.taskId, a]))
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="tbl">
        <caption className="sr-only">Proposed assignments</caption>
        <thead><tr><th>Responsibility</th><th>Was</th><th>Proposed</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>
          {rows.map((t) => {
            const a = asg.get(t.id), b = base.get(t.id)
            const changed = plan.changedTaskIds.includes(t.id)
            return (
              <tr key={t.id} style={{ background: selectedId === t.id ? 'var(--surface-2)' : undefined }}>
                <td><button className="btn sm ghost" style={{ padding: 0, textAlign: 'left' }} onClick={() => onSelect(t.id)} aria-label={`Inspect ${t.title}`}>
                  <b>{t.title}</b> <span className="chip dark mono" style={{ marginLeft: 4 }}>T{t.tier}</span><ChevronRight size={14} aria-hidden /></button></td>
                <td className="mono" style={{ fontSize: 12 }}>{b ? `${memberName(baselineH, b.memberId)} ${fmt(b.startMin)}` : '—'}</td>
                <td className="mono" style={{ fontSize: 12 }}>{a ? `${memberName(h, a.memberId)} ${fmtRange(a.startMin, a.endMin)}` : <span style={{ color: 'var(--bad)', fontWeight: 700 }}>UNCOVERED</span>}</td>
                <td>{!a ? <span className="chip bad">⚠ needs a human</span> : changed ? <span className="chip ok">↺ reassigned</span> : <span className="chip">unchanged</span>}
                  {a && plan.pendingConsentTaskIds.includes(t.id) && <span className="chip warn" style={{ marginLeft: 4 }}><Hand size={11} aria-hidden /> consent pending</span>}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {a && (<>
                    <button className="btn sm danger" disabled={busy} onClick={() => void reject(t.id, a.memberId)} aria-label={`Reject ${memberName(h, a.memberId)} for ${t.title}`}>Reject</button>{' '}
                    <button className="btn sm" disabled={busy} onClick={() => { setModify(t.id); setMm(a.memberId) }} aria-label={`Modify assignee for ${t.title}`}><Pin size={12} aria-hidden /> Modify</button>
                  </>)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <Modal open={!!modify} onClose={() => setModify(null)} title="Modify a proposed assignment">
        {modify && (() => {
          const t = h.tasks.find((x) => x.id === modify)!
          return (
            <div style={{ display: 'grid', gap: 12 }}>
              <p>Pin <b>{t.title}</b> to a specific person. DOMINO re-runs the solver with this as a constraint and re-verifies — if the choice is illegal or infeasible, the task will come back uncovered with the reason.</p>
              <div className="field"><label htmlFor="pin-m">Assignee</label>
                <select id="pin-m" className="input" value={mm} onChange={(e) => setMm(e.target.value)}>
                  {h.members.filter((m) => !m.isDependent).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn" onClick={() => setModify(null)}>Cancel</button>
                <button className="btn primary" onClick={() => { void pin(modify, mm); setModify(null) }}>Re-optimize with this constraint</button>
              </div>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}

export function ExplanationDrawer({ plan, h, taskId }: { plan: RecoveryPlan; h: Household; taskId: string | null }) {
  if (!taskId) return <p className="muted">Select a responsibility to see why it was assigned, left uncovered, or which alternatives were rejected.</p>
  const exp = plan.explanations.find((e) => e.taskId === taskId)
  const alts = plan.rejectedAlternatives[taskId] ?? []
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <h3>{entityLabel(h, taskId)}</h3>
      {exp ? <p style={{ margin: 0 }}>{exp.text}</p> : <p className="muted">No explanation record for this task.</p>}
      {exp && <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{exp.codes.map((c) => <span key={c} className="chip mono">{c}</span>)}</div>}
      <div>
        <div className="eyebrow">Rejected alternatives ({alts.length})</div>
        {alts.length === 0 && <p className="muted" style={{ margin: '4px 0' }}>No other candidates.</p>}
        <ul style={{ margin: '4px 0', paddingLeft: 18, fontSize: 12.5 }}>
          {alts.map((a) => <li key={a.memberId}><b>{a.memberName}</b> — {a.text.replace(/^[^:]+: /, '')} <span className="mono muted">[{a.codes.join(', ')}]</span></li>)}
        </ul>
      </div>
    </div>
  )
}

export function ApprovalDialog({ plan, open, onClose, h }: { plan: RecoveryPlan; open: boolean; onClose: () => void; h: Household }) {
  const approve = useStore((s) => s.approvePlan)
  const receipt = useStore((s) => s.receipt)
  const [ackU, setAckU] = useState(false), [ackC, setAckC] = useState(false), [sure, setSure] = useState(false), [busy, setBusy] = useState(false)
  const needU = plan.uncoveredCriticalTaskIds.length > 0, needC = plan.pendingConsentTaskIds.length > 0
  const ready = sure && (!needU || ackU) && (!needC || ackC) && plan.validation.overallStatus === 'valid'
  return (
    <Modal open={open} onClose={onClose} title="Approve plan (simulation only)">
      <div style={{ display: 'grid', gap: 12 }}>
        <StatusPill plan={plan} />
        <p style={{ margin: 0 }}>Approving records an <b>internal simulation receipt</b>. DOMINO does not message, book, or instruct anyone.</p>
        {needU && (
          <div className="banner bad" role="alert"><ShieldAlert size={17} aria-hidden /><div><b>Unresolved critical responsibilities:</b> {plan.uncoveredCriticalTaskIds.map((t) => entityLabel(h, t)).join(', ')}.
            No valid caregiver exists for {plan.uncoveredCriticalTaskIds.length === 1 ? 'it' : 'them'} under the stated rules — a human must decide.</div></div>
        )}
        {needC && <div className="banner warn"><Hand size={17} aria-hidden /><div>Consent still required from the proposed assignee for: {plan.pendingConsentTaskIds.map((t) => entityLabel(h, t)).join(', ')}.</div></div>}
        {needU && <label style={{ display: 'flex', gap: 8 }}><input type="checkbox" checked={ackU} onChange={(e) => setAckU(e.target.checked)} /> I understand critical tasks remain uncovered and will handle them myself.</label>}
        {needC && <label style={{ display: 'flex', gap: 8 }}><input type="checkbox" checked={ackC} onChange={(e) => setAckC(e.target.checked)} /> I understand assignees must still consent.</label>}
        <label style={{ display: 'flex', gap: 8 }}><input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} /> I, a human, approve this plan as a simulation.</label>
        {receipt && receipt.planId === plan.planId ? (
          <div className="banner ok" role="status"><CheckCircle2 size={17} aria-hidden /><div><b>Receipt {receipt.receiptId}</b> · {receipt.approvedAt}<br />{receipt.note}</div></div>
        ) : (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn primary" disabled={!ready || busy} onClick={async () => { setBusy(true); await approve(plan, { unresolved: ackU, consent: ackC }); setBusy(false) }}>Approve verified plan</button>
          </div>
        )}
      </div>
    </Modal>
  )
}

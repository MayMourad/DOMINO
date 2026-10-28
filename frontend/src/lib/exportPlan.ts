import type { ApprovalReceipt, Disruption, Household, RecoveryPlan } from '../types'
import { fmtRange } from './time'

const name = (h: Household, id: string) => h.members.find((m) => m.id === id)?.name ?? id
const title = (h: Household, id: string) => h.tasks.find((t) => t.id === id)?.title ?? id

export function planSummary(h: Household, events: Disruption[], plan: RecoveryPlan, receipt: ApprovalReceipt | null) {
  return {
    generatedBy: 'DOMINO — Family Resilience Intelligence System (simulation only; nothing was sent to anyone)',
    household: h.name, date: h.simulationDate, timezone: h.timezone,
    scenario: events.map((e) => ({ type: e.type, entities: e.affectedEntityIds, window: fmtRange(e.startMin, e.endMin), reason: e.reason })),
    plan: { id: plan.planId, label: plan.label, status: plan.statusLabel, solverStatus: plan.solverStatus, inputHash: plan.inputHash },
    assignments: plan.assignments.map((a) => ({
      task: title(h, a.taskId), assignee: name(h, a.memberId), time: fmtRange(a.startMin, a.endMin),
      resources: a.resourceIds.map((r) => h.resources.find((x) => x.id === r)?.name ?? r), consentPending: plan.pendingConsentTaskIds.includes(a.taskId),
    })),
    uncovered: plan.uncoveredTaskIds.map((t) => ({ task: title(h, t), critical: plan.uncoveredCriticalTaskIds.includes(t), why: plan.explanations.find((e) => e.taskId === t)?.text })),
    verification: { status: plan.validation.overallStatus, hardViolations: plan.validation.hardViolations, verifiedAt: plan.validation.verifiedAt },
    approval: receipt && receipt.planId === plan.planId ? receipt : null,
  }
}

export function download(filename: string, mime: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: mime }))
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
}

const pad = (n: number) => String(n).padStart(2, '0')
const ics = (date: string, min: number) => `${date.replace(/-/g, '')}T${pad(Math.floor(min / 60))}${pad(min % 60)}00`

/** Calendar file of the proposed assignments. It is a file for the user to open — DOMINO never sends invitations. */
export function planToIcs(h: Household, plan: RecoveryPlan): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DOMINO//Family Resilience//EN', 'CALSCALE:GREGORIAN']
  for (const a of plan.assignments) {
    lines.push('BEGIN:VEVENT', `UID:${plan.planId}-${a.taskId}@domino.local`, `DTSTAMP:${ics(h.simulationDate, 0)}Z`,
      `DTSTART;TZID=Asia/Dubai:${ics(h.simulationDate, a.startMin)}`, `DTEND;TZID=Asia/Dubai:${ics(h.simulationDate, a.endMin)}`,
      `SUMMARY:${title(h, a.taskId)} — ${name(h, a.memberId)}`,
      `DESCRIPTION:Proposed by DOMINO (simulation). ${plan.pendingConsentTaskIds.includes(a.taskId) ? 'Assignee consent still required.' : ''}`, 'END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

import type { Disruption, Household } from '../types'
import { fmt, uid } from './time'

export interface Preset { key: string; title: string; blurb: string; events: Disruption[] }

const ev = (type: Disruption['type'], ids: string[], s: number, e: number, reason: string, value?: number): Disruption => ({
  id: uid('ev'), type, affectedEntityIds: ids, startMin: s, endMin: e, reason, value: value ?? null, confirmed: false,
})

/** Fixture-appropriate presets derived from the household's own data (nothing hardcoded per person). */
export function buildPresets(h: Household): Preset[] {
  const load = (id: string) => h.baselineAssignments.filter((a) => a.memberId === id).length
  const workers = h.members.filter((m) => !m.isDependent).sort((a, b) => load(b.id) - load(a.id))
  const primary = workers[0]
  const second = workers.find((m) => m.id !== primary?.id && m.skills.includes('driving')) ?? workers[1]
  const vehicle = h.resources.find((r) => r.type === 'vehicle')
  const critical = [...h.tasks].filter((t) => t.tier === 0).sort((a, b) => a.earliestStartMin - b.earliestStartMin)[0]
  const out: Preset[] = []
  const until = Math.min(1080, h.planningEndMin)
  if (primary) out.push({
    key: 'primary-out', title: `${primary.name} unavailable`,
    blurb: `${primary.name} cannot help from ${fmt(h.planningStartMin)} until ${fmt(until)}.`,
    events: [ev('member_unavailable', [primary.id], h.planningStartMin, until, `${primary.name} unavailable until ${fmt(until)}`)],
  })
  if (vehicle) out.push({
    key: 'vehicle-out', title: 'Family vehicle unavailable',
    blurb: `${vehicle.name} cannot be used for the whole planning window.`,
    events: [ev('resource_unavailable', [vehicle.id], h.planningStartMin, h.planningEndMin, `${vehicle.name} unavailable`)],
  })
  if (second && critical) out.push({
    key: 'caregiver-conflict', title: 'Caregiver schedule conflict',
    blurb: `${second.name} is committed elsewhere during “${critical.title}”.`,
    events: [ev('member_unavailable', [second.id], critical.earliestStartMin, critical.latestEndMin, `${second.name} conflict during ${critical.title}`)],
  })
  if (critical) out.push({
    key: 'critical-delayed', title: 'Critical task delayed',
    blurb: `“${critical.title}” moves 30 minutes later.`,
    events: [ev('task_rescheduled', [critical.id], critical.earliestStartMin + 30, critical.latestEndMin + 30, `${critical.title} delayed 30 min`)],
  })
  if (primary && second && critical) out.push({
    key: 'two-simultaneous', title: 'Two simultaneous disruptions',
    blurb: `${primary.name} unavailable and ${second.name} committed during “${critical.title}”.`,
    events: [
      ev('member_unavailable', [primary.id], h.planningStartMin, until, `${primary.name} unavailable until ${fmt(until)}`),
      ev('member_unavailable', [second.id], critical.earliestStartMin, critical.latestEndMin, `${second.name} conflict during ${critical.title}`),
    ],
  })
  return out
}

export const EVENT_TYPE_LABEL: Record<Disruption['type'], string> = {
  member_unavailable: 'Member unavailable',
  resource_unavailable: 'Resource unavailable',
  task_rescheduled: 'Task rescheduled',
  availability_changed: 'Availability changed',
  resource_capacity_changed: 'Resource capacity changed',
}

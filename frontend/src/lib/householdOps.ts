import type { FamilyMember, Household, HouseholdResource } from '../types'

const nextId = (prefix: string, used: string[]) => {
  let n = used.filter((u) => u.startsWith(prefix)).length + 1
  while (used.includes(`${prefix}${String(n).padStart(2, '0')}`)) n++
  return `${prefix}${String(n).padStart(2, '0')}`
}
const allIds = (h: Household) => [...h.members, ...h.tasks, ...h.resources, ...h.milestones, ...h.locations].map((x) => x.id)

export function blankMember(h: Household): FamilyMember {
  return {
    id: nextId('P', allIds(h)), name: 'New member', age: 30, role: 'adult', isDependent: false, skills: [], permissions: [], restrictions: [],
    availability: [{ startMin: h.planningStartMin, endMin: h.planningEndMin }], homeLocationId: h.locations[0]?.id ?? 'L01',
    authorizedDependentIds: [], baselineWorkloadMinutes: 0,
  }
}

export function blankResource(h: Household): HouseholdResource {
  return {
    id: nextId('R', allIds(h)), name: 'New resource', type: 'resource', capacity: 1, exclusive: true,
    availability: [{ startMin: h.planningStartMin, endMin: h.planningEndMin }], unavailableWindows: [], locationId: h.locations[0]?.id ?? 'L01',
    restrictions: [], allowedMemberIds: null,
  }
}

/** Removal keeps the household referentially valid: every reference to the removed entity is cleaned up. */
export function removeEntity(h: Household, id: string): Household {
  const d: Household = structuredClone(h)
  d.members = d.members.filter((m) => m.id !== id).map((m) => ({ ...m, authorizedDependentIds: m.authorizedDependentIds.filter((x) => x !== id) }))
  d.tasks = d.tasks.filter((t) => t.id !== id).map((t) => ({
    ...t,
    predecessorTaskIds: t.predecessorTaskIds.filter((x) => x !== id),
    requiredDependentIds: t.requiredDependentIds.filter((x) => x !== id),
    excludedMemberIds: t.excludedMemberIds.filter((x) => x !== id),
    eligibleMemberIds: t.eligibleMemberIds ? t.eligibleMemberIds.filter((x) => x !== id) : t.eligibleMemberIds,
  }))
  d.resources = d.resources.filter((r) => r.id !== id).map((r) => ({ ...r, allowedMemberIds: r.allowedMemberIds ? r.allowedMemberIds.filter((x) => x !== id) : r.allowedMemberIds }))
  d.milestones = d.milestones.map((m) => ({ ...m, enabledByTaskIds: m.enabledByTaskIds.filter((x) => x !== id), dependentId: m.dependentId === id ? null : m.dependentId }))
  d.baselineAssignments = d.baselineAssignments.filter((a) => a.taskId !== id && a.memberId !== id).map((a) => ({ ...a, resourceIds: a.resourceIds.filter((x) => x !== id) }))
  return d
}

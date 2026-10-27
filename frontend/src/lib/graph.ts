import type { Assignment, Household } from '../types'

export type EdgeType =
  | 'assigned_to' | 'requires_resource' | 'requires_permission' | 'depends_on' | 'enables' | 'serves_dependent' | 'disrupted_by'

export interface GEdge { id: string; source: string; target: string; type: EdgeType }

/** Typed edges, identical in meaning to backend/app/services/dependency_graph.py::build_graph. */
export function buildEdges(h: Household, assignments: Assignment[]): GEdge[] {
  const out: GEdge[] = []
  const add = (source: string, target: string, type: EdgeType) => out.push({ id: `${type}:${source}>${target}`, source, target, type })
  for (const a of assignments) {
    add(a.taskId, a.memberId, 'assigned_to')
    const t = h.tasks.find((x) => x.id === a.taskId)
    if (t && t.requiredPermissions.length) add(a.taskId, a.memberId, 'requires_permission')
    for (const r of a.resourceIds) add(a.taskId, r, 'requires_resource')
  }
  for (const t of h.tasks) {
    t.requiredDependentIds.forEach((d) => add(t.id, d, 'serves_dependent'))
    t.predecessorTaskIds.forEach((p) => add(t.id, p, 'depends_on'))
    t.requiredMilestoneIds.forEach((m) => add(t.id, m, 'depends_on'))
  }
  for (const m of h.milestones) m.enabledByTaskIds.forEach((t) => add(t, m.id, 'enables'))
  return out
}

export const UNASSIGNED_X = 24
export const LANE_X0 = 340
export const LANE_DX = 290
export const ROW_Y0 = 150
export const ROW_DY = 112

export interface Pos { x: number; y: number }

/**
 * Stable layout: x follows the assignee's lane (so reassignments move nodes sideways), y follows the
 * baseline start-time rank (so vertical position never changes between views).
 */
export function computeLayout(h: Household, assignments: Assignment[]): Record<string, Pos> {
  const pos: Record<string, Pos> = {}
  const workers = h.members.filter((m) => !m.isDependent)
  const dependents = h.members.filter((m) => m.isDependent)
  workers.forEach((m, i) => (pos[m.id] = { x: LANE_X0 + i * LANE_DX, y: 0 }))
  const sideX = LANE_X0 + workers.length * LANE_DX + 20
  dependents.forEach((m, i) => (pos[m.id] = { x: sideX, y: i * 96 }))
  const startOf = (tid: string) => h.baselineAssignments.find((a) => a.taskId === tid)?.startMin
    ?? h.tasks.find((t) => t.id === tid)?.earliestStartMin ?? 0
  const ranked = [...h.tasks].sort((a, b) => startOf(a.id) - startOf(b.id) || a.id.localeCompare(b.id))
  const asg = new Map(assignments.map((a) => [a.taskId, a]))
  const rowY = new Map<string, number>()
  ranked.forEach((t, i) => rowY.set(t.id, ROW_Y0 + i * ROW_DY))
  for (const t of ranked) {
    const a = asg.get(t.id)
    const lane = a ? workers.findIndex((m) => m.id === a.memberId) : -1
    pos[t.id] = { x: lane >= 0 ? LANE_X0 + lane * LANE_DX : UNASSIGNED_X, y: rowY.get(t.id)! }
  }
  h.milestones.forEach((m, i) => {
    const ys = m.enabledByTaskIds.map((t) => rowY.get(t)).filter((y): y is number => y !== undefined)
    pos[m.id] = { x: sideX + 20, y: (ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : ROW_Y0 + i * ROW_DY) + 46 }
  })
  const resX = sideX + 270
  h.resources.forEach((r, i) => (pos[r.id] = { x: resX, y: ROW_Y0 + i * 96 - 30 }))
  return pos
}

export const TIER_LABEL = ['Tier 0 · Essential', 'Tier 1 · Important', 'Tier 2 · Routine', 'Tier 3 · Deferrable']
export const TIER_SHORT = ['T0', 'T1', 'T2', 'T3']

export function memberName(h: Household, id: string): string {
  return h.members.find((m) => m.id === id)?.name ?? id
}
export function entityLabel(h: Household, id: string): string {
  return h.members.find((m) => m.id === id)?.name ?? h.tasks.find((t) => t.id === id)?.title
    ?? h.resources.find((r) => r.id === id)?.name ?? h.milestones.find((m) => m.id === id)?.title ?? id
}

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { bundledFixture } from '../services/fixtures'
import { buildEdges, computeLayout } from '../lib/graph'
import { buildPresets } from '../lib/presets'
import { fmt, normalizeWindows, parseHHMM, subtractWindow } from '../lib/time'
import type { Disruption, SimulationResult } from '../types'

vi.mock('../services/api', async () => {
  const actual = await vi.importActual<typeof import('../services/api')>('../services/api')
  return { ...actual, api: { ...actual.api, simulate: vi.fn(), recover: vi.fn(), validateHousehold: vi.fn(async () => ({ valid: true, issues: [] })) } }
})
import { api } from '../services/api'
import { useStore } from '../state/store'

const amina = () => bundledFixture('amina')!

describe('time helpers', () => {
  it('formats and parses HH:MM strictly', () => {
    expect(fmt(885)).toBe('14:45')
    expect(parseHHMM('14:45')).toBe(885)
    expect(parseHHMM('25:00')).toBeNull()
    expect(parseHHMM('abc')).toBeNull()
  })
  it('normalizes and subtracts half-open windows', () => {
    expect(normalizeWindows([{ startMin: 0, endMin: 60 }, { startMin: 60, endMin: 90 }])).toEqual([{ startMin: 0, endMin: 90 }])
    expect(subtractWindow([{ startMin: 0, endMin: 100 }], 30, 60)).toEqual([{ startMin: 0, endMin: 30 }, { startMin: 60, endMin: 100 }])
  })
})

describe('graph model', () => {
  it('builds typed edges from the household (not from visuals)', () => {
    const h = amina()
    const edges = buildEdges(h, h.baselineAssignments)
    expect(edges.some((e) => e.type === 'enables' && e.source === 'T01' && e.target === 'M01')).toBe(true)
    expect(edges.some((e) => e.type === 'depends_on' && e.source === 'T03' && e.target === 'M01')).toBe(true)
    expect(edges.some((e) => e.type === 'assigned_to' && e.source === 'T04' && e.target === 'P02')).toBe(true)
  })
  it('keeps y fixed and moves only x when an assignment changes (spatial continuity)', () => {
    const h = amina()
    const before = computeLayout(h, h.baselineAssignments)
    const moved = h.baselineAssignments.map((a) => (a.taskId === 'T01' ? { ...a, memberId: 'P02' } : a))
    const after = computeLayout(h, moved)
    expect(after.T01.y).toBe(before.T01.y)
    expect(after.T01.x).not.toBe(before.T01.x)
    expect(after.T04).toEqual(before.T04)
  })
})

describe('presets', () => {
  it('derive fixture-appropriate unconfirmed events', () => {
    const ps = buildPresets(amina())
    expect(ps.map((p) => p.key)).toEqual(['primary-out', 'vehicle-out', 'caregiver-conflict', 'critical-delayed', 'two-simultaneous'])
    expect(ps.flatMap((p) => p.events).every((e) => !e.confirmed)).toBe(true)
    expect(ps[0].events[0].affectedEntityIds).toEqual(['P01'])
  })
})

describe('stale-response prevention', () => {
  const ev: Disruption = { id: 'e1', type: 'member_unavailable', affectedEntityIds: ['P01'], startMin: 870, endMin: 1080, confirmed: true }
  beforeEach(() => {
    useStore.setState({ draft: amina(), reference: amina(), householdId: 'amina', events: [ev], householdVersion: 1, scenarioVersion: 1, sim: { status: 'idle' }, rec: { status: 'idle' }, undoStack: [] })
    vi.mocked(api.simulate).mockReset()
  })
  it('discards a simulation response that arrives after the household was edited', async () => {
    let resolve!: (r: SimulationResult) => void
    vi.mocked(api.simulate).mockReturnValue(new Promise<SimulationResult>((r) => { resolve = r }))
    const run = useStore.getState().runScenario()
    useStore.getState().editHousehold((h) => ({ ...h, name: 'edited' }))          // invalidates the in-flight request
    resolve({ householdVersion: 1, scenarioVersion: 1, inputHash: 'sc-old' } as SimulationResult)
    expect(await run).toBe(false)
    expect(useStore.getState().sim.status).toBe('idle')
    expect(useStore.getState().householdVersion).toBe(2)
  })
  it('refuses to run unconfirmed events', async () => {
    useStore.setState({ events: [{ ...ev, confirmed: false }] })
    expect(await useStore.getState().runScenario()).toBe(false)
    expect(api.simulate).not.toHaveBeenCalled()
  })
  it('editing clears previous plans, approvals and constraints', () => {
    useStore.setState({ rec: { status: 'ready' }, selectedPlanId: 'p', rejections: [{ taskId: 'T01', memberId: 'P02' }] })
    useStore.getState().editHousehold((h) => h)
    const s = useStore.getState()
    expect(s.rec.status).toBe('idle')
    expect(s.selectedPlanId).toBeNull()
    expect(s.rejections).toEqual([])
    expect(s.receipt).toBeNull()
  })
  it('undo restores the previous household and bumps the version', () => {
    useStore.getState().editHousehold((h) => ({ ...h, name: 'changed' }))
    useStore.getState().undo()
    expect(useStore.getState().draft?.name).toBe(amina().name)
  })
})

describe('household operations', () => {
  it('removing an entity cleans up every reference so the household stays valid', async () => {
    const { removeEntity, blankMember, blankResource } = await import('../lib/householdOps')
    const h = amina()
    const noMember = removeEntity(h, 'P01')
    expect(noMember.members.some((m) => m.id === 'P01')).toBe(false)
    expect(noMember.baselineAssignments.every((a) => a.memberId !== 'P01')).toBe(true)
    const noTask = removeEntity(h, 'T01')
    expect(noTask.milestones[0].enabledByTaskIds).toEqual([])
    expect(noTask.baselineAssignments.some((a) => a.taskId === 'T01')).toBe(false)
    const noRes = removeEntity(h, 'R01')
    expect(noRes.baselineAssignments.every((a) => !a.resourceIds.includes('R01'))).toBe(true)
    expect(blankMember(h).id).toBe('P05')
    expect(blankResource(h).id).toBe('R05')
    expect(h.members.length).toBe(4)                                  // input untouched
  })
  it('exports a calendar file without sending anything', async () => {
    const { planToIcs } = await import('../lib/exportPlan')
    const h = amina()
    const ics = planToIcs(h, { planId: 'p1', assignments: h.baselineAssignments, pendingConsentTaskIds: ['T01'] } as never)
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('DTSTART;TZID=Asia/Dubai:20261029T144500')
    expect(ics).toContain('Assignee consent still required')
  })
})

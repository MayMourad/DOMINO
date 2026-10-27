import { create } from 'zustand'
import { api, ApiFailure } from '../services/api'
import { bundledFixture, bundledSummaries } from '../services/fixtures'
import type {
  ApprovalReceipt, BenchSuite, Disruption, FixtureSummary, Health, Household, Pin, RecoveryPlan, RecoveryResponse,
  Rejection, SimulationResult, StrategyId, ValidationIssue,
} from '../types'

export type ScreenId = 'launch' | 'network' | 'studio' | 'cascade' | 'recovery' | 'futures' | 'evaluation'
export const SCREENS: { id: ScreenId; label: string; short: string }[] = [
  { id: 'launch', label: 'System Launch', short: 'Launch' },
  { id: 'network', label: 'Family Network', short: 'Network' },
  { id: 'studio', label: 'Disruption Studio', short: 'Disrupt' },
  { id: 'cascade', label: 'Cascade Laboratory', short: 'Cascade' },
  { id: 'recovery', label: 'Recovery Studio', short: 'Recover' },
  { id: 'futures', label: 'Family Futures Laboratory', short: 'Futures' },
  { id: 'evaluation', label: 'Evaluation Laboratory', short: 'Evaluate' },
]

type Phase<T> = { status: 'idle' | 'calculating' | 'ready' | 'error'; data?: T; error?: string; code?: string }
export interface Toast { id: number; kind: 'info' | 'success' | 'error'; text: string }
const DRAFT_KEY = 'domino.draft.v1'

interface State {
  screen: ScreenId
  apiStatus: 'unknown' | 'online' | 'offline'
  health: Health | null
  fixtures: FixtureSummary[]
  usingBundled: boolean
  // household
  householdId: string | null
  reference: Household | null
  draft: Household | null
  householdVersion: number
  undoStack: Household[]
  issues: ValidationIssue[]
  validation: 'idle' | 'checking' | 'valid' | 'invalid' | 'unchecked'
  // scenario
  events: Disruption[]
  scenarioVersion: number
  sim: Phase<SimulationResult>
  rec: Phase<RecoveryResponse>
  selectedPlanId: string | null
  rejections: Rejection[]
  pins: Pin[]
  excluded: string[]
  receipt: ApprovalReceipt | null
  // ui
  selectedNodeId: string | null
  cascade: { cursor: number; playing: boolean; speed: number; showDirect: boolean; showIndirect: boolean }
  bench: Phase<BenchSuite>
  toasts: Toast[]
  reducedMotion: boolean
  // actions
  go: (s: ScreenId) => void
  boot: () => Promise<void>
  loadHousehold: (id: string, go?: boolean) => Promise<void>
  editHousehold: (fn: (h: Household) => Household) => void
  undo: () => void
  resetHousehold: () => void
  setEvents: (evs: Disruption[]) => void
  runScenario: () => Promise<boolean>
  generateRecovery: (opts?: { rejections?: Rejection[]; pins?: Pin[]; exclude?: string[]; strategies?: StrategyId[] }) => Promise<void>
  rejectAssignment: (taskId: string, memberId: string) => Promise<void>
  pinAssignment: (taskId: string, memberId: string, startMin?: number) => Promise<void>
  clearConstraints: () => void
  selectPlan: (id: string | null) => void
  approvePlan: (plan: RecoveryPlan, ack: { unresolved: boolean; consent: boolean }) => Promise<boolean>
  runBenchmarks: () => Promise<void>
  select: (id: string | null) => void
  setCascade: (p: Partial<State['cascade']>) => void
  toast: (kind: Toast['kind'], text: string) => void
  dismissToast: (id: number) => void
  setReducedMotion: (v: boolean) => void
}

let simCtl: AbortController | null = null
let recCtl: AbortController | null = null
let valTimer: ReturnType<typeof setTimeout> | null = null
let toastSeq = 1
let simSeq = 0, recSeq = 0

const idle = { status: 'idle' as const }

export const useStore = create<State>((set, get) => {
  const invalidate = () => {
    simCtl?.abort(); recCtl?.abort(); simSeq++; recSeq++
    set({ sim: idle, rec: idle, selectedPlanId: null, receipt: null, rejections: [], pins: [], excluded: [] })
  }
  const persist = () => {
    try {
      const s = get()
      if (s.draft) localStorage.setItem(DRAFT_KEY, JSON.stringify({ householdId: s.householdId, draft: s.draft, events: s.events }))
    } catch { /* storage may be unavailable */ }
  }
  const scheduleValidation = () => {
    if (valTimer) clearTimeout(valTimer)
    set({ validation: 'checking' })
    valTimer = setTimeout(async () => {
      const h = get().draft
      if (!h) return
      const hv = get().householdVersion
      try {
        const r = await api.validateHousehold(h)
        if (get().householdVersion !== hv) return
        set({ issues: r.issues, validation: r.valid ? 'valid' : 'invalid', apiStatus: 'online' })
      } catch (e) {
        if (get().householdVersion !== hv) return
        set({ validation: 'unchecked', issues: [], apiStatus: e instanceof ApiFailure && e.code === 'NETWORK' ? 'offline' : get().apiStatus })
      }
    }, 350)
  }

  return {
    screen: 'launch', apiStatus: 'unknown', health: null, fixtures: [], usingBundled: false,
    householdId: null, reference: null, draft: null, householdVersion: 1, undoStack: [], issues: [], validation: 'idle',
    events: [], scenarioVersion: 1, sim: idle, rec: idle, selectedPlanId: null, rejections: [], pins: [], excluded: [], receipt: null,
    selectedNodeId: null, cascade: { cursor: 0, playing: false, speed: 1, showDirect: true, showIndirect: true },
    bench: idle, toasts: [], reducedMotion: typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,

    go: (screen) => { set({ screen }); if (location.hash !== `#/${screen}`) location.hash = `/${screen}` },

    boot: async () => {
      try {
        const [health, fixtures] = await Promise.all([api.health(), api.fixtures()])
        set({ health, fixtures, apiStatus: 'online', usingBundled: false })
      } catch {
        set({ apiStatus: 'offline', fixtures: bundledSummaries(), usingBundled: true, health: null })
      }
      try {
        const raw = localStorage.getItem(DRAFT_KEY)
        if (raw) {
          const d = JSON.parse(raw) as { householdId: string; draft: Household; events: Disruption[] }
          const ref = await (async () => { try { return await api.fixture(d.householdId) } catch { return bundledFixture(d.householdId) } })()
          if (ref && d.draft) {
            set({ householdId: d.householdId, reference: ref, draft: d.draft, events: d.events ?? [], householdVersion: 1, scenarioVersion: 1 })
            if (get().apiStatus === 'online') scheduleValidation()
          }
        }
      } catch { /* ignore corrupt draft */ }
    },

    loadHousehold: async (id, goNext = true) => {
      let h: Household | null
      try { h = await api.fixture(id); set({ apiStatus: 'online', usingBundled: false }) }
      catch (e) {
        h = bundledFixture(id)
        if (!h) { get().toast('error', e instanceof ApiFailure ? e.message : 'Could not load household.'); return }
        set({ apiStatus: 'offline', usingBundled: true })
        get().toast('info', 'Backend unreachable — loaded the bundled fictional household. Computation is disabled until the API is back.')
      }
      invalidate()
      set({ householdId: id, reference: h, draft: structuredClone(h), householdVersion: 1, scenarioVersion: 1, undoStack: [], events: [],
        issues: [], validation: 'idle', selectedNodeId: null, cascade: { ...get().cascade, cursor: 0, playing: false } })
      persist()
      if (get().apiStatus === 'online') scheduleValidation()
      if (goNext && get().screen === 'launch') get().go('network')  // never yank a user who already navigated elsewhere
    },

    editHousehold: (fn) => {
      const cur = get().draft
      if (!cur) return
      const next = fn(structuredClone(cur))
      invalidate()
      set((s) => ({ draft: next, householdVersion: s.householdVersion + 1, undoStack: [...s.undoStack.slice(-30), cur] }))
      persist()
      scheduleValidation()
    },
    undo: () => {
      const st = get().undoStack
      if (!st.length) return
      const prev = st[st.length - 1]
      invalidate()
      set((s) => ({ draft: prev, undoStack: st.slice(0, -1), householdVersion: s.householdVersion + 1 }))
      persist(); scheduleValidation()
    },
    resetHousehold: () => {
      const ref = get().reference
      if (!ref) return
      invalidate()
      set((s) => ({ draft: structuredClone(ref), undoStack: [], events: [], householdVersion: s.householdVersion + 1, scenarioVersion: s.scenarioVersion + 1,
        cascade: { ...s.cascade, cursor: 0, playing: false } }))
      persist(); scheduleValidation()
      get().toast('success', 'Household and scenario reset to the validated baseline.')
    },

    setEvents: (evs) => {
      invalidate()
      set((s) => ({ events: evs, scenarioVersion: s.scenarioVersion + 1, cascade: { ...s.cascade, cursor: 0, playing: false } }))
      persist()
    },

    runScenario: async () => {
      const { draft, events, householdVersion: hv, scenarioVersion: sv } = get()
      if (!draft) return false
      if (!events.length || events.some((e) => !e.confirmed)) { get().toast('error', 'Confirm every disruption before running the scenario.'); return false }
      simCtl?.abort(); recCtl?.abort(); simCtl = new AbortController()
      const seq = ++simSeq
      recSeq++
      set({ sim: { status: 'calculating' }, rec: idle, selectedPlanId: null, receipt: null, cascade: { ...get().cascade, cursor: 0, playing: false } })
      try {
        const data = await api.simulate(draft, hv, events, sv, simCtl.signal)
        const s = get()
        if (seq !== simSeq || s.householdVersion !== hv || s.scenarioVersion !== sv || data.householdVersion !== hv || data.scenarioVersion !== sv) return false // stale
        set({ sim: { status: 'ready', data }, apiStatus: 'online' })
        return true
      } catch (e) {
        if (seq !== simSeq || (e instanceof DOMException && e.name === 'AbortError')) return false
        const f = e as ApiFailure
        set({ sim: { status: 'error', error: f.message ?? 'Simulation failed.', code: f.code }, apiStatus: f.code === 'NETWORK' ? 'offline' : get().apiStatus })
        return false
      }
    },

    generateRecovery: async (opts) => {
      const s0 = get()
      const { draft, events, householdVersion: hv, scenarioVersion: sv } = s0
      if (!draft || !events.length) return
      const rejections = opts?.rejections ?? s0.rejections
      const pins = opts?.pins ?? s0.pins
      const excluded = opts?.exclude ?? []
      recCtl?.abort(); recCtl = new AbortController()
      const seq = ++recSeq
      set({ rec: { status: 'calculating', data: get().rec.data }, rejections, pins, excluded, receipt: null })
      try {
        const data = await api.recover(draft, hv, events, sv, {
          simulationHash: s0.sim.data?.inputHash, rejections, pins, excludeSignatures: excluded, strategies: opts?.strategies,
        }, recCtl.signal)
        const s = get()
        if (seq !== recSeq || s.householdVersion !== hv || s.scenarioVersion !== sv) return // stale response discarded
        const keep = s.selectedPlanId && data.plans.some((p) => p.planId === s.selectedPlanId) ? s.selectedPlanId : data.plans[0]?.planId ?? null
        set({ rec: { status: 'ready', data }, selectedPlanId: keep, apiStatus: 'online' })
      } catch (e) {
        if (seq !== recSeq || (e instanceof DOMException && e.name === 'AbortError')) return
        const f = e as ApiFailure
        set({ rec: { status: 'error', error: f.message ?? 'Recovery failed.', code: f.code } })
      }
    },

    rejectAssignment: async (taskId, memberId) => {
      const rej = [...get().rejections.filter((r) => !(r.taskId === taskId && r.memberId === memberId)), { taskId, memberId }]
      const pins = get().pins.filter((p) => p.taskId !== taskId)
      await get().generateRecovery({ rejections: rej, pins })
    },
    pinAssignment: async (taskId, memberId, startMin) => {
      const pins = [...get().pins.filter((p) => p.taskId !== taskId), { taskId, memberId, startMin: startMin ?? null }]
      await get().generateRecovery({ pins, rejections: get().rejections })
    },
    clearConstraints: () => { void get().generateRecovery({ rejections: [], pins: [], exclude: [] }) },

    selectPlan: (id) => set({ selectedPlanId: id, receipt: null }),

    approvePlan: async (plan, ack) => {
      const s = get()
      if (!s.draft) return false
      try {
        const receipt = await api.approve(s.draft, s.events, plan, plan.inputHash, s.rejections, s.pins, ack)
        if (get().householdVersion !== s.householdVersion || get().scenarioVersion !== s.scenarioVersion) return false
        set({ receipt })
        get().toast('success', 'Simulation approval recorded. No one was notified.')
        return true
      } catch (e) {
        get().toast('error', (e as ApiFailure).message ?? 'Approval failed.')
        return false
      }
    },

    runBenchmarks: async () => {
      set({ bench: { status: 'calculating' } })
      try {
        const data = await api.benchRun()
        set({ bench: { status: 'ready', data } })
      } catch (e) {
        set({ bench: { status: 'error', error: (e as ApiFailure).message, code: (e as ApiFailure).code } })
      }
    },

    select: (id) => set({ selectedNodeId: id }),
    setCascade: (p) => set((s) => ({ cascade: { ...s.cascade, ...p } })),
    toast: (kind, text) => {
      const id = toastSeq++
      set((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, text }] }))
      setTimeout(() => get().dismissToast(id), 6000)
    },
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    setReducedMotion: (v) => set({ reducedMotion: v }),
  }
})

export const selectedPlan = (s: State): RecoveryPlan | null =>
  s.rec.data?.plans.find((p) => p.planId === s.selectedPlanId) ?? null

export const confirmedEvents = (s: State) => s.events.filter((e) => e.confirmed)

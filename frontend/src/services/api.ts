import type {
  ApiErrorBody, ApprovalReceipt, BenchCatalog, BenchSuite, Disruption, EventInterpretation, FixtureSummary, Health,
  Household, Pin, RecoveryPlan, RecoveryResponse, Rejection, SimulationResult, StrategyId, ValidationIssue, ValidationReport,
} from '../types'

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export class ApiFailure extends Error {
  code: string; status: number; retryable: boolean; requestId?: string
  constructor(code: string, message: string, status = 0, retryable = false, requestId?: string) {
    super(message); this.code = code; this.status = status; this.retryable = retryable; this.requestId = requestId
  }
}

async function call<T>(path: string, init?: RequestInit & { signal?: AbortSignal; timeoutMs?: number }): Promise<T> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(new DOMException('timeout', 'TimeoutError')), init?.timeoutMs ?? 30000)
  init?.signal?.addEventListener('abort', () => ctl.abort(init.signal?.reason))
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init, signal: ctl.signal, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    })
    if (!res.ok) {
      let body: ApiErrorBody | null = null
      try { body = await res.json() } catch { /* non-JSON error */ }
      throw new ApiFailure(body?.error.code ?? 'HTTP_ERROR', body?.error.message ?? `Request failed (${res.status}).`,
        res.status, body?.error.retryable ?? res.status >= 500, body?.error.requestId)
    }
    return (await res.json()) as T
  } catch (e) {
    if (e instanceof ApiFailure) throw e
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    if (e instanceof DOMException && e.name === 'TimeoutError') throw new ApiFailure('TIMEOUT', 'The server took too long to respond.', 0, true)
    if (ctl.signal.aborted && ctl.signal.reason instanceof DOMException && ctl.signal.reason.name === 'TimeoutError')
      throw new ApiFailure('TIMEOUT', 'The server took too long to respond.', 0, true)
    throw new ApiFailure('NETWORK', 'Cannot reach the DOMINO backend.', 0, true)
  } finally { clearTimeout(timer) }
}

const post = <T,>(path: string, body: unknown, signal?: AbortSignal, timeoutMs?: number) =>
  call<T>(path, { method: 'POST', body: JSON.stringify(body), signal, timeoutMs })

export const api = {
  health: (signal?: AbortSignal) => call<Health>('/v1/health', { signal, timeoutMs: 6000 }),
  fixtures: () => call<FixtureSummary[]>('/v1/fixtures', { timeoutMs: 8000 }),
  fixture: (id: string) => call<Household>(`/v1/fixtures/${id}`, { timeoutMs: 8000 }),
  validateHousehold: (h: Household, signal?: AbortSignal) =>
    post<{ valid: boolean; issues: ValidationIssue[] }>('/v1/households/validate', { householdSnapshot: h }, signal, 10000),
  interpret: (h: Household, text: string, nowMin: number | null, signal?: AbortSignal) =>
    post<EventInterpretation>('/v1/events/interpret', { householdSnapshot: h, text, nowMin }, signal, 25000),
  simulate: (h: Household, hv: number, events: Disruption[], sv: number, signal?: AbortSignal) =>
    post<SimulationResult>('/v1/simulations', { householdId: h.id, householdVersion: hv, householdSnapshot: h, scenarioVersion: sv, events }, signal),
  recover: (h: Household, hv: number, events: Disruption[], sv: number, opts: {
    simulationHash?: string; strategies?: StrategyId[]; rejections?: Rejection[]; pins?: Pin[]; excludeSignatures?: string[]
  }, signal?: AbortSignal) =>
    post<RecoveryResponse>('/v1/recovery-plans', { householdSnapshot: h, householdVersion: hv, scenarioVersion: sv, events, ...opts }, signal, 45000),
  validatePlan: (h: Household, events: Disruption[], plan: RecoveryPlan, rejections: Rejection[], pins: Pin[]) =>
    post<ValidationReport>('/v1/plans/validate', {
      householdSnapshot: h, events, rejections, pins, assignments: plan.assignments, uncoveredTaskIds: plan.uncoveredTaskIds,
      planId: plan.planId, inputHash: plan.inputHash, pendingConsentTaskIds: plan.pendingConsentTaskIds,
    }),
  approve: (h: Household, events: Disruption[], plan: RecoveryPlan, currentInputHash: string, rejections: Rejection[], pins: Pin[],
    ack: { unresolved: boolean; consent: boolean }) =>
    post<ApprovalReceipt>('/v1/plans/approve', {
      householdSnapshot: h, events, rejections, pins, plan, currentInputHash, humanConfirmed: true,
      acknowledgedUnresolved: ack.unresolved, acknowledgedConsentPending: ack.consent,
    }),
  benchCatalog: () => call<BenchCatalog>('/v1/benchmarks/catalog', { timeoutMs: 8000 }),
  benchRun: (caseIds?: string[], signal?: AbortSignal) => post<BenchSuite>('/v1/benchmarks/run', { caseIds }, signal, 180000),
}

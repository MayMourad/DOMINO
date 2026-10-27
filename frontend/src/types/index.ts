// Types mirror backend/app/models (Pydantic). Times are integer minutes after midnight, Asia/Dubai.

export interface TimeWindow { startMin: number; endMin: number }
export interface Location { id: string; name: string }
export interface TravelLeg { fromId: string; toId: string; minutes: number }

export type Role = 'adult' | 'teen' | 'child' | 'senior'
export interface FamilyMember {
  id: string; name: string; age: number; role: Role; isDependent: boolean
  skills: string[]; permissions: string[]; restrictions: string[]; availability: TimeWindow[]
  homeLocationId: string; authorizedDependentIds: string[]; baselineWorkloadMinutes: number
}
export interface HouseholdTask {
  id: string; title: string; description: string; tier: 0 | 1 | 2 | 3; priorityWeight: number
  durationMin: number; earliestStartMin: number; latestEndMin: number; fixedStartMin?: number | null
  requiredSkills: string[]; requiredPermissions: string[]; eligibleMemberIds?: string[] | null
  excludedMemberIds: string[]; requiredResourceTypes: string[]; resourceUnits: Record<string, number>
  requiredDependentIds: string[]; predecessorTaskIds: string[]; requiredMilestoneIds: string[]
  originLocationId: string; destinationLocationId: string; requiredConsent: boolean; isOptional: boolean
}
export interface HouseholdResource {
  id: string; name: string; type: string; capacity: number; exclusive: boolean
  availability: TimeWindow[]; unavailableWindows: TimeWindow[]; locationId: string
  restrictions: string[]; allowedMemberIds?: string[] | null
}
export interface Milestone { id: string; title: string; enabledByTaskIds: string[]; dependentId?: string | null }
export interface Assignment {
  taskId: string; memberId: string; startMin: number; endMin: number
  resourceIds: string[]; itineraryId?: string | null; changedFromBaseline: boolean
}
export interface Household {
  id: string; name: string; description: string; simulationDate: string; timezone: 'Asia/Dubai'
  version: number; planningStartMin: number; planningEndMin: number; gridMin: number
  locations: Location[]; travelMatrix: TravelLeg[]; members: FamilyMember[]; tasks: HouseholdTask[]
  resources: HouseholdResource[]; milestones: Milestone[]; baselineAssignments: Assignment[]
}

export type DisruptionType =
  | 'member_unavailable' | 'resource_unavailable' | 'task_rescheduled'
  | 'availability_changed' | 'resource_capacity_changed'
export interface Disruption {
  id: string; type: DisruptionType; affectedEntityIds: string[]; startMin: number; endMin: number
  reason?: string | null; value?: number | null; confirmed: boolean
}
export interface Rejection { taskId: string; memberId: string; startMin?: number | null }
export interface Pin { taskId: string; memberId: string; startMin?: number | null }

export type ImpactCategory =
  | 'unaffected' | 'directly_disrupted' | 'at_risk_dependency' | 'recoverable' | 'unresolved' | 'restored'
export interface CausalPath { nodeIds: string[]; edgeTypes: string[] }
export interface ImpactNode {
  id: string; nodeType: 'person' | 'task' | 'resource' | 'milestone' | 'disruption'; label: string
  category: ImpactCategory; reasonCodes: string[]; depth: number; causalPaths: CausalPath[]
  explanation: string; recoverable?: boolean | null
}
export interface CascadeStep { depth: number; nodeIds: string[]; edges: [string, string, string][] }
export interface CoverageSummary {
  coveredByTier: Record<string, number>; totalByTier: Record<string, number>
  weightedCoverage: number; uncoveredTaskIds: string[]
}
export interface SimulationResult {
  simulationId: string; householdId: string; householdVersion: number; scenarioVersion: number
  inputHash: string; engineVersion: string; computedAt: string; calculationStatus: 'ok' | 'warnings'
  directEntityIds: string[]; indirectEntityIds: string[]; affectedTaskIds: string[]
  nodes: ImpactNode[]; cascade: CascadeStep[]; maxDepth: number
  baselineCoverage: CoverageSummary; postDisruptionCoverage: CoverageSummary
  recoverabilityProbe?: {
    solverStatus: string; elapsedMs: number; coveredTaskIds: string[]; uncoveredTaskIds: string[]
    criticalRecovery: boolean; completeRecovery: boolean; note: string
  } | null
  warnings: string[]; durationMs: number
}

export interface ValidationCheck {
  ruleId: string; description: string; affectedEntityIds: string[]; passed: boolean
  evidence: string; errorCode?: string | null
}
export interface ValidationReport {
  planId: string; inputHash: string; expectedHash: string; overallStatus: 'valid' | 'invalid'
  completeness: 'complete' | 'critical_complete' | 'partial'; hardViolations: number
  uncoveredCriticalTaskIds: string[]; checks: ValidationCheck[]; explanations: string[]
  warnings: string[]; verifiedAt: string; label: string
}
export interface ExplanationRecord {
  id: string; kind: string; taskId: string; memberId?: string | null; codes: string[]; text: string
}
export interface PlanMetrics {
  coveredByTier: Record<string, number>; totalByTier: Record<string, number>; weightedCoverage: number
  coveredCount: number; totalCount: number; reassignmentCount: number; displacementMin: number
  workloadMinutes: Record<string, number>; workloadGini: number; maxWorkloadMin: number
}
export type StrategyId = 'priority_first' | 'minimum_change' | 'balanced_workload'
export interface RecoveryPlan {
  planId: string; strategyId: StrategyId; strategyIds: StrategyId[]; label: string; inputHash: string
  assignments: Assignment[]; uncoveredTaskIds: string[]; uncoveredCriticalTaskIds: string[]
  uncoveredOtherTaskIds: string[]; completeRecovery: boolean; criticalRecovery: boolean
  pendingConsentTaskIds: string[]; solverStatus: 'OPTIMAL' | 'FEASIBLE' | 'INFEASIBLE' | 'MODEL_INVALID' | 'UNKNOWN'
  solverElapsedMs: number; objectives: { name: string; value: number }[]; metrics: PlanMetrics
  changedTaskIds: string[]; explanations: ExplanationRecord[]
  rejectedAlternatives: Record<string, { memberId: string; memberName: string; codes: string[]; text: string }[]>
  validation: ValidationReport; approvalStatus: 'not_approved' | 'approved'; statusLabel: string
  signature: string; impactResolution: Record<string, ImpactCategory>
}
export interface RecoveryResponse {
  requestedInputHash: string; simulationHash: string; engineVersion: string; solverStatus: string
  plans: RecoveryPlan[]; duplicateStrategyNote?: string | null; candidateCounts: Record<string, number>
  totalElapsedMs: number; solver: Record<string, unknown>; warnings: string[]
  householdVersion?: number; scenarioVersion?: number
}
export interface ApprovalReceipt {
  receiptId: string; planId: string; inputHash: string; approvedAt: string; simulated: boolean
  notificationsSent: number; consentPending: string[]; unresolvedCriticalTaskIds: string[]; note: string
}
export interface ValidationIssue { code: string; severity: 'error' | 'warning'; message: string; entityIds: string[] }
export interface EventInterpretation {
  proposedEvents: Disruption[]; resolvedEntityIds: string[]; unresolvedMentions: string[]
  ambiguities: string[]; assumptions: string[]; requiredConfirmations: string[]
  interpretationStatus: 'ready_for_review' | 'needs_clarification' | 'invalid'; warnings: string[]; model?: string | null
}
export interface FixtureSummary { id: string; name: string; description: string; members: number; tasks: number; resources: number }
export interface Health {
  status: string; engineVersion: string; solver: string
  ai: { available: boolean; model: string | null; warning?: string | null }; benchmarksEnabled: boolean; time: string
}
export interface BenchResult {
  id: string; title: string; group: string; kind: string; status: 'pass' | 'fail' | 'not_run'
  expected: string[]; observed: string[]; failures: string[]; notRunReason?: string | null; elapsedMs: number
  metrics: Record<string, unknown>; inputs: { household?: string; ops?: unknown[]; events?: unknown[]; reject?: unknown; check?: string }
}
export interface BenchSuite {
  executedAt: string; environment: Record<string, unknown>; totalCases: number
  counts: { pass: number; fail: number; not_run: number }; wallClockMs: number
  latency: { observations: number; medianMs?: number; p95Ms?: number; note?: string }
  dependencyDetection: { cases: number; precision: number; recall: number; f1: number } | null
  baselineComparison: {
    cases: number
    domino: Cmp; greedy: Cmp; noRecovery: Cmp
    dominoBeatsGreedyCritical: number; greedyBeatsDominoCritical: number
  } | null
  results: BenchResult[]; methodology: string
}
interface Cmp { meanWeightedCoverage: number; casesWithUncoveredCritical: number; allValid: boolean; meanChanges: number }
export interface BenchCatalog { total: number; cases: { id: string; title: string; group: string; kind: string; description: string; expected: string[] }[]; note: string }

export interface ApiErrorBody { error: { code: string; message: string; details: unknown[]; requestId: string; retryable: boolean } }

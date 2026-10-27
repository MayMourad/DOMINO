"""Result / response models: simulation, recovery plans, validation reports."""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict

from .domain import Assignment, Disruption, Household, Pin, Rejection, StrategyId, TimeWindow


class Loose(BaseModel):
    model_config = ConfigDict(extra="forbid")


ImpactCategory = Literal[
    "unaffected", "directly_disrupted", "at_risk_dependency", "recoverable", "unresolved", "restored"
]


class CausalPath(Loose):
    nodeIds: list[str]
    edgeTypes: list[str]


class ImpactNode(Loose):
    id: str
    nodeType: Literal["person", "task", "resource", "milestone", "disruption"]
    label: str
    category: ImpactCategory
    reasonCodes: list[str] = []
    depth: int = 0
    causalPaths: list[CausalPath] = []
    explanation: str = ""
    recoverable: Optional[bool] = None


class CascadeStep(Loose):
    depth: int
    nodeIds: list[str]
    edges: list[tuple[str, str, str]]


class CoverageSummary(Loose):
    coveredByTier: dict[str, int]
    totalByTier: dict[str, int]
    weightedCoverage: float
    uncoveredTaskIds: list[str]


class SimulationResult(Loose):
    simulationId: str
    householdId: str
    householdVersion: int
    scenarioVersion: int
    inputHash: str
    engineVersion: str
    computedAt: str
    calculationStatus: Literal["ok", "warnings"]
    directEntityIds: list[str]
    indirectEntityIds: list[str]
    affectedTaskIds: list[str]
    nodes: list[ImpactNode]
    cascade: list[CascadeStep]
    maxDepth: int
    baselineCoverage: CoverageSummary
    postDisruptionCoverage: CoverageSummary
    recoverabilityProbe: Optional[dict[str, Any]] = None
    warnings: list[str] = []
    durationMs: float


class ValidationCheck(Loose):
    ruleId: str
    description: str
    affectedEntityIds: list[str]
    passed: bool
    evidence: str
    errorCode: Optional[str] = None


class ValidationReport(Loose):
    planId: str
    inputHash: str
    expectedHash: str
    overallStatus: Literal["valid", "invalid"]
    completeness: Literal["complete", "critical_complete", "partial"]
    hardViolations: int
    uncoveredCriticalTaskIds: list[str]
    checks: list[ValidationCheck]
    explanations: list[str]
    warnings: list[str]
    verifiedAt: str
    label: str


class ExplanationRecord(Loose):
    id: str
    kind: Literal["assignment_accepted", "assignment_unchanged", "task_uncovered", "alternative_rejected"]
    taskId: str
    memberId: Optional[str] = None
    codes: list[str]
    text: str
    evidence: dict[str, Any] = {}


class ObjectiveValue(Loose):
    name: str
    value: float


class PlanMetrics(Loose):
    coveredByTier: dict[str, int]
    totalByTier: dict[str, int]
    weightedCoverage: float
    coveredCount: int
    totalCount: int
    reassignmentCount: int
    displacementMin: int
    workloadMinutes: dict[str, int]
    workloadGini: float
    maxWorkloadMin: int


class RecoveryPlan(Loose):
    planId: str
    strategyId: StrategyId
    strategyIds: list[StrategyId]
    label: str
    inputHash: str
    assignments: list[Assignment]
    uncoveredTaskIds: list[str]
    uncoveredCriticalTaskIds: list[str]
    uncoveredOtherTaskIds: list[str]
    completeRecovery: bool
    criticalRecovery: bool
    pendingConsentTaskIds: list[str]
    solverStatus: Literal["OPTIMAL", "FEASIBLE", "INFEASIBLE", "MODEL_INVALID", "UNKNOWN"]
    solverElapsedMs: float
    objectives: list[ObjectiveValue]
    metrics: PlanMetrics
    changedTaskIds: list[str]
    explanations: list[ExplanationRecord]
    rejectedAlternatives: dict[str, list[dict[str, Any]]]
    validation: ValidationReport
    approvalStatus: Literal["not_approved", "approved"] = "not_approved"
    statusLabel: str
    signature: str
    impactResolution: dict[str, str] = {}


class RecoveryResponse(Loose):
    requestedInputHash: str
    simulationHash: str
    engineVersion: str
    solverStatus: str
    plans: list[RecoveryPlan]
    duplicateStrategyNote: Optional[str] = None
    candidateCounts: dict[str, int]
    totalElapsedMs: float
    solver: dict[str, Any]
    warnings: list[str] = []


class SimulationRequest(BaseModel):
    householdId: str
    householdVersion: int = 1
    householdSnapshot: Household
    scenarioVersion: int = 1
    events: list[Disruption]
    includeProbe: bool = True


class RecoveryRequest(BaseModel):
    householdSnapshot: Household
    householdVersion: int = 1
    scenarioVersion: int = 1
    events: list[Disruption]
    simulationHash: Optional[str] = None
    strategies: list[StrategyId] = ["priority_first", "minimum_change", "balanced_workload"]
    rejections: list[Rejection] = []
    pins: list[Pin] = []
    excludeSignatures: list[str] = []
    timeLimitSeconds: Optional[float] = None


class PlanValidateRequest(BaseModel):
    householdSnapshot: Household
    events: list[Disruption]
    rejections: list[Rejection] = []
    pins: list[Pin] = []
    assignments: list[Assignment]
    uncoveredTaskIds: list[str]
    planId: str = "candidate"
    inputHash: str
    pendingConsentTaskIds: list[str] = []


class ApproveRequest(BaseModel):
    householdSnapshot: Household
    events: list[Disruption]
    rejections: list[Rejection] = []
    pins: list[Pin] = []
    plan: RecoveryPlan
    currentInputHash: str
    humanConfirmed: bool
    acknowledgedUnresolved: bool = False
    acknowledgedConsentPending: bool = False


class HouseholdValidateRequest(BaseModel):
    householdSnapshot: dict[str, Any]


class InterpretRequest(BaseModel):
    householdSnapshot: Household
    text: str
    nowMin: Optional[int] = None


__all__ = [n for n in dir() if not n.startswith("_")]
_unused = (Assignment, TimeWindow)

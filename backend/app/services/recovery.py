"""Recovery orchestration: strategies → distinct plans → independent verification."""

from __future__ import annotations

import hashlib
import time
from typing import Optional

from ..config import settings
from ..models.domain import ApiError, Assignment, Disruption, Household, Pin, Rejection
from ..models.results import PlanMetrics, RecoveryPlan, RecoveryResponse
from .candidate_generation import generate_candidates
from .dependency_graph import analyze_impact
from .explanations import build_plan_explanations
from .households import ENGINE_VERSION, apply_disruptions, input_hash, scenario_hash, validate_events
from .optimizer import STRATEGY_LABELS, SolveResult, plan_signature, solve_strategy
from .simulator import resolve_impact
from .verifier import verify_plan

ALL_STRATEGIES = ["priority_first", "minimum_change", "balanced_workload"]


def gini(values: list[int]) -> float:
    """Gini coefficient of non-negative values; defined as 0.0 when all values are zero or fewer than two."""
    vals = sorted(values)
    n, tot = len(vals), sum(vals)
    if n < 2 or tot == 0:
        return 0.0
    cum = sum((i + 1) * v for i, v in enumerate(vals))
    return round((2 * cum) / (n * tot) - (n + 1) / n, 4)


def compute_metrics(hyp: Household, base: Household, assignments: list[Assignment]) -> PlanMetrics:
    asg = {a.taskId: a for a in assignments}
    base_asg = {a.taskId: a for a in base.baselineAssignments}
    cov = {str(i): 0 for i in range(4)}
    tot = {str(i): 0 for i in range(4)}
    wc = wt = 0
    for t in hyp.tasks:
        tot[str(t.tier)] += 1
        wt += t.priorityWeight
        if t.id in asg:
            cov[str(t.tier)] += 1
            wc += t.priorityWeight
    reassign = disp = 0
    for tid, a in asg.items():
        b = base_asg.get(tid)
        if b:
            reassign += int(b.memberId != a.memberId)
            disp += abs(a.startMin - b.startMin)
    load = {m.id: m.baselineWorkloadMinutes for m in hyp.members if not m.isDependent}
    for a in assignments:
        if a.memberId in load:
            load[a.memberId] += a.endMin - a.startMin
    return PlanMetrics(
        coveredByTier=cov, totalByTier=tot, weightedCoverage=round(wc / wt, 4) if wt else 1.0,
        coveredCount=len(asg), totalCount=len(hyp.tasks), reassignmentCount=reassign, displacementMin=disp,
        workloadMinutes=load, workloadGini=gini(list(load.values())), maxWorkloadMin=max(load.values(), default=0))


def _status_label(report_label: str, solver_status: str) -> str:
    if solver_status == "UNKNOWN":
        return "Solver timeout — outcome unconfirmed"
    if solver_status == "MODEL_INVALID":
        return "Invalid model — calculation failed"
    if solver_status == "INFEASIBLE":
        return "No valid plan found"
    return report_label


def build_plan(
    base: Household, hyp: Household, events: list[Disruption], res: SolveResult, strategy: str, in_hash: str,
    rejections: list[Rejection], pins: list[Pin], cs, sim=None,
) -> RecoveryPlan:
    asg = res.assignments
    uncovered = sorted(t.id for t in hyp.tasks if t.id not in {a.taskId for a in asg})
    pending = sorted(a.taskId for a in asg if hyp.task(a.taskId) and hyp.task(a.taskId).requiredConsent)  # type: ignore[union-attr]
    sig = plan_signature(asg)
    pid = "plan-" + hashlib.sha256((in_hash + sig).encode()).hexdigest()[:10]
    report = verify_plan(base, events, asg, uncovered, pid, in_hash, in_hash, rejections, pins, pending)
    crit = [t.id for t in hyp.tasks if t.id in uncovered and t.tier <= 1 and not t.isOptional]
    other = [u for u in uncovered if u not in crit]
    expl, rejected = build_plan_explanations(hyp, base, asg, uncovered, cs)
    base_asg = {a.taskId: a for a in base.baselineAssignments}
    changed = sorted(a.taskId for a in asg if a.changedFromBaseline) + sorted(
        t for t in uncovered if t in base_asg)
    return RecoveryPlan(
        planId=pid, strategyId=strategy, strategyIds=[strategy], label=STRATEGY_LABELS[strategy],  # type: ignore[arg-type]
        inputHash=in_hash, assignments=asg, uncoveredTaskIds=uncovered, uncoveredCriticalTaskIds=crit,
        uncoveredOtherTaskIds=other, completeRecovery=not uncovered, criticalRecovery=not crit,
        pendingConsentTaskIds=pending, solverStatus=res.status,  # type: ignore[arg-type]
        solverElapsedMs=res.elapsed_ms, objectives=res.objectives, metrics=compute_metrics(hyp, base, asg),
        changedTaskIds=changed, explanations=expl, rejectedAlternatives=rejected, validation=report,
        statusLabel=_status_label(report.label, res.status), signature=sig,
        impactResolution=resolve_impact(sim, base, asg) if sim is not None else {})


def generate_recovery(
    base: Household,
    events: list[Disruption],
    strategies: Optional[list[str]] = None,
    rejections: Optional[list[Rejection]] = None,
    pins: Optional[list[Pin]] = None,
    exclude_signatures: Optional[list[str]] = None,
    time_limit: Optional[float] = None,
    simulation_hash: Optional[str] = None,
    seed: int = 1,
) -> RecoveryResponse:
    t0 = time.perf_counter()
    rejections, pins = rejections or [], pins or []
    validate_events(base, events)
    sc = scenario_hash(base, events)
    if simulation_hash and simulation_hash != sc:
        raise ApiError("STALE_SCENARIO", "The scenario changed after the simulation; recalculate before generating recovery.", 409)
    for r in rejections:
        if base.task(r.taskId) is None or base.member(r.memberId) is None:
            raise ApiError("INVALID_REFERENCE", f"Rejection references unknown entity ({r.taskId}, {r.memberId}).", 422)
    for p in pins:
        if base.task(p.taskId) is None or base.member(p.memberId) is None:
            raise ApiError("INVALID_REFERENCE", f"Pin references unknown entity ({p.taskId}, {p.memberId}).", 422)
    limit = min(max(time_limit or settings.solver_time_limit_seconds, 0.1), 10.0)
    hyp = apply_disruptions(base, events)
    in_hash = input_hash(base, events, rejections, pins)
    cs = generate_candidates(hyp, rejections, pins, base)
    sim = analyze_impact(base, events)
    plans: list[RecoveryPlan] = []
    by_sig: dict[str, RecoveryPlan] = {}
    statuses: list[str] = []
    notes: list[str] = []
    for strat in strategies or ALL_STRATEGIES:
        res = solve_strategy(hyp, base, strat, cs, limit, seed, exclude_signatures, rejections, pins)
        statuses.append(res.status)
        if res.note:
            notes.append(f"{STRATEGY_LABELS[strat]}: {res.note}")
        if res.error:
            notes.append(f"{STRATEGY_LABELS[strat]}: {res.error}")
        if res.status in ("MODEL_INVALID", "UNKNOWN", "INFEASIBLE") and not res.assignments:
            plan = build_plan(base, hyp, events, res, strat, in_hash, rejections, pins, cs, sim)
            plans.append(plan)
            continue
        plan = build_plan(base, hyp, events, res, strat, in_hash, rejections, pins, cs, sim)
        if plan.signature in by_sig:
            first = by_sig[plan.signature]
            first.strategyIds.append(strat)  # type: ignore[arg-type]
            continue
        by_sig[plan.signature] = plan
        plans.append(plan)
    dup_note = None
    for p in plans:
        if len(p.strategyIds) > 1:
            p.label = " · ".join(STRATEGY_LABELS[s] for s in p.strategyIds)
    n_requested = len(strategies or ALL_STRATEGIES)
    if len(plans) < n_requested and plans:
        dup_note = (f"{n_requested} strategies produced {len(plans)} distinct arrangement(s). Identical arrangements "
                    f"are shown once instead of manufacturing alternatives.")
    worst = "OPTIMAL"
    for s in statuses:
        if s != "OPTIMAL":
            worst = s if worst == "OPTIMAL" or s in ("MODEL_INVALID", "INFEASIBLE") else worst
    return RecoveryResponse(
        requestedInputHash=in_hash, simulationHash=sc, engineVersion=ENGINE_VERSION, solverStatus=worst, plans=plans,
        duplicateStrategyNote=dup_note, candidateCounts={"candidates": len(cs.cands), "tasks": len(hyp.tasks)},
        totalElapsedMs=round((time.perf_counter() - t0) * 1000, 2),
        solver={"name": "OR-Tools CP-SAT", "workers": 1, "seed": seed, "timeLimitSecondsPerStrategy": limit,
                "objectiveOrder": "lexicographic: Tier0 → Tier1 → Tier2 → Tier3 coverage → strategy preferences"},
        warnings=notes)

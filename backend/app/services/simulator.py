"""Simulation entry point: impact analysis plus an honest recoverability probe."""

from __future__ import annotations

from ..models.domain import Assignment, Disruption, Household
from ..models.results import SimulationResult


def resolve_impact(sim: SimulationResult, h: Household, assignments: list[Assignment]) -> dict[str, str]:
    """Post-recovery category per affected node, computed from a concrete plan (never from the UI)."""
    covered = {a.taskId for a in assignments}
    out: dict[str, str] = {}
    for n in sim.nodes:
        if n.category == "unaffected" or n.nodeType == "disruption":
            continue
        if n.nodeType == "task":
            if n.category == "directly_disrupted":
                out[n.id] = "recoverable" if n.id in covered else "unresolved"
            else:
                out[n.id] = "restored" if n.id in covered else "unresolved"
        elif n.nodeType == "milestone":
            ms = h.milestone(n.id)
            out[n.id] = "restored" if ms and all(t in covered for t in ms.enabledByTaskIds) else "unresolved"
        elif n.nodeType == "person" and n.category == "at_risk_dependency":
            serving = [t.id for t in h.tasks if n.id in t.requiredDependentIds and t.id in sim.affectedTaskIds]
            out[n.id] = "restored" if all(t in covered for t in serving) else "unresolved"
    return out


def simulate(h: Household, events: list[Disruption], household_version: int = 1, scenario_version: int = 1,
             include_probe: bool = True) -> SimulationResult:
    from .dependency_graph import analyze_impact
    from .recovery import generate_recovery

    sim = analyze_impact(h, events, household_version, scenario_version)
    if include_probe:
        resp = generate_recovery(h, events, ["priority_first"])
        plan = resp.plans[0]
        covered = {a.taskId for a in plan.assignments}
        sim.recoverabilityProbe = {
            "solverStatus": plan.solverStatus, "elapsedMs": plan.solverElapsedMs,
            "coveredTaskIds": sorted(covered), "uncoveredTaskIds": plan.uncoveredTaskIds,
            "criticalRecovery": plan.criticalRecovery, "completeRecovery": plan.completeRecovery,
            "note": "Feasibility probe using the Priority First objective; full alternatives come from /v1/recovery-plans."}
        for node in sim.nodes:
            if node.nodeType == "task" and node.category != "unaffected":
                node.recoverable = node.id in covered
            elif node.id in plan.impactResolution:
                node.recoverable = plan.impactResolution[node.id] in ("recoverable", "restored")
    return sim

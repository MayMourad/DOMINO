"""Typed family dependency graph and deterministic impact propagation.

Edge semantics (source → target):
  assigned_to         task → person        task is currently performed by the person
  requires_resource   task → resource      task consumes the resource while it runs
  requires_permission task → person        the assignee must hold the task's permissions (eligibility rule)
  depends_on          task → milestone|task  task cannot complete before the prerequisite is satisfied
  enables             task → milestone     completing the task satisfies the milestone
  serves_dependent    task → person        the task exists for the benefit of a dependent
  disrupted_by        entity → disruption  the entity is directly targeted by a disruption

Impact propagates only along: disruption → entity (disrupted_by, reversed), person|resource → task
(assigned_to / requires_resource, conditional on the baseline assignment actually being invalidated),
task → milestone (enables), milestone|task → task (depends_on, reversed) and task → dependent person
(serves_dependent, terminal).
"""

from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

import networkx as nx

from ..models.domain import Assignment, Disruption, Household
from ..models.results import (
    CascadeStep,
    CausalPath,
    CoverageSummary,
    ImpactNode,
    SimulationResult,
)
from . import timeutil as tu
from .households import ENGINE_VERSION, apply_disruptions, effective_predecessors, scenario_hash, validate_events
from .verifier import assignment_issues

EDGE_TYPES = {"assigned_to", "requires_resource", "requires_permission", "depends_on", "enables",
              "serves_dependent", "disrupted_by"}


def build_graph(h: Household, events: Optional[list[Disruption]] = None,
                assignments: Optional[list[Assignment]] = None) -> nx.MultiDiGraph:
    g = nx.MultiDiGraph()
    for m in h.members:
        g.add_node(m.id, type="person", label=m.name, role=m.role, dependent=m.isDependent)
    for t in h.tasks:
        g.add_node(t.id, type="task", label=t.title, tier=t.tier)
    for r in h.resources:
        g.add_node(r.id, type="resource", label=r.name, resourceType=r.type)
    for ms in h.milestones:
        g.add_node(ms.id, type="milestone", label=ms.title)
    for ev in events or []:
        g.add_node(ev.id, type="disruption", label=ev.reason or ev.type.replace("_", " "))
        for eid in ev.affectedEntityIds:
            if eid in g:
                g.add_edge(eid, ev.id, type="disrupted_by")
    for a in (assignments if assignments is not None else h.baselineAssignments):
        if a.taskId not in g or a.memberId not in g:
            continue
        g.add_edge(a.taskId, a.memberId, type="assigned_to")
        t = h.task(a.taskId)
        if t and t.requiredPermissions:
            g.add_edge(a.taskId, a.memberId, type="requires_permission")
        for rid in a.resourceIds:
            if rid in g:
                g.add_edge(a.taskId, rid, type="requires_resource")
    for t in h.tasks:
        for d in t.requiredDependentIds:
            if d in g:
                g.add_edge(t.id, d, type="serves_dependent")
        for p in t.predecessorTaskIds:
            if p in g:
                g.add_edge(t.id, p, type="depends_on")
        for ms in t.requiredMilestoneIds:
            if ms in g:
                g.add_edge(t.id, ms, type="depends_on")
    for ms in h.milestones:
        for tid in ms.enabledByTaskIds:
            if tid in g:
                g.add_edge(tid, ms.id, type="enables")
    return g


def graph_to_dict(g: nx.MultiDiGraph) -> dict[str, Any]:
    return {
        "nodes": [{"id": n, **d} for n, d in g.nodes(data=True)],
        "edges": [{"source": u, "target": v, "type": d["type"]} for u, v, d in g.edges(data=True)],
    }


def topological_task_order(h: Household) -> list[str]:
    dg = nx.DiGraph()
    for t in h.tasks:
        dg.add_node(t.id)
        for p in effective_predecessors(h, t):
            dg.add_edge(p, t.id)
    return list(nx.lexicographical_topological_sort(dg))


def weighted_coverage(h: Household, covered_ids: set[str]) -> CoverageSummary:
    cov: dict[str, int] = {str(i): 0 for i in range(4)}
    tot: dict[str, int] = {str(i): 0 for i in range(4)}
    wc = wt = 0
    for t in h.tasks:
        tot[str(t.tier)] += 1
        wt += t.priorityWeight
        if t.id in covered_ids:
            cov[str(t.tier)] += 1
            wc += t.priorityWeight
    return CoverageSummary(coveredByTier=cov, totalByTier=tot, weightedCoverage=round(wc / wt, 4) if wt else 1.0,
                           uncoveredTaskIds=sorted(t.id for t in h.tasks if t.id not in covered_ids))


def analyze_impact(h: Household, events: list[Disruption], household_version: int = 1,
                   scenario_version: int = 1) -> SimulationResult:
    t0 = time.perf_counter()
    validate_events(h, events)
    hyp = apply_disruptions(h, events)
    base_asg = {a.taskId: a for a in h.baselineAssignments}
    base_ok = {tid for tid, a in base_asg.items() if not assignment_issues(h, a)}
    hyp_issues = {tid: assignment_issues(hyp, a) for tid, a in base_asg.items()}
    direct_tasks = {t.id for t in h.tasks if t.id not in base_asg or hyp_issues.get(t.id)}

    g = build_graph(h, events)
    prop = nx.DiGraph()  # propagation graph: u → v with edge-type label
    category: dict[str, str] = {}
    reasons: dict[str, set[str]] = {}
    depth: dict[str, int] = {}

    def mark(n: str, cat: str, why: str, d: int) -> bool:
        first = n not in category
        if first or (cat == "directly_disrupted" and category[n] != "directly_disrupted"):
            category[n] = cat
        reasons.setdefault(n, set()).add(why)
        if n not in depth or d < depth[n]:
            depth[n] = d
        return first

    # seeds: disruption → targeted entity → baseline tasks that this event actually invalidates
    def event_hits(ev: Disruption, eid: str, tid: str) -> Optional[str]:
        a, t = base_asg.get(tid), h.task(tid)
        if t is None:
            return None
        if ev.type == "task_rescheduled":
            return "task_rescheduled" if tid == eid else None
        if a is None:
            return None
        if ev.type == "member_unavailable" and a.memberId == eid and tu.intersects(a.startMin, a.endMin, ev.startMin, ev.endMin):
            return "assigned_to"
        if ev.type == "availability_changed" and a.memberId == eid and not (ev.startMin <= a.startMin and a.endMin <= ev.endMin):
            return "assigned_to"
        if ev.type == "resource_unavailable" and eid in a.resourceIds and tu.intersects(a.startMin, a.endMin, ev.startMin, ev.endMin):
            return "requires_resource"
        if ev.type == "resource_capacity_changed" and eid in a.resourceIds:
            r = h.resource(eid)
            if r and t.resourceUnits.get(r.type, 1) > (ev.value or 0):
                return "requires_resource"
        return None

    for ev in events:
        mark(ev.id, "directly_disrupted", "DISRUPTION_ROOT", 0)
        for eid in ev.affectedEntityIds:
            prop.add_edge(ev.id, eid, type="disrupted_by")
            mark(eid, "directly_disrupted", ev.type.upper(), 1)
            for tid in sorted(direct_tasks):
                et = event_hits(ev, eid, tid)
                if et and et != "task_rescheduled":
                    prop.add_edge(eid, tid, type=et)
    frontier: list[str] = []
    for tid in sorted(direct_tasks):
        codes = {c for c, _ in hyp_issues.get(tid, [])} or {"NO_BASELINE_ASSIGNMENT"}
        if tid in base_asg and tid not in base_ok:
            codes.add("BASELINE_INVALID")
        if not any(prop.has_edge(u, tid) for u in prop.nodes) and tid not in prop and events:
            prop.add_edge(events[0].id, tid, type="disrupted_by")
        for c in codes:
            mark(tid, "directly_disrupted", c, 2)
        frontier.append(tid)

    # BFS over semantically valid downstream edges
    queue = list(frontier)
    while queue:
        u = queue.pop(0)
        du = depth[u]
        targets: list[tuple[str, str, str, str]] = []  # (target, edge type, reason, category)
        if h.task(u):
            for ms in h.milestones:
                if u in ms.enabledByTaskIds:
                    targets.append((ms.id, "enables", "PREREQUISITE_THREATENED", "at_risk_dependency"))
            for t in h.tasks:
                if u in t.predecessorTaskIds:
                    targets.append((t.id, "depends_on", "PREREQUISITE_THREATENED", "at_risk_dependency"))
            for d in h.task(u).requiredDependentIds:  # type: ignore[union-attr]
                targets.append((d, "serves_dependent", "DEPENDENT_AT_RISK", "at_risk_dependency"))
        elif h.milestone(u):
            for t in h.tasks:
                if u in t.requiredMilestoneIds:
                    targets.append((t.id, "depends_on", "PREREQUISITE_THREATENED", "at_risk_dependency"))
        for v, et, why, cat in targets:
            prop.add_edge(u, v, type=et)
            if mark(v, cat, why, du + 1):
                queue.append(v)
            else:
                depth[v] = min(depth[v], du + 1) if category[v] != "directly_disrupted" else depth[v]
                reasons[v].add(why)

    # causal paths (all simple paths from any disruption root, capped)
    roots = [ev.id for ev in events]
    nodes_out: list[ImpactNode] = []
    labels = {n: d.get("label", n) for n, d in g.nodes(data=True)}
    types = {n: d.get("type", "task") for n, d in g.nodes(data=True)}
    order = sorted(types, key=lambda n: (depth.get(n, 99), {"disruption": 0, "person": 1, "resource": 2, "task": 3, "milestone": 4}[types[n]], n))
    for n in order:
        cat = category.get(n, "unaffected")
        paths: list[CausalPath] = []
        if n in prop and n not in roots:
            for r in roots:
                if r in prop:
                    for p in nx.all_simple_paths(prop, r, n, cutoff=7):
                        paths.append(CausalPath(nodeIds=list(p), edgeTypes=[prop.edges[a, b]["type"] for a, b in zip(p, p[1:])]))
            paths.sort(key=lambda cp: (len(cp.nodeIds), cp.nodeIds))
            paths = paths[:6]
        nodes_out.append(ImpactNode(id=n, nodeType=types[n], label=str(labels[n]), category=cat,  # type: ignore[arg-type]
                                    reasonCodes=sorted(reasons.get(n, [])), depth=depth.get(n, 0), causalPaths=paths,
                                    explanation=""))
    from .explanations import explain_impact_node  # local import to avoid cycle at import time

    for node in nodes_out:
        node.explanation = explain_impact_node(h, hyp, events, node)

    max_depth = max((depth[n] for n in depth), default=0)
    cascade: list[CascadeStep] = []
    for d in range(0, max_depth + 1):
        ids = sorted(n for n in depth if depth[n] == d)
        edges = sorted((u, v, prop.edges[u, v]["type"]) for u, v in prop.edges if depth.get(v) == d)
        if ids:
            cascade.append(CascadeStep(depth=d, nodeIds=ids, edges=edges))

    affected_tasks = sorted(n for n in category if h.task(n))
    direct_ids = sorted(n for n, c in category.items() if c == "directly_disrupted" and n not in roots)
    indirect_ids = sorted(n for n, c in category.items() if c == "at_risk_dependency")
    ok_after = {tid for tid in base_ok if tid not in category}
    warnings: list[str] = []
    for t in h.tasks:
        if t.id not in base_asg:
            warnings.append(f"Task {t.id} has no baseline assignment and counts as uncovered.")
        elif t.id not in base_ok:
            warnings.append(f"Baseline assignment for {t.id} is already invalid before the disruption.")
    return SimulationResult(
        simulationId="sim-" + uuid.uuid4().hex[:10], householdId=h.id, householdVersion=household_version,
        scenarioVersion=scenario_version, inputHash=scenario_hash(h, events), engineVersion=ENGINE_VERSION,
        computedAt=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        calculationStatus="warnings" if warnings else "ok", directEntityIds=direct_ids, indirectEntityIds=indirect_ids,
        affectedTaskIds=affected_tasks, nodes=nodes_out, cascade=cascade, maxDepth=max_depth,
        baselineCoverage=weighted_coverage(h, base_ok), postDisruptionCoverage=weighted_coverage(h, ok_after),
        warnings=warnings, durationMs=round((time.perf_counter() - t0) * 1000, 2))


__all__ = ["build_graph", "graph_to_dict", "analyze_impact", "topological_task_order", "weighted_coverage",
           "EDGE_TYPES"]

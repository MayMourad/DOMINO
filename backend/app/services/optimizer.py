"""CP-SAT recovery optimizer.

Formulation (one boolean per candidate ``c = (task t, member p, start s, resource set r)``):

    x[c] ∈ {0,1}                        candidate selected
    covered[t] = Σ_{c∈t} x[c] ≤ 1      task has (at most) one primary assignment; uncovered[t] = 1 - covered[t]
    NoOverlap(optional fixed-size intervals of p)         a member never double-books
    NoOverlap / Cumulative(intervals using resource q)    exclusive / shared resource capacity
    covered[t] ⇒ covered[π] ∧ start[t] ≥ end[π]  ∀π ∈ preds(t)   precedence (tasks and milestones)
    x[c] + x[c'] ≤ 1 where the travel gap between c and c' (same member) is too short

Objectives are optimised *lexicographically*, one CP-SAT solve per pass, fixing each optimum before the next:
coverage of Tier 0, Tier 1, Tier 2, Tier 3 (priority-weighted within a tier), then the strategy's secondary
preferences. No weights can let a convenience task outweigh an essential one.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Optional

from ortools.sat.python import cp_model

from ..models.domain import Assignment, Household, Pin, Rejection
from ..models.results import ObjectiveValue
from .candidate_generation import Cand, CandidateSet, generate_candidates
from .households import effective_predecessors

STRATEGY_LABELS = {
    "priority_first": "Priority First",
    "minimum_change": "Minimum Change",
    "balanced_workload": "Balanced Workload",
}


@dataclass
class SolveResult:
    status: str
    assignments: list[Assignment] = field(default_factory=list)
    elapsed_ms: float = 0.0
    solver_wall_ms: float = 0.0
    objectives: list[ObjectiveValue] = field(default_factory=list)
    candidate_count: int = 0
    passes: int = 0
    error: Optional[str] = None
    note: Optional[str] = None


def map_status(s: int) -> str:
    return {
        cp_model.OPTIMAL: "OPTIMAL",
        cp_model.FEASIBLE: "FEASIBLE",
        cp_model.INFEASIBLE: "INFEASIBLE",
        cp_model.MODEL_INVALID: "MODEL_INVALID",
    }.get(s, "UNKNOWN")


def plan_signature(assignments: list[Assignment]) -> str:
    return "|".join(sorted(f"{a.taskId}:{a.memberId}@{a.startMin}:{'+'.join(sorted(a.resourceIds))}" for a in assignments))


def solve_model(model: cp_model.CpModel, limit_s: float, seed: int = 1) -> tuple[cp_model.CpSolver, str]:
    """Validate then solve; invalid models are reported as MODEL_INVALID, never solved."""
    err = model.Validate()
    solver = cp_model.CpSolver()
    if err:
        return solver, "MODEL_INVALID"
    solver.parameters.max_time_in_seconds = max(0.05, limit_s)
    solver.parameters.num_workers = 1  # deterministic
    solver.parameters.random_seed = seed
    return solver, map_status(solver.Solve(model))


def solve_strategy(
    hyp: Household,
    base: Household,
    strategy: str,
    cs: Optional[CandidateSet] = None,
    time_limit: float = 2.0,
    seed: int = 1,
    exclude_signatures: Optional[list[str]] = None,
    rejections: Optional[list[Rejection]] = None,
    pins: Optional[list[Pin]] = None,
) -> SolveResult:
    t_start = time.perf_counter()
    cs = cs or generate_candidates(hyp, rejections, pins, base)
    cands = cs.cands
    m = cp_model.CpModel()
    x = {c.idx: m.NewBoolVar(f"x{c.idx}") for c in cands}
    by_task: dict[str, list[Cand]] = {t.id: [] for t in hyp.tasks}
    for c in cands:
        by_task[c.task_id].append(c)
    covered = {}
    for t in hyp.tasks:
        covered[t.id] = m.NewBoolVar(f"cov_{t.id}")
        m.Add(sum(x[c.idx] for c in by_task[t.id]) == covered[t.id])

    # --- member no-overlap ---
    ivs = {c.idx: m.NewOptionalFixedSizeIntervalVar(c.start, c.end - c.start, x[c.idx], f"iv{c.idx}") for c in cands}
    for mem in hyp.members:
        mine = [ivs[c.idx] for c in cands if c.member_id == mem.id]
        if len(mine) > 1:
            m.AddNoOverlap(mine)

    # --- resources ---
    for r in hyp.resources:
        users = [c for c in cands if r.id in c.resource_ids]
        if len(users) < 1:
            continue
        if r.exclusive:
            m.AddNoOverlap([ivs[c.idx] for c in users])
        else:
            demands = []
            for c in users:
                t = hyp.task(c.task_id)
                assert t
                demands.append(t.resourceUnits.get(r.type, 1))
            m.AddCumulative([ivs[c.idx] for c in users], demands, r.capacity)

    # --- precedence ---
    start_v: dict[str, cp_model.LinearExpr] = {}
    end_v: dict[str, cp_model.LinearExpr] = {}
    for t in hyp.tasks:
        start_v[t.id] = sum(c.start * x[c.idx] for c in by_task[t.id]) if by_task[t.id] else 0
        end_v[t.id] = sum(c.end * x[c.idx] for c in by_task[t.id]) if by_task[t.id] else 0
    for t in hyp.tasks:
        if not by_task[t.id]:
            continue
        for p in effective_predecessors(hyp, t):
            if hyp.task(p) is None:
                m.Add(covered[t.id] == 0)
                continue
            m.AddImplication(covered[t.id], covered[p])
            m.Add(start_v[t.id] >= end_v[p]).OnlyEnforceIf(covered[t.id])

    # --- travel transitions between different tasks of one member ---
    for i, ta in enumerate(hyp.tasks):
        for tb in hyp.tasks[i + 1:]:
            need_ab = hyp.travel(ta.destinationLocationId, tb.originLocationId)
            need_ba = hyp.travel(tb.destinationLocationId, ta.originLocationId)
            if need_ab == 0 and need_ba == 0:
                continue
            for ca in by_task[ta.id]:
                for cb in by_task[tb.id]:
                    if ca.member_id != cb.member_id:
                        continue
                    a_first_bad = ca.end + (need_ab if need_ab >= 0 else 10 ** 6) > cb.start and ca.start < cb.end
                    b_first_bad = cb.end + (need_ba if need_ba >= 0 else 10 ** 6) > ca.start and cb.start < ca.end
                    # conflict iff neither ordering leaves enough room
                    if a_first_bad and b_first_bad:
                        m.AddBoolOr([x[ca.idx].Not(), x[cb.idx].Not()])

    # --- no-good cuts for "find another arrangement" ---
    for sig in exclude_signatures or []:
        chosen = set()
        for part in sig.split("|"):
            if not part:
                continue
            tm, rest = part.split(":", 1)
            mem, rest2 = rest.split("@", 1)
            start, res = rest2.split(":", 1)
            for c in by_task.get(tm, []):
                if c.member_id == mem and c.start == int(start) and "+".join(sorted(c.resource_ids)) == res:
                    chosen.add(c.idx)
        n_sel = len({p for p in sig.split("|") if p})
        if chosen and len(chosen) == n_sel:
            m.Add(sum(x[i] for i in chosen) - sum(x[i] for i in x if i not in chosen) <= n_sel - 1)

    # --- objective terms ---
    base_asg = {a.taskId: a for a in base.baselineAssignments}

    def changed(c: Cand) -> int:
        b = base_asg.get(c.task_id)
        return int(b is not None and (b.memberId != c.member_id or b.startMin != c.start))

    def disp(c: Cand) -> int:
        b = base_asg.get(c.task_id)
        return abs(c.start - b.startMin) if b else 0

    def reassigned(c: Cand) -> int:
        b = base_asg.get(c.task_id)
        return int(b is not None and b.memberId != c.member_id)

    def res_switch(c: Cand) -> int:
        b = base_asg.get(c.task_id)
        return int(b is not None and sorted(b.resourceIds) != sorted(c.resource_ids))

    def term(fn) -> cp_model.LinearExpr:
        return sum(fn(c) * x[c.idx] for c in cands if fn(c)) if cands else 0

    passes: list[tuple[str, str, object]] = []  # (name, sense, expr)
    for tier in (0, 1, 2, 3):
        ts = [t for t in hyp.tasks if t.tier == tier]
        if ts:
            passes.append((f"tier{tier}_weighted_coverage", "max", sum(t.priorityWeight * covered[t.id] for t in ts)))

    workers = [mem for mem in hyp.members if not mem.isDependent]

    def balanced_terms() -> list[tuple[str, str, object]]:
        horizon = 1440 * 2
        loads = {}
        for mem in workers:
            loads[mem.id] = mem.baselineWorkloadMinutes + sum(
                (c.end - c.start) * x[c.idx] for c in cands if c.member_id == mem.id)
        hi, lo = m.NewIntVar(0, horizon, "max_load"), m.NewIntVar(0, horizon, "min_load")
        for ld in loads.values():
            m.Add(hi >= ld)
            m.Add(lo <= ld)
        return [("max_workload_minutes", "min", hi), ("workload_spread_minutes", "min", hi - lo)]

    if strategy == "priority_first":
        passes += [("total_displacement_minutes", "min", term(disp)), ("changed_assignments", "min", term(changed))]
    elif strategy == "minimum_change":
        passes += [("changed_assignments", "min", term(changed)), ("total_displacement_minutes", "min", term(disp)),
                   ("resource_switches", "min", term(res_switch))]
    elif strategy == "balanced_workload":
        passes += balanced_terms() + [("changed_assignments", "min", term(changed)),
                                       ("total_displacement_minutes", "min", term(disp))]
    else:
        raise ValueError(f"unknown strategy {strategy}")
    _ = reassigned  # exposed via metrics, not an optimisation pass

    deadline = time.perf_counter() + time_limit
    objectives: list[ObjectiveValue] = []
    status_all = "OPTIMAL"
    chosen: Optional[list[int]] = None
    wall = 0.0
    note = None
    err = m.Validate()
    if err:
        return SolveResult("MODEL_INVALID", elapsed_ms=round((time.perf_counter() - t_start) * 1000, 2),
                           candidate_count=len(cands), error=err[:200])
    passes = [p for p in passes if not isinstance(p[2], int)]  # constant objectives carry no information
    for n_pass, (name, sense, expr) in enumerate(passes):
        remaining = deadline - time.perf_counter()
        if remaining <= 0.02 and chosen is not None:
            status_all, note = "FEASIBLE", "time budget exhausted before all objective passes completed"
            break
        if sense == "max":
            m.Maximize(expr)  # type: ignore[arg-type]
        else:
            m.Minimize(expr)  # type: ignore[arg-type]
        solver, st = solve_model(m, remaining, seed)
        wall += solver.WallTime()
        if st in ("OPTIMAL", "FEASIBLE"):
            chosen = [c.idx for c in cands if solver.Value(x[c.idx])]
            val = int(round(solver.ObjectiveValue()))
            objectives.append(ObjectiveValue(name=name, value=val))
            m.Add(expr >= val) if sense == "max" else m.Add(expr <= val)  # type: ignore[operator]
            if st == "FEASIBLE":
                status_all = "FEASIBLE"
        else:
            if chosen is None:
                return SolveResult(st, elapsed_ms=round((time.perf_counter() - t_start) * 1000, 2),
                                   candidate_count=len(cands), passes=n_pass, error=None,
                                   note="no conclusive result within the limit" if st == "UNKNOWN" else None)
            status_all, note = "FEASIBLE", f"pass '{name}' ended {st}; earlier optimum retained"
            break
    chosen_set = set(chosen or [])
    asg = []
    for c in cands:
        if c.idx in chosen_set:
            b = base_asg.get(c.task_id)
            asg.append(Assignment(taskId=c.task_id, memberId=c.member_id, startMin=c.start, endMin=c.end,
                                  resourceIds=list(c.resource_ids), itineraryId=b.itineraryId if b else None,
                                  changedFromBaseline=bool(b is None or changed(c) or res_switch(c))))
    asg.sort(key=lambda a: (a.startMin, a.taskId))
    return SolveResult(status_all, asg, round((time.perf_counter() - t_start) * 1000, 2), round(wall * 1000, 2),
                       objectives, len(cands), len(passes), None, note)

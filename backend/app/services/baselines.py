"""Comparison baselines (Section 17.9): No Recovery and Greedy First Fit. Both are verified independently."""

from __future__ import annotations

import time
from dataclasses import dataclass

from ..models.domain import Assignment, Disruption, Household
from . import timeutil as tu
from .candidate_generation import generate_candidates
from .households import apply_disruptions, effective_predecessors, input_hash
from .recovery import compute_metrics
from .verifier import assignment_issues, verify_plan


@dataclass
class BaselineOutcome:
    name: str
    assignments: list[Assignment]
    elapsed_ms: float
    valid: bool
    hard_violations: int
    critical_uncovered: list[str]
    weighted_coverage: float
    covered_count: int
    changes: int


def _wrap(name: str, base: Household, events: list[Disruption], asg: list[Assignment], ms: float) -> BaselineOutcome:
    hyp = apply_disruptions(base, events)
    unc = sorted(t.id for t in hyp.tasks if t.id not in {a.taskId for a in asg})
    h = input_hash(base, events, [], [])
    rep = verify_plan(base, events, asg, unc, name, h, h)
    met = compute_metrics(hyp, base, asg)
    base_asg = {a.taskId: a for a in base.baselineAssignments}
    changes = sum(1 for a in asg if (b := base_asg.get(a.taskId)) is None or b.memberId != a.memberId or b.startMin != a.startMin)
    return BaselineOutcome(name, asg, ms, rep.overallStatus == "valid", rep.hardViolations,
                           rep.uncoveredCriticalTaskIds, met.weightedCoverage, met.coveredCount, changes)


def no_recovery(base: Household, events: list[Disruption]) -> BaselineOutcome:
    """Baseline A: keep the original schedule; invalidated assignments simply count as uncovered."""
    t0 = time.perf_counter()
    hyp = apply_disruptions(base, events)
    kept: list[Assignment] = []
    for a in base.baselineAssignments:
        if assignment_issues(hyp, a):
            continue
        kept.append(a)
    # a dependent task whose prerequisite was dropped is not completed either
    changed = True
    while changed:
        changed = False
        ids = {a.taskId for a in kept}
        for a in list(kept):
            t = hyp.task(a.taskId)
            if t and any(p not in ids for p in effective_predecessors(hyp, t)):
                kept.remove(a)
                changed = True
    return _wrap("no_recovery", base, events, kept, round((time.perf_counter() - t0) * 1000, 3))


def greedy_first_fit(base: Household, events: list[Disruption]) -> BaselineOutcome:
    """Baseline B: tasks in descending priority; first eligible member/start/resource that causes no conflict."""
    t0 = time.perf_counter()
    hyp = apply_disruptions(base, events)
    cs = generate_candidates(hyp, [], [], base)
    chosen: list[Assignment] = []
    order = sorted(hyp.tasks, key=lambda t: (t.tier, -t.priorityWeight, t.id))
    done = set()
    pending = list(order)
    # respect prerequisites: retry tasks until no progress
    progress = True
    while pending and progress:
        progress = False
        for t in list(pending):
            preds = effective_predecessors(hyp, t)
            if any(p not in done and any(x.id == p for x in pending) for p in preds):
                continue
            pending.remove(t)
            progress = True
            if any(p not in done for p in preds):
                continue
            for c in sorted(cs.for_task(t.id), key=lambda c: (c.start, c.member_id, c.resource_ids)):
                cand = Assignment(taskId=t.id, memberId=c.member_id, startMin=c.start, endMin=c.end,
                                  resourceIds=list(c.resource_ids))
                if any(tu.intersects(o.startMin, o.endMin, c.start, c.end) and (
                        o.memberId == c.member_id or set(o.resourceIds) & set(c.resource_ids)) for o in chosen):
                    continue
                if any(p_end > c.start for p_end in (o.endMin for o in chosen if o.taskId in preds)):
                    continue
                chosen.append(cand)
                done.add(t.id)
                break
    chosen.sort(key=lambda a: (a.startMin, a.taskId))
    return _wrap("greedy_first_fit", base, events, chosen, round((time.perf_counter() - t0) * 1000, 3))

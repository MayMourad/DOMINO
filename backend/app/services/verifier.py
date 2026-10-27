"""Independent plan verifier — a separate trust boundary.

This module deliberately imports nothing from the optimizer or the candidate
generator. It recomputes every rule directly from the household state, the
confirmed disruptions and the proposed assignments using plain interval
arithmetic.
"""

from __future__ import annotations

from datetime import datetime, timezone
from itertools import combinations

from ..models.domain import Assignment, Disruption, Household, HouseholdResource, HouseholdTask, Pin, Rejection
from ..models.results import ValidationCheck, ValidationReport
from . import timeutil as tu
from .households import apply_disruptions, effective_predecessors, resource_windows

RULES: dict[str, str] = {
    "V01": "Every referenced task, member and resource exists",
    "V02": "Each task has at most one primary assignment",
    "V03": "Assigned member holds all required skills and is not a dependent",
    "V04": "Assigned member holds all required explicit permissions and has no conflicting restriction",
    "V05": "Assigned member is on the task's eligibility list and not excluded",
    "V06": "Assignment interval matches the task duration and lies inside the task window",
    "V07": "Member is available for the entire interval",
    "V08": "A member never performs overlapping assignments (including required travel gaps)",
    "V09": "Every assigned resource is available for the entire interval",
    "V10": "Resource exclusivity and capacity are respected",
    "V11": "Required resource types are satisfied by compatible, permitted resources",
    "V12": "Dependent care is performed only by a member specifically authorized for that dependent",
    "V13": "Predecessor tasks and milestones are completed before dependent tasks start",
    "V14": "Itinerary and travel assumptions are respected",
    "V15": "Plan corresponds to the current scenario hash",
    "V16": "Coverage of critical tasks is reported accurately",
    "V17": "Consent-dependent actions remain pending approval",
    "V18": "User rejections and pinned assignments are honored",
}


def _units(t: HouseholdTask, rtype: str) -> int:
    return t.resourceUnits.get(rtype, 1)


def assignment_issues(h: Household, a: Assignment) -> list[tuple[str, str]]:
    """All single-assignment problems as (code, message). Empty ⇒ locally valid."""
    out: list[tuple[str, str]] = []
    t, m = h.task(a.taskId), h.member(a.memberId)
    if t is None:
        return [("INVALID_REFERENCE", f"task {a.taskId} does not exist")]
    if m is None:
        return [("INVALID_REFERENCE", f"member {a.memberId} does not exist")]
    for rid in a.resourceIds:
        if h.resource(rid) is None:
            out.append(("INVALID_REFERENCE", f"resource {rid} does not exist"))
    if out:
        return out
    if m.isDependent:
        out.append(("DEPENDENT_ASSIGNED", f"{m.name} is a dependent and cannot be assigned responsibilities"))
    if t.eligibleMemberIds is not None and m.id not in t.eligibleMemberIds:
        out.append(("NOT_ELIGIBLE", f"{m.name} is not on the eligibility list for {t.title}"))
    if m.id in t.excludedMemberIds:
        out.append(("EXCLUDED_MEMBER", f"{m.name} is explicitly excluded from {t.title}"))
    for s in t.requiredSkills:
        if s not in m.skills:
            out.append(("MISSING_SKILL", f"{m.name} lacks required skill '{s}'"))
    for p in t.requiredPermissions:
        if p not in m.permissions:
            out.append(("MISSING_PERMISSION", f"{m.name} lacks required permission '{p}'"))
    for r in m.restrictions:
        if r in t.requiredPermissions or r in t.requiredSkills or any(r == f"no_{p}" for p in t.requiredPermissions):
            out.append(("RESTRICTED", f"{m.name} has restriction '{r}' that conflicts with {t.title}"))
    for d in t.requiredDependentIds:
        if d not in m.authorizedDependentIds:
            out.append(("DEPENDENT_NOT_AUTHORIZED", f"{m.name} is not authorized for dependent {d}"))
    if a.endMin - a.startMin != t.durationMin:
        out.append(("DURATION_MISMATCH", f"interval {tu.fmt_range(a.startMin, a.endMin)} is not {t.durationMin} min"))
    if a.startMin < t.earliestStartMin or a.endMin > t.latestEndMin:
        out.append(("OUTSIDE_TASK_WINDOW", f"{tu.fmt_range(a.startMin, a.endMin)} is outside the task window "
                                          f"{tu.fmt_range(t.earliestStartMin, t.latestEndMin)}"))
    if t.fixedStartMin is not None and a.startMin != t.fixedStartMin:
        out.append(("FIXED_START_VIOLATED", f"task must start at {tu.fmt(t.fixedStartMin)}"))
    if not tu.contains(m.availability, a.startMin, a.endMin):
        out.append(("MEMBER_UNAVAILABLE", f"{m.name} is not available for {tu.fmt_range(a.startMin, a.endMin)}"))
    used_types: dict[str, HouseholdResource] = {}
    for rid in a.resourceIds:
        r = h.resource(rid)
        assert r is not None
        if r.type in used_types:
            out.append(("RESOURCE_TYPE_DUPLICATE", f"more than one '{r.type}' assigned"))
        used_types[r.type] = r
        if r.type not in t.requiredResourceTypes:
            out.append(("RESOURCE_NOT_REQUIRED", f"{r.name} is not a required resource type for {t.title}"))
        if not tu.contains(resource_windows(r), a.startMin, a.endMin):
            out.append(("RESOURCE_UNAVAILABLE", f"{r.name} is not available for {tu.fmt_range(a.startMin, a.endMin)}"))
        if r.allowedMemberIds is not None and m.id not in r.allowedMemberIds:
            out.append(("RESOURCE_NOT_PERMITTED", f"{m.name} may not use {r.name}"))
        if _units(t, r.type) > r.capacity:
            out.append(("RESOURCE_CAPACITY_EXCEEDED", f"{t.title} needs {_units(t, r.type)} units of {r.name} "
                                                       f"but capacity is {r.capacity}"))
    for rtype in t.requiredResourceTypes:
        if rtype not in used_types:
            out.append(("RESOURCE_MISSING", f"no '{rtype}' resource assigned"))
    return out


def _transition_gap_ok(h: Household, a: Assignment, b: Assignment) -> tuple[bool, str]:
    """a precedes-or-equals b in time for the same member."""
    ta, tb = h.task(a.taskId), h.task(b.taskId)
    if ta is None or tb is None:
        return True, ""
    need = h.travel(ta.destinationLocationId, tb.originLocationId)
    gap = b.startMin - a.endMin
    if need == -1:
        return False, (f"{ta.id}→{tb.id} requires moving {ta.destinationLocationId}→{tb.originLocationId} "
                       f"but no travel time is modelled")
    if gap < need:
        return False, f"only {gap} min between {ta.id} and {tb.id}, travel needs {need} min"
    return True, f"gap {gap} min ≥ travel {need} min"


def verify_plan(
    household: Household,
    events: list[Disruption],
    assignments: list[Assignment],
    claimed_uncovered: list[str],
    plan_id: str,
    plan_hash: str,
    expected_hash: str,
    rejections: list[Rejection] | None = None,
    pins: list[Pin] | None = None,
    claimed_pending_consent: list[str] | None = None,
) -> ValidationReport:
    h = apply_disruptions(household, events)
    checks: list[ValidationCheck] = []
    warnings: list[str] = []

    def chk(rule: str, ids: list[str], ok: bool, evidence: str, code: str | None = None) -> None:
        checks.append(ValidationCheck(ruleId=rule, description=RULES[rule], affectedEntityIds=ids,
                                      passed=ok, evidence=evidence, errorCode=None if ok else (code or rule)))

    # V01 / V02 -------------------------------------------------------------
    seen: dict[str, int] = {}
    for a in assignments:
        seen[a.taskId] = seen.get(a.taskId, 0) + 1
    refs_ok = True
    for a in assignments:
        probs = [msg for code, msg in assignment_issues(h, a) if code == "INVALID_REFERENCE"]
        refs_ok &= not probs
        chk("V01", [a.taskId, a.memberId], not probs, "; ".join(probs) or "all referenced entities exist",
            "INVALID_REFERENCE")
    for tid, n in seen.items():
        chk("V02", [tid], n == 1, f"{tid} appears {n} time(s)" if n != 1 else f"{tid} assigned exactly once",
            "DUPLICATE_ASSIGNMENT")

    # Per-assignment local rules -------------------------------------------
    rule_codes = {
        "V03": {"MISSING_SKILL", "DEPENDENT_ASSIGNED"},
        "V04": {"MISSING_PERMISSION", "RESTRICTED"},
        "V05": {"NOT_ELIGIBLE", "EXCLUDED_MEMBER"},
        "V06": {"DURATION_MISMATCH", "OUTSIDE_TASK_WINDOW", "FIXED_START_VIOLATED"},
        "V07": {"MEMBER_UNAVAILABLE"},
        "V09": {"RESOURCE_UNAVAILABLE"},
        "V11": {"RESOURCE_MISSING", "RESOURCE_NOT_REQUIRED", "RESOURCE_TYPE_DUPLICATE", "RESOURCE_NOT_PERMITTED"},
        "V12": {"DEPENDENT_NOT_AUTHORIZED"},
    }
    for a in assignments:
        if h.task(a.taskId) is None or h.member(a.memberId) is None:
            continue
        iss = assignment_issues(h, a)
        m, t = h.member(a.memberId), h.task(a.taskId)
        assert m and t
        for rule, codes in rule_codes.items():
            bad = [(c, msg) for c, msg in iss if c in codes]
            ok_text = {
                "V03": f"{m.name} holds skills {t.requiredSkills or '[none required]'}",
                "V04": f"{m.name} holds permissions {t.requiredPermissions or '[none required]'}",
                "V05": f"{m.name} is eligible for {t.title}",
                "V06": f"{tu.fmt_range(a.startMin, a.endMin)} fits {tu.fmt_range(t.earliestStartMin, t.latestEndMin)}",
                "V07": f"{m.name} available over {tu.fmt_range(a.startMin, a.endMin)}",
                "V09": f"resources {a.resourceIds or '[none]'} available over {tu.fmt_range(a.startMin, a.endMin)}",
                "V11": f"resource types {t.requiredResourceTypes or '[none]'} satisfied by {a.resourceIds or '[none]'}",
                "V12": f"{m.name} authorized for {t.requiredDependentIds or 'no dependents required'}",
            }[rule]
            chk(rule, [a.taskId, a.memberId], not bad, "; ".join(msg for _, msg in bad) or ok_text,
                bad[0][0] if bad else None)

    # V08 overlap + V14 travel ---------------------------------------------
    by_member: dict[str, list[Assignment]] = {}
    for a in assignments:
        by_member.setdefault(a.memberId, []).append(a)
    for mid, lst in by_member.items():
        lst = sorted(lst, key=lambda x: (x.startMin, x.endMin))
        bad_pairs = [(a, b) for a, b in combinations(lst, 2) if tu.intersects(a.startMin, a.endMin, b.startMin, b.endMin)]
        chk("V08", [mid] + [x.taskId for x in lst], not bad_pairs,
            "; ".join(f"{a.taskId} {tu.fmt_range(a.startMin, a.endMin)} overlaps {b.taskId} {tu.fmt_range(b.startMin, b.endMin)}"
                      for a, b in bad_pairs) or f"{len(lst)} assignment(s) for {mid} do not overlap",
            "MEMBER_OVERLAP")
        trav_bad: list[str] = []
        for a, b in zip(lst, lst[1:]):
            if tu.intersects(a.startMin, a.endMin, b.startMin, b.endMin):
                continue
            ok, why = _transition_gap_ok(h, a, b)
            if not ok:
                trav_bad.append(why)
        chk("V14", [mid], not trav_bad, "; ".join(trav_bad) or "itinerary durations include transit; transitions respected",
            "TRAVEL_VIOLATION")

    # V10 resources ---------------------------------------------------------
    use: dict[str, list[tuple[Assignment, int]]] = {}
    for a in assignments:
        t = h.task(a.taskId)
        if t is None:
            continue
        for rid in a.resourceIds:
            r = h.resource(rid)
            if r is not None:
                use.setdefault(rid, []).append((a, _units(t, r.type)))
    for rid, lst in use.items():
        r = h.resource(rid)
        assert r
        bad: list[str] = []
        if r.exclusive:
            for (a, _), (b, _) in combinations(lst, 2):
                if tu.intersects(a.startMin, a.endMin, b.startMin, b.endMin):
                    bad.append(f"{a.taskId} and {b.taskId} both use exclusive {r.name} at the same time")
        points = sorted({x.startMin for x, _ in lst})
        for p in points:
            load = sum(u for x, u in lst if x.startMin <= p < x.endMin)
            if load > r.capacity:
                bad.append(f"load {load} exceeds capacity {r.capacity} of {r.name} at {tu.fmt(p)}")
                break
        chk("V10", [rid] + [x.taskId for x, _ in lst], not bad,
            "; ".join(bad) or f"{r.name}: {len(lst)} booking(s) within capacity {r.capacity}"
            + (" and exclusive" if r.exclusive else ""), "RESOURCE_CONFLICT")

    # V13 precedence --------------------------------------------------------
    asg = {a.taskId: a for a in assignments}
    for a in assignments:
        t = h.task(a.taskId)
        if t is None:
            continue
        preds = effective_predecessors(h, t)
        problems = []
        for p in preds:
            pa = asg.get(p)
            if pa is None:
                problems.append(f"prerequisite {p} is not covered")
            elif pa.endMin > a.startMin:
                problems.append(f"prerequisite {p} ends {tu.fmt(pa.endMin)} after {t.id} starts {tu.fmt(a.startMin)}")
        chk("V13", [a.taskId] + preds, not problems,
            "; ".join(problems) or (f"prerequisites {preds} complete before {tu.fmt(a.startMin)}" if preds else "no prerequisites"),
            "PRECEDENCE_UNMET")

    # V15 hash --------------------------------------------------------------
    chk("V15", [], plan_hash == expected_hash,
        f"plan hash {plan_hash} {'matches' if plan_hash == expected_hash else 'does NOT match current'} {expected_hash}",
        "STALE_SCENARIO")

    # V16 coverage ----------------------------------------------------------
    truly_uncovered = sorted(t.id for t in h.tasks if t.id not in asg)
    critical = sorted(t.id for t in h.tasks if t.id not in asg and t.tier <= 1 and not t.isOptional)
    ok16 = sorted(claimed_uncovered) == truly_uncovered
    chk("V16", truly_uncovered, ok16,
        f"claimed uncovered {sorted(claimed_uncovered)}, actual uncovered {truly_uncovered}" if not ok16
        else f"uncovered set {truly_uncovered or '[]'} reported exactly", "COVERAGE_MISREPORTED")

    # V17 consent -----------------------------------------------------------
    consent_needed = sorted(a.taskId for a in assignments if (h.task(a.taskId) and h.task(a.taskId).requiredConsent))  # type: ignore[union-attr]
    ok17 = claimed_pending_consent is None or sorted(claimed_pending_consent) == consent_needed
    chk("V17", consent_needed, ok17,
        f"consent pending for {consent_needed or 'no tasks'} until each assignee confirms; DOMINO sends no notifications"
        if ok17 else f"consent list {claimed_pending_consent} != required {consent_needed}", "CONSENT_STATE_INVALID")

    # V18 rejections / pins -------------------------------------------------
    rej_bad = [r for r in (rejections or []) for a in assignments
               if a.taskId == r.taskId and a.memberId == r.memberId and (r.startMin is None or r.startMin == a.startMin)]
    pin_bad = [p for p in (pins or []) if p.taskId in asg and (
        asg[p.taskId].memberId != p.memberId or (p.startMin is not None and asg[p.taskId].startMin != p.startMin))]
    chk("V18", [r.taskId for r in rej_bad] + [p.taskId for p in pin_bad], not rej_bad and not pin_bad,
        "a rejected or pinned constraint was violated" if rej_bad or pin_bad
        else f"{len(rejections or [])} rejection(s) and {len(pins or [])} pin(s) honored", "USER_CONSTRAINT_VIOLATED")

    hard = sum(1 for c in checks if not c.passed)
    all_uncovered = truly_uncovered
    completeness = "complete" if not all_uncovered else ("critical_complete" if not critical else "partial")
    status = "invalid" if hard else "valid"
    if hard:
        label = "Invalid plan — hard-constraint violations detected"
    elif completeness == "complete":
        label = "Verified complete recovery"
    elif completeness == "critical_complete":
        label = "Verified critical recovery — lower-priority tasks deferred"
    else:
        label = "Valid partial plan — human intervention required"
    explanations = [f"{c.ruleId} {c.errorCode}: {c.evidence}" for c in checks if not c.passed]
    if critical:
        warnings.append("Critical responsibilities remain uncovered: " + ", ".join(critical))
    if not refs_ok:
        warnings.append("Some references were invalid; dependent checks were skipped.")
    return ValidationReport(
        planId=plan_id, inputHash=plan_hash, expectedHash=expected_hash, overallStatus=status,
        completeness=completeness, hardViolations=hard, uncoveredCriticalTaskIds=critical, checks=checks,
        explanations=explanations, warnings=warnings,
        verifiedAt=datetime.now(timezone.utc).isoformat(timespec="seconds"), label=label)

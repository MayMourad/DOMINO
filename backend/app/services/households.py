"""Household domain layer: fixtures, structural validation, disruption application, hashing."""

from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable

from pydantic import ValidationError

from ..config import settings
from ..models.domain import (
    ApiError,
    Disruption,
    Household,
    HouseholdTask,
    Pin,
    Rejection,
    TimeWindow,
)
from . import timeutil as tu

ENGINE_VERSION = "domino-engine/1.0.0"
FIXTURE_IDS = ["amina", "multigenerational", "restricted-transport"]


# --------------------------------------------------------------------------- fixtures
def fixtures_dir() -> Path:
    return Path(settings.data_dir) / "households"


def load_fixture(fixture_id: str) -> Household:
    """Load a fixture strictly: no runtime repair, any issue is a hard failure."""
    if fixture_id not in FIXTURE_IDS:
        raise ApiError("FIXTURE_NOT_FOUND", f"Unknown household fixture '{fixture_id}'.", 404)
    path = fixtures_dir() / f"{fixture_id}.json"
    try:
        h = Household.model_validate_json(path.read_text(encoding="utf-8"))
    except ValidationError as exc:  # pragma: no cover - guarded by tests
        raise ApiError("FIXTURE_INVALID", f"Fixture '{fixture_id}' failed schema validation.", 500,
                       [str(exc)]) from exc
    issues = [i for i in validate_household(h) if i["severity"] == "error"]
    if issues:
        raise ApiError("FIXTURE_INVALID", f"Fixture '{fixture_id}' has integrity errors.", 500, issues)
    return h


# --------------------------------------------------------------------------- structure
def effective_predecessors(h: Household, t: HouseholdTask) -> list[str]:
    """Tasks that must finish before ``t`` starts (direct + via required milestones)."""
    preds = list(t.predecessorTaskIds)
    for mid in t.requiredMilestoneIds:
        m = h.milestone(mid)
        if m:
            preds.extend(m.enabledByTaskIds)
    return sorted(set(preds))


def find_cycle(h: Household) -> list[str] | None:
    graph = {t.id: [p for p in effective_predecessors(h, t) if h.task(p)] for t in h.tasks}
    state: dict[str, int] = {}
    stack: list[str] = []

    def dfs(n: str) -> list[str] | None:
        state[n] = 1
        stack.append(n)
        for p in graph.get(n, []):
            if state.get(p) == 1:
                return stack[stack.index(p):] + [p]
            if state.get(p) is None:
                found = dfs(p)
                if found:
                    return found
        stack.pop()
        state[n] = 2
        return None

    for n in graph:
        if state.get(n) is None:
            c = dfs(n)
            if c:
                return c
    return None


def _issue(code: str, severity: str, message: str, ids: Iterable[str] = ()) -> dict[str, Any]:
    return {"code": code, "severity": severity, "message": message, "entityIds": list(ids)}


def validate_household(h: Household, check_baseline: bool = True) -> list[dict[str, Any]]:
    """Referential + semantic validation. Errors block simulation; warnings do not."""
    issues: list[dict[str, Any]] = []
    seen: dict[str, str] = {}
    for kind, items in (("member", h.members), ("task", h.tasks), ("resource", h.resources),
                        ("milestone", h.milestones), ("location", h.locations)):
        for it in items:
            if it.id in seen:
                issues.append(_issue("DUPLICATE_ID", "error",
                                     f"Identifier '{it.id}' is used by both a {seen[it.id]} and a {kind}.", [it.id]))
            seen[it.id] = kind
    member_ids = {m.id for m in h.members}
    task_ids = {t.id for t in h.tasks}
    res_ids = {r.id for r in h.resources}
    ms_ids = {m.id for m in h.milestones}
    loc_ids = {loc.id for loc in h.locations}
    dependents = {m.id for m in h.members if m.isDependent}

    def ref(cond: bool, owner: str, what: str, rid: str) -> None:
        if not cond:
            issues.append(_issue("INVALID_REFERENCE", "error", f"{owner} references unknown {what} '{rid}'.", [owner]))

    for m in h.members:
        if loc_ids:
            ref(m.homeLocationId in loc_ids, m.id, "location", m.homeLocationId)
        for d in m.authorizedDependentIds:
            ref(d in member_ids, m.id, "dependent", d)
        if m.isDependent and m.authorizedDependentIds:
            issues.append(_issue("DEPENDENT_WITH_AUTHORIZATIONS", "error",
                                 f"Dependent {m.name} cannot be authorized to care for others.", [m.id]))
    for t in h.tasks:
        if t.earliestStartMin >= t.latestEndMin:
            issues.append(_issue("INVALID_WINDOW", "error",
                                 f"Task {t.id} window {tu.fmt_range(t.earliestStartMin, t.latestEndMin)} is empty.", [t.id]))
        elif t.durationMin > t.latestEndMin - t.earliestStartMin:
            issues.append(_issue("WINDOW_TOO_SHORT", "warning",
                                 f"Task {t.id} needs {t.durationMin} min but its window is "
                                 f"{t.latestEndMin - t.earliestStartMin} min; it cannot be scheduled.", [t.id]))
        if t.fixedStartMin is not None and not (
                t.earliestStartMin <= t.fixedStartMin and t.fixedStartMin + t.durationMin <= t.latestEndMin):
            issues.append(_issue("FIXED_START_OUTSIDE_WINDOW", "warning",
                                 f"Task {t.id} fixed start lies outside its window; it cannot be scheduled.", [t.id]))
        for p in t.predecessorTaskIds:
            ref(p in task_ids, t.id, "predecessor task", p)
            if p == t.id:
                issues.append(_issue("DEPENDENCY_CYCLE", "error", f"Task {t.id} depends on itself.", [t.id]))
        for ms in t.requiredMilestoneIds:
            ref(ms in ms_ids, t.id, "milestone", ms)
        for d in t.requiredDependentIds:
            ref(d in member_ids, t.id, "dependent", d)
            if d in member_ids and d not in dependents:
                issues.append(_issue("NOT_A_DEPENDENT", "error", f"{d} is not marked as a dependent.", [t.id, d]))
        for mid in (t.eligibleMemberIds or []) + t.excludedMemberIds:
            ref(mid in member_ids, t.id, "member", mid)
        if loc_ids:
            ref(t.originLocationId in loc_ids, t.id, "location", t.originLocationId)
            ref(t.destinationLocationId in loc_ids, t.id, "location", t.destinationLocationId)
        for rtype in t.requiredResourceTypes:
            if not any(r.type == rtype for r in h.resources):
                issues.append(_issue("NO_RESOURCE_OF_TYPE", "warning",
                                     f"Task {t.id} needs a '{rtype}' but the household has none; it cannot be covered.", [t.id]))
    for r in h.resources:
        if loc_ids:
            ref(r.locationId in loc_ids, r.id, "location", r.locationId)
        for mid in r.allowedMemberIds or []:
            ref(mid in member_ids, r.id, "member", mid)
    for ms in h.milestones:
        for tid in ms.enabledByTaskIds:
            ref(tid in task_ids, ms.id, "task", tid)
        if ms.dependentId:
            ref(ms.dependentId in member_ids, ms.id, "dependent", ms.dependentId)
    for a in h.baselineAssignments:
        ref(a.taskId in task_ids, "baseline", "task", a.taskId)
        ref(a.memberId in member_ids, "baseline", "member", a.memberId)
        for rid in a.resourceIds:
            ref(rid in res_ids, "baseline", "resource", rid)
    cyc = find_cycle(h)
    if cyc:
        issues.append(_issue("DEPENDENCY_CYCLE", "error", "Dependency cycle: " + " → ".join(cyc), cyc))
    if check_baseline and not any(i["severity"] == "error" for i in issues):
        from .verifier import assignment_issues  # local import: verifier is a separate trust boundary

        for a in h.baselineAssignments:
            for code, msg in assignment_issues(h, a):
                issues.append(_issue("BASELINE_INVALID", "warning", f"Baseline {a.taskId}: {msg}", [a.taskId, a.memberId]))
                break
    return issues


def parse_household(raw: dict[str, Any]) -> tuple[Household | None, list[dict[str, Any]]]:
    """Schema-validate raw JSON and return (household, issues)."""
    try:
        h = Household.model_validate(raw)
    except ValidationError as exc:
        return None, [
            _issue("SCHEMA_ERROR", "error", f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}", [])
            for e in exc.errors()
        ]
    return h, validate_household(h)


# --------------------------------------------------------------------------- disruptions
def validate_events(h: Household, events: list[Disruption]) -> None:
    member_ids = {m.id for m in h.members}
    res_ids = {r.id for r in h.resources}
    task_ids = {t.id for t in h.tasks}
    kinds = {
        "member_unavailable": member_ids, "availability_changed": member_ids,
        "resource_unavailable": res_ids, "resource_capacity_changed": res_ids, "task_rescheduled": task_ids,
    }
    seen: set[str] = set()
    for ev in events:
        if ev.id in seen:
            raise ApiError("DUPLICATE_EVENT_ID", f"Event id '{ev.id}' is duplicated.", 422)
        seen.add(ev.id)
        if not ev.confirmed:
            raise ApiError("UNCONFIRMED_EVENT", f"Event '{ev.id}' has not been confirmed by the user.", 422)
        if not ev.affectedEntityIds:
            raise ApiError("INVALID_REFERENCE", f"Event '{ev.id}' names no affected entity.", 422)
        for eid in ev.affectedEntityIds:
            if eid not in kinds[ev.type]:
                raise ApiError("INVALID_REFERENCE",
                               f"Event '{ev.id}' ({ev.type}) references '{eid}', which is not a valid target.", 422,
                               [{"entityId": eid}])


def apply_disruptions(h: Household, events: list[Disruption]) -> Household:
    """Return a hypothetical household; the input is never mutated."""
    hyp = h.model_copy(deep=True)
    for ev in events:
        for eid in ev.affectedEntityIds:
            if ev.type == "member_unavailable":
                m = hyp.member(eid)
                if m:
                    m.availability = tu.subtract(m.availability, ev.startMin, ev.endMin)
            elif ev.type == "availability_changed":
                m = hyp.member(eid)
                if m:
                    m.availability = [TimeWindow(startMin=ev.startMin, endMin=ev.endMin)]
            elif ev.type == "resource_unavailable":
                r = hyp.resource(eid)
                if r:
                    r.unavailableWindows = tu.normalize(r.unavailableWindows + [TimeWindow(startMin=ev.startMin, endMin=ev.endMin)])
            elif ev.type == "resource_capacity_changed":
                r = hyp.resource(eid)
                if r and ev.value is not None:
                    r.capacity = ev.value
            elif ev.type == "task_rescheduled":
                t = hyp.task(eid)
                if t:
                    t.earliestStartMin, t.latestEndMin = ev.startMin, ev.endMin
                    if t.fixedStartMin is not None:
                        t.fixedStartMin = ev.startMin
    return hyp


def resource_windows(r: Any) -> list[TimeWindow]:
    """Effective availability of a resource after removing its unavailable windows."""
    ws = tu.normalize(r.availability)
    for u in r.unavailableWindows:
        ws = tu.subtract(ws, u.startMin, u.endMin)
    return ws


# --------------------------------------------------------------------------- hashing
def canonical_json(obj: Any) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def household_payload(h: Household) -> dict[str, Any]:
    d = h.model_dump(mode="json")
    d.pop("version", None)  # content hash: identical content ⇒ identical hash
    return d


def scenario_hash(h: Household, events: list[Disruption]) -> str:
    payload = {
        "household": household_payload(h),
        "events": sorted((e.model_dump(mode="json") for e in events), key=lambda e: e["id"]),
    }
    return "sc-" + hashlib.sha256(canonical_json(payload).encode()).hexdigest()[:16]


def input_hash(h: Household, events: list[Disruption], rejections: list[Rejection], pins: list[Pin]) -> str:
    payload = {
        "scenario": scenario_hash(h, events),
        "rejections": sorted((r.model_dump(mode="json") for r in rejections), key=canonical_json),
        "pins": sorted((p.model_dump(mode="json") for p in pins), key=canonical_json),
    }
    return "in-" + hashlib.sha256(canonical_json(payload).encode()).hexdigest()[:16]


def tier_label(tier: int) -> str:
    return ["Tier 0 — essential safety & dependent care", "Tier 1 — important caregiving",
            "Tier 2 — routine commitments", "Tier 3 — deferrable convenience"][tier]


def group_by(items: Iterable[Any], key) -> dict[Any, list[Any]]:
    out: dict[Any, list[Any]] = defaultdict(list)
    for it in items:
        out[key(it)].append(it)
    return out

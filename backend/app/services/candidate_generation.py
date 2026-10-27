"""Candidate assignment generation: (task, member, start, resource set) tuples.

Only *static* impossibilities are filtered here (skills, permissions, authorization, windows of single
members/resources). Anything involving competition between tasks — member overlap, resource
double-booking, precedence, travel gaps — is left to the CP-SAT model.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from itertools import product
from typing import Optional

from ..models.domain import Household, HouseholdResource, HouseholdTask, Pin, Rejection
from . import timeutil as tu
from .households import resource_windows

MAX_RESOURCE_COMBOS = 16


@dataclass(frozen=True)
class Cand:
    idx: int
    task_id: str
    member_id: str
    start: int
    end: int
    resource_ids: tuple[str, ...]


@dataclass
class CandidateSet:
    cands: list[Cand] = field(default_factory=list)
    # (task_id, member_id) -> [(reason code, human text)] for members that cannot take the task
    member_reasons: dict[tuple[str, str], list[tuple[str, str]]] = field(default_factory=dict)
    # task_id -> task level reasons (impossible window, missing resource type, ...)
    task_reasons: dict[str, list[tuple[str, str]]] = field(default_factory=dict)

    def for_task(self, tid: str) -> list[Cand]:
        return [c for c in self.cands if c.task_id == tid]


def static_member_reasons(h: Household, t: HouseholdTask, mid: str) -> list[tuple[str, str]]:
    m = h.member(mid)
    assert m is not None
    out: list[tuple[str, str]] = []
    if m.isDependent:
        out.append(("DEPENDENT_MEMBER", f"{m.name} is a dependent and cannot be assigned responsibilities"))
    if t.eligibleMemberIds is not None and mid not in t.eligibleMemberIds:
        out.append(("NOT_ELIGIBLE", f"{m.name} is not on the eligibility list for this task"))
    if mid in t.excludedMemberIds:
        out.append(("EXCLUDED_MEMBER", f"{m.name} is explicitly excluded from this task"))
    for s in t.requiredSkills:
        if s not in m.skills:
            out.append(("MISSING_SKILL", f"{m.name} lacks the skill '{s}'"))
    for p in t.requiredPermissions:
        if p not in m.permissions:
            out.append(("MISSING_PERMISSION", f"{m.name} lacks the permission '{p}'"))
    for r in m.restrictions:
        if r in t.requiredPermissions or r in t.requiredSkills or any(r == f"no_{p}" for p in t.requiredPermissions):
            out.append(("RESTRICTED", f"{m.name} has the restriction '{r}'"))
    for d in t.requiredDependentIds:
        if d not in m.authorizedDependentIds:
            dep = h.member(d)
            out.append(("DEPENDENT_NOT_AUTHORIZED", f"{m.name} is not authorized to care for {dep.name if dep else d}"))
    return out


def _starts(t: HouseholdTask, grid: int, baseline_start: Optional[int]) -> list[int]:
    if t.fixedStartMin is not None:
        return [t.fixedStartMin] if t.earliestStartMin <= t.fixedStartMin and t.fixedStartMin + t.durationMin <= t.latestEndMin else []
    first = -(-t.earliestStartMin // grid) * grid
    last = t.latestEndMin - t.durationMin
    s = set(range(first, last + 1, grid))
    if baseline_start is not None and t.earliestStartMin <= baseline_start <= last:
        s.add(baseline_start)
    return sorted(s)


def generate_candidates(h: Household, rejections: list[Rejection] | None = None, pins: list[Pin] | None = None,
                        base_h: Optional[Household] = None) -> CandidateSet:
    """``h`` is the hypothetical (post-disruption) household."""
    rejections, pins = rejections or [], pins or []
    base_asg = {a.taskId: a for a in (base_h or h).baselineAssignments}
    cs = CandidateSet()
    idx = 0
    for t in h.tasks:
        starts = _starts(t, h.gridMin, base_asg[t.id].startMin if t.id in base_asg else None)
        if not starts:
            cs.task_reasons.setdefault(t.id, []).append(
                ("IMPOSSIBLE_TIME_WINDOW", f"no start fits {t.durationMin} min inside "
                                           f"{tu.fmt_range(t.earliestStartMin, t.latestEndMin)}"))
            continue
        # resource options per type
        type_options: dict[str, list[HouseholdResource]] = {}
        for rtype in t.requiredResourceTypes:
            units = t.resourceUnits.get(rtype, 1)
            opts = [r for r in h.resources if r.type == rtype and units <= r.capacity]
            if not opts:
                any_type = [r for r in h.resources if r.type == rtype]
                code = "RESOURCE_CAPACITY_EXCEEDED" if any_type else "NO_RESOURCE_OF_TYPE"
                cs.task_reasons.setdefault(t.id, []).append(
                    (code, f"no '{rtype}' resource can supply {units} unit(s)" if any_type else f"household has no '{rtype}'"))
            type_options[rtype] = opts
        if any(not v for v in type_options.values()):
            continue
        pin = next((p for p in pins if p.taskId == t.id), None)
        for m in h.members:
            reasons = static_member_reasons(h, t, m.id)
            if any(r.taskId == t.id and r.memberId == m.id and r.startMin is None for r in rejections):
                reasons.append(("REJECTED_BY_USER", f"the assignment of {m.name} to this task was rejected"))
            if pin and pin.memberId != m.id:
                reasons.append(("PINNED_TO_OTHER", "the user pinned this task to a different member"))
            if reasons:
                cs.member_reasons[(t.id, m.id)] = reasons
                continue
            member_slots = [s for s in starts if tu.contains(m.availability, s, s + t.durationMin)]
            if pin and pin.startMin is not None:
                member_slots = [s for s in member_slots if s == pin.startMin]
            member_slots = [s for s in member_slots if not any(
                r.taskId == t.id and r.memberId == m.id and r.startMin == s for r in rejections)]
            if not member_slots:
                cs.member_reasons[(t.id, m.id)] = [(
                    "MEMBER_UNAVAILABLE", f"{m.name} is not available for any {t.durationMin}-minute slot within "
                                          f"{tu.fmt_range(t.earliestStartMin, t.latestEndMin)}")]
                continue
            produced = 0
            res_block: list[str] = []
            for s in member_slots:
                combos_per_type = []
                for rtype, opts in type_options.items():
                    ok = [r for r in opts if (r.allowedMemberIds is None or m.id in r.allowedMemberIds)
                          and tu.contains(resource_windows(r), s, s + t.durationMin)]
                    if not ok:
                        res_block.append(f"'{rtype}' unavailable at {tu.fmt(s)}")
                    combos_per_type.append(ok)
                if any(not c for c in combos_per_type):
                    continue
                for combo in list(product(*combos_per_type))[:MAX_RESOURCE_COMBOS]:
                    cs.cands.append(Cand(idx, t.id, m.id, s, s + t.durationMin, tuple(r.id for r in combo)))
                    idx += 1
                    produced += 1
            if produced == 0:
                cs.member_reasons[(t.id, m.id)] = [(
                    "RESOURCE_UNAVAILABLE",
                    f"no required resource is available during {m.name}'s possible slots"
                    + (f" ({res_block[0]})" if res_block else ""))]
    return cs

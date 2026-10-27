"""Deterministic, evidence-based explanations. Every sentence is generated from computed records."""

from __future__ import annotations

from typing import Any

from ..models.domain import Assignment, Disruption, Household
from ..models.results import ExplanationRecord, ImpactNode
from . import timeutil as tu
from .candidate_generation import CandidateSet
from .households import effective_predecessors

REASON_TEXT = {
    "MISSING_PERMISSION": "missing permission",
    "MISSING_SKILL": "missing skill",
    "MEMBER_UNAVAILABLE": "member unavailable",
    "RESOURCE_UNAVAILABLE": "resource unavailable",
    "RESOURCE_OCCUPIED": "resource already occupied",
    "SCHEDULE_OVERLAP": "schedule overlap",
    "DEPENDENT_NOT_AUTHORIZED": "not authorized for the dependent",
    "PRECEDENCE_UNMET": "prerequisite not satisfied",
    "IMPOSSIBLE_TIME_WINDOW": "impossible time window",
    "LOWER_PRIORITY_DISPLACED": "displaced by higher-priority work",
    "CONSENT_PENDING": "consent pending",
}


def _event_for(events: list[Disruption], entity_id: str) -> Disruption | None:
    return next((e for e in events if entity_id in e.affectedEntityIds), None)


def _ev_text(h: Household, ev: Disruption) -> str:
    rng = tu.fmt_range(ev.startMin, ev.endMin)
    return {
        "member_unavailable": f"unavailable {rng}",
        "availability_changed": f"only available {rng}",
        "resource_unavailable": f"unavailable {rng}",
        "resource_capacity_changed": f"reduced to capacity {ev.value}",
        "task_rescheduled": f"moved to the window {rng}",
    }[ev.type]


def explain_impact_node(h: Household, hyp: Household, events: list[Disruption], node: ImpactNode) -> str:
    label = {n.id: n.name for n in h.members}
    label.update({t.id: t.title for t in h.tasks})
    label.update({r.id: r.name for r in h.resources})
    label.update({m.id: m.title for m in h.milestones})
    if node.category == "unaffected":
        return f"{node.label} is not connected to any disrupted entity through a valid dependency edge."
    if node.nodeType == "disruption":
        return f"Scenario event: {node.label}."
    path = node.causalPaths[0].nodeIds if node.causalPaths else []
    up = path[-2] if len(path) >= 2 else None
    if node.nodeType == "person":
        ev = _event_for(events, node.id)
        if node.category == "directly_disrupted" and ev:
            return f"{node.label} is {_ev_text(h, ev)} — {ev.reason or ev.type.replace('_', ' ')}."
        return f"{node.label} depends on {label.get(up, up)}, which is disrupted, so their need is not yet met."
    if node.nodeType == "resource":
        ev = _event_for(events, node.id)
        return f"{node.label} is {_ev_text(h, ev)}." if ev else f"{node.label} is affected."
    if node.nodeType == "task":
        t = h.task(node.id)
        a = next((x for x in h.baselineAssignments if x.taskId == node.id), None)
        if node.category == "directly_disrupted":
            if a is None:
                return f"{node.label} has no valid baseline assignment."
            who = h.member(a.memberId)
            ev = _event_for(events, a.memberId) or next((e for e in events if set(e.affectedEntityIds) & set(a.resourceIds)), None) \
                or _event_for(events, node.id)
            if ev and ev.type in ("member_unavailable", "availability_changed"):
                return (f"{node.label} ({tu.fmt_range(a.startMin, a.endMin)}) is assigned to {who.name if who else a.memberId}, "
                        f"who is {_ev_text(h, ev)}.")
            if ev and ev.type in ("resource_unavailable", "resource_capacity_changed"):
                rid = next((r for r in ev.affectedEntityIds if r in a.resourceIds), ev.affectedEntityIds[0])
                return (f"{node.label} ({tu.fmt_range(a.startMin, a.endMin)}) requires {label.get(rid, rid)}, "
                        f"which is {_ev_text(h, ev)}.")
            if ev and ev.type == "task_rescheduled":
                return (f"{node.label} was moved to {tu.fmt_range(ev.startMin, ev.endMin)}, so its baseline slot "
                        f"{tu.fmt_range(a.startMin, a.endMin)} is no longer valid.")
            return f"{node.label}'s baseline assignment is no longer valid."
        # indirect
        ms = next((m for m in h.milestones if m.id in (t.requiredMilestoneIds if t else [])), None)
        what = label.get(up, up)
        if ms and up == ms.id:
            enablers = [label.get(e, e) for e in ms.enabledByTaskIds]
            return (f"{node.label} depends on '{ms.title}'. {', '.join(enablers)} is disrupted, so the prerequisite "
                    f"has not been satisfied.")
        return f"{node.label} depends on {what}, which is disrupted."
    if node.nodeType == "milestone":
        m = h.milestone(node.id)
        enablers = [label.get(e, e) for e in (m.enabledByTaskIds if m else [])]
        return f"'{node.label}' is enabled by {', '.join(enablers)}; that responsibility is disrupted so the milestone is not satisfied."
    return node.label


def _fmt_list(xs: list[str]) -> str:
    return ", ".join(xs) if xs else "none required"


def build_plan_explanations(
    hyp: Household,
    base: Household,
    assignments: list[Assignment],
    uncovered: list[str],
    cs: CandidateSet,
) -> tuple[list[ExplanationRecord], dict[str, list[dict[str, Any]]]]:
    recs: list[ExplanationRecord] = []
    rejected: dict[str, list[dict[str, Any]]] = {}
    asg = {a.taskId: a for a in assignments}
    base_asg = {a.taskId: a for a in base.baselineAssignments}
    for t in hyp.tasks:
        alts: list[dict[str, Any]] = []
        unmet_pre = [p for p in effective_predecessors(hyp, t) if p in uncovered]
        for m in hyp.members:
            if m.isDependent:
                continue
            sel = asg.get(t.id)
            if sel and sel.memberId == m.id:
                continue
            reasons = cs.member_reasons.get((t.id, m.id))
            if reasons:
                alts.append({"memberId": m.id, "memberName": m.name, "codes": [c for c, _ in reasons],
                             "text": f"{m.name}: " + "; ".join(txt for _, txt in reasons)})
            elif unmet_pre and not sel and any(c.task_id == t.id and c.member_id == m.id for c in cs.cands):
                alts.append({"memberId": m.id, "memberName": m.name, "codes": ["PRECEDENCE_UNMET"],
                             "text": f"{m.name} is eligible, but the prerequisite {', '.join(unmet_pre)} is uncovered"})
            elif any(c.task_id == t.id and c.member_id == m.id for c in cs.cands):
                alts.append({"memberId": m.id, "memberName": m.name,
                             "codes": ["NOT_SELECTED_BY_OBJECTIVE" if sel else "LOWER_PRIORITY_DISPLACED"],
                             "text": f"{m.name} is eligible but the selected arrangement is preferred under the "
                                     f"strategy's objectives" if sel else
                                     f"{m.name} is eligible, but every feasible slot conflicts with higher-priority "
                                     f"assignments or a prerequisite"})
        rejected[t.id] = alts

    for a in assignments:
        t, m = hyp.task(a.taskId), hyp.member(a.memberId)
        assert t and m
        res_names = [r.name for r in (hyp.resource(rid) for rid in a.resourceIds) if r]
        b = base_asg.get(a.taskId)
        same = b and b.memberId == a.memberId and b.startMin == a.startMin
        perms = [p for p in t.requiredPermissions if p in m.permissions]
        text = (f"{m.name} is eligible for {t.title} because they hold permissions [{_fmt_list(perms)}] and skills "
                f"[{_fmt_list(t.requiredSkills)}]")
        if t.requiredDependentIds:
            deps = [d.name for d in (hyp.member(i) for i in t.requiredDependentIds) if d]
            text += f", are specifically authorized for {', '.join(deps)}"
        if res_names:
            text += f", and {', '.join(res_names)} {'is' if len(res_names) == 1 else 'are'} available {tu.fmt_range(a.startMin, a.endMin)}"
        else:
            text += f", and are free {tu.fmt_range(a.startMin, a.endMin)}"
        recs.append(ExplanationRecord(
            id=f"exp-{t.id}", kind="assignment_unchanged" if same else "assignment_accepted", taskId=t.id, memberId=m.id,
            codes=["UNCHANGED_FROM_BASELINE"] if same else ["REASSIGNED" if b and b.memberId != m.id else "RESCHEDULED"],
            text=("Unchanged from baseline. " if same else "") + text + ".",
            evidence={"permissions": perms, "skills": t.requiredSkills, "resources": a.resourceIds,
                      "interval": [a.startMin, a.endMin], "baselineMember": b.memberId if b else None}))
    for tid in uncovered:
        t = hyp.task(tid)
        if t is None:
            continue
        codes: list[str] = [c for c, _ in cs.task_reasons.get(tid, [])]
        bits = [txt for _, txt in cs.task_reasons.get(tid, [])]
        unmet = [p for p in effective_predecessors(hyp, t) if p in uncovered]
        if unmet:
            codes.append("PRECEDENCE_UNMET")
            bits.append("its prerequisite " + ", ".join(f"{hyp.task(u).title} ({u})" for u in unmet if hyp.task(u))
                        + " is itself uncovered, so this task cannot be counted as completed")
        for alt in rejected.get(tid, []):
            codes += [c for c in alt["codes"] if c not in codes]
            bits.append(alt["text"])
        if not codes:
            codes.append("NO_FEASIBLE_ASSIGNMENT")
        recs.append(ExplanationRecord(
            id=f"exp-{tid}", kind="task_uncovered", taskId=tid, codes=codes,
            text=f"{t.title} cannot be covered: " + "; ".join(bits) + ". DOMINO will not invent a caregiver, permission or resource.",
            evidence={"tier": t.tier}))
    return recs, rejected

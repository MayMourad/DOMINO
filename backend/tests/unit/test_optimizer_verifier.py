import pytest

from app.models.domain import ApiError, Assignment, Rejection
from app.services.households import apply_disruptions, input_hash, load_fixture, scenario_hash
from app.services.optimizer import map_status, plan_signature, solve_model
from app.services.recovery import generate_recovery, gini
from app.services.verifier import verify_plan
from tests.conftest import ev


def asg(plan):
    return {a.taskId: a for a in plan.assignments}


def test_flagship_recovery_is_complete_and_verified(amina, amina_out):
    r = generate_recovery(amina, amina_out)
    p = r.plans[0]
    a = asg(p)
    assert p.solverStatus == "OPTIMAL" and p.completeRecovery and p.validation.overallStatus == "valid"
    assert (a["T01"].memberId, a["T02"].memberId, a["T03"].memberId, a["T04"].memberId) == ("P02", "P02", "P03", "P02")
    assert "T04" not in p.changedTaskIds  # dinner preserved, no conflict introduced
    assert p.pendingConsentTaskIds == ["T01"]
    assert len(r.plans) == 1 and r.duplicateStrategyNote  # identical strategies are not shown as 3 plans


def test_secondary_disruption_leaves_pickup_uncovered_honestly(amina, amina_out, khalid_out):
    p = generate_recovery(amina, amina_out + khalid_out).plans[0]
    assert p.uncoveredCriticalTaskIds == ["T01", "T03"] and not p.criticalRecovery
    assert p.validation.overallStatus == "valid" and p.validation.completeness == "partial"
    assert "Valid partial plan" in p.statusLabel
    a = asg(p)
    assert a["T04"].memberId == "P02" and "T01" not in a and "T03" not in a
    kinds = {e.taskId: e.codes for e in p.explanations if e.kind == "task_uncovered"}
    assert "PRECEDENCE_UNMET" in kinds["T03"]


def test_permission_removal_makes_member_ineligible(amina, amina_out):
    h = amina.model_copy(deep=True)
    h.member("P02").permissions.remove("pickup_authorized")
    p = generate_recovery(h, amina_out).plans[0]
    assert "T01" in p.uncoveredTaskIds
    h2 = amina.model_copy(deep=True)
    h2.member("P02").permissions.remove("drive")
    p2 = generate_recovery(h2, amina_out).plans[0]
    assert "T01" in p2.uncoveredTaskIds and "T02" in p2.uncoveredTaskIds


def test_never_assigns_minor_to_drive_even_when_critical():
    h = load_fixture("restricted-transport")
    r = generate_recovery(h, [ev("s", "member_unavailable", ["P01"], 870, 1140)])
    for p in r.plans:
        assert all(not (a.taskId in ("T01", "T02") and a.memberId in ("P02", "P03")) for a in p.assignments)
        assert "T01" in p.uncoveredCriticalTaskIds


def test_strategies_differ_when_alternatives_exist():
    h = load_fixture("multigenerational")
    r = generate_recovery(h, [ev("m", "member_unavailable", ["P01"], 870, 1140)])
    assert all(p.validation.overallStatus == "valid" for p in r.plans)
    assert {s for p in r.plans for s in p.strategyIds} == {"priority_first", "minimum_change", "balanced_workload"}


def test_determinism(amina, amina_out):
    a = [p.signature for p in generate_recovery(amina, amina_out).plans]
    b = [p.signature for p in generate_recovery(amina, amina_out).plans]
    assert a == b


def test_rejection_changes_hash_and_result(amina, amina_out):
    first = generate_recovery(amina, amina_out)
    second = generate_recovery(amina, amina_out, rejections=[Rejection(taskId="T01", memberId="P02")])
    assert first.requestedInputHash != second.requestedInputHash
    assert "T01" in second.plans[0].uncoveredTaskIds and second.plans[0].validation.overallStatus == "valid"


def test_no_good_cut_returns_distinct_arrangement(amina, amina_out):
    p = generate_recovery(amina, amina_out).plans[0]
    alt = generate_recovery(amina, amina_out, ["priority_first"], exclude_signatures=[p.signature]).plans[0]
    assert alt.signature != p.signature and alt.validation.overallStatus == "valid" and alt.criticalRecovery


def test_stale_simulation_hash_rejected(amina, amina_out):
    with pytest.raises(ApiError) as e:
        generate_recovery(amina, amina_out, simulation_hash=scenario_hash(amina, []))
    assert e.value.code == "STALE_SCENARIO"


def test_solver_status_mapping_and_invalid_model():
    from ortools.sat.python import cp_model
    assert map_status(cp_model.UNKNOWN) == "UNKNOWN" and map_status(cp_model.OPTIMAL) == "OPTIMAL"
    m = cp_model.CpModel()
    m.NewBoolVar("a")
    c = m.Proto().constraints.add()
    c.linear.vars.append(42)
    c.linear.coeffs.append(1)
    c.linear.domain.extend([0, 1])
    assert solve_model(m, 0.2)[1] == "MODEL_INVALID"


def test_gini_edge_cases():
    assert gini([0, 0, 0]) == 0.0 and gini([5]) == 0.0 and gini([10, 10]) == 0.0
    assert gini([0, 10]) == 0.5


# ---------------------------------------------------------------- independent verifier: negative tests
def verify(h, events, assignments, rej=None):
    sc = input_hash(h, events, rej or [], [])
    unc = [t.id for t in apply_disruptions(h, events).tasks if t.id not in {a.taskId for a in assignments}]
    return verify_plan(h, events, assignments, unc, "mutant", sc, sc, rej)


def A(t, m, s, e, r):
    return Assignment(taskId=t, memberId=m, startMin=s, endMin=e, resourceIds=r)


def failed(rep):
    return {c.ruleId for c in rep.checks if not c.passed}


def test_verifier_rejects_unauthorized_driving(amina, amina_out):
    rep = verify(amina, amina_out, [A("T01", "P03", 885, 925, ["R01", "R04"])])
    assert rep.overallStatus == "invalid" and {"V04", "V07"} <= failed(rep)


def test_verifier_rejects_overlap_and_double_booked_vehicle(amina):
    rep = verify(amina, [], [A("T01", "P01", 885, 925, ["R01", "R04"]), A("T02", "P01", 900, 935, ["R01"])])
    assert {"V08", "V10"} <= failed(rep)


def test_verifier_rejects_missing_prerequisite(amina):
    rep = verify(amina, [], [A("T03", "P01", 1005, 1035, ["R03"])])
    assert "V13" in failed(rep)


def test_verifier_rejects_assignment_during_unavailability(amina, amina_out):
    rep = verify(amina, amina_out, amina.baselineAssignments)
    assert "V07" in failed(rep) and rep.overallStatus == "invalid"


def test_verifier_rejects_capacity_and_wrong_resource_set(amina):
    h = amina.model_copy(deep=True)
    h.resource("R01").capacity = 1
    rep = verify(h, [], [A("T01", "P01", 885, 925, ["R01", "R04"])])
    assert rep.overallStatus == "invalid"
    assert any(c.errorCode in ("RESOURCE_CAPACITY_EXCEEDED", "RESOURCE_CONFLICT") and not c.passed for c in rep.checks) or \
        any("capacity" in c.evidence for c in rep.checks if not c.passed)
    rep2 = verify(amina, [], [A("T01", "P01", 885, 925, ["R01"])])
    assert "V11" in failed(rep2)


def test_verifier_rejects_stale_hash_and_misreported_coverage(amina):
    rep = verify_plan(amina, [], amina.baselineAssignments, [], "old", "in-old", "in-new")
    assert "V15" in failed(rep)
    rep = verify_plan(amina, [], amina.baselineAssignments[:2], [], "liar", "h", "h")
    assert "V16" in failed(rep)  # claims nothing is uncovered while two tasks are missing


def test_verifier_flags_user_rejection_violation(amina):
    rep = verify(amina, [], amina.baselineAssignments, [Rejection(taskId="T04", memberId="P02")])
    assert "V18" in failed(rep)


def test_verifier_dependent_cannot_be_assigned(amina):
    rep = verify(amina, [], [A("T01", "P04", 885, 925, ["R01", "R04"])])
    assert "V03" in failed(rep)


def test_signature_stable(amina):
    assert plan_signature(amina.baselineAssignments) == plan_signature(list(reversed(amina.baselineAssignments)))

import pytest
from pydantic import ValidationError

from app.models.domain import ApiError, TimeWindow
from app.services import timeutil as tu
from app.services.households import (
    FIXTURE_IDS,
    apply_disruptions,
    load_fixture,
    parse_household,
    scenario_hash,
    validate_household,
)
from app.services.verifier import verify_plan
from tests.conftest import ev


@pytest.mark.parametrize("fid", FIXTURE_IDS)
def test_fixture_loads_and_baseline_is_valid(fid):
    h = load_fixture(fid)
    assert not [i for i in validate_household(h) if i["severity"] == "error"]
    sc = scenario_hash(h, [])
    rep = verify_plan(h, [], h.baselineAssignments, [], "baseline", sc, sc)
    assert rep.overallStatus == "valid" and rep.hardViolations == 0 and rep.completeness == "complete"


def test_unknown_fixture():
    with pytest.raises(ApiError) as e:
        load_fixture("nope")
    assert e.value.code == "FIXTURE_NOT_FOUND"


def test_schema_rejects_bad_time_window():
    for s, e in [(-1, 10), (10, 10), (0, 1441), (50, 40)]:
        with pytest.raises(ValidationError):
            TimeWindow(startMin=s, endMin=e)


def test_time_normalisation_merges_and_subtracts():
    ws = tu.normalize([TimeWindow(startMin=0, endMin=60), TimeWindow(startMin=60, endMin=90), TimeWindow(startMin=100, endMin=120)])
    assert [(w.startMin, w.endMin) for w in ws] == [(0, 90), (100, 120)]
    out = tu.subtract(ws, 30, 110)
    assert [(w.startMin, w.endMin) for w in out] == [(0, 30), (110, 120)]
    assert tu.contains(ws, 0, 90) and not tu.contains(ws, 80, 101)  # half-open, single window
    assert not tu.intersects(0, 10, 10, 20)


def test_invalid_reference_and_cycle_detected(amina):
    raw = amina.model_dump(mode="json")
    raw["baselineAssignments"][0]["resourceIds"] = ["R99"]
    _, issues = parse_household(raw)
    assert any(i["code"] == "INVALID_REFERENCE" for i in issues)
    raw = amina.model_dump(mode="json")
    raw["tasks"][0]["predecessorTaskIds"] = ["T03"]
    _, issues = parse_household(raw)
    assert any(i["code"] == "DEPENDENCY_CYCLE" for i in issues)


def test_apply_disruptions_does_not_mutate_baseline(amina, amina_out):
    before = amina.model_dump_json()
    hyp = apply_disruptions(amina, amina_out)
    assert amina.model_dump_json() == before
    assert tu.contains(hyp.member("P01").availability, 1080, 1110)
    assert not tu.contains(hyp.member("P01").availability, 885, 925)


def test_scenario_hash_is_stable_and_sensitive(amina, amina_out):
    a, b = scenario_hash(amina, amina_out), scenario_hash(amina.model_copy(deep=True), list(amina_out))
    assert a == b
    other = [ev("e1", "member_unavailable", ["P01"], 870, 1081)]
    assert scenario_hash(amina, other) != a
    h2 = amina.model_copy(deep=True)
    h2.members[0].skills.append("x")
    assert scenario_hash(h2, amina_out) != a
    h3 = amina.model_copy(deep=True)
    h3.version = 99  # version alone is not content
    assert scenario_hash(h3, amina_out) == a

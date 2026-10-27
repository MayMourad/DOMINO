import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.households import load_fixture

client = TestClient(app)
EV = {"id": "e1", "type": "member_unavailable", "affectedEntityIds": ["P01"], "startMin": 870, "endMin": 1080, "confirmed": True}


def snap(fid="amina"):
    return load_fixture(fid).model_dump(mode="json")


def test_health_and_fixtures():
    h = client.get("/v1/health").json()
    assert h["status"] == "ok" and h["solver"] == "OR-Tools CP-SAT"
    assert [f["id"] for f in client.get("/v1/fixtures").json()] == ["amina", "multigenerational", "restricted-transport"]
    assert client.get("/v1/fixtures/amina").json()["members"][0]["name"] == "Amina"
    r = client.get("/v1/fixtures/zzz")
    assert r.status_code == 404 and r.json()["error"]["code"] == "FIXTURE_NOT_FOUND" and r.json()["error"]["requestId"]


def test_full_pipeline_simulation_to_approval():
    body = {"householdId": "amina", "householdVersion": 3, "householdSnapshot": snap(), "scenarioVersion": 7, "events": [EV]}
    sim = client.post("/v1/simulations", json=body).json()
    assert sim["householdVersion"] == 3 and sim["scenarioVersion"] == 7 and sim["inputHash"].startswith("sc-")
    assert sim["recoverabilityProbe"]["criticalRecovery"] is True
    rec = client.post("/v1/recovery-plans", json={"householdSnapshot": snap(), "events": [EV], "simulationHash": sim["inputHash"]}).json()
    plan = rec["plans"][0]
    assert plan["validation"]["overallStatus"] == "valid" and plan["solverStatus"] == "OPTIMAL"
    v = client.post("/v1/plans/validate", json={
        "householdSnapshot": snap(), "events": [EV], "assignments": plan["assignments"], "uncoveredTaskIds": plan["uncoveredTaskIds"],
        "planId": plan["planId"], "inputHash": plan["inputHash"], "pendingConsentTaskIds": plan["pendingConsentTaskIds"]}).json()
    assert v["overallStatus"] == "valid"
    appr = {"householdSnapshot": snap(), "events": [EV], "plan": plan, "currentInputHash": plan["inputHash"], "humanConfirmed": False}
    assert client.post("/v1/plans/approve", json=appr).json()["error"]["code"] == "CONFIRMATION_REQUIRED"
    appr["humanConfirmed"] = True
    assert client.post("/v1/plans/approve", json=appr).json()["error"]["code"] == "CONSENT_NOT_ACKNOWLEDGED"
    appr["acknowledgedConsentPending"] = True
    ok = client.post("/v1/plans/approve", json=appr).json()
    assert ok["simulated"] is True and ok["notificationsSent"] == 0
    appr["currentInputHash"] = "in-stale"
    assert client.post("/v1/plans/approve", json=appr).status_code == 409


def test_partial_plan_requires_acknowledging_unresolved_tasks():
    evs = [EV, {"id": "e2", "type": "member_unavailable", "affectedEntityIds": ["P02"], "startMin": 880, "endMin": 940, "confirmed": True}]
    plan = client.post("/v1/recovery-plans", json={"householdSnapshot": snap(), "events": evs}).json()["plans"][0]
    assert plan["uncoveredCriticalTaskIds"] == ["T01", "T03"]
    appr = {"householdSnapshot": snap(), "events": evs, "plan": plan, "currentInputHash": plan["inputHash"], "humanConfirmed": True,
            "acknowledgedConsentPending": True}
    assert client.post("/v1/plans/approve", json=appr).json()["error"]["code"] == "UNRESOLVED_NOT_ACKNOWLEDGED"
    appr["acknowledgedUnresolved"] = True
    assert client.post("/v1/plans/approve", json=appr).status_code == 200


def test_invalid_plan_cannot_be_approved():
    plan = client.post("/v1/recovery-plans", json={"householdSnapshot": snap(), "events": [EV]}).json()["plans"][0]
    plan["assignments"][0]["memberId"] = "P03"
    appr = {"householdSnapshot": snap(), "events": [EV], "plan": plan, "currentInputHash": plan["inputHash"], "humanConfirmed": True,
            "acknowledgedConsentPending": True}
    assert client.post("/v1/plans/approve", json=appr).json()["error"]["code"] == "PLAN_INVALID"


def test_errors_are_structured_and_safe():
    assert client.post("/v1/simulations", json={"nope": 1}).json()["error"]["code"] == "INVALID_REQUEST"
    bad = {"householdId": "amina", "householdSnapshot": snap(), "events": [{**EV, "confirmed": False}]}
    assert client.post("/v1/simulations", json=bad).json()["error"]["code"] == "UNCONFIRMED_EVENT"
    bad = {"householdId": "amina", "householdSnapshot": snap(), "events": [{**EV, "affectedEntityIds": ["P99"]}]}
    assert client.post("/v1/simulations", json=bad).json()["error"]["code"] == "INVALID_REFERENCE"
    stale = client.post("/v1/recovery-plans", json={"householdSnapshot": snap(), "events": [EV], "simulationHash": "sc-old"})
    assert stale.status_code == 409 and "Traceback" not in stale.text
    big = client.post("/v1/simulations", content=b"x" * 10, headers={"content-length": str(10 ** 7), "content-type": "application/json"})
    assert big.status_code == 413


def test_household_validation_endpoint():
    raw = snap()
    raw["tasks"][0]["predecessorTaskIds"] = ["T99"]
    r = client.post("/v1/households/validate", json={"householdSnapshot": raw}).json()
    assert r["valid"] is False and any(i["code"] == "INVALID_REFERENCE" for i in r["issues"])
    ok = client.post("/v1/households/validate", json={"householdSnapshot": snap()}).json()
    assert ok["valid"] and ok["graph"]["edges"]


def test_interpret_without_key_is_honest(monkeypatch):
    from app.services import interpreter
    monkeypatch.setattr(interpreter.settings, "gemini_api_key", "")
    r = client.post("/v1/events/interpret", json={"householdSnapshot": snap(), "text": "Amina is out until 6", "nowMin": 870})
    assert r.status_code == 503 and r.json()["error"]["code"] == "AI_UNAVAILABLE"


def test_benchmark_catalog_does_not_pretend_to_have_run():
    c = client.get("/v1/benchmarks/catalog").json()
    assert c["total"] >= 30 and c["executed"] is False


def test_unknown_origin_gets_no_cors_header():
    r = client.get("/v1/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in r.headers
    r = client.get("/v1/health", headers={"Origin": "http://localhost:5173"})
    assert r.headers.get("access-control-allow-origin") == "http://localhost:5173"


@pytest.mark.parametrize("fid", ["multigenerational", "restricted-transport"])
def test_other_fixtures_simulate(fid):
    h = snap(fid)
    ev = {**EV, "affectedEntityIds": ["P01" if fid == "restricted-transport" else "P02"], "startMin": 870, "endMin": 1140}
    r = client.post("/v1/recovery-plans", json={"householdSnapshot": h, "events": [ev]})
    assert r.status_code == 200 and all(p["validation"]["overallStatus"] == "valid" for p in r.json()["plans"])

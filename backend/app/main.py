"""DOMINO FastAPI application (versioned REST API under /v1)."""

from __future__ import annotations

import logging
import threading
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .models.domain import ApiError, Household
from .models.results import (
    ApproveRequest,
    HouseholdValidateRequest,
    InterpretRequest,
    PlanValidateRequest,
    RecoveryRequest,
    SimulationRequest,
)
from .services import benchmarks, interpreter
from .services.dependency_graph import build_graph, graph_to_dict
from .services.households import (
    ENGINE_VERSION,
    FIXTURE_IDS,
    input_hash,
    load_fixture,
    parse_household,
    scenario_hash,
    validate_events,
)
from .services.recovery import generate_recovery
from .services.simulator import simulate
from .services.verifier import verify_plan

log = logging.getLogger("domino")
SOLVE_SLOTS = threading.BoundedSemaphore(4)  # bounded concurrency for CPU-heavy work


class RateLimiter:
    def __init__(self) -> None:
        self.hits: dict[str, deque[float]] = defaultdict(deque)
        self.lock = threading.Lock()

    def check(self, key: str, limit: int, window: float = 60.0) -> None:
        now = time.monotonic()
        with self.lock:
            q = self.hits[key]
            while q and now - q[0] > window:
                q.popleft()
            if len(q) >= limit:
                raise ApiError("RATE_LIMITED", "Too many requests; please wait a moment.", 429, retryable=True)
            q.append(now)


limiter = RateLimiter()
app = FastAPI(title="DOMINO API", version="1.0.0", docs_url="/docs", redoc_url=None)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_allowed_origins, allow_methods=["GET", "POST"],
                   allow_headers=["Content-Type"], max_age=600)


def err_json(code: str, message: str, status: int, request_id: str, details: list | None = None, retryable: bool = False):
    return JSONResponse(status_code=status, headers={"X-Request-Id": request_id},
                        content={"error": {"code": code, "message": message, "details": details or [],
                                           "requestId": request_id, "retryable": retryable}})


@app.middleware("http")
async def guard(request: Request, call_next):
    rid = "req-" + uuid.uuid4().hex[:10]
    request.state.rid = rid
    cl = request.headers.get("content-length")
    if cl and cl.isdigit() and int(cl) > settings.max_request_bytes:
        return err_json("REQUEST_TOO_LARGE", "Request body is too large.", 413, rid)
    try:
        resp = await call_next(request)
    except Exception:  # noqa: BLE001
        log.exception("unhandled error %s", rid)
        return err_json("INTERNAL_ERROR", "An internal error occurred.", 500, rid)
    resp.headers["X-Request-Id"] = rid
    return resp


@app.exception_handler(ApiError)
async def api_error_handler(request: Request, exc: ApiError):
    return err_json(exc.code, exc.message, exc.status, request.state.rid, exc.details, exc.retryable)


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    details = [{"path": ".".join(str(p) for p in e["loc"][1:]), "message": e["msg"]} for e in exc.errors()][:20]
    return err_json("INVALID_REQUEST", "The request body failed validation.", 422, request.state.rid, details)


def client_key(request: Request) -> str:
    return request.client.host if request.client else "unknown"


v1 = APIRouter(prefix="/v1")


@v1.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "engineVersion": ENGINE_VERSION, "solver": "OR-Tools CP-SAT",
            "ai": {"available": interpreter.ai_available(), "model": settings.gemini_model if interpreter.ai_available() else None,
                   "warning": settings.gemini_model_warning},
            "benchmarksEnabled": settings.benchmark_runs_enabled, "time": datetime.now(timezone.utc).isoformat(timespec="seconds")}


@v1.get("/fixtures")
def fixtures() -> list[dict[str, Any]]:
    out = []
    for fid in FIXTURE_IDS:
        h = load_fixture(fid)
        out.append({"id": h.id, "name": h.name, "description": h.description, "members": len(h.members), "tasks": len(h.tasks),
                    "resources": len(h.resources)})
    return out


@v1.get("/fixtures/{fixture_id}")
def fixture(fixture_id: str) -> Household:
    return load_fixture(fixture_id)


@v1.post("/households/validate")
def validate_household_ep(req: HouseholdValidateRequest) -> dict[str, Any]:
    h, issues = parse_household(req.householdSnapshot)
    ok = h is not None and not any(i["severity"] == "error" for i in issues)
    return {"valid": ok, "issues": issues, "household": h.model_dump(mode="json") if h else None,
            "graph": graph_to_dict(build_graph(h)) if ok and h else None}


@v1.post("/events/interpret")
def interpret_ep(req: InterpretRequest, request: Request) -> dict[str, Any]:
    limiter.check("ai:" + client_key(request), settings.interpret_rate_per_minute)
    return interpreter.interpret(req.householdSnapshot, req.text, req.nowMin).model_dump(mode="json")


def _guarded(fn, *a, **kw):
    if not SOLVE_SLOTS.acquire(timeout=5):
        raise ApiError("BUSY", "The solver is busy; retry shortly.", 503, retryable=True)
    try:
        return fn(*a, **kw)
    finally:
        SOLVE_SLOTS.release()


def _check_household(h: Household) -> None:
    _, issues = parse_household(h.model_dump(mode="json"))
    errs = [i for i in issues if i["severity"] == "error"]
    if errs:
        raise ApiError("HOUSEHOLD_INVALID", "The household has validation errors.", 422, errs[:10])


@v1.post("/simulations")
def simulations(req: SimulationRequest) -> dict[str, Any]:
    _check_household(req.householdSnapshot)
    validate_events(req.householdSnapshot, req.events)
    res = _guarded(simulate, req.householdSnapshot, req.events, req.householdVersion, req.scenarioVersion, req.includeProbe)
    return res.model_dump(mode="json")


@v1.post("/recovery-plans")
def recovery_plans(req: RecoveryRequest) -> dict[str, Any]:
    _check_household(req.householdSnapshot)
    resp = _guarded(generate_recovery, req.householdSnapshot, req.events, list(req.strategies), req.rejections, req.pins,
                    req.excludeSignatures, req.timeLimitSeconds, req.simulationHash)
    out = resp.model_dump(mode="json")
    out["householdVersion"], out["scenarioVersion"] = req.householdVersion, req.scenarioVersion
    return out


@v1.post("/plans/validate")
def plans_validate(req: PlanValidateRequest) -> dict[str, Any]:
    _check_household(req.householdSnapshot)
    validate_events(req.householdSnapshot, req.events)
    expected = input_hash(req.householdSnapshot, req.events, req.rejections, req.pins)
    rep = verify_plan(req.householdSnapshot, req.events, req.assignments, req.uncoveredTaskIds, req.planId, req.inputHash,
                      expected, req.rejections, req.pins, req.pendingConsentTaskIds)
    return rep.model_dump(mode="json")


@v1.post("/plans/approve")
def plans_approve(req: ApproveRequest) -> dict[str, Any]:
    _check_household(req.householdSnapshot)
    validate_events(req.householdSnapshot, req.events)
    expected = input_hash(req.householdSnapshot, req.events, req.rejections, req.pins)
    if req.plan.inputHash != expected or req.currentInputHash != expected:
        raise ApiError("STALE_SCENARIO", "This plan was computed for different inputs. Recalculate before approving.", 409)
    if not req.humanConfirmed:
        raise ApiError("CONFIRMATION_REQUIRED", "Explicit human confirmation is required.", 422)
    pending = sorted(a.taskId for a in req.plan.assignments
                     if (t := req.householdSnapshot.task(a.taskId)) and t.requiredConsent)
    rep = verify_plan(req.householdSnapshot, req.events, req.plan.assignments, req.plan.uncoveredTaskIds, req.plan.planId,
                      req.plan.inputHash, expected, req.rejections, req.pins, pending)
    if rep.overallStatus != "valid":
        raise ApiError("PLAN_INVALID", "The plan failed independent verification and cannot be approved.", 422,
                       [c.model_dump() for c in rep.checks if not c.passed][:10])
    if rep.uncoveredCriticalTaskIds and not req.acknowledgedUnresolved:
        raise ApiError("UNRESOLVED_NOT_ACKNOWLEDGED",
                       "Critical responsibilities remain uncovered; acknowledge them to approve this partial plan.", 422,
                       [{"taskIds": rep.uncoveredCriticalTaskIds}])
    if pending and not req.acknowledgedConsentPending:
        raise ApiError("CONSENT_NOT_ACKNOWLEDGED", "Acknowledge that assignees must still consent.", 422, [{"taskIds": pending}])
    return {"receiptId": "rcpt-" + uuid.uuid4().hex[:10], "planId": req.plan.planId, "inputHash": expected,
            "approvedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"), "simulated": True,
            "notificationsSent": 0, "consentPending": pending, "unresolvedCriticalTaskIds": rep.uncoveredCriticalTaskIds,
            "validationHardViolations": rep.hardViolations,
            "note": "Internal simulation receipt. No message, booking or instruction was sent to anyone."}


@v1.get("/benchmarks/catalog")
def bench_catalog() -> dict[str, Any]:
    cases = benchmarks.catalog()
    return {"total": len(cases), "cases": cases, "executed": False, "note": "Benchmark not yet executed."}


@v1.post("/benchmarks/run")
def bench_run(request: Request, body: dict[str, Any] | None = None) -> dict[str, Any]:
    if not settings.benchmark_runs_enabled:
        raise ApiError("BENCHMARKS_DISABLED", "Benchmark runs are disabled on this server.", 403)
    limiter.check("bench:" + client_key(request), settings.benchmark_rate_per_minute)
    ids = (body or {}).get("caseIds")
    if ids is not None and (not isinstance(ids, list) or len(ids) > 100 or not all(isinstance(i, str) for i in ids)):
        raise ApiError("INVALID_REQUEST", "caseIds must be a list of case identifiers.", 422)
    return _guarded(benchmarks.run_suite, ids)


@v1.post("/graph")
def graph_ep(req: HouseholdValidateRequest) -> dict[str, Any]:
    h, issues = parse_household(req.householdSnapshot)
    if h is None or any(i["severity"] == "error" for i in issues):
        raise ApiError("HOUSEHOLD_INVALID", "The household has validation errors.", 422, issues[:10])
    return graph_to_dict(build_graph(h))


_ = scenario_hash


@v1.post("/benchmarks/ai-interpretation")
def bench_ai(request: Request) -> dict[str, Any]:
    if not settings.benchmark_runs_enabled:
        raise ApiError("BENCHMARKS_DISABLED", "Benchmark runs are disabled on this server.", 403)
    limiter.check("bench-ai:" + client_key(request), 2)
    return _guarded(benchmarks.run_ai_eval)


app.include_router(v1)

"""Live smoke test against a RUNNING backend (and optionally the Vite proxy / a deployed URL).

Usage:  python scripts/live_smoke.py [API_BASE] [--origin ORIGIN]
Exits non-zero on any failure. Uses only the standard library.
"""

from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request

args = [a for a in sys.argv[1:] if not a.startswith("--")]
BASE = (args[0] if args else "http://127.0.0.1:8000").rstrip("/")
ORIGIN = sys.argv[sys.argv.index("--origin") + 1] if "--origin" in sys.argv else None
fails: list[str] = []


def call(method: str, path: str, body=None, headers=None):
    h = {"Content-Type": "application/json", **(headers or {})}
    req = urllib.request.Request(BASE + path, method=method, headers=h, data=json.dumps(body).encode() if body is not None else None)
    t = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, json.loads(r.read() or b"null"), dict(r.headers), (time.perf_counter() - t) * 1000
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw), dict(e.headers), (time.perf_counter() - t) * 1000
        except Exception:
            return e.code, raw, dict(e.headers), (time.perf_counter() - t) * 1000


def check(name: str, ok: bool, detail: str = "") -> None:
    print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail else ""))
    if not ok:
        fails.append(name)


s, health, hdr, _ = call("GET", "/v1/health", headers={"Origin": ORIGIN} if ORIGIN else None)
check("health ok", s == 200 and health["status"] == "ok", f"engine={health.get('engineVersion')} ai={health.get('ai')}")
if ORIGIN:
    check("CORS allows the Pages origin", hdr.get("access-control-allow-origin") == ORIGIN)
    s2, _, h2, _ = call("GET", "/v1/health", headers={"Origin": "https://evil.example"})
    check("CORS rejects an unknown origin", "access-control-allow-origin" not in {k.lower(): v for k, v in h2.items()})

s, fx, _, _ = call("GET", "/v1/fixtures")
check("3 fixtures listed", s == 200 and [f["id"] for f in fx] == ["amina", "multigenerational", "restricted-transport"])

EV = {"id": "e1", "type": "member_unavailable", "affectedEntityIds": ["P01"], "startMin": 870, "endMin": 1080, "confirmed": True}
EV2 = {"id": "e2", "type": "member_unavailable", "affectedEntityIds": ["P02"], "startMin": 880, "endMin": 940, "confirmed": True}
s, amina, _, _ = call("GET", "/v1/fixtures/amina")
s, sim, _, ms = call("POST", "/v1/simulations", {"householdId": "amina", "householdSnapshot": amina, "events": [EV]})
check("flagship simulation: T01-T03 direct, T04 unaffected", s == 200 and {n["id"]: n["category"] for n in sim["nodes"]}.get("T04") == "unaffected"
      and all({n["id"]: n["category"] for n in sim["nodes"]}[t] == "directly_disrupted" for t in ("T01", "T02", "T03")), f"{ms:.0f} ms")
s, rec, _, ms = call("POST", "/v1/recovery-plans", {"householdSnapshot": amina, "events": [EV], "simulationHash": sim["inputHash"]})
p = rec["plans"][0]
a = {x["taskId"]: x["memberId"] for x in p["assignments"]}
check("flagship recovery verified & complete", p["solverStatus"] == "OPTIMAL" and p["completeRecovery"] and p["validation"]["overallStatus"] == "valid"
      and a == {"T01": "P02", "T02": "P02", "T03": "P03", "T04": "P02"}, f"{ms:.0f} ms, solver {p['solverElapsedMs']} ms")
s, rec2, _, ms = call("POST", "/v1/recovery-plans", {"householdSnapshot": amina, "events": [EV, EV2]})
p2 = rec2["plans"][0]
check("secondary disruption: pickup honestly uncovered", p2["uncoveredCriticalTaskIds"] == ["T01", "T03"] and p2["validation"]["overallStatus"] == "valid", f"{ms:.0f} ms")
s, e, _, _ = call("POST", "/v1/recovery-plans", {"householdSnapshot": amina, "events": [EV], "simulationHash": "sc-stale"})
check("stale hash refused (409)", s == 409 and e["error"]["code"] == "STALE_SCENARIO")
s, e, _, _ = call("POST", "/v1/simulations", {"householdId": "amina", "householdSnapshot": amina, "events": [{**EV, "confirmed": False}]})
check("unconfirmed event refused", s == 422 and e["error"]["code"] == "UNCONFIRMED_EVENT")

# determinism across repeated live calls
sigs = {call("POST", "/v1/recovery-plans", {"householdSnapshot": amina, "events": [EV]})[1]["plans"][0]["signature"] for _ in range(3)}
check("deterministic across 3 live calls", len(sigs) == 1)

for fid, ent in (("multigenerational", "P02"), ("restricted-transport", "P01")):
    h = call("GET", f"/v1/fixtures/{fid}")[1]
    s, r, _, ms = call("POST", "/v1/recovery-plans", {"householdSnapshot": h, "events": [{**EV, "affectedEntityIds": [ent], "endMin": 1140}]})
    check(f"{fid} recovery verified", s == 200 and all(x["validation"]["overallStatus"] == "valid" for x in r["plans"]), f"{ms:.0f} ms")

s, ai, _, _ = call("POST", "/v1/events/interpret", {"householdSnapshot": amina, "text": "Amina cannot help until 6 PM", "nowMin": 870})
if health["ai"]["available"]:
    check("Gemini interpretation returns a proposed, unconfirmed event",
          s == 200 and ai["proposedEvents"] and not any(e["confirmed"] for e in ai["proposedEvents"]), json.dumps(ai)[:160])
else:
    check("Gemini unavailable is reported honestly (503)", s == 503 and ai["error"]["code"] == "AI_UNAVAILABLE")

s, suite, _, ms = call("POST", "/v1/benchmarks/run", {})
if s == 200:
    check("benchmark suite: no failures", suite["counts"]["fail"] == 0 and suite["counts"]["pass"] >= 30, f"{suite['counts']} in {ms/1000:.1f}s")
else:
    check("benchmark endpoint reachable", False, f"status {s}")

if health["ai"]["available"]:
    s, aie, _, _ = call("POST", "/v1/benchmarks/ai-interpretation", {})
    check("AI annotated sentences executed", s == 200 and aie.get("executed"), json.dumps({k: aie.get(k) for k in ("model", "completed", "errors", "exactMatchAccuracy")}))

print("\nFAILED: " + ", ".join(fails) if fails else "\nALL LIVE CHECKS PASSED")
sys.exit(1 if fails else 0)

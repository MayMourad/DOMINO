"""Generates data/benchmarks/cases/*.json and manifest.json.

Cases are *declarations* (household + edits + events + invariants). Nothing here records an outcome;
outcomes only come from running the engine (backend/app/services/benchmarks.py).
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "benchmarks"


def ev(id, typ, ids, s, e, reason=None, value=None):
    return {"id": id, "type": typ, "affectedEntityIds": ids, "startMin": s, "endMin": e, "reason": reason,
            "value": value, "confirmed": True}


def case(id, title, group, household, kind, expected, assertion, events=None, ops=None, description="", **extra):
    return {"id": id, "title": title, "group": group, "household": household, "kind": kind, "description": description or title,
            "expected": expected, "assert": assertion, "events": events or [], "ops": ops or [], **extra}


def a(t, m, s, e, r):
    return {"taskId": t, "memberId": m, "startMin": s, "endMin": e, "resourceIds": r}


AMINA_OUT = ev("e-amina", "member_unavailable", ["P01"], 870, 1080, "Amina unavailable 14:30–18:00")
KHALID_OUT = ev("e-khalid", "member_unavailable", ["P02"], 880, 940, "Khalid unavailable 14:40–15:40")

new_adult = {"id": "P05", "name": "Layla", "age": 35, "role": "adult", "isDependent": False,
             "skills": ["driving", "shopping"], "permissions": ["drive", "pickup_authorized"], "restrictions": [],
             "availability": [{"startMin": 870, "endMin": 1110}], "homeLocationId": "L01",
             "authorizedDependentIds": ["P04"], "baselineWorkloadMinutes": 0}
laundry = {"id": "T05", "title": "Laundry folding", "description": "Fixed-time household chore", "tier": 2, "priorityWeight": 3,
           "durationMin": 35, "earliestStartMin": 1080, "latestEndMin": 1115, "fixedStartMin": 1080, "requiredSkills": [],
           "requiredPermissions": [], "eligibleMemberIds": ["P02"], "excludedMemberIds": [], "requiredResourceTypes": [],
           "resourceUnits": {}, "requiredDependentIds": [], "predecessorTaskIds": [], "requiredMilestoneIds": [],
           "originLocationId": "L01", "destinationLocationId": "L01", "requiredConsent": False, "isOptional": False}

AM = "amina"
cases_amina = [
    case("T01", "Amina baseline", "amina", AM, "baseline", ["All baseline assignments pass all 18 verifier rules"], {"baseline_valid": True}),
    case("T02", "Amina unavailable", "amina", AM, "recovery",
         ["Pickup→Khalid, homework→Noura, dinner stays with Khalid", "Verified complete recovery", "T04 not affected"],
         {"all_plans_valid": True, "complete_recovery": True, "assigned": {"T01": "P02", "T03": "P03", "T04": "P02"},
          "expected_affected": ["T01", "T02", "T03", "M01"], "affected_excludes": ["T04"]}, [AMINA_OUT]),
    case("T03", "Khalid unavailable during pickup", "amina", AM, "recovery",
         ["No unauthorized pickup assignment", "T01 and T03 uncovered; dinner still covered"],
         {"all_plans_valid": True, "exactly_uncovered": ["T01", "T03"], "critical_recovery": False, "covered": ["T02", "T04"],
          "never_assigned": {"T01": ["P01", "P02", "P03", "P04"]}}, [AMINA_OUT, KHALID_OUT]),
    case("T04", "Sedan unavailable", "amina", AM, "recovery", ["Vehicle-dependent tasks affected and uncovered; dinner unaffected"],
         {"all_plans_valid": True, "exactly_uncovered": ["T01", "T02", "T03"], "expected_affected": ["T01", "T02", "T03", "M01"],
          "affected_excludes": ["T04"], "critical_recovery": False},
         [ev("e-sedan", "resource_unavailable", ["R01"], 870, 1140, "Family sedan unavailable")]),
    case("T05", "Noura unavailable (with Amina out)", "amina", AM, "recovery",
         ["Homework has no other eligible helper → uncovered; pickup still recovered"],
         {"all_plans_valid": True, "exactly_uncovered": ["T03"], "assigned": {"T01": "P02"}, "critical_recovery": False},
         [AMINA_OUT, ev("e-noura", "member_unavailable", ["P03"], 990, 1080, "Noura unavailable")]),
    case("T06", "Grocery window narrowed", "amina", AM, "recovery", ["Grocery re-timed inside 16:40–17:30"],
         {"all_plans_valid": True, "within_window": {"T02": [1000, 1050]}, "categories": {"T02": "directly_disrupted"}},
         [ev("e-g", "task_rescheduled", ["T02"], 1000, 1050, "Grocery window narrowed")]),
    case("T07", "Homework overlaps dinner for same person", "amina", AM, "recovery",
         ["Only Khalid may do both at the same fixed time → exactly one covered, no double booking"],
         {"all_plans_valid": True, "covered_count_of": {"tasks": ["T03", "T04"], "equals": 1}},
         ops=[{"op": "add_skill", "id": "P02", "skill": "homework_assist"},
              {"op": "set_task", "id": "T03", "fields": {"eligibleMemberIds": ["P02"], "fixedStartMin": 1050}},
              {"op": "set_task", "id": "T04", "fields": {"eligibleMemberIds": ["P02"], "fixedStartMin": 1050, "earliestStartMin": 1020}}]),
    case("T08", "Pickup permission removed", "amina", AM, "recovery", ["Khalid without pickup permission is never assigned"],
         {"all_plans_valid": True, "uncovered": ["T01"], "never_assigned": {"T01": ["P02", "P03"]}, "critical_recovery": False},
         [AMINA_OUT], [{"op": "remove_permission", "id": "P02", "permission": "pickup_authorized"}]),
    case("T09", "New authorized adult added", "amina", AM, "recovery", ["Candidate search includes Layla; pickup covered"],
         {"all_plans_valid": True, "assigned": {"T01": "P05"}, "critical_recovery": True},
         [AMINA_OUT, KHALID_OUT], [{"op": "add_member", "member": new_adult}]),
    case("T10", "Disruption reset restores baseline", "amina", AM, "reset", ["No events → plan identical to baseline, nothing changed"],
         {"all_plans_valid": True, "extra": {"baselineRestored": True}}),
    case("T20", "Rejected assignment triggers fresh optimization", "amina", AM, "rejection",
         ["Rejecting Khalid for pickup → new input hash, new solve, pickup uncovered"],
         {"extra": {"freshSolve": True, "rejectedAbsent": True, "solves": 2, "newPlansValid": True}, "uncovered": ["T01"]},
         [AMINA_OUT], reject={"taskId": "T01", "memberId": "P02"}),
    case("T30", "Stale scenario hash", "amina", AM, "stale", ["Recovery with a mismatched simulation hash is refused; verifier flags V15"],
         {"error_code": "STALE_SCENARIO", "extra": {"verifierRejectsStale": True}}, [AMINA_OUT]),
    case("T17", "Prerequisite delayed", "amina", AM, "recovery",
         ["Pickup directly disrupted; homework threatened through milestone M01; dinner unaffected"],
         {"all_plans_valid": True, "categories": {"T01": "directly_disrupted", "T03": "at_risk_dependency", "T04": "unaffected"},
          "expected_affected": ["T01", "T03", "M01"], "complete_recovery": True},
         [ev("e-delay", "task_rescheduled", ["T01"], 960, 1010, "School dismissal delayed")]),
    case("T18", "Two simultaneous member disruptions", "amina", AM, "recovery", ["Both events applied consistently; dinner re-timed before Khalid leaves"],
         {"all_plans_valid": True, "complete_recovery": True, "assigned": {"T01": "P02", "T04": "P02"},
          "expected_affected": ["T01", "T02", "T03", "T04", "M01"]},
         [AMINA_OUT, ev("e-k2", "member_unavailable", ["P02"], 1050, 1110, "Khalid leaves at 17:30")]),
    case("E09", "Consent stays pending", "amina", AM, "recovery", ["Reassigned pickup needs the new assignee's confirmation"],
         {"pending_consent": ["T01"], "all_plans_valid": True}, [AMINA_OUT]),
    case("E16", "Find another distinct arrangement (no-good cut)", "amina", AM, "alternative",
         ["Excluding the first arrangement yields a different, valid arrangement with the same critical coverage"],
         {"extra": {"distinct": True, "altValid": True, "sameCriticalCoverage": True}}, [AMINA_OUT]),
    case("E17", "Deterministic repeatability (flagship)", "amina", AM, "repeat", ["Identical inputs → identical plan signatures"],
         {"extra": {"deterministic": True}}, [AMINA_OUT]),
]

MG = "multigenerational"
cases_mg = [
    case("T11", "Multigenerational baseline", "multigenerational", MG, "baseline", ["Valid original schedule"], {"baseline_valid": True}),
    case("T12", "Omar unavailable", "multigenerational", MG, "recovery", ["Pickup and errands reassigned to Mariam"],
         {"all_plans_valid": True, "complete_recovery": True, "assigned": {"T01": "P01"},
          "expected_affected": ["T01", "T04", "M01", "T03"]}, [ev("e-omar", "member_unavailable", ["P02"], 870, 1140, "Omar unavailable")]),
    case("T13", "Mariam unavailable", "multigenerational", MG, "recovery", ["Check-in → Fatima, dinner → Omar"],
         {"all_plans_valid": True, "complete_recovery": True, "assigned": {"T02": "P03", "T05": "P02"}, "expected_affected": ["T02", "T05"]},
         [ev("e-mariam", "member_unavailable", ["P01"], 870, 1140, "Mariam unavailable")]),
    case("T14", "Fatima unavailable", "multigenerational", MG, "recovery", ["Only Fatima can assist with schoolwork → uncovered"],
         {"all_plans_valid": True, "exactly_uncovered": ["T03"], "critical_recovery": False, "expected_affected": ["T03"]},
         [ev("e-fatima", "member_unavailable", ["P03"], 870, 1140, "Fatima unavailable")]),
    case("T15", "Sedan capacity reduced", "multigenerational", MG, "recovery",
         ["Pickup needs 2 seat-units; capacity 1 → uncovered; 1-unit grocery still fits"],
         {"all_plans_valid": True, "uncovered": ["T01", "T03"], "covered": ["T04"], "expected_affected": ["T01", "T03", "M01"]},
         [ev("e-cap", "resource_capacity_changed", ["R01"], 870, 1140, "Sedan seats reduced", 1)]),
    case("T16", "Shared resource double-booked", "multigenerational", MG, "mutation",
         ["Two tasks on the exclusive sedan at once → verifier fails V10"],
         {"fails_rules_include": ["V10"]}, plan=[a("T01", "P02", 900, 940, ["R01"]), a("T04", "P01", 920, 960, ["R01"])]),
    case("T19", "Multigenerational recovery rerun", "multigenerational", MG, "repeat", ["Deterministic repeatability"],
         {"extra": {"deterministic": True}}, [ev("e-omar", "member_unavailable", ["P02"], 870, 1140, "Omar unavailable")]),
    case("E14", "Multigenerational sedan unavailable", "multigenerational", MG, "recovery", ["Pickup, grocery and homework cannot be covered"],
         {"all_plans_valid": True, "uncovered": ["T01", "T03", "T04"], "critical_recovery": False},
         [ev("e-sedan", "resource_unavailable", ["R01"], 870, 1140, "Sedan unavailable")]),
]

RT = "restricted-transport"
cases_rt = [
    case("T21", "Restricted-transport baseline", "restricted-transport", RT, "baseline", ["Valid original schedule"], {"baseline_valid": True}),
    case("T22", "Sole driver unavailable", "restricted-transport", RT, "recovery",
         ["Pickup explicitly uncovered; Rashid/Leena never assigned to drive; dinner unaffected"],
         {"all_plans_valid": True, "uncovered": ["T01", "T02", "T03"], "critical_recovery": False,
          "never_assigned": {"T01": ["P02", "P03"], "T02": ["P02", "P03"]}, "expected_affected": ["T01", "T02", "T03", "M01"]},
         [ev("e-salma", "member_unavailable", ["P01"], 870, 1140, "Salma unavailable")]),
    case("T23", "Only vehicle unavailable", "restricted-transport", RT, "recovery", ["No imaginary replacement vehicle"],
         {"all_plans_valid": True, "uncovered": ["T01", "T02"], "critical_recovery": False, "expected_affected": ["T01", "T02", "T03", "M01"]},
         [ev("e-veh", "resource_unavailable", ["R01"], 870, 1140, "Vehicle unavailable")]),
    case("T24", "Rashid driving attempted", "restricted-transport", RT, "mutation", ["Unlicensed adult assigned to pickup → V03/V04 fail"],
         {"fails_rules_include": ["V03", "V04"]}, plan=[a("T01", "P02", 900, 940, ["R01"])]),
    case("T25", "Leena driving attempted", "restricted-transport", RT, "mutation", ["Minor without permission assigned to pickup → rejected"],
         {"fails_rules_include": ["V03", "V04", "V07"]}, plan=[a("T01", "P03", 900, 940, ["R01"])]),
    case("T26", "School pickup uncovered", "restricted-transport", RT, "recovery",
         ["Dependent prerequisite enforced: homework uncovered although Leena and Rashid are free"],
         {"all_plans_valid": True, "exactly_uncovered": ["T01", "T03"], "covered": ["T02", "T04"], "expected_affected": ["T01", "T03", "M01"]},
         [ev("e-s2", "member_unavailable", ["P01"], 870, 960, "Salma unavailable until 16:00")]),
    case("T27", "Secondary overlap introduced", "restricted-transport", RT, "recovery",
         ["Fixed laundry (Rashid only) collides with dinner; dinner moves to Salma; no double booking"],
         {"all_plans_valid": True, "complete_recovery": True, "assigned": {"T05": "P02", "T04": "P01"}},
         ops=[{"op": "add_task", "task": laundry}]),
    case("T28", "Impossible task window", "restricted-transport", RT, "recovery", ["Window shorter than duration → uncovered with explicit reason; warning issued"],
         {"issue_codes": ["WINDOW_TOO_SHORT"], "uncovered": ["T02"], "all_plans_valid": True},
         ops=[{"op": "set_task", "id": "T02", "fields": {"earliestStartMin": 1000, "latestEndMin": 1020}}]),
    case("T29", "Invalid resource ID", "restricted-transport", RT, "household_validation", ["Reference validation rejects R99"],
         {"issue_codes": ["INVALID_REFERENCE"]}, ops=[{"op": "set_baseline_resources", "taskId": "T01", "resourceIds": ["R99"]}]),
    case("E15", "Homework support unavailable → Rashid", "restricted-transport", RT, "recovery", ["Leena unavailable; Rashid (authorized, skilled) covers homework"],
         {"all_plans_valid": True, "complete_recovery": True, "assigned": {"T03": "P02"}},
         [ev("e-leena", "member_unavailable", ["P03"], 870, 1140, "Leena unavailable")]),
    case("E07", "Duplicate task IDs", "restricted-transport", RT, "household_validation", ["DUPLICATE_ID reported"],
         {"issue_codes": ["DUPLICATE_ID"]}, ops=[{"op": "duplicate_task", "id": "T01"}]),
]

sysc = [
    case("E01", "Prompt injection ignored", "ai", AM, "system", ["Instruction-like text produces a warning; event stays unconfirmed; unsupported request dropped"],
         {"extra": {"warned": True, "confirmedFlag": False, "events": 1, "unsupportedIgnored": True}}, check="prompt_injection"),
    case("E02", "Unknown person names flagged", "ai", AM, "system", ["Unknown 'Zayed' is never invented as an entity"],
         {"extra": {"status": "invalid", "unresolved": ["Zayed"], "events": 0}}, check="unknown_names"),
    case("E03", "Ambiguous time expression", "ai", AM, "system", ["'until 6 PM' without a scenario clock needs clarification"],
         {"extra": {"status": "needs_clarification", "needsConfirmation": True}}, check="ambiguous_time"),
    case("E04", "Missing Gemini credentials", "ai", AM, "system", ["Honest 503 AI_UNAVAILABLE; manual form still works"],
         {"extra": {"code": "AI_UNAVAILABLE", "status": 503}}, check="missing_credentials"),
    case("E05", "Solver timeout status mapping", "solver", AM, "system", ["UNKNOWN is preserved, never relabelled"],
         {"extra": {"mapped": "UNKNOWN", "optimal": "OPTIMAL", "infeasible": "INFEASIBLE"}}, check="solver_unknown_status"),
    case("E06", "Invalid solver model", "solver", AM, "system", ["Invalid CP-SAT model reported as MODEL_INVALID, not solved"],
         {"extra": {"status": "MODEL_INVALID"}}, check="solver_invalid_model"),
    case("E08", "Graph dependency cycle detected", "graph", AM, "system", ["Cyclic prerequisites are rejected"],
         {"extra": {"cycleDetected": True}}, check="dependency_cycle"),
    case("E10", "Unconfirmed event rejected", "ai", AM, "system", ["Unconfirmed events never reach the solver"],
         {"extra": {"code": "UNCONFIRMED_EVENT"}}, check="event_unconfirmed"),
    case("E11", "Graph edges are typed", "graph", AM, "system", ["Only declared edge types exist; depends_on and enables present"],
         {"extra": {"allEdgeTypesValid": True, "hasDependsOn": True, "hasEnables": True}}, check="graph_edges_typed"),
    case("E12", "Duplicate display names not guessed", "ai", AM, "system", ["Two members named 'Amina' → ambiguity, no guess"],
         {"extra": {"ambiguousNotGuessed": True}}, check="duplicate_names"),
    case("X01", "Browser refresh restores draft", "frontend", AM, "system", ["Executed by Playwright"], {}, check="external",
         reason="Executed by the Playwright suite (frontend/e2e/tests/resilience.spec.ts); see TESTING.md."),
    case("X02", "API unavailability handled", "frontend", AM, "system", ["Executed by Playwright"], {}, check="external",
         reason="Executed by the Playwright suite (frontend/e2e/tests/resilience.spec.ts); see TESTING.md."),
    case("X03", "Accessibility checks", "frontend", AM, "system", ["Executed by Playwright"], {}, check="external",
         reason="Keyboard/landmark/reduced-motion checks run in frontend/e2e/tests/resilience.spec.ts; no full WCAG audit has been performed."),
    case("X04", "GitHub Pages base path", "frontend", AM, "system", ["Checked by the production build"], {}, check="external",
         reason="Checked by building with VITE_BASE_PATH=/DOMINO/ and loading the preview; see TESTING.md."),
]

if __name__ == "__main__":
    (OUT / "cases").mkdir(parents=True, exist_ok=True)
    groups = {"amina": cases_amina, "multigenerational": cases_mg, "restricted-transport": cases_rt, "system": sysc}
    manifest = {"schema": 1, "files": [], "total": 0}
    for k, v in groups.items():
        (OUT / "cases" / f"{k}.json").write_text(json.dumps(v, indent=1) + "\n", encoding="utf-8")
        manifest["files"].append({"file": f"cases/{k}.json", "cases": [c["id"] for c in v]})
        manifest["total"] += len(v)
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=1) + "\n", encoding="utf-8")
    print("cases:", manifest["total"])

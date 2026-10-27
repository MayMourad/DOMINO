"""Generates data/households/*.json from compact definitions, validating each via the Pydantic model.

Run:  python backend/scripts/build_fixtures.py
The JSON files are the source of truth at runtime; this script only exists to keep
their authoring consistent. All households are entirely fictional.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.models.domain import Household  # noqa: E402
from app.services.households import validate_household  # noqa: E402


def t(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def win(a: str, b: str) -> dict:
    return {"startMin": t(a), "endMin": t(b)}


LOCS = [{"id": "L01", "name": "Home"}, {"id": "L02", "name": "School"}, {"id": "L03", "name": "Grocery store"}]
TRAVEL = [
    {"fromId": "L01", "toId": "L02", "minutes": 20}, {"fromId": "L02", "toId": "L01", "minutes": 20},
    {"fromId": "L01", "toId": "L03", "minutes": 12}, {"fromId": "L03", "toId": "L01", "minutes": 12},
    {"fromId": "L02", "toId": "L03", "minutes": 15}, {"fromId": "L03", "toId": "L02", "minutes": 15},
]


def member(id, name, age, role, dep, skills, perms, restr, avail, auth, base):
    return {"id": id, "name": name, "age": age, "role": role, "isDependent": dep, "skills": skills,
            "permissions": perms, "restrictions": restr, "availability": avail, "homeLocationId": "L01",
            "authorizedDependentIds": auth, "baselineWorkloadMinutes": base}


def task(id, title, desc, tier, weight, dur, e, l, skills=(), perms=(), rtypes=(), units=None, deps=(), ms=(),
         preds=(), consent=False, opt=False, elig=None, excl=()):
    return {"id": id, "title": title, "description": desc, "tier": tier, "priorityWeight": weight,
            "durationMin": dur, "earliestStartMin": t(e), "latestEndMin": t(l), "requiredSkills": list(skills),
            "requiredPermissions": list(perms), "eligibleMemberIds": elig, "excludedMemberIds": list(excl),
            "requiredResourceTypes": list(rtypes), "resourceUnits": units or {}, "requiredDependentIds": list(deps),
            "predecessorTaskIds": list(preds), "requiredMilestoneIds": list(ms), "originLocationId": "L01",
            "destinationLocationId": "L01", "requiredConsent": consent, "isOptional": opt}


def res(id, name, typ, cap, a, b, excl=True, allowed=None):
    return {"id": id, "name": name, "type": typ, "capacity": cap, "exclusive": excl,
            "availability": [win(a, b)], "unavailableWindows": [], "locationId": "L01",
            "restrictions": [], "allowedMemberIds": allowed}


def asg(tid, mid, a, b, rids, itin=None):
    return {"taskId": tid, "memberId": mid, "startMin": t(a), "endMin": t(b), "resourceIds": rids,
            "itineraryId": itin, "changedFromBaseline": False}


def hh(id, name, desc, members, tasks, resources, milestones, baseline):
    return {"id": id, "name": name, "description": desc, "simulationDate": "2026-10-29", "timezone": "Asia/Dubai",
            "version": 1, "planningStartMin": t("14:30"), "planningEndMin": t("19:00"), "gridMin": 5,
            "locations": LOCS, "travelMatrix": TRAVEL, "members": members, "tasks": tasks, "resources": resources,
            "milestones": milestones, "baselineAssignments": baseline}


amina = hh(
    "amina", "The Amina Family",
    "Flagship fictional household: two authorized adult drivers, a teen who may help with homework, and a 9-year-old "
    "who depends on school pickup.",
    [
        member("P01", "Amina", 41, "adult", False, ["driving", "shopping", "homework_assist"], ["drive", "pickup_authorized"], [],
               [win("14:30", "18:30")], ["P04"], 20),
        member("P02", "Khalid", 43, "adult", False, ["driving", "shopping", "meal_prep"], ["drive", "pickup_authorized"], [],
               [win("14:30", "18:30")], ["P04"], 30),
        member("P03", "Noura", 16, "teen", False, ["homework_assist"], [], ["drive", "pickup_authorized"],
               [win("16:30", "18:00")], ["P04"], 45),
        member("P04", "Yusuf", 9, "child", True, [], [], [], [win("14:30", "19:00")], [], 0),
    ],
    [
        task("T01", "School pickup", "Depart home, collect Yusuf from school (~15:00), return home.", 0, 10, 40, "14:40", "15:45",
             ["driving"], ["drive", "pickup_authorized"], ["vehicle", "child_restraint"], {"vehicle": 2}, ["P04"], consent=True),
        task("T02", "Grocery collection", "Round trip to collect groceries.", 3, 2, 35, "15:00", "17:30",
             ["shopping"], ["drive"], ["vehicle"]),
        task("T03", "Homework assistance", "Help Yusuf with homework once he is home.", 1, 6, 30, "16:30", "18:00",
             ["homework_assist"], [], ["study_area"], None, ["P04"], ["M01"]),
        task("T04", "Dinner preparation", "Prepare the family dinner.", 1, 6, 30, "17:00", "18:30",
             ["meal_prep"], [], ["kitchen"]),
    ],
    [
        res("R01", "Family sedan", "vehicle", 5, "14:30", "19:00"),
        res("R02", "Home kitchen", "kitchen", 1, "14:30", "19:00"),
        res("R03", "Homework area", "study_area", 1, "14:30", "19:00"),
        res("R04", "Child vehicle restraint", "child_restraint", 1, "14:30", "19:00"),
    ],
    [{"id": "M01", "title": "Yusuf arrived home", "enabledByTaskIds": ["T01"], "dependentId": "P04"}],
    [
        asg("T01", "P01", "14:45", "15:25", ["R01", "R04"], "itin-school-pickup"),
        asg("T02", "P01", "15:55", "16:30", ["R01"], "itin-grocery"),
        asg("T03", "P01", "16:45", "17:15", ["R03"]),
        asg("T04", "P02", "17:30", "18:00", ["R02"]),
    ],
)

multi = hh(
    "multigenerational", "The Al-Mansoori Multigenerational Family",
    "Fictional three-generation household: two working adults, an independent grandmother with limited availability "
    "and no driving licence, and a 12-year-old student.",
    [
        member("P01", "Mariam", 39, "adult", False, ["driving", "meal_prep", "household_checkin", "shopping"],
               ["drive", "pickup_authorized"], [], [win("14:45", "19:00")], ["P04"], 25),
        member("P02", "Omar", 42, "adult", False, ["driving", "shopping", "meal_prep"], ["drive", "pickup_authorized"], [],
               [win("14:45", "19:00")], ["P04"], 25),
        member("P03", "Fatima", 70, "senior", False, ["homework_assist", "household_checkin"], [], ["drive"],
               [win("15:30", "17:30")], ["P04"], 0),
        member("P04", "Hessa", 12, "child", True, [], [], [], [win("14:30", "19:00")], [], 0),
    ],
    [
        task("T01", "Hessa school pickup", "Collect Hessa from school and return home.", 0, 10, 40, "14:50", "15:50",
             ["driving"], ["drive", "pickup_authorized"], ["vehicle"], {"vehicle": 2}, ["P04"], consent=True),
        task("T02", "Afternoon household check-in", "Brief check-in on the household.", 2, 3, 20, "15:45", "17:00",
             ["household_checkin"], [], []),
        task("T03", "Schoolwork assistance", "Support Hessa's schoolwork at home.", 1, 6, 30, "16:15", "17:45",
             ["homework_assist"], [], ["study_area"], None, ["P04"], ["M01"]),
        task("T04", "Grocery collection", "Round trip errand.", 3, 2, 40, "16:40", "18:20",
             ["shopping"], ["drive"], ["vehicle"]),
        task("T05", "Dinner preparation", "Prepare dinner for four.", 1, 6, 40, "17:30", "19:00",
             ["meal_prep"], [], ["kitchen"]),
    ],
    [
        res("R01", "Family sedan", "vehicle", 5, "14:45", "19:00"),
        res("R02", "Shared kitchen", "kitchen", 1, "14:30", "19:00"),
        res("R03", "Study area", "study_area", 1, "14:30", "19:00"),
    ],
    [{"id": "M01", "title": "Hessa arrived home", "enabledByTaskIds": ["T01"], "dependentId": "P04"}],
    [
        asg("T01", "P02", "15:00", "15:40", ["R01"], "itin-school-pickup"),
        asg("T02", "P01", "16:00", "16:20", []),
        asg("T03", "P03", "16:30", "17:00", ["R03"]),
        asg("T04", "P02", "17:00", "17:40", ["R01"], "itin-grocery"),
        asg("T05", "P01", "18:00", "18:40", ["R02"]),
    ],
)

restricted = hh(
    "restricted-transport", "The Salma Family",
    "Fictional household with a single licensed driver and one vehicle: losing either leaves the school pickup "
    "without a legal replacement.",
    [
        member("P01", "Salma", 38, "adult", False, ["driving", "shopping", "meal_prep"], ["drive", "pickup_authorized"], [],
               [win("14:30", "19:00")], ["P04"], 30),
        member("P02", "Rashid", 40, "adult", False, ["meal_prep", "homework_assist"], [], ["drive", "pickup_authorized"],
               [win("14:30", "19:00")], ["P04"], 20),
        member("P03", "Leena", 17, "teen", False, ["homework_assist"], [], ["drive", "pickup_authorized"],
               [win("16:30", "18:00")], ["P04"], 40),
        member("P04", "Ali", 9, "child", True, [], [], [], [win("14:30", "19:00")], [], 0),
    ],
    [
        task("T01", "School pickup", "Collect Ali from school and return home.", 0, 10, 40, "14:50", "15:50",
             ["driving"], ["drive", "pickup_authorized"], ["vehicle"], {"vehicle": 2}, ["P04"], consent=True),
        task("T02", "Grocery collection", "Round trip errand.", 3, 2, 35, "15:45", "18:00",
             ["shopping"], ["drive"], ["vehicle"]),
        task("T03", "Homework support", "Help Ali with homework once he is home.", 1, 6, 30, "16:30", "18:00",
             ["homework_assist"], [], ["study_area"], None, ["P04"], ["M01"]),
        task("T04", "Dinner preparation", "Prepare the family dinner.", 1, 6, 35, "17:30", "19:00",
             ["meal_prep"], [], ["kitchen"]),
    ],
    [
        res("R01", "Family vehicle", "vehicle", 5, "14:30", "19:00"),
        res("R02", "Home study space", "study_area", 1, "14:30", "19:00"),
        res("R03", "Kitchen", "kitchen", 1, "14:30", "19:00"),
    ],
    [{"id": "M01", "title": "Ali arrived home", "enabledByTaskIds": ["T01"], "dependentId": "P04"}],
    [
        asg("T01", "P01", "15:00", "15:40", ["R01"], "itin-school-pickup"),
        asg("T02", "P01", "16:00", "16:35", ["R01"], "itin-grocery"),
        asg("T03", "P03", "17:00", "17:30", ["R02"]),
        asg("T04", "P02", "18:00", "18:35", ["R03"]),
    ],
)

if __name__ == "__main__":
    out = ROOT / "data" / "households"
    out.mkdir(parents=True, exist_ok=True)
    for key, data in {"amina": amina, "multigenerational": multi, "restricted-transport": restricted}.items():
        model = Household.model_validate(data)
        issues = validate_household(model)
        bad = [i for i in issues if i["severity"] == "error" or i["code"] == "BASELINE_INVALID"]
        if bad:
            raise SystemExit(f"{key}: fixture integrity errors: {bad}")
        (out / f"{key}.json").write_text(json.dumps(model.model_dump(mode="json"), indent=2) + "\n", encoding="utf-8")
        print(f"wrote {key}.json ({len(model.tasks)} tasks, {len(model.members)} members, warnings={len(issues)})")

"""Built-in, deterministic natural-language parser (no network, no API key).

It produces the same *extraction* structure the Gemini path produces, so the identical resolution, validation and
confirmation pipeline in ``interpreter.interpret`` applies. It extracts only the five supported disruption types; it
never schedules, approves or follows instructions in the text. It is deliberately conservative: when something is
unclear it returns ``None`` times, and the pipeline then asks the user to clarify.
"""

from __future__ import annotations

import re
from typing import Any, Optional

from ..models.domain import Household
from . import timeutil as tu

NUM_WORDS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10, "an": 1, "a": 1, "half": 0.5}
RESOURCE_ALIASES = {"car": "vehicle", "cars": "vehicle", "sedan": "vehicle", "van": "vehicle", "vehicle": "vehicle", "family car": "vehicle",
                    "kitchen": "kitchen", "oven": "kitchen", "study area": "study_area", "homework area": "study_area", "study space": "study_area",
                    "car seat": "child_restraint", "child seat": "child_restraint", "restraint": "child_restraint"}
TASK_ALIASES = {"pickup": ("pickup", "pick up", "pick-up", "school run", "collect"), "grocer": ("grocer", "shopping", "errand"),
                "homework": ("homework", "schoolwork", "study support"), "dinner": ("dinner", "meal", "cooking", "supper"),
                "check-in": ("check-in", "check in", "checkin")}
T = r"(?P<h{n}>\d{{1,2}})(?::(?P<m{n}>\d{{2}}))?\s*(?P<a{n}>a\.?m\.?|p\.?m\.?)?"
TIME = r"\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?"
UNAVAIL_PERSON = re.compile(r"\b(can(?:no|')t|cannot|can not|unavailable|not available|isn't available|is out|are out|away|busy|sick|ill|late|stuck|won't|will not|"
                            r"unable|off|out|tied up|working|travell?ing|delayed|has to leave|have to leave|leaving)\b", re.I)
UNAVAIL_RES = re.compile(r"\b(broke|broken|breaks?|breakdown|broke down|unavailable|not available|down|out of service|in the (?:shop|garage)|flat|won't start|"
                         r"can(?:no|')t be used|cannot be used|not working|out|stolen|unusable)\b", re.I)
RESCHEDULE = re.compile(r"\b(moved|move|pushed|push|delay(?:ed)?|resched\w*|shift(?:ed)?|postpon\w*|has to|have to|needs? to|must|now (?:at|happens?|starts?)|"
                        r"brought forward|earlier|later)\b", re.I)
ONLY_AVAIL = re.compile(r"\b(only available|available only|only free|only around|only here)\b", re.I)
HEDGE = re.compile(r"\b(might|maybe|perhaps|possibly|could be|may be|probably|not sure)\b", re.I)
INJECTION_WORDS = re.compile(r"ignore|disregard|system prompt|approve|override", re.I)
STOP_CAPS = {"the", "a", "an", "this", "that", "it", "we", "i", "they", "he", "she", "today", "tomorrow", "monday", "tuesday", "wednesday", "thursday",
             "friday", "saturday", "sunday", "ignore", "please", "also", "then", "and", "but", "his", "her", "their", "our", "my"}


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9؀-ۿ ]+", " ", re.sub(r"[’']s\b", "", s.casefold())).strip()


def _to_min(h: int, m: int, ap: Optional[str], hint_ap: Optional[str], morning_ctx: bool) -> Optional[int]:
    if m > 59 or h > 24:
        return None
    mark = (ap or hint_ap or "").replace(".", "").lower()
    if mark == "pm":
        return (h % 12 + 12) * 60 + m
    if mark == "am":
        return (h % 12) * 60 + m
    if h >= 13:  # 24-hour clock
        return h * 60 + m
    if h == 12:
        return 12 * 60 + m
    # no marker: the households model an afternoon/evening, so bare 1–11 mean PM unless the text says morning
    return (h + (0 if morning_ctx else 12)) * 60 + m


def _parse_times(clause: str, now_min: Optional[int], h: Household) -> tuple[Optional[int], Optional[int], list[str], list[str]]:
    """Returns (start, end, assumptions, ambiguities)."""
    low = clause.lower()
    morning = bool(re.search(r"\bmorning\b", low)) and not re.search(r"\bafternoon\b", low)
    notes: list[str] = []
    amb: list[str] = []

    def tok(m: re.Match[str], n: str) -> tuple[int, int, Optional[str]]:
        return int(m.group("h" + n)), int(m.group("m" + n) or 0), m.group("a" + n)

    rng = re.search(r"(?:from|between|during|over)?\s*" + T.format(n="1") + r"\s*(?:-|–|—|to|until|till|til|through|and)\s*" + T.format(n="2"), low)
    if rng:
        h1, m1, a1 = tok(rng, "1")
        h2, m2, a2 = tok(rng, "2")
        explicit = (":" in rng.group(0)) or a1 or a2 or re.search(r"\b(from|between)\b", rng.group(0))
        if explicit:
            e = _to_min(h2, m2, a2, None, morning)
            s = _to_min(h1, m1, a1, a2, morning)
            if s is not None and e is not None and s >= e and not a1:
                s -= 12 * 60
            if s is not None and e is not None and 0 <= s < e <= 1440:
                return s, e, notes, amb
    m = re.search(r"\b(?:until|till|til|through|up to|by)\s+" + T.format(n="1"), low)
    if m:
        h1, m1, a1 = tok(m, "1")
        e = _to_min(h1, m1, a1, None, morning)
        if e is not None and e <= 1440:
            return None, e, notes, amb
    m = re.search(r"\b(?:from|after|starting(?: at)?|beginning(?: at)?|since)\s+" + T.format(n="1"), low)
    if m:
        h1, m1, a1 = tok(m, "1")
        s = _to_min(h1, m1, a1, None, morning)
        if s is not None and s < h.planningEndMin:
            notes.append(f"No end time was given; {tu.fmt(h.planningEndMin)} (end of the planning window) was used as the end.")
            return s, h.planningEndMin, notes, amb
    m = re.search(r"\bfor\s+(?:the\s+next\s+|next\s+)?(?:(\d+(?:\.\d+)?|one|two|three|four|five|an?|half an?)\s*)?(hours?|hrs?|minutes?|mins?)\b", low)
    if m and not m.group(1) and "next" not in m.group(0):
        m = None
    if m:
        raw = (m.group(1) or "one").replace("half an", "0.5").replace("half a", "0.5")
        val = float(raw) if re.fullmatch(r"\d+(?:\.\d+)?", raw) else NUM_WORDS.get(raw, 1)
        dur = int(val * (60 if m.group(2).startswith("h") else 1))
        if now_min is not None:
            notes.append(f"'For the next {m.group(1) or ''} {m.group(2)}' starts at the scenario clock {tu.fmt(now_min)}.")
            return now_min, min(1440, now_min + dur), notes, amb
        amb.append("A duration was given but no start time or scenario clock; set the scenario clock or enter the times.")
        return None, None, notes, amb
    m = re.search(r"\b(?:at|to)\s+" + T.format(n="1") + r"(?!\s*(?:seats?|people|minutes|mins|hours))", low)
    if m and (m.group("m1") or m.group("a1")):
        h1, m1, a1 = tok(m, "1")
        s = _to_min(h1, m1, a1, None, morning)
        if s is not None:
            return s, None, notes, amb  # caller decides (task_rescheduled uses the task duration)
    if re.search(r"\b(this afternoon|all afternoon|all day|today|this evening|rest of the day|all evening)\b", low):
        notes.append(f"'This afternoon / today' was read as the whole planning window {tu.fmt_range(h.planningStartMin, h.planningEndMin)}.")
        return h.planningStartMin, h.planningEndMin, notes, amb
    return None, None, notes, amb


def _mentions(clause: str, h: Household) -> dict[str, list[str]]:
    """Entities found in the clause, in order of appearance, keyed by kind."""
    low = clause.lower()
    found: dict[str, list[tuple[int, str]]] = {"person": [], "resource": [], "task": []}
    for m in h.members:
        for variant in {m.name.lower(), m.name.split()[0].lower()}:
            for hit in re.finditer(r"\b" + re.escape(variant) + r"(?:'s)?\b", low):
                found["person"].append((hit.start(), m.name))
    for r in h.resources:
        names = {r.name.lower(), r.type.replace("_", " ")}
        names |= {a for a, t in RESOURCE_ALIASES.items() if t == r.type}
        for n in names:
            for hit in re.finditer(r"\b" + re.escape(n) + r"\b", low):
                found["resource"].append((hit.start(), r.name if n == r.name.lower() else n))
    for t in h.tasks:
        words = {t.title.lower()}
        for key, alts in TASK_ALIASES.items():
            if any(k in t.title.lower() or k in t.description.lower() for k in alts[:1]) or key in t.title.lower():
                words |= set(alts)
        for w in words:
            for hit in re.finditer(r"\b" + re.escape(w), low):
                found["task"].append((hit.start(), t.title))
    out: dict[str, list[str]] = {}
    for kind, items in found.items():
        seen: list[str] = []
        for _, nm in sorted(items):
            if nm not in seen:
                seen.append(nm)
        out[kind] = seen
    return out


def _unknown_people(clause: str, h: Household) -> list[str]:
    known = {w for m in h.members for w in _norm(m.name).split()}
    domain = {w for t in h.tasks for w in _norm(t.title).split()} | {w for r in h.resources for w in _norm(r.name).split()}
    unk: list[str] = []
    for m in re.finditer(r"\b([A-Z][a-z]{2,})\b(?=\s+(?:and\s+\w+\s+)?(?:is|are|was|cannot|can't|can not|won't|will|has|isn't|needs?|gets|got|stays|had)\b)", clause):
        w = m.group(1)
        if w.lower() in STOP_CAPS or w.lower() in known or w.lower() in domain or w.lower() in {x for a in TASK_ALIASES.values() for x in a}:
            continue
        if w.lower() in RESOURCE_ALIASES:
            continue
        unk.append(w)
    return unk


def _clauses(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?;])\s+|\n+|\s+(?:and then|then|also|plus)\s+", text.strip())
    return [p.strip() for p in parts if p and p.strip()]


def parse(h: Household, text: str, now_min: Optional[int]) -> dict[str, Any]:
    events: list[dict[str, Any]] = []
    ambiguities: list[str] = []
    assumptions: list[str] = []
    for clause in _clauses(text):
        ment = _mentions(clause, h)
        unk = _unknown_people(clause, h)
        low = clause.lower()
        s, e, notes, amb = _parse_times(clause, now_min, h)
        assumptions += notes
        ambiguities += amb
        ev: Optional[dict[str, Any]] = None
        cap = re.search(r"\b(?:capacity|seats?)\b[^.]*?\b(?:to|of|at|is|=)\s*(\d+)|\b(\d+)\s*seats?\b", low)
        if ment["resource"] and cap and re.search(r"\b(capacity|seat)", low):
            val = int(next(g for g in cap.groups() if g))
            ev = {"type": "resource_capacity_changed", "mentions": ment["resource"][:1], "value": val}
        elif ment["resource"] and (UNAVAIL_RES.search(low) or re.search(r"\b(can't|cannot)\b", low)):
            ev = {"type": "resource_unavailable", "mentions": ment["resource"][:2]}
        elif ment["task"] and not ment["person"] and RESCHEDULE.search(low):
            ev = {"type": "task_rescheduled", "mentions": ment["task"][:1]}
            t = next((x for x in h.tasks if x.title == ev["mentions"][0]), None)
            by = re.search(r"\bby\s+(\d+|an?|one|two|three|half an?)\s*(hours?|hrs?|minutes?|mins?)\b", low)
            if t and by:
                raw = by.group(1).replace("half an", "0.5").replace("half a", "0.5")
                val = float(raw) if re.fullmatch(r"\d+(?:\.\d+)?", raw) else NUM_WORDS.get(raw, 1)
                delta = int(val * (60 if by.group(2).startswith("h") else 1)) * (-1 if re.search(r"earlier|forward", low) else 1)
                s, e = max(0, t.earliestStartMin + delta), min(1440, t.latestEndMin + delta)
                assumptions.append(f"'{t.title}' window shifted by {delta} min: {tu.fmt_range(s, e)}.")
            elif t and s is not None and e is None:
                e = min(1440, s + t.durationMin)
                assumptions.append(f"Only a start time was given; the window {tu.fmt_range(s, e)} equals the task's {t.durationMin}-minute duration.")
        elif (ment["person"] or unk) and ONLY_AVAIL.search(low):
            ev = {"type": "availability_changed", "mentions": ment["person"][:1] or unk[:1]}
        elif (ment["person"] or unk) and (UNAVAIL_PERSON.search(low) or s is not None or e is not None):
            ev = {"type": "member_unavailable", "mentions": ment["person"] + unk}
        elif unk:
            ev = {"type": "member_unavailable", "mentions": unk}
        if ev is not None and HEDGE.search(low) and s is None and e is None:
            ambiguities.append(f"“{clause[:60]}” sounds speculative (no concrete time), so it was not treated as a disruption.")
            continue
        if ev is None:
            if clause and not INJECTION_WORDS.search(clause):
                ambiguities.append(f"Could not find a supported disruption in: “{clause[:80]}”. DOMINO models availability, resource, schedule and capacity changes.")
            continue
        if ev["type"] == "member_unavailable" and unk:
            ev["mentions"] = ev["mentions"] + [u for u in unk if u not in ev["mentions"]]
        ev.update({"startTime": tu.fmt(s) if s is not None else None, "endTime": tu.fmt(e) if e is not None else None,
                   "reason": clause[:80], "value": ev.get("value")})
        events.append(ev)
    return {"events": events, "ambiguities": list(dict.fromkeys(ambiguities)), "assumptions": list(dict.fromkeys(assumptions))}

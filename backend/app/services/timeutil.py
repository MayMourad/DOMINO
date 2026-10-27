"""Interval arithmetic on half-open [start, end) integer-minute windows."""

from __future__ import annotations

from typing import Iterable

from ..models.domain import TimeWindow


def fmt(m: int) -> str:
    return f"{m // 60:02d}:{m % 60:02d}"


def fmt_range(a: int, b: int) -> str:
    return f"{fmt(a)}–{fmt(b)}"


def normalize(windows: Iterable[TimeWindow]) -> list[TimeWindow]:
    """Sort, then merge overlapping *and* touching windows."""
    ws = sorted(((w.startMin, w.endMin) for w in windows))
    out: list[list[int]] = []
    for s, e in ws:
        if out and s <= out[-1][1]:
            out[-1][1] = max(out[-1][1], e)
        else:
            out.append([s, e])
    return [TimeWindow(startMin=s, endMin=e) for s, e in out]


def subtract(windows: Iterable[TimeWindow], s: int, e: int) -> list[TimeWindow]:
    out: list[TimeWindow] = []
    for w in normalize(windows):
        if e <= w.startMin or s >= w.endMin:
            out.append(w)
            continue
        if w.startMin < s:
            out.append(TimeWindow(startMin=w.startMin, endMin=s))
        if e < w.endMin:
            out.append(TimeWindow(startMin=e, endMin=w.endMin))
    return out


def contains(windows: Iterable[TimeWindow], s: int, e: int) -> bool:
    """True when [s, e) lies entirely inside a single normalized window."""
    return any(w.startMin <= s and e <= w.endMin for w in normalize(windows))


def intersects(a0: int, a1: int, b0: int, b1: int) -> bool:
    return a0 < b1 and b0 < a1


def overlaps_any(windows: Iterable[TimeWindow], s: int, e: int) -> bool:
    return any(intersects(s, e, w.startMin, w.endMin) for w in windows)

"""Canonical DOMINO domain model (Section 5 of the specification).

All times are integer minutes after local midnight (Asia/Dubai) on the single
simulated date; intervals are half-open ``[start, end)``.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

Role = Literal["adult", "teen", "child", "senior"]
DisruptionType = Literal[
    "member_unavailable",
    "resource_unavailable",
    "task_rescheduled",
    "availability_changed",
    "resource_capacity_changed",
]
StrategyId = Literal["priority_first", "minimum_change", "balanced_workload"]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class TimeWindow(Strict):
    startMin: int
    endMin: int

    @model_validator(mode="after")
    def _check(self) -> "TimeWindow":
        if not (0 <= self.startMin < self.endMin <= 1440):
            raise ValueError("TimeWindow requires 0 <= startMin < endMin <= 1440")
        return self


class Location(Strict):
    id: str
    name: str


class TravelLeg(Strict):
    fromId: str
    toId: str
    minutes: int = Field(ge=0, le=600)


class FamilyMember(Strict):
    id: str
    name: str
    age: int = Field(ge=0, le=120)
    role: Role
    isDependent: bool
    skills: list[str] = []
    permissions: list[str] = []
    restrictions: list[str] = []
    availability: list[TimeWindow] = []
    homeLocationId: str
    authorizedDependentIds: list[str] = []
    baselineWorkloadMinutes: int = Field(default=0, ge=0, le=1440)


class HouseholdTask(Strict):
    id: str
    title: str
    description: str = ""
    tier: Literal[0, 1, 2, 3]
    priorityWeight: int = Field(default=1, ge=1, le=100)
    durationMin: int = Field(ge=5, le=720)
    earliestStartMin: int = Field(ge=0, le=1440)
    latestEndMin: int = Field(ge=0, le=1440)
    fixedStartMin: Optional[int] = None
    requiredSkills: list[str] = []
    requiredPermissions: list[str] = []
    eligibleMemberIds: Optional[list[str]] = None
    excludedMemberIds: list[str] = []
    requiredResourceTypes: list[str] = []
    # units of each resource's capacity this task consumes (default 1 per type)
    resourceUnits: dict[str, int] = {}
    requiredDependentIds: list[str] = []
    predecessorTaskIds: list[str] = []
    requiredMilestoneIds: list[str] = []
    originLocationId: str
    destinationLocationId: str
    requiredConsent: bool = False
    isOptional: bool = False


class HouseholdResource(Strict):
    id: str
    name: str
    type: str
    capacity: int = Field(ge=0, le=100)
    # exclusive resources can serve only one task at a time regardless of capacity;
    # ``capacity`` then bounds the units a single task may demand (e.g. seats).
    exclusive: bool = True
    availability: list[TimeWindow] = []
    unavailableWindows: list[TimeWindow] = []
    locationId: str
    restrictions: list[str] = []
    allowedMemberIds: Optional[list[str]] = None


class Milestone(Strict):
    id: str
    title: str
    enabledByTaskIds: list[str]
    dependentId: Optional[str] = None


class Assignment(Strict):
    taskId: str
    memberId: str
    startMin: int
    endMin: int
    resourceIds: list[str] = []
    itineraryId: Optional[str] = None
    changedFromBaseline: bool = False


class Household(Strict):
    id: str
    name: str
    description: str = ""
    simulationDate: str = "2026-10-29"
    timezone: Literal["Asia/Dubai"] = "Asia/Dubai"
    version: int = 1
    planningStartMin: int = 870
    planningEndMin: int = 1140
    gridMin: int = Field(default=5, ge=5, le=30)
    locations: list[Location] = []
    travelMatrix: list[TravelLeg] = []
    members: list[FamilyMember]
    tasks: list[HouseholdTask]
    resources: list[HouseholdResource] = []
    milestones: list[Milestone] = []
    baselineAssignments: list[Assignment] = []

    def member(self, mid: str) -> Optional[FamilyMember]:
        return next((m for m in self.members if m.id == mid), None)

    def task(self, tid: str) -> Optional[HouseholdTask]:
        return next((t for t in self.tasks if t.id == tid), None)

    def resource(self, rid: str) -> Optional[HouseholdResource]:
        return next((r for r in self.resources if r.id == rid), None)

    def milestone(self, mid: str) -> Optional[Milestone]:
        return next((m for m in self.milestones if m.id == mid), None)

    def travel(self, a: str, b: str) -> int:
        if a == b:
            return 0
        for leg in self.travelMatrix:
            if leg.fromId == a and leg.toId == b:
                return leg.minutes
        return -1  # no travel model declared


class Disruption(Strict):
    id: str
    type: DisruptionType
    affectedEntityIds: list[str]
    startMin: int
    endMin: int
    reason: Optional[str] = None
    value: Optional[int] = None  # new capacity for resource_capacity_changed
    confirmed: bool = False

    @model_validator(mode="after")
    def _check(self) -> "Disruption":
        if not (0 <= self.startMin < self.endMin <= 1440):
            raise ValueError("Disruption requires 0 <= startMin < endMin <= 1440")
        if self.type == "resource_capacity_changed" and (self.value is None or self.value < 0):
            raise ValueError("resource_capacity_changed requires a non-negative value")
        return self


class Rejection(Strict):
    taskId: str
    memberId: str
    startMin: Optional[int] = None  # when set, only this exact slot is rejected


class Pin(Strict):
    taskId: str
    memberId: str
    startMin: Optional[int] = None


class ApiError(Exception):
    def __init__(self, code: str, message: str, status: int = 400, details: Optional[list] = None, retryable: bool = False):
        super().__init__(message)
        self.code, self.message, self.status = code, message, status
        self.details, self.retryable = details or [], retryable

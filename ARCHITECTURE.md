# Architecture

## Component boundaries

| Layer | Module (`backend/app/services`) | Responsibility |
|---|---|---|
| Domain | `households.py`, `models/domain.py` | Pydantic models, referential validation, disruption application, content hashing |
| Interpretation | `interpreter.py` | Gemini structured extraction → deterministic entity/time resolution → *unconfirmed* events |
| Graph analysis | `dependency_graph.py`, `simulator.py` | Typed graph, impact propagation, causal paths, cascade steps, post-recovery resolution |
| Scheduling | `candidate_generation.py`, `optimizer.py`, `recovery.py` | Candidate generation, CP-SAT model, lexicographic passes, strategies, de-duplication |
| Verification | `verifier.py` | **Independent** 18-rule checker (imports nothing from the optimizer/candidates) |
| Explanation | `explanations.py` | Sentences generated from computed records only |
| Evaluation | `benchmarks.py`, `baselines.py` | Executable cases, No-recovery and Greedy baselines, metrics |
| API | `main.py` | `/v1` REST, structured errors, CORS, size/rate limits, bounded solver concurrency |

Frontend (`frontend/src`): `state/store.ts` (Zustand; versions, abort, stale discard), `services/api.ts`, `lib/graph.ts` (typed edges + stable layout), `components/graph/FamilyGraph.tsx` (React Flow, magnetic transitions, cascade reveal), `components/graph/Constellation.tsx` (3D canvas), `components/timeline/Timelines.tsx` (Gantt with Motion layout continuity, cascade scrubber), `screens/*` (7 screens).

## Data flow and state ownership

The canonical **household snapshot** is the source of truth. The frontend keeps `reference` (validated fixture), `draft` (edited copy), `householdVersion`, `events`, `scenarioVersion`, plus `sim`, `rec`, `selectedPlanId`, `rejections`, `pins`, `receipt`. Any edit calls `invalidate()`: in-flight requests are aborted, sequence counters bump, and simulation, plans, constraints and approval are cleared. A response is applied only if its request sequence **and** household/scenario versions still match. The backend additionally computes content hashes: `scenario_hash = H(household w/o version, events)` and `input_hash = H(scenario_hash, rejections, pins)`; recovery refuses a mismatched `simulationHash` (409 `STALE_SCENARIO`), and approval re-verifies the plan against the current hash.

## Dependency rules

Edge types and meaning: `assigned_to` (task→person), `requires_resource`, `requires_permission` (eligibility, non-propagating), `depends_on` (task→task|milestone), `enables` (task→milestone), `serves_dependent`, `disrupted_by`. Propagation: disruption → targeted entity → baseline tasks the event *actually invalidates* (interval intersection / window / capacity) → `enables` → milestone → `depends_on` (reversed) → dependent tasks; task → dependent person (terminal). Every node keeps **all** simple causal paths (capped). Categories: unaffected, directly disrupted, at risk through dependency; after a plan exists: recoverable / restored / unresolved (`impactResolution`, computed on the backend).

## Solver formulation

One boolean per candidate `(task, member, start, resource set)`; `covered[t] = Σ x ≤ 1`.
Constraints: per-member `NoOverlap` over optional fixed-size intervals; exclusive resources `NoOverlap`, shared resources `Cumulative` with per-task unit demand; precedence `covered[t] ⇒ covered[π]` and `start[t] ≥ end[π]` (tasks and milestones via enabling tasks); pairwise travel-gap exclusion where a travel matrix demands it (unmodelled travel between different places is forbidden, never assumed zero); no-good cuts for “another arrangement”.
Candidate filtering removes only *static* impossibilities (skills, explicit permissions, dependent authorization, a single member's/resource's availability, task window). Contention stays in the model, and uncoverable tasks stay **uncovered** — the model never forces assignment.
Objectives are **lexicographic**: maximize weighted Tier 0 coverage, fix it, then Tier 1, Tier 2, Tier 3, then strategy preferences (Priority First: displacement, changes · Minimum Change: changes, displacement, resource switches · Balanced Workload: max load, spread, changes, displacement). `num_workers=1`, fixed seed ⇒ deterministic. CP-SAT status is preserved (`OPTIMAL/FEASIBLE/INFEASIBLE/MODEL_INVALID/UNKNOWN`) and kept separate from *business* completeness (`completeRecovery`, `criticalRecovery`, uncovered lists). Identical arrangements from different strategies are shown once.

## Validation architecture

`verifier.py` recomputes eligibility, permissions, windows, availability, overlaps, travel gaps, resource exclusivity/capacity, resource-type satisfaction, dependent authorization, precedence, hash match, coverage reporting, consent state and user rejections/pins directly from the household. Plans are labelled by three independent fields: assignment validity, recovery completeness, approval. A plan with any failed hard check is never labelled valid.

## API contracts

`GET /v1/health`, `GET /v1/fixtures[/{id}]`, `POST /v1/households/validate`, `POST /v1/events/interpret`, `POST /v1/simulations`, `POST /v1/recovery-plans`, `POST /v1/plans/validate`, `POST /v1/plans/approve`, `GET /v1/benchmarks/catalog`, `POST /v1/benchmarks/run`, `POST /v1/benchmarks/ai-interpretation`, `POST /v1/graph`. Errors: `{"error":{"code","message","details","requestId","retryable"}}`; no stack traces. Interactive schema at `/docs`.

## Gemini integration

Single approach: `google-genai` `client.models.generate_content` with `response_mime_type="application/json"` and `response_json_schema` from a Pydantic model (installed SDK 2.33; the current docs page also shows a newer `interactions` API, which was deliberately not mixed in). The model returns mentions and HH:MM strings only; the backend resolves entities against the current household (duplicates ⇒ ambiguity, unknown ⇒ unresolved), validates time windows, never guesses a start for “until 6 PM” without a scenario clock, flags instruction-like text, and always emits `confirmed=false`.

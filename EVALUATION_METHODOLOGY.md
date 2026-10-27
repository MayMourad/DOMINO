# Evaluation methodology

## Dataset construction
Three fictional households (`data/households/*.json`) authored with `backend/scripts/build_fixtures.py` and validated by the Pydantic schema, referential/cycle checks, and the independent verifier (baseline = 0 hard violations). There is no runtime repair of seed data. Capabilities, permissions, restrictions, availability, resource requirements, windows and baseline assignments are explicit. Benchmark cases (`data/benchmarks/cases/*.json`) declare a household, optional edits, confirmed events and invariants; they contain **no recorded outcomes**.

## Metrics and formulas
- **Hard-constraint violations** = number of failed mandatory verifier checks (18 rules). Acceptance: 0 for any plan labelled valid.
- **Weighted coverage** = Σ priorityWeight(covered) / Σ priorityWeight(all tasks), reported per tier and with the absolute count of uncovered Tier 0/1 tasks (so an average cannot hide a critical gap).
- **Dependency detection**: precision, recall, F1 of the set of affected *tasks and milestones* (direct + indirect) vs. a hand-written expected set per case; micro-averaged across cases that declare one.
- **Recovery efficiency**: CP-SAT wall time per strategy (`solverElapsedMs`), case wall time, reassignment count (member changed), displacement (Σ|start − baseline start| minutes). Median/p95 are reported only with ≥ 20 observations.
- **Workload balance**: per-member minutes = `baselineWorkloadMinutes` + assigned minutes; Gini coefficient `G = 2Σ i·xᵢ / (nΣxᵢ) − (n+1)/n` over sorted loads; defined as 0 when fewer than two members or all loads are zero. Task minutes are not a complete measure of caregiving burden.
- **Plan consistency**: identical inputs (single worker, fixed seed) must give identical plan signatures (cases T19, E17).
- **Natural-language interpretation**: 12 annotated sentences (`data/benchmarks/ai_sentences.json`) scored on entity set, event type, time window, uncertainty handling (status) and exact match. **Only computed from real Gemini calls**; otherwise reported as *not executed*. Deterministic safety logic around the model is tested separately with a stand-in extractor and is *not* an accuracy result.
- **Not implemented**: robustness-under-perturbation score and the experimental Family Resilience Index. They were optional; no FRI is shown anywhere.

## Baselines
A. **No recovery** — original schedule kept; invalidated assignments (and tasks whose prerequisite was dropped) count as uncovered.
B. **Greedy first-fit** — tasks by tier, then weight; first eligible member/start/resource without conflicts, respecting prerequisites. Both baselines are passed through the same independent verifier. Results are reported as measured (see TESTING.md); no claim that DOMINO always wins.

## Measurement environment and reproducibility
Each saved run records Python, OR-Tools, OS, CPU count, engine version, solver workers/seed/time limit. Re-run via `POST /v1/benchmarks/run`, the Evaluation Lab, or `pytest backend/tests/benchmarks`. The latest saved run: `docs/benchmark-results/latest.json`.

## Limitations
Synthetic, small households; hand-authored expectations; one simulated day; no real-world validation of family wellbeing; latency depends on hardware.

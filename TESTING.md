# Testing

All results below are from runs performed during development on Windows 11, Python 3.14.6, OR-Tools 9.15.6755, Node 24, Chromium (Playwright headless shell). Nothing here is projected.

## Commands actually executed

| Command | Result |
|---|---|
| `cd backend && python -m pytest` | **54 passed** (unit, integration, full benchmark suite) |
| `cd backend && ruff check .` | All checks passed |
| `python backend/scripts/build_fixtures.py` | 3 fixtures written; each validated and baseline verified |
| `python backend/scripts/build_benchmarks.py` | 50 case declarations written |
| `cd frontend && npm run typecheck` (`tsc --noEmit`) | 0 errors |
| `cd frontend && npm run lint` | 0 errors, 0 warnings |
| `cd frontend && npm test` (vitest) | **9 passed** |
| `cd frontend && DOMINO_PYTHON=<python> npx playwright test` | **6 passed** (flagship flow, multigenerational, restricted transport + approval, refresh, offline, keyboard/reduced-motion) |
| `cd frontend && VITE_BASE_PATH=/DOMINO/ npx vite build` | Built; assets reference `/DOMINO/` |

Additional runs after the first report (all real, 2026-10-27):
- **GitHub Actions CI (Ubuntu):** backend (ruff + pytest), frontend (typecheck, lint, vitest, `/DOMINO/` build) and Playwright e2e — **succeeded**.
- **Live smoke test** (`python scripts/live_smoke.py <api> --origin <pages>`) against a local backend, the Vite proxy, a clean-venv install, and the **hosted Render API**: health, CORS allow/deny, fixtures, flagship simulation + recovery (OPTIMAL, verified), secondary disruption (pickup honestly uncovered), stale-hash and unconfirmed-event refusals, determinism over 3 calls, other two households, live Gemini interpretation, 50-case suite (hosted: 45 pass / 0 fail / 5 not run — E04 is not run once a key is configured), AI accuracy run — **all passed**.
- **Playwright against the deployed site + hosted API** (`E2E_BASE_URL=https://maymourad.github.io/DOMINO/ npx playwright test`): **7 passed**, including natural language → editable proposal → human confirmation → scenario run. Local run: 6 passed (the AI test is skipped without a key).
- **Gemini interpretation accuracy** (`scripts/ai_eval_runs.py`, `docs/benchmark-results/ai-interpretation.json`): model `gemini-3.5-flash-lite`, 12 annotated sentences, 3 runs → exact match 100 % / 100 % / 100 % (entity, type, time, uncertainty each 100 %). An earlier run with the first prompt scored 83 % and 92 % — the misses were `availability_changed` chosen for “cannot help”; the prompt now defines each type and the UI warns that `availability_changed` *replaces* availability. 12 sentences is a small set and Gemini is not fully deterministic, so treat this as a sanity check, not a general accuracy claim.
- **Bugs found only by live testing and fixed:** `GEMINI_MODEL` set to a project id (now detected and ignored with a health warning); provider errors misclassified as rate limits (“generateContent” contains “rate”); provider call timeout too short for the first model; navigation race when a hosted household load finished after the user moved on; scenario clock displayed but not sent.
- **Secret scan** of the deployed JS bundle: no `AIza…` key; the API URL is the only backend reference.

Not executed: a full WCAG audit, Safari/Firefox runs.

## Test layers

- **Backend unit** (`backend/tests/unit`): schemas, time windows, fixtures, hashing, graph propagation (direct/indirect, multiple causal paths), optimizer (flagship, secondary disruption, permission removal, determinism, rejection, no-good cut, stale hash, invalid model, Gini), verifier negative tests (unauthorized driving, overlap, double-booked vehicle, missing prerequisite, unavailability, capacity, stale hash, misreported coverage, rejected/pinned constraints, dependent assigned), interpreter (entity resolution, unknown names, ambiguous time, injection, missing key).
- **Backend integration** (`backend/tests/integration/test_api.py`): full pipeline simulate → recover → validate → approve, structured errors, request-size limit, CORS allow/deny, approval gating (confirmation, consent, unresolved critical tasks, invalid plan, stale hash).
- **Benchmarks** (`backend/tests/benchmarks`, `data/benchmarks/cases`): 50 declared cases = T01–T30 from the specification plus E01–E17 and X01–X04.
- **Frontend unit** (`frontend/src/tests`): time helpers, typed edges, stable layout (y fixed, only x moves), presets, stale-response discard, unconfirmed-event refusal, invalidation on edit, undo.
- **End to end** (`frontend/e2e/tests`): the 12-step flagship sequence plus the other two households, approval acknowledgement, refresh persistence, backend outage, keyboard focus/landmarks/reduced motion/graph text alternative.

## Benchmark run (saved to `docs/benchmark-results/latest.json`)

Run on this machine: 50 cases → **46 pass, 0 fail, 4 not run** (X01–X04 are executed by Playwright / the build, not the backend runner). Wall clock ≈ 5 s.
Recovery solves: n = 27, median ≈ 189 ms, p95 ≈ 333 ms per case (each case runs three strategies, the impact analysis and the independent verifier; environment is recorded in the file).
Dependency detection (11 cases with hand-written expected sets): precision 1.00, recall 1.00, F1 1.00 — a small, hand-authored set, so not evidence of generality.
Baselines over 21 disruption cases (all baseline outputs also independently verified valid): mean weighted coverage DOMINO 71.5 %, Greedy first-fit 71.1 %, No recovery 36.6 %. Cases with an uncovered critical task: DOMINO 10, Greedy 10, No recovery 20. **DOMINO did not leave fewer critical tasks uncovered than greedy in any of these cases (ties in all)**; its advantage here is fewer changed assignments (2.48 vs 3.14 mean) and lexicographic guarantees, not more coverage on these small households.

The AI-interpretation accuracy tab is **not executed** without `GEMINI_API_KEY`; no number exists.

## Known issues / limitations

- Flagship strategies usually collapse into one arrangement (only one legal assignee set exists); the UI says so instead of showing three copies. Households B and C produce differing alternatives in some scenarios.
- The embedded browser preview used during development throttles hidden tabs, which delays React Flow's `fitView`; this is a preview artefact, the Playwright run is unaffected.
- Python 3.14 venv path length on Windows (`WinError 206`) — use a short venv path.
- Responsive behaviour was checked at a 375 px viewport (no horizontal overflow, bottom navigation); the graph itself is a pan/zoom canvas with a text alternative.

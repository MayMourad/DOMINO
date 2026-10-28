# Testing

All results below are from runs performed during development on Windows 11, Python 3.14.6, OR-Tools 9.15.6755, Node 24, Chromium (Playwright headless shell). Nothing here is projected.

## Commands actually executed

| Command | Result |
|---|---|
| `cd backend && python -m pytest` | **63 passed** (unit, integration, full 51-case benchmark suite) |
| `cd backend && ruff check .` | All checks passed |
| `python backend/scripts/build_fixtures.py` | 3 fixtures written; each validated and baseline verified |
| `python backend/scripts/build_benchmarks.py` | 50 case declarations written |
| `cd frontend && npm run typecheck` (`tsc --noEmit`) | 0 errors |
| `cd frontend && npm run lint` | 0 errors, 0 warnings |
| `cd frontend && npm test` (vitest) | **11 passed** |
| `cd frontend && DOMINO_PYTHON=<python> npx playwright test` | **15 passed** locally with no AI key (flagship, other two households + approval, refresh, offline, keyboard/reduced-motion, natural-language with the built-in parser, Configure Household, manual events, pin / alternative arrangements, Futures + Apply, Evaluation Lab, household add/remove, plan export) |
| `cd frontend && VITE_BASE_PATH=/DOMINO/ npx vite build` | Built; assets reference `/DOMINO/` |

Additional runs after the first report (all real, 2026-10-27):
- **GitHub Actions CI (Ubuntu):** backend (ruff + pytest), frontend (typecheck, lint, vitest, `/DOMINO/` build) and Playwright e2e — **succeeded**.
- **Live smoke test** (`python scripts/live_smoke.py <api> --origin <pages>`) against a local backend, the Vite proxy, a clean-venv install, and the **hosted Render API**: health, CORS allow/deny, fixtures, flagship simulation + recovery (OPTIMAL, verified), secondary disruption (pickup honestly uncovered), stale-hash and unconfirmed-event refusals, determinism over 3 calls, other two households, live Gemini interpretation, 50-case suite (hosted: 45 pass / 0 fail / 5 not run — E04 is not run once a key is configured), AI accuracy run — **all passed**.
- **Playwright against the deployed site + hosted API** (`E2E_BASE_URL=https://maymourad.github.io/DOMINO/ npx playwright test`): 15 tests, 14 passed on the first full run; the one failure (household add/remove) passed 5/5 on repeat and was made to wait for backend validation (a transient free-tier hiccup, not a logic bug).
- **Natural-language interpretation** (`scripts/ai_eval_runs.py`, results in `docs/benchmark-results/ai-*.json`; hosted API, 2026-10-28). Two sentence sets of 12: *annotated* (used while developing) and *held-out* (written afterwards):

  | Engine | Annotated | Held-out |
  |---|---|---|
  | Built-in rule parser (deterministic, no key) | 12/12 | 12/12 |
  | Gemini `gemini-3.5-flash-lite` | 12/12 | 11/12 |

  Caveats, stated plainly: the rule parser scored 11/12 on the held-out set *on its first run*; the two misses were then fixed, so its 12/12 is no longer an independent measurement. Gemini's held-out miss is “Dinner is delayed by 30 minutes”, which needs the task's baseline time (only the rule parser has the household context in code). Earlier Gemini runs on the annotated set varied (83 %, 92 %, then 100 % ×3) before the prompt was tightened, and one run hit Gemini's free-tier rate limit mid-way — the evaluation now paces calls and retries, and auto mode falls back to the rule parser on any Gemini failure. 12 sentences per set is a small sample; treat these as sanity checks, not general accuracy claims.
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

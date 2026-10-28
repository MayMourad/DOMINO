# DOMINO — Family Resilience Intelligence System

**Team:** May Ahmed Mourad (G12) · Shamsa Faris Almazrouei (G12) · Fatima Mohamed Almazrouei (G11)

> When one part of family life changes, DOMINO calculates what happens next — and helps the family find a verified way forward.

DOMINO is a **computational family digital twin and recovery planner**, built for the Abu Dhabi University 6th Annual COE STEM Programming with AI Competition (theme: *AI for Family*, Cycle 3). It is **not** a calendar, a to-do list, or a chatbot: it models a household as a typed dependency graph, finds what a hypothetical disruption invalidates (directly and downstream), solves for legal recovery assignments with **Google OR-Tools CP-SAT**, and re-checks every plan with a **separate, independent verifier** before a human approves it.

All households are **fictional**. DOMINO simulates hypothetical events from the data you give it; it does not predict real emergencies, track anyone, or contact anyone. It is not endorsed by any government body; it relates to the UAE Year of Family 2026 only in theme.

## What is implemented

| Area | Status |
|---|---|
| 3 fictional households (JSON, schema + integrity validated, baseline verified) | Implemented and tested |
| Typed dependency graph, direct/indirect impact, causal paths, cycle detection | Implemented and tested |
| CP-SAT recovery: lexicographic Tier 0→1→2→3 coverage, then strategy preferences; 3 strategies, de-duplicated; no-good “another arrangement” | Implemented and tested |
| Independent verifier (18 rules, negative tests) | Implemented and tested |
| Gemini natural-language → *proposed* event (structured output, entity resolution, confirmation gate) | Implemented and live-tested (`gemini-3.5-flash-lite`); a built-in rule parser is always available and is the fallback; every proposed event starts unconfirmed |
| 7 screens (Launch, Network, Disruption Studio, Cascade Lab, Recovery Studio, Futures Lab, Evaluation Lab) | Implemented; flows covered by Playwright |
| 3D constellation, cinematic cascade timeline, magnetic recovery transitions | Implemented (original code; see `docs/references/ATTRIBUTION.md`) |
| 51 executable benchmark cases | Implemented. Hosted run, 28 Oct 2026: **46 pass, 0 fail, 5 not run** (4 frontend/build cases and 1 key-dependent case); saved runs in `docs/benchmark-results/` |
| Household editing (add/remove/edit members, resources, tasks; undo; reset), plan export (JSON, calendar .ics, print/PDF) | Implemented and covered by e2e |
| Deployment | **Live:** frontend https://maymourad.github.io/DOMINO/ (GitHub Pages) · API https://domino-api-0fo2.onrender.com (Render free tier — first request after idle can take ~30–60 s) |

See [TESTING.md](TESTING.md) for the exact commands that were run and their results.

## Architecture in one picture

```
Household snapshot → Confirmed disruption → Dependency analysis → CP-SAT optimization → Independent verification → Human approval
 (validated JSON)    (user-confirmed)       (graph, BFS paths)    (lexicographic)        (separate module)         (simulation only)
```

Details: [ARCHITECTURE.md](ARCHITECTURE.md).

## Quick start

Requirements: Python ≥ 3.11 (developed on 3.14), Node ≥ 20.

```bash
# backend
cd backend
python -m venv .venv && . .venv/bin/activate          # Windows: see the note below
pip install -e ".[dev]"
python -m uvicorn app.main:app --port 8000

# frontend (second terminal)
cd frontend
npm install
npm run dev                                           # http://127.0.0.1:5173 (proxies /v1 to :8000)
```

> **Windows note:** OR-Tools loads native DLLs and fails with `WinError 206` if the venv path is very long. Create the venv at a short path (e.g. `py -m venv C:\dv`).

### Configure Gemini (optional)

Copy `.env.example` to `.env` (repo root, git-ignored) and set `GEMINI_API_KEY` and `GEMINI_MODEL` (a *model name* such as `gemini-3.5-flash-lite` — not a Google Cloud project id; a non-model value is ignored with a warning in `/v1/health`). The key is read **only by the backend**; it never appears in frontend code. Without it the “Interpret with AI” control is labelled unavailable, and presets plus the manual form work fully.

### Tests and checks

```bash
cd backend  && python -m pytest && ruff check .       # 63 tests incl. the 51-case benchmark suite
cd frontend && npm run typecheck && npm run lint && npm test
cd frontend && npx playwright install chromium && DOMINO_PYTHON=<python> npx playwright test
cd frontend && VITE_BASE_PATH=/DOMINO/ npm run build     # production build for GitHub Pages
cd frontend && VITE_BASE_PATH=/DOMINO/ npm run preview   # preview needs the same base path (in Git Bash prefix MSYS_NO_PATHCONV=1)
```

## Demo (60–90 s)

See [DEMO_GUIDE.md](DEMO_GUIDE.md): Amina becomes unavailable → cascade → verified recovery (pickup→Khalid, homework→Noura, dinner untouched) → Khalid also unavailable → DOMINO reports the pickup **uncovered** instead of inventing a caregiver.

## Responsible-AI limitations

- Fictional data only; no real-world dispatch, messaging, bookings, or emergency-service integration.
- Bounded single-day planning horizon (5-minute grid); itineraries embed travel time; other transitions use a declared travel matrix and unmodelled travel is rejected rather than assumed zero.
- The language model never schedules, validates, or approves anything; it only proposes structured events that a human must confirm.
- Natural-language extraction can be wrong or incomplete — hence mandatory review. On two 12-sentence sets (hosted API, 28 Oct 2026) Gemini matched 12/12 (annotated) and 11/12 (held-out) and the rule parser 12/12 on both, but the parser's held-out score is not independent (it was fixed after a first miss). These are sanity checks, not general accuracy claims; see [TESTING.md](TESTING.md).
- The optimizer reflects the stated rules, not real-world wellbeing. No predictive emergency probabilities are produced.

## Team
May Ahmed Mourad (Grade 12), Shamsa Faris Almazrouei (Grade 12), Fatima Mohamed Almazrouei (Grade 11) — Abu Dhabi University 6th Annual COE STEM Programming with AI Competition 2026.

## Repository map

`backend/` FastAPI + OR-Tools · `frontend/` React/TS/Vite · `data/households` fixtures · `data/benchmarks` cases · `docs/` decisions, references, saved benchmark run · `.github/workflows` CI + Pages · `presentation/` 30-slide deck (PPTX, PDF), evidence ledger, oral path · `report/` six-page technical report (Word, PDF) · `video/` video production pack and recording scripts.

Also: [COMPETITION_CLARIFICATIONS.md](COMPETITION_CLARIFICATIONS.md), [EVALUATION_METHODOLOGY.md](EVALUATION_METHODOLOGY.md), [AI_DEVELOPMENT_LOG.md](AI_DEVELOPMENT_LOG.md), [AI usage report](docs/AI_USAGE_REPORT.md).


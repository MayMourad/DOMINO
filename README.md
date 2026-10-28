# DOMINO â€” Family Resilience Intelligence System

**Team:** May Ahmed Mourad (G12) · Shamsa Faris Almazrouei (G12) · Fatima Mohamed Almazrouei (G11)

> When one part of family life changes, DOMINO calculates what happens next â€” and helps the family find a verified way forward.

DOMINO is a **computational family digital twin and recovery planner**, built for the Abu Dhabi University 6th Annual COE STEM Programming with AI Competition (theme: *AI for Family*, Cycle 3). It is **not** a calendar, a to-do list, or a chatbot: it models a household as a typed dependency graph, finds what a hypothetical disruption invalidates (directly and downstream), solves for legal recovery assignments with **Google OR-Tools CP-SAT**, and re-checks every plan with a **separate, independent verifier** before a human approves it.

All households are **fictional**. DOMINO simulates hypothetical events from the data you give it; it does not predict real emergencies, track anyone, or contact anyone. It is not endorsed by any government body; it relates to the UAE Year of Family 2026 only in theme.

## What is implemented

| Area | Status |
|---|---|
| 3 fictional households (JSON, schema + integrity validated, baseline verified) | Implemented and tested |
| Typed dependency graph, direct/indirect impact, causal paths, cycle detection | Implemented and tested |
| CP-SAT recovery: lexicographic Tier 0â†’1â†’2â†’3 coverage, then strategy preferences; 3 strategies, de-duplicated; no-good â€œanother arrangementâ€ | Implemented and tested |
| Independent verifier (18 rules, negative tests) | Implemented and tested |
| Gemini natural-language â†’ *proposed* event (structured output, entity resolution, confirmation gate) | Implemented; **live Gemini call not exercised (no API key available)** â€” logic tested with a stand-in extractor |
| 7 screens (Launch, Network, Disruption Studio, Cascade Lab, Recovery Studio, Futures Lab, Evaluation Lab) | Implemented; flows covered by Playwright |
| 3D constellation, cinematic cascade timeline, magnetic recovery transitions | Implemented (original code; see `docs/references/ATTRIBUTION.md`) |
| 50 executable benchmark cases (46 run in backend; 4 external) | Implemented; run results in `docs/benchmark-results/latest.json` |
| Household editing (add/remove/edit members, resources, tasks; undo; reset), plan export (JSON, calendar .ics, print/PDF) | Implemented and covered by e2e |
| Deployment | **Live:** frontend https://maymourad.github.io/DOMINO/ (GitHub Pages) · API https://domino-api-0fo2.onrender.com (Render free tier — first request after idle can take ~30–60 s) |

See [TESTING.md](TESTING.md) for the exact commands that were run and their results.

## Architecture in one picture

```
Household snapshot â†’ Confirmed disruption â†’ Dependency analysis â†’ CP-SAT optimization â†’ Independent verification â†’ Human approval
 (validated JSON)    (user-confirmed)       (graph, BFS paths)    (lexicographic)        (separate module)         (simulation only)
```

Details: [ARCHITECTURE.md](ARCHITECTURE.md).

## Quick start

Requirements: Python â‰¥ 3.11 (developed on 3.14), Node â‰¥ 20.

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

Copy `.env.example` to `.env` (repo root, git-ignored) and set `GEMINI_API_KEY` and `GEMINI_MODEL` (a *model name* such as `gemini-3.5-flash-lite` — not a Google Cloud project id; a non-model value is ignored with a warning in `/v1/health`). The key is read **only by the backend**; it never appears in frontend code. Without it the â€œInterpret with AIâ€ control is labelled unavailable, and presets plus the manual form work fully.

### Tests and checks

```bash
cd backend  && python -m pytest && ruff check .       # 63 tests incl. the 51-case benchmark suite
cd frontend && npm run typecheck && npm run lint && npm test
cd frontend && npx playwright install chromium && DOMINO_PYTHON=<python> npx playwright test
cd frontend && VITE_BASE_PATH=/DOMINO/ npm run build     # production build for GitHub Pages
cd frontend && VITE_BASE_PATH=/DOMINO/ npm run preview   # preview needs the same base path (in Git Bash prefix MSYS_NO_PATHCONV=1)
```

## Demo (60â€“90 s)

See [DEMO_GUIDE.md](DEMO_GUIDE.md): Amina becomes unavailable â†’ cascade â†’ verified recovery (pickupâ†’Khalid, homeworkâ†’Noura, dinner untouched) â†’ Khalid also unavailable â†’ DOMINO reports the pickup **uncovered** instead of inventing a caregiver.

## Responsible-AI limitations

- Fictional data only; no real-world dispatch, messaging, bookings, or emergency-service integration.
- Bounded single-day planning horizon (5-minute grid); itineraries embed travel time; other transitions use a declared travel matrix and unmodelled travel is rejected rather than assumed zero.
- The language model never schedules, validates, or approves anything; it only proposes structured events that a human must confirm.
- Natural-language extraction can be wrong or incomplete â€” hence mandatory review. No accuracy figure exists until the annotated sentences are run against a real key.
- The optimizer reflects the stated rules, not real-world wellbeing. No predictive emergency probabilities are produced.

## Team
May Ahmed Mourad (Grade 12), Shamsa Faris Almazrouei (Grade 12), Fatima Mohamed Almazrouei (Grade 11) — Abu Dhabi University 6th Annual COE STEM Programming with AI Competition 2026.

## Repository map

`backend/` FastAPI + OR-Tools Â· `frontend/` React/TS/Vite Â· `data/households` fixtures Â· `data/benchmarks` cases Â· `docs/` decisions, references, saved benchmark run Â· `.github/workflows` CI + Pages.

Also: [COMPETITION_CLARIFICATIONS.md](COMPETITION_CLARIFICATIONS.md), [EVALUATION_METHODOLOGY.md](EVALUATION_METHODOLOGY.md), [AI_DEVELOPMENT_LOG.md](AI_DEVELOPMENT_LOG.md).


# Deployment

## Status (2026-10-27) — deployed
- **GitHub repository:** https://github.com/MayMourad/DOMINO (public). CI green on Ubuntu.
- **Frontend:** https://maymourad.github.io/DOMINO/ — GitHub Pages, built by `.github/workflows/pages.yml` with `VITE_BASE_PATH=/DOMINO/` and `VITE_API_BASE_URL` from the repository variable `API_BASE_URL`.
- **Backend:** https://domino-api-0fo2.onrender.com — Render free web service built from the root `Dockerfile` via `render.yaml` (auto-deploys on push to `main`). `CORS_ALLOWED_ORIGINS=https://maymourad.github.io`. Secrets (`GEMINI_API_KEY`) live only in the Render dashboard.
- **Cold starts:** the free tier sleeps when idle; the first request can take tens of seconds. Open `/v1/health` before a demo to warm it.
- **Re-verify any time:** `python scripts/live_smoke.py https://domino-api-0fo2.onrender.com --origin https://maymourad.github.io` and `E2E_BASE_URL=https://maymourad.github.io/DOMINO/ npx playwright test` (from `frontend/`).
- **Owner action (optional):** in Render, set `GEMINI_MODEL` to `gemini-3.5-flash-lite` (it currently holds a project id, which the backend ignores with a warning).

## Details

## 1. Backend (any HTTPS Python host)
- Runtime: Python ≥ 3.11 (developed on 3.14). OR-Tools publishes wheels for common platforms; verify the chosen host's Python version has one.
- Install: `pip install ./backend` (from the repo root) · Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT` with working directory `backend/` and `DOMINO_DATA_DIR` pointing at the repo's `data/` folder (default resolves relative to the repo).
- Environment: `GEMINI_API_KEY`, `GEMINI_MODEL`, `CORS_ALLOWED_ORIGINS` (exactly the Pages origin, e.g. `https://<user>.github.io`), `SOLVER_TIME_LIMIT_SECONDS`, `BENCHMARK_RUNS_ENABLED`.
- Health check: `GET /v1/health`. Safeguards already in code: request-size limit, per-IP rate limits for interpretation (12/min) and benchmarks (6/min; AI-eval 2/min), bounded solver concurrency (4), CORS allow-list, no stack traces in responses.
- Do not assume a hosting plan's free-tier limits; free tiers commonly sleep when idle (cold start of several seconds) — warm it before a demo.

## 2. Frontend (GitHub Pages)
- Set repository variable `API_BASE_URL` to the backend's HTTPS origin, enable Pages (source: GitHub Actions), push to `main`: `.github/workflows/pages.yml` builds with `VITE_BASE_PATH=/<repo>/` and copies `index.html` to `404.html`. Routing is hash-based, so refresh on any screen works.
- Local check of the subpath build: `VITE_BASE_PATH=/DOMINO/ npm run build && npm run preview`.

## 3. Verification checklist (to run after publishing)
Frontend builds ✓ (done locally) · base path works · refresh on `#/recovery` works · API reachable over HTTPS · CORS allows only the Pages origin · no `GEMINI_API_KEY` string in `frontend/dist` (`grep -r GEMINI frontend/dist` should find nothing but UI copy) · all 7 screens load · simulate/recover work against the hosted API · benchmark endpoint rate-limited.

# Deployment

## Status (2026-10-27)
- **GitHub repository:** https://github.com/MayMourad/DOMINO (public). CI (backend, frontend, Playwright e2e on Ubuntu) passed on the initial push.
- **Frontend (GitHub Pages):** https://maymourad.github.io/DOMINO/ — live. Without a backend it correctly shows *API offline* and disables computation.
- **Backend:** one-click Render Blueprint — https://render.com/deploy?repo=https://github.com/MayMourad/DOMINO — requires the owner to sign in to Render (and optionally paste `GEMINI_API_KEY` in the dashboard). After it is up, set the repository variable `API_BASE_URL` to the service URL and re-run the Pages workflow (`gh variable set API_BASE_URL --body https://<service>.onrender.com && gh workflow run pages.yml`), then verify with `python scripts/live_smoke.py https://<service>.onrender.com --origin https://maymourad.github.io`.

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

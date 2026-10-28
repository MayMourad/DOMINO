# AI development log

Project team: May Ahmed Mourad (G12), Shamsa Faris Almazrouei (G12), Fatima Mohamed Almazrouei (G11).

This file indexes AI-assisted work. It does **not** contain chat transcripts, and none were reconstructed. The project owner must export the genuine chats (for the required single PDF) from the tool that held them.

| Date | Session / tool | Task | Key decisions | Evidence |
|---|---|---|---|---|
| 2026-10-27 | Claude Code (Claude desktop app, model Sonnet 5.5), one session | Implement DOMINO prototype end to end from the master prompt plus the visual-requirements addendum | Backend-first: domain model → fixtures → verifier → graph → CP-SAT → API → benchmarks, then frontend; independent verifier kept free of optimizer imports; lexicographic objective passes; honest uncovered-task handling; Gemini via `generate_content` + JSON schema (no key available, so only the logic is tested); original canvas constellation instead of copying Spline scenes | 54 backend tests, 9 frontend tests, 6 Playwright tests, 50-case benchmark run (`docs/benchmark-results/latest.json`); see TESTING.md |

Chat export location: **to be provided by the project owner** (not stored in this repository).

Notable corrections made during development (kept for the report): baseline comparison initially ignored user rejections for the greedy baseline (unfair; fixed to compare only unconstrained cases); React Flow controlled-mode dimension feedback was missing (fit-view no-op; fixed); alias resolution for “car” matched two resources (fixed to prefer exact resource type).

## 2026-10-27 (continuation, same Claude Code session)
Deployed to GitHub (repo `DOMINO`), Pages and Render; ran live tests. Decisions: default model `gemini-3.5-flash-lite` (the first choice `gemini-3.8-flash` timed out at 15 s); non-model `GEMINI_MODEL` values are ignored with a health warning; prompt now defines each event type; provider errors are classified precisely and scrubbed of key-shaped text. Evidence: `docs/benchmark-results/ai-interpretation.json`, TESTING.md.

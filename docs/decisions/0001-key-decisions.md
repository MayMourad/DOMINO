# ADR 0001 — Key engineering decisions

1. **One boolean per (task, member, start, resource set)** instead of integer start variables: makes eligibility, availability and resource choice static domain pruning while keeping contention in `NoOverlap`/`Cumulative`. Cost: more variables, acceptable at household scale (hundreds).
2. **Lexicographic passes, not weighted sums**: guarantees a Tier 0 task is never traded for several low-tier tasks. Cost: several solves per strategy (~tens of ms each here).
3. **Resource model**: `capacity` bounds per-task unit demand (e.g. seats); `exclusive` forbids concurrent use. Vehicles are exclusive; a pickup needs 2 seat-units so “seats reduced to 1” makes pickup infeasible.
4. **Verifier independence**: no imports from optimizer/candidate generation; duplicated rule logic is intentional.
5. **Criticality** = Tier 0–1. `completeRecovery` = nothing uncovered; `criticalRecovery` = no Tier 0–1 task uncovered; three separate status fields (validity, completeness, approval).
6. **Strategy de-duplication** by canonical assignment signature; “another arrangement” uses a no-good cut rather than fabricating variety.
7. **Hash-based routing + localStorage draft** so GitHub Pages refreshes work and edits survive reloads (per-viewer convenience only).
8. **Gemini** only extracts; deterministic code resolves and validates; every proposed event starts unconfirmed.
9. **Disruption semantics**: `member_unavailable` removes a window; `availability_changed` *replaces* availability by the given window; `task_rescheduled` replaces the task window; `resource_capacity_changed` sets capacity from `value`.

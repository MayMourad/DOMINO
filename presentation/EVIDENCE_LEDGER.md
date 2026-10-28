# DOMINO presentation — evidence ledger

Observation date for every live measurement: **28 Oct 2026**. Sources: the published prototype (`https://maymourad.github.io/DOMINO/`), the hosted API behind it, and the public repository. Raw captures are in `presentation/evidence/` (`live_flagship.json`, `live_benchmark.json`) and `presentation/shots/` (screenshots). `build.mjs` reads those files, so every number on the slides is regenerated from them rather than typed by hand.

Category key: **Implemented** (exists in the code) · **Observed** (seen in the live prototype) · **Measured** (a number from a recorded run) · **Target** (a configured limit, not a result) · **Future** (not built).

| # | Claim on the slides | Slide | Category | Source / verification method | Limitation |
|---|---|---|---|---|---|
| 1 | Amina becomes unavailable 14:30–18:00; pickup, grocery and homework are broken, dinner is not | 2, 8 | Measured | `data/households/amina.json`; `POST /v1/simulations` (live) | Fictional household, one simulated day |
| 2 | Direct = 4 (Amina + 3 tasks), indirect = 2 (milestone + Yusuf), depth 3; weighted coverage 100% → 25% | 8, 17, 24 | Measured | `live_flagship.json` (`sim`) | Single scenario |
| 3 | Typed graph with edge types assigned_to, requires_resource, requires_permission, depends_on, enables, serves_dependent, disrupted_by | 3, 11 | Implemented | `backend/app/services/dependency_graph.py` | Diagram simplified |
| 4 | Three fictional households | 6 | Implemented | `data/households/*.json`; real screenshots of the published Family Network | Synthetic data only |
| 5 | 56 candidates after static filtering; CP-SAT status OPTIMAL; five lexicographic passes; objective values Tier0=10, Tier1=12, Tier3=2, displacement 0, changes 3 | 9, 21 | Measured | `live_flagship.json` (`rec`) | One worker, seed 1; formulation simplified on the slide |
| 6 | CP-SAT formulation `x[t,p,s,r]`, no-overlap for people and exclusive resources, cumulative for shared, precedence, lexicographic objective | 21, 22 | Implemented | `backend/app/services/{candidate_generation,optimizer}.py` | Presented in simplified notation |
| 7 | Independent verifier: 18 rules, 56/56 checks passed, 0 hard violations on the flagship plan | 9, 23, 25 | Measured | `live_flagship.json` (`validation`); `verifier.py`; negative tests T16/T24/T25/T30 | The verifier checks the model's declared rules, not real-world safety |
| 8 | All three recovery strategies produced the same single arrangement | 18 | Measured | `live_flagship.json` | True for this scenario only |
| 9 | Solver time: 10 hosted runs, 43–167 ms, median 133 ms (flagship run 51 ms) | 18, 24 | Measured | `live_flagship.json` (`solver_ms_10_runs`) | Free-tier CPU; varies; not a guarantee |
| 10 | Round trip about 0.5 s (simulate) and 0.9 s (recover) | 24 | Measured | `live_flagship.json` | Includes network; depends on the day |
| 11 | With Khalid also unavailable 14:40–15:45: valid partial plan, 33% weighted coverage, pickup and homework uncovered, 30/30 checks, solver OPTIMAL | 19, 25 | Measured + Observed | `live_flagship.json` (`rec2`); screenshots `07_ref`, `07_mod`, `07_banner` | Result depends on the declared permissions |
| 12 | Noura cannot take the pickup (missing skill, missing permissions, restrictions); Yusuf is a dependent | 22, 25 | Observed | Explanation records shown in the Futures Laboratory banner | Reason codes are produced by the model's own data |
| 13 | Natural language: Gemini (`gemini-3.5-flash-lite`) returned `member_unavailable`, Amina, 14:30–18:00, unconfirmed | 13 | Observed | Live probe of the hosted API; screenshot `03_studio_nl` | One probe, not an accuracy claim |
| 14 | Gemini matched 12/12 annotated and 11/12 held-out sentences; the rule parser matched 12/12 on both | 13 (notes) | Measured | `docs/benchmark-results/ai-*.json` | 12-sentence sets; the parser's held-out score was fixed after a first miss, so it is not independent |
| 15 | 51 benchmark cases defined and processed; 46 passed, 0 failed, 5 not run | 20, 26, 29 | Measured | `POST /v1/benchmarks/run` on the hosted API; `live_benchmark.json`; screenshot `10_eval_overview` | The 5 not-run cases are external or key-dependent; cases are hand-written |
| 16 | Dependency detection: 11 cases, precision / recall / F1 = 1 | 26 | Measured | `live_benchmark.json` (`dependencyDetection`) | Small hand-authored set; supports correctness on these cases only |
| 17 | Baselines: DOMINO 71.5% mean weighted coverage, 10/21 cases with an uncovered critical task, 2.48 mean changes; greedy first-fit 71.1%, 10/21, 3.14; no recovery 36.6%, 20/21 | 26 | Measured | `live_benchmark.json` (`baselineComparison`) | Greedy tied DOMINO on critical coverage in all 21 cases; stated on the slide |
| 18 | Per-case solver median 187 ms, max 393 ms; case wall-clock median 802 ms, p95 1700 ms | 26 | Measured | `live_benchmark.json` | Includes baselines and three strategies; free tier |
| 19 | Engineering targets (e.g. 2 s per strategy) | notes only | Target | `backend/app/config.py` (solver limits) | Configured limits, not results |
| 20 | Gemini key lives only on the server; CORS allow-list; Pydantic validation; rate limits | 27 | Implemented | `render.yaml`, `backend/app/main.py`; published JavaScript scanned for key patterns | Hosting is free tier; the health check is a snapshot, not an uptime promise |
| 21 | UAE Year of Family 2026 | 28 | Reference | `https://u.ae/en/Year-of-family/Family-year-2026` | Relates to the theme only; not endorsed; benefits are design-level, not measured with families |
| 22 | Larger households, travel times, multi-day planning, Arabic support, usability studies, privacy-preserving data | 29 | Future | Roadmap only | Not built |

## Not claimed anywhere in the deck

- No user study, wellbeing or population-level outcome.
- No claim that DOMINO predicts emergencies; it simulates specified, hypothetical events.
- No claim about any specific commercial calendar or task product.
- No uptime guarantee for the free-tier backend.
- No animations were built; the PDF and the PPTX are both fully static.

## Secrets check

The PPTX XML and the PDF text were scanned for API-key prefixes, Google project identifiers, Render service or dashboard identifiers and `onrender` hostnames: none present. The only external hyperlink is the public prototype URL.

# Competition clarifications

Event: Abu Dhabi University 6th Annual COE STEM Programming with AI Competition — Thursday 29 October 2026, 3:00–6:00 PM UAE time, virtual; theme *AI for Family*; Cycle 3 (Grades 9–12), classification decided by the organizers.

## Resolved by the project owner (2026-10-27)

| Question | Answer / decision |
|---|---|
| Build restrictions (advance-built, built during the session) | **No specific restriction on building was stated.** Only the online submission window applies: 3:00–6:00 PM UAE time on 29 October 2026. |
| Submission timeframe | 3:00–6:00 PM on the 29th (online). |
| Judging rubric | **None supplied.** Nothing in this repo assumes weights; DOMINO is documented against the stated theme and technical criteria only. |
| Category classification | **Decided by the organizers**, not by the team. |

## Still open (not answered by the supplied materials)

Handled by choosing the safest course of action rather than assuming an answer:

| Open point | Course taken |
|---|---|
| Are external AI APIs (Gemini) allowed, and any key/data restrictions? | Gemini is **optional**: the app is fully usable without it (presets, manual form). The key lives only on the backend; only fictional data is ever sent. If the organizer forbids external APIs, leave `GEMINI_API_KEY` unset. |
| Must hosted backends stay online after submission / for how long? | The prototype is also runnable locally from the repository with the README steps, so judging never depends on one hosted instance. |
| Required URL / archive format for the prototype? | Provided all three: public GitHub repository, GitHub Pages URL, and reproducible local run instructions. |
| Open-source libraries and attribution? | Only permissively licensed libraries; credited in `docs/references/ATTRIBUTION.md`. |
| Format of the compiled AI-chat PDF? | `AI_DEVELOPMENT_LOG.md` indexes sessions; genuine exported chats are compiled by the owner (never reconstructed). |

Context note: 2026 is the UAE *Year of Family* (https://u.ae/en/Year-of-family/Family-year-2026). DOMINO references this as theme only and does not imply government endorsement.

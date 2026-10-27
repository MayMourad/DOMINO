# Demo guide (60–90 seconds)

Start both servers (see README). Use a 1440×900 window; enable “reduced motion” in the OS only if you want an instant, animation-free capture.

## Flagship sequence and the outcomes you should see

Every outcome below is **computed live** — these are expectations, not canned results.

| Time | Action | Expected result |
|---|---|---|
| 0–10 s | Launch → **Explore Amina Family** | Family Network: 4 members, 4 responsibilities, 13 typed relationships, validation ✓ |
| 10–25 s | **Disrupt** → preset **Amina unavailable** → **Confirm all** → **Run scenario** | Cascade Lab plays: Amina → School pickup, Grocery, Homework (direct) → “Yusuf arrived home” and Yusuf (at risk). Dinner stays un-highlighted. “Recoverable? yes” |
| 25–45 s | **Continue to Recovery Studio** | Graph animates: three tasks detach from Amina and reconnect — pickup & groceries → Khalid, homework → Noura. “Verified complete recovery”, 4/4 covered, 3 reassigned; note that 3 strategies agree on 1 arrangement |
| 45–60 s | Open the **Independent verification** panel; expand V07/V10/V13 | 0 hard violations; evidence lines (e.g. Khalid holds `drive`, `pickup_authorized`; sedan + restraint free 14:45–15:25) |
| 60–75 s | **Futures** → Secondary disruption *Caregiver schedule conflict* → **Add** → **Run counterfactual** | Modified world: School pickup and Homework uncovered; banner “Different result… will not invent a caregiver”. Reference column unchanged |
| 75–90 s | Back in **Recovery** → **Review & approve** (use the restricted-transport household for an unresolved-critical example) | Approval requires explicit human acknowledgement of uncovered critical tasks; receipt says no one was notified |

Optional extras: **Reject** Khalid for pickup (fresh solve → pickup uncovered); **Find another distinct arrangement**; **Evaluate → Run benchmark suite**.

## Contingency

- **Backend down:** the top bar shows “API offline”; households open from read-only bundled copies and computation is disabled. Start `uvicorn` and press **Retry**. Do not present offline views as solver output.
- **Gemini unavailable:** the AI panel says so; use presets or the manual form.
- **Graph looks zoomed oddly:** press the ⛶ fit-view control.
- **Fresh state:** Network → **Reset household** (clears scenario, plans and approval), or clear site data.

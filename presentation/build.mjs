// Builds DOMINO_Presentation.pptx (30 slides, native editable objects, speaker notes) from live evidence + real screenshots.
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { createRequire } from 'node:module'
import { C, F, act, pres, slide, T, mono, source, box, tbox, edge, pill, stat, shot, callout, gantt, aminaGraph, constellation, fmt, THEME, count } from './lib.mjs'

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const S = (f) => path.join(here, 'shots', f)
const A = (f) => path.join(here, 'assets', f)
fs.mkdirSync(path.join(here, 'assets'), { recursive: true })
const ev = JSON.parse(fs.readFileSync(path.join(here, 'evidence', 'live_flagship.json'), 'utf8'))
const bench = JSON.parse(fs.readFileSync(path.join(here, 'evidence', 'live_benchmark.json'), 'utf8'))
const suite = bench.suite
const plan = ev.rec.plans[0], plan2 = ev.rec2.plans[0]
const solverMs = [...ev.solver_ms_10_runs].sort((a, b) => a - b)
const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const DATE = '28 Oct 2026'

// ---------------------------------------------------------------- image preparation (real screenshots only; crops, never stretched)
async function crop(name, out, l, t, w, h, width = 2400) {
  const meta = await sharp(S(name)).metadata()
  const r = { left: l, top: t, width: Math.min(w, meta.width - l), height: Math.min(h, meta.height - t) }
  await sharp(S(name)).extract(r).resize({ width: Math.min(width, r.width) }).jpeg({ quality: 90 }).toFile(A(out))
  return r.width / r.height
}
const img = {}
const put = async (k, shotName, out, l, t, w, h, width) => { img[k] = { f: A(out), ar: await crop(shotName, out, l, t, w, h, width) } }
await put('launch', '01_launch_viewport.png', 'launch.jpg', 0, 0, 2560, 1720)
await put('netMulti', '12_net_multigen.png', 'net_multi.jpg', 40, 250, 1440, 620, 2200)
await put('netRestr', '13_net_restricted.png', 'net_restr.jpg', 40, 250, 1440, 620, 2200)
await put('netAmina', '02_network_graph.png', 'net_amina.jpg', 40, 250, 1440, 620, 2200)
await put('inspector', '02_inspector.png', 'inspector.jpg', 0, 0, 720, 1150, 1440)
await put('presets', '03_presets.png', 'presets.jpg', 0, 0, 750, 1022, 1500)
await put('scenario', '03_scenario.png', 'scenario.jpg', 0, 0, 2304, 310)
await put('nl', '03_studio_nl.png', 'nl.jpg', 0, 0, 750, 850, 1500)
await put('nlReview', '03_studio_nl.png', 'nl_review.jpg', 0, 860, 750, 992, 1500)
await put('cascade', '04_cascade_top.png', 'cascade.jpg', 0, 0, 2304, 1450)
await put('recGraph', '05_recovery_graph.png', 'rec_graph.jpg', 50, 250, 1440, 500, 2200)
await put('verify', '06_verification.png', 'verify.jpg', 0, 0, 720, 1400, 1440)
await put('futRef', '07_ref.png', 'fut_ref.jpg', 0, 0, 1138, 910, 1500)
await put('futMod', '07_mod.png', 'fut_mod.jpg', 0, 0, 1138, 910, 1500)
await put('futBanner', '07_banner.png', 'fut_banner.jpg', 0, 0, 2304, 162, 2400)
await put('eval', '10_eval_overview.png', 'eval.jpg', 0, 100, 2560, 1480)
const fit = (im, maxW, maxH) => { const w = Math.min(maxW, maxH * im.ar); return { w, h: w / im.ar } }

const NOTE_END = '\n\nEvidence basis: see EVIDENCE_LEDGER.md in the presentation folder.'

// ================================================================= ACT I — THE PROBLEM
act('Opening')
// 01 ---------------------------------------------------------------- cover
{
  const s = slide('COVER', {
    notes: `Opening (20 seconds). DOMINO is a Family Resilience Intelligence System: it models a household as a connected system and calculates how a family can recover when a plan breaks. Our line is: when one thing changes, everything connects.\n\nWe are May Ahmed Mourad and Shamsa Faris Almazrouei from Grade 12, and Fatima Mohamed Almazrouei from Grade 11, from ADNOC Schools — Madinat Zayed. The project is built for the theme AI for Family in Cycle 3.\n\nRECOMMENDED SHORTER ORAL PATH (no extra slides needed): 1 cover, 2 problem, 3 hidden system, 5 solution, 9 computational recovery, 11 architecture, 17 cascade, 18 recovery, 23 verification, 25 when recovery is impossible, 26 evidence, 28 impact, 30 close. That is thirteen slides and fits a five to seven minute pitch. The remaining slides are for judges reading the submission independently.` + NOTE_END,
  })
  constellation(s, 9.7, 3.7, 2.75, { line: C.SLATE })
  T(s, 'DOMINO', 0.8, 1.35, 7.5, 1.5, { fontSize: 96, bold: true, color: C.WHITE })
  T(s, 'Family Resilience Intelligence System', 0.8, 2.95, 7.5, 0.6, { fontSize: 28, color: C.SOFT })
  T(s, '“When one thing changes, everything connects.”', 0.8, 3.85, 6.8, 0.9, { fontSize: 24, italic: true, color: C.WHITE })
  T(s, '6th Annual COE STEM Programming with AI Competition  ·  AI for Family', 0.8, 5.0, 7.2, 0.3, { fontSize: 14, color: C.SOFT })
  mono(s, 'May Ahmed Mourad  ·  Grade 12', 0.8, 5.55, 6.5, 0.28, { fontSize: 14, color: C.WHITE })
  mono(s, 'Shamsa Faris Almazrouei  ·  Grade 12', 0.8, 5.88, 6.5, 0.28, { fontSize: 14, color: C.WHITE })
  mono(s, 'Fatima Mohamed Almazrouei  ·  Grade 11', 0.8, 6.21, 6.5, 0.28, { fontSize: 14, color: C.WHITE })
  T(s, 'ADNOC Schools — Madinat Zayed', 0.8, 6.62, 6.5, 0.3, { fontSize: 12, color: C.SOFT })
  T(s, 'Concept rendering: entities of the fictional Amina household', 8.4, 6.62, 4.4, 0.3, { fontSize: 10, italic: true, color: C.SOFT, align: 'right' })
}

act('Act I — The problem')
// 02 ---------------------------------------------------------------- one disruption
{
  const s = slide('DARK', {
    kicker: 'Act I · The problem', title: 'One disruption, multiple consequences',
    notes: `Start with a moment, not a technology. It is 2:30 in the afternoon. Amina, one of two adults in this fictional family, becomes unavailable until 6 PM.\n\nLook at what the original plan asked of her: school pickup at 14:45, groceries at 15:55 and homework help at 16:45. Three responsibilities that looked independent in a calendar are suddenly all broken at once. Dinner belongs to Khalid, so it is not obviously affected.\n\nThe important point is that the three broken tasks are not equal. Collecting a nine-year-old from school is essential; groceries can wait. A calendar shows three red boxes. It does not tell the family which one matters most, who is legally and practically able to replace Amina, or what depends on what. That is the gap DOMINO addresses.\n\nData: every time, task and person on this slide comes from the Amina household fixture (data/households/amina.json). Transition: so what is the hidden structure behind those three boxes?` + NOTE_END,
  })
  T(s, 'At 2:30 PM, Amina becomes\nunavailable until 6:00 PM.', 0.6, 1.5, 7.6, 1.2, { fontSize: 30, bold: true, color: C.WHITE })
  pill(s, 'DISRUPTION · 14:30', 8.6, 1.62, 2.1, 0.36, { fill: '3A1B22', line: 'D98186', color: 'FFE6E6', fontSize: 11 })
  T(s, 'Original plan (fixture)  ·  shaded = available  ·  hatched = unavailable', 0.6, 2.85, 9, 0.26, { fontSize: 12, color: C.SOFT })
  const bar = (a, b, t, hot) => ({ s: a, e: b, text: t, fill: hot ? '4A2430' : C.COBALT, line: hot ? 'E08A8E' : undefined, size: 11 })
  gantt(s, 0.6, 3.2, 12.1, [
    { label: 'Amina', sub: 'adult', shade: [{ s: 870, e: 1110 }], away: [{ s: 870, e: 1080 }], bars: [bar(885, 925, 'School pickup', 1), bar(955, 990, 'Grocery', 1), bar(1005, 1035, 'Homework', 1)] },
    { label: 'Khalid', sub: 'adult', shade: [{ s: 870, e: 1110 }], bars: [bar(1050, 1080, 'Dinner')] },
    { label: 'Noura', sub: 'teen', shade: [{ s: 990, e: 1080 }] },
  ], { dark: true, t0: 870, t1: 1140, rowH: 0.7 })
  const y = 5.85
  pill(s, 'School pickup · Tier 0 · essential', 0.6, y, 3.45, 0.42, { fill: '4A2430', line: 'E08A8E', color: C.WHITE, fontSize: 12 })
  pill(s, 'Homework assistance · Tier 1', 4.25, y, 3.0, 0.42, { fill: '4A2430', line: 'E08A8E', color: C.WHITE, fontSize: 12 })
  pill(s, 'Grocery collection · Tier 3', 7.45, y, 2.8, 0.42, { fill: '4A2430', line: 'E08A8E', color: C.WHITE, fontSize: 12 })
  T(s, 'Dinner (Khalid) is not obviously affected.', 10.45, y + 0.05, 2.4, 0.4, { fontSize: 12, color: C.SOFT })
  source(s, 'Source: data/households/amina.json (fictional household). Times are Asia/Dubai, simulated date 29 Oct 2026.', true)
}

// 03 ---------------------------------------------------------------- hidden system
{
  const s = slide('LIGHT', {
    kicker: 'Act I · The problem', title: 'The hidden system behind family life',
    notes: `This is the same household drawn as a system. People at the top, responsibilities below the person who owns them, shared resources on the right, and one milestone: Yusuf arrived home.\n\nThe lines are not decoration. Each one has a type with a defined meaning in the software: assigned-to, uses-resource, enables, depends-on, serves-dependent. School pickup enables the milestone Yusuf arrived home; homework assistance depends on that milestone. So homework is linked to Amina twice: directly, because she is assigned, and indirectly, because it can only happen after pickup.\n\nAlso notice the shared things. One sedan and one child restraint are needed for pickup; groceries need the same sedan. Time is a resource too: nobody can do two things at once.\n\nThat is why a single unavailable caregiver can affect several dependent responsibilities. Transition: a normal calendar stores none of these relationships — let us compare.` + NOTE_END,
  })
  box(s, 0.6, 1.55, 9.35, 4.95, { fill: C.NAVY, round: true })
  aminaGraph(s, 0.85, 1.8, 0.72, 'plain', { ky: 1.2 })
  T(s, '3 responsibilities → 1 caregiver', 10.25, 1.6, 2.5, 0.8, { fontSize: 18, bold: true, color: C.NAVY })
  T(s, 'Pickup, groceries and homework are all assigned to Amina.', 10.25, 2.35, 2.5, 0.8, { fontSize: 12, color: C.MUTED })
  T(s, 'A shared vehicle', 10.25, 3.25, 2.5, 0.4, { fontSize: 18, bold: true, color: C.NAVY })
  T(s, 'Pickup and groceries both need the same sedan, one at a time.', 10.25, 3.62, 2.5, 0.8, { fontSize: 12, color: C.MUTED })
  T(s, 'A gating milestone', 10.25, 4.55, 2.5, 0.4, { fontSize: 18, bold: true, color: C.NAVY })
  T(s, 'Homework can only happen after “Yusuf arrived home”.', 10.25, 4.92, 2.5, 0.8, { fontSize: 12, color: C.MUTED })
  mono(s, 'solid = assigned to / enables   dashed = uses resource   dotted arrow = depends on / serves dependent', 0.6, 6.5, 9.4, 0.25, { fontSize: 10, color: C.MUTED })
  source(s, 'Source: Amina fixture; edge types from backend/app/services/dependency_graph.py. Native, editable diagram.')
}

// 04 ---------------------------------------------------------------- limitations
{
  const s = slide('ICE', {
    kicker: 'Act I · The problem', title: 'Why calendars and task lists are not enough',
    notes: `We are careful here: we are not saying every product lacks these features. This compares common scheduling functions — a shared calendar or a to-do list — with what a disruption actually requires.\n\nA calendar is excellent at recording that something is scheduled. What it typically does not do is know that the school pickup enables the homework session, detect that moving one task threatens another, calculate a legal alternative, check that alternative against permissions and resources, or let you ask what if Khalid is also unavailable.\n\nThe right-hand column is not a claim of perfection; each row points to the slide where we demonstrate it and to a test in our benchmark suite. Transition: so what is DOMINO, in one sentence?` + NOTE_END,
  })
  const hdr = (t, a) => ({ text: t, options: { bold: true, color: C.WHITE, fill: { color: C.NAVY }, align: a ?? 'left', fontSize: 14 } })
  const no = { text: 'Typically limited or absent', options: { color: C.MUTED, fill: { color: C.WHITE }, fontSize: 13 } }
  const rows = [
    ['Records scheduled events', { text: 'Yes — its core purpose', options: { color: C.OK, bold: true, fill: { color: C.WHITE }, fontSize: 13 } }, 'Household model with baseline schedule', 'S07'],
    ['Models dependency relationships', no, 'Typed graph: assigned-to, enables, depends-on …', 'S12'],
    ['Detects cascading consequences', no, 'Direct and downstream impact with causal paths', 'S17'],
    ['Calculates feasible alternatives', no, 'CP-SAT optimization with priority tiers', 'S21'],
    ['Verifies constraints', no, 'Independent 18-rule verifier', 'S23'],
    ['Supports counterfactual comparison', no, 'Recomputed what-if side by side', 'S19'],
  ]
  const tbl = [[hdr('Function'), hdr('Typical calendar / task list'), hdr('DOMINO'), hdr('Slide', 'center')]]
  for (const r of rows) tbl.push([
    { text: r[0], options: { bold: true, color: C.NAVY, fill: { color: C.WHITE }, fontSize: 14 } }, r[1],
    { text: '✓  ' + r[2], options: { color: C.COBALT, bold: true, fill: { color: C.WHITE }, fontSize: 13 } },
    { text: r[3], options: { fontFace: F.mono, color: C.MUTED, align: 'center', fill: { color: C.WHITE }, fontSize: 12 } }])
  s.addTable(tbl, { x: 0.6, y: 1.65, w: 12.1, colW: [3.5, 3.1, 4.5, 1.0], rowH: 0.62, border: { type: 'solid', color: C.LINE, pt: 0.75 }, fontFace: F.sans, valign: 'middle', margin: [0.04, 0.12, 0.04, 0.12] })
  T(s, 'This compares common scheduling functions with the broader requirements of recovering from a disruption. Individual products vary; no claim is made about any specific product.', 0.6, 6.1, 12.1, 0.5, { fontSize: 13, color: C.MUTED })
}

// 05 ---------------------------------------------------------------- solution
{
  const s = slide('ICE', {
    kicker: 'Act I · The problem → the solution', title: 'The DOMINO solution',
    notes: `Here is the whole product in under thirty seconds. DOMINO calculates how a family can recover when its original plan becomes impossible.\n\nFive steps. One: understand — a sentence, a preset or a form becomes a structured event, and a human confirms it. Two: analyze — a dependency graph finds what is directly broken and what is threatened downstream. Three: optimize — Google OR-Tools CP-SAT searches for legal reassignments, protecting essential tasks first. Four: verify — a separate module that shares no code with the solver re-checks every rule. Five: review — a human approves, and anything that cannot be covered is shown as unresolved rather than hidden.\n\nTwo design decisions matter for responsible AI. Language AI only interprets text; it never produces a schedule. And DOMINO simulates hypothetical events; it does not predict how likely an emergency is. Transition: first, who are the families we tested on?` + NOTE_END,
  })
  T(s, 'DOMINO calculates how a family can recover when its original plan becomes impossible.', 0.6, 1.55, 12.1, 0.95, { fontSize: 26, bold: true, color: C.NAVY })
  const steps = [
    ['1', 'Understand', 'Text, preset or form becomes a structured event. A human confirms it.', 'Gemini + built-in parser', C.SOFT, C.NAVY],
    ['2', 'Analyze', 'A typed dependency graph finds direct and downstream consequences.', 'NetworkX graph', C.COBALT, C.WHITE],
    ['3', 'Optimize', 'CP-SAT searches legal reassignments; essential tasks first.', 'OR-Tools CP-SAT', C.COBALT, C.WHITE],
    ['4', 'Verify', 'A separate module re-checks every rule from raw data.', 'Independent verifier', C.OK, C.WHITE],
    ['5', 'Review', 'A human approves — or sees exactly what still needs them.', 'Human in the loop', C.NAVY, C.WHITE],
  ]
  steps.forEach((st, i) => {
    const x = 0.6 + i * 2.45
    tbox(s, [{ text: `${st[0]}  ${st[1]}`, options: { bold: true } }], x, 3.0, 2.55, 0.95, { shape: pres.shapes.CHEVRON, fill: st[4], color: st[5], fontSize: 15, align: 'center', margin: 0 })
    box(s, x + 0.05, 4.2, 2.25, 1.55, { fill: C.WHITE, line: C.LINE })
    T(s, st[2], x + 0.18, 4.32, 2.0, 1.3, { fontSize: 14, color: C.INK })
    pill(s, st[3], x + 0.1, 5.9, 2.15, 0.36, { fill: C.WHITE, line: st[4], color: C.NAVY, fontSize: 11 })
  })
  T(s, 'DOMINO simulates the consequences of specified, hypothetical events. It does not predict the probability of emergencies.', 0.6, 6.4, 12.1, 0.3, { fontSize: 12, italic: true, color: C.MUTED })
}

// 06 ---------------------------------------------------------------- three households
{
  const s = slide('LIGHT', {
    kicker: 'Act I · Test households', title: 'Three households, different constraints',
    notes: `A solver that works for one scripted family proves little, so we built three fictional households with deliberately different structures. All three are real files in the repository and are loaded through the same validated pipeline; the screenshots are their actual Family Network views.\n\nThe Amina family has two authorized adult drivers, a teenager who may help with homework but is explicitly not allowed to drive, and a nine-year-old dependent. The Al-Mansoori family has three generations: two working adults, a grandmother who can help with schoolwork and check-ins but holds no driving permission, and a twelve-year-old. We deliberately did not assume she is incapable because she is older — permissions are explicit data. The Salma family has exactly one licensed driver and one vehicle.\n\nWhy this matters: each household exercises a different behaviour of the solver — clean reassignment, real alternatives between several valid plans, and honest infeasibility when the only legal driver disappears. All data is fictional; no real family information is used.` + NOTE_END,
  })
  const cols = [
    ['The Amina Family', img.netAmina, '4 members · 4 tasks · 4 resources', 'Two authorized adult drivers; a teen who may help with homework but cannot drive; a 9-year-old dependent.', 'Exercises: clean reassignment'],
    ['The Al-Mansoori Multigenerational Family', img.netMulti, '4 members · 5 tasks · 3 resources', 'Three generations; a 70-year-old grandmother helps with schoolwork and check-ins but holds no driving permission.', 'Exercises: several valid alternatives'],
    ['The Salma Family', img.netRestr, '4 members · 4 tasks · 3 resources', 'One licensed driver, one vehicle: losing either leaves school pickup without a legal replacement.', 'Exercises: honest infeasibility'],
  ]
  cols.forEach((c, i) => {
    const x = 0.6 + i * 4.12
    const g = fit(c[1], 3.9, 2.0)
    shot(s, c[1].f, x, 1.6, g.w, g.h, `Family Network graph of ${c[0]} (real prototype screenshot)`)
    T(s, c[0], x, 3.55, 3.9, 0.6, { fontSize: 18, bold: true, color: C.NAVY })
    mono(s, c[2], x, 4.25, 3.9, 0.25, { fontSize: 12, color: C.COBALT })
    T(s, c[3], x, 4.65, 3.9, 1.1, { fontSize: 15, color: C.INK })
    pill(s, c[4], x, 5.85, 3.9, 0.45, { fill: C.ICE, color: C.NAVY, fontSize: 14 })
  })
  source(s, 'Source: data/households/{amina, multigenerational, restricted-transport}.json — fictional; screenshots from the published prototype, ' + DATE + '.')
}

// 07 ---------------------------------------------------------------- flagship household
{
  const s = slide('ICE', {
    kicker: 'Act I · The flagship household', title: 'The Amina family baseline',
    notes: `This is the baseline for the demonstration, exactly as stored in the fixture. Four people. Amina and Khalid are adults with explicit driving and pickup-authorization permissions. Noura is sixteen: she can help with homework, but her record lists driving and pickup as restrictions — so age never grants permission. Yusuf is nine and a dependent: he is never assigned responsibilities, he is the person they care for.\n\nFour responsibilities with their priority tiers: school pickup is Tier 0, essential, and needs a licensed authorized driver, the sedan and the child restraint. Homework and dinner are Tier 1. Groceries are Tier 3, deferrable. Homework depends on the milestone Yusuf arrived home, which pickup enables.\n\nThe baseline itself passes our verifier with zero violations — that is a unit test, not an assumption.` + NOTE_END,
  })
  const members = [
    ['A', 'Amina · 41 · adult', 'drive · pickup_authorized · homework_assist · shopping', C.COBALT],
    ['K', 'Khalid · 43 · adult', 'drive · pickup_authorized · shopping · meal_prep', C.COBALT],
    ['N', 'Noura · 16 · teen', 'homework_assist only · restrictions: drive, pickup_authorized', C.SLATE],
    ['Y', 'Yusuf · 9 · dependent', 'never assigned tasks · authorized carers: Amina, Khalid, Noura', C.NAVY],
  ]
  members.forEach((m, i) => {
    const y = 1.6 + i * 1.18
    tbox(s, [{ text: m[0], options: { bold: true } }], 0.6, y + 0.1, 0.75, 0.75, { shape: pres.shapes.OVAL, fill: m[3], color: C.WHITE, fontSize: 24, align: 'center', margin: 0 })
    T(s, m[1], 1.55, y + 0.07, 4.2, 0.35, { fontSize: 17, bold: true, color: C.NAVY })
    T(s, m[2], 1.55, y + 0.45, 4.3, 0.55, { fontSize: 12, color: C.MUTED })
  })
  const hdr = (t) => ({ text: t, options: { bold: true, color: C.WHITE, fill: { color: C.NAVY }, fontSize: 12 } })
  const cell = (t, o = {}) => ({ text: t, options: { fill: { color: C.WHITE }, color: C.INK, fontSize: 13, ...o } })
  const rows = [
    [hdr('Responsibility'), hdr('Tier'), hdr('Baseline'), hdr('Time'), hdr('Needs')],
    [cell('School pickup', { bold: true }), cell('0', { fontFace: F.mono }), cell('Amina'), cell('14:45–15:25', { fontFace: F.mono, fontSize: 12 }), cell('drive, pickup_authorized, sedan, child restraint', { fontSize: 11 })],
    [cell('Grocery collection', { bold: true }), cell('3', { fontFace: F.mono }), cell('Amina'), cell('15:55–16:30', { fontFace: F.mono, fontSize: 12 }), cell('shopping, sedan', { fontSize: 11 })],
    [cell('Homework assistance', { bold: true }), cell('1', { fontFace: F.mono }), cell('Amina'), cell('16:45–17:15', { fontFace: F.mono, fontSize: 12 }), cell('homework_assist, study area, milestone M01', { fontSize: 11 })],
    [cell('Dinner preparation', { bold: true }), cell('1', { fontFace: F.mono }), cell('Khalid'), cell('17:30–18:00', { fontFace: F.mono, fontSize: 12 }), cell('meal_prep, kitchen', { fontSize: 11 })],
  ]
  s.addTable(rows, { x: 6.1, y: 1.6, w: 6.6, colW: [1.7, 0.45, 0.8, 1.45, 2.2], rowH: 0.62, border: { type: 'solid', color: C.LINE, pt: 0.75 }, fontFace: F.sans, valign: 'middle', margin: [0.03, 0.08, 0.03, 0.08] })
  box(s, 6.1, 4.85, 6.6, 1.55, { fill: C.NAVY })
  mono(s, 'T01 pickup ──enables──▶ M01 “Yusuf arrived home”\nT03 homework ──depends on──▶ M01', 6.3, 4.98, 6.2, 0.55, { fontSize: 12, color: C.SOFT })
  T(s, 'The dependency is stored in the household model, not inferred from a picture. Baseline check: 18 verifier rules, 0 violations (test T01).', 6.3, 5.6, 6.2, 0.7, { fontSize: 13, color: C.WHITE })
  source(s, 'Source: data/households/amina.json; benchmark case T01 “Amina baseline”.')
}

// 08 ---------------------------------------------------------------- cascade begins
{
  const s = slide('DARK', {
    kicker: 'Act I · The problem → analysis', title: 'The cascade begins',
    notes: `This is the output of the dependency analysis for the flagship event, redrawn natively from the real result. Red means directly disrupted; amber means at risk through a dependency; faded means unaffected.\n\nThe analysis starts from the disruption, reaches Amina, and from her to the three tasks whose baseline assignments actually overlap her unavailable window — pickup, groceries and homework. Then it follows only valid dependency edges: pickup enables the milestone Yusuf arrived home, so the milestone is at risk, and so is Yusuf, the dependent that the pickup serves. The cascade depth is three.\n\nTwo things we want you to notice. First, dinner, Khalid, Noura and every resource are untouched — DOMINO does not exaggerate the damage. Second, the causal path is kept, not just the colour: homework has two paths, one through Amina and one through the pickup milestone. The table on the right is the before-and-after state, with the actual path text from the engine.` + NOTE_END,
  })
  box(s, 0.6, 1.55, 8.55, 4.95, { fill: '0C2442', round: true })
  aminaGraph(s, 0.8, 1.85, 0.66, 'cascade', { ky: 1.2 })
  const hdr = (t) => ({ text: t, options: { bold: true, color: C.NAVY, fill: { color: C.SOFT }, fontSize: 12 } })
  const c = (t, col, o = {}) => ({ text: t, options: { color: col ?? C.WHITE, fill: { color: C.DARK2 }, fontSize: 12, ...o } })
  s.addTable([
    [hdr('Entity'), hdr('Before'), hdr('After')],
    [c('Amina'), c('available'), c('unavailable', 'E08A8E', { bold: true })],
    [c('School pickup'), c('valid'), c('direct', 'E08A8E', { bold: true })],
    [c('Grocery'), c('valid'), c('direct', 'E08A8E', { bold: true })],
    [c('Homework'), c('valid'), c('direct + risk', 'E08A8E', { bold: true })],
    [c('Yusuf arrived home'), c('satisfiable'), c('at risk', 'E6B756', { bold: true })],
    [c('Yusuf'), c('served'), c('at risk', 'E6B756', { bold: true })],
    [c('Dinner, Khalid, Noura'), c('valid'), c('unaffected', C.SOFT)],
  ], { x: 9.35, y: 1.55, w: 3.4, colW: [1.5, 0.9, 1.0], rowH: 0.42, border: { type: 'solid', color: C.NAVY, pt: 1 }, fontFace: F.sans, valign: 'middle', margin: [0.02, 0.06, 0.02, 0.06] })
  mono(s, 'Real causal path (engine output):\nDisruption → Amina → School pickup → Yusuf arrived home → Homework\n[disrupted_by › assigned_to › enables › depends_on]', 9.35, 5.05, 3.4, 1.4, { fontSize: 10, color: C.SOFT })
  mono(s, `${ev.sim.directEntityIds.length} direct · ${ev.sim.indirectEntityIds.length} indirect · depth ${ev.sim.maxDepth}  ·  weighted coverage 100% → ${Math.round(ev.sim.postDisruptionCoverage.weightedCoverage * 100)}%`, 0.6, 6.5, 8.5, 0.25, { fontSize: 11, color: C.SOFT })
  source(s, `Source: POST /v1/simulations on the live API, ${DATE}; direct = Amina + 3 tasks, indirect = milestone + Yusuf.`, true)
}

// ================================================================= ACT II — THE INTELLIGENCE
act('Act II — The intelligence')
// 09 ---------------------------------------------------------------- computational recovery
{
  const s = slide('LIGHT', {
    kicker: 'Act II · The intelligence', title: 'From confirmed event to reviewed recovery',
    notes: `Here is the complete processing chain, with the boundary between language AI and deterministic computation made explicit.\n\nStep one, a confirmed event: it may start as text interpreted by Gemini or our built-in parser, but nothing proceeds until the user confirms the structured fields. Step two, dependency analysis: pure graph code finds direct and indirect effects. Step three, candidate generation: for each task we generate every legal member, start time and resource combination, removing only static impossibilities such as missing permissions. For the flagship scenario that produces 56 candidates. Step four, CP-SAT chooses among them under hard constraints and lexicographic priorities; five passes, status OPTIMAL in tens of milliseconds. Step five, the independent validator re-checks the result from scratch: 56 individual checks across 18 rules, no violations. Step six, human review, where consent for the pickup assignee is still pending.\n\nThe design principle: the language model never sees the solver, and the solver never marks its own homework.` + NOTE_END,
  })
  const items = [
    ['LANGUAGE', 'Confirmed event', '1 event · Amina · 14:30–18:00 · confirmed by user', C.SOFT, C.NAVY],
    ['GRAPH', 'Dependency analysis', `${ev.sim.directEntityIds.length} direct · ${ev.sim.indirectEntityIds.length} indirect · depth ${ev.sim.maxDepth}`, C.COBALT, C.WHITE],
    ['GRAPH', 'Candidate generation', `${ev.rec.candidateCounts.candidates} candidates after static filtering`, C.COBALT, C.WHITE],
    ['CP-SAT', 'Constraint optimization', `${plan.solverStatus} · ${plan.objectives.length} lexicographic passes`, C.NAVY, C.WHITE],
    ['VALIDATOR', 'Independent validation', `${plan.validation.checks.length} checks · 18 rules · ${plan.validation.hardViolations} violations`, C.OK, C.WHITE],
    ['HUMAN', 'Recovery review', 'approval needed · pickup consent pending', C.SLATE, C.WHITE],
  ]
  items.forEach((it, i) => {
    const x = 0.6 + i * 2.05
    pill(s, it[0], x, 1.75, 1.85, 0.34, { fill: it[3], color: it[4], fontSize: 11 })
    box(s, x, 2.2, 1.85, 1.7, { fill: C.ICE })
    T(s, `${i + 1}`, x + 0.12, 2.28, 0.4, 0.4, { fontSize: 22, bold: true, color: it[3] === C.SOFT ? C.COBALT : it[3] })
    T(s, it[1], x + 0.12, 2.78, 1.62, 0.9, { fontSize: 15, bold: true, color: C.NAVY })
    if (i < 5) edge(s, x + 1.88, 3.05, x + 2.04, 3.05, { color: C.COBALT, w: 2, arrow: true })
    T(s, it[2], x, 4.1, 1.85, 1.0, { fontSize: 12, color: C.INK })
  })
  box(s, 0.6, 5.35, 12.1, 1.15, { fill: C.NAVY })
  T(s, 'The language model never sees the solver.   The solver never marks its own homework.', 0.9, 5.5, 11.5, 0.45, { fontSize: 20, bold: true, color: C.WHITE })
  T(s, 'Language AI interprets text only. Everything that decides or checks an assignment is deterministic, tested code.', 0.9, 6.0, 11.5, 0.35, { fontSize: 13, color: C.SOFT })
  source(s, `Source: live flagship run (POST /v1/recovery-plans), ${DATE}. Counts are measured outputs, not targets.`)
}

// 10 ---------------------------------------------------------------- distinctive
{
  const s = slide('ICE', {
    kicker: 'Act II · The intelligence', title: 'What makes DOMINO distinctive',
    notes: `Four capabilities, and the value is in combining them.\n\nOne: a structured family digital twin — people, permissions, resources, time windows and dependencies stored as validated data. Two: graph-based cascade analysis — it tells you what a change actually touches. Three: mathematical optimization — instead of suggestions, a solver searches the space of legal arrangements and proves optimality for its formulation. Four: independently verified decisions — a second implementation checks the result.\n\nWhy together? A chatbot can suggest a plan but cannot guarantee it respects a permission. A solver without a model of dependencies would not know what to re-plan. And an optimizer that checks itself can repeat its own mistakes. We are not claiming to be the first system of its kind — we are claiming this particular combination, implemented and tested end to end.` + NOTE_END,
  })
  const cells = [
    ['1', 'Structured family digital twin', 'Members, skills, explicit permissions, time windows, resources and milestones as validated data.', 0.6, 1.6],
    ['2', 'Graph-based cascade analysis', 'Typed edges show what a change touches directly and downstream, with causal paths.', 8.35, 1.6],
    ['3', 'Mathematical recovery optimization', 'CP-SAT searches legal arrangements; essential responsibilities are protected first.', 0.6, 4.1],
    ['4', 'Independently verified decisions', 'A separate validator re-checks every rule; unresolved tasks stay visible.', 8.35, 4.1],
  ]
  cells.forEach((c) => {
    box(s, c[3], c[4], 4.35, 2.3, { fill: C.WHITE, line: C.LINE, shadow: true })
    T(s, c[0], c[3] + 0.25, c[4] + 0.18, 0.6, 0.7, { fontSize: 40, bold: true, color: C.COBALT })
    T(s, c[1], c[3] + 0.95, c[4] + 0.25, 3.25, 0.7, { fontSize: 17, bold: true, color: C.NAVY })
    T(s, c[2], c[3] + 0.25, c[4] + 1.1, 3.9, 1.1, { fontSize: 13, color: C.INK })
  })
  tbox(s, [{ text: 'Household\ndigital twin', options: { bold: true } }], 5.4, 3.0, 2.55, 1.6, { shape: pres.shapes.OVAL, fill: C.NAVY, color: C.WHITE, fontSize: 18, align: 'center', margin: 0 })
  for (const [x, y] of [[4.95, 2.75], [8.35, 2.75], [4.95, 4.65], [8.35, 4.65]]) edge(s, x, y, x < 6.6 ? 5.6 : 7.75, y < 3.9 ? 3.4 : 4.2, { color: C.SLATE, w: 1.5 })
  T(s, 'The value is in the combination: a chatbot cannot guarantee a permission; a solver without a model does not know what to re-plan.', 0.6, 6.45, 12.1, 0.3, { fontSize: 12, italic: true, color: C.MUTED })
}

// 11 ---------------------------------------------------------------- architecture
{
  const s = slide('LIGHT', {
    kicker: 'Act II · The intelligence', title: 'System architecture',
    notes: `This is the real architecture, color coded by trust. The browser side is React and TypeScript built with Vite. The graph is React Flow with custom nodes, Motion handles the layout transitions, and a small Zustand store keeps household and scenario versions so that a late response can never overwrite a newer scenario. It is hosted as a static site on GitHub Pages.\n\nIt talks over HTTPS and JSON to a FastAPI backend, which validates every request with Pydantic. Inside the backend, soft-blue marks the only language-AI layer: the interpreter, which calls Gemini for structured JSON and falls back to a built-in rule parser. Cobalt marks deterministic computation: household validation, the NetworkX dependency graph, candidate generation and the OR-Tools CP-SAT optimizer. Green marks the independent verifier, which imports nothing from the optimizer. Benchmarks and baselines run the same engine for evaluation.\n\nThe deployed backend runs in Docker on Render; Gemini credentials exist only on the server, never in browser code.` + NOTE_END,
  })
  box(s, 0.6, 1.55, 3.35, 4.95, { fill: C.ICE, line: C.LINE })
  T(s, 'Browser', 0.8, 1.65, 3, 0.35, { fontSize: 16, bold: true, color: C.NAVY })
  T(s, 'React + TypeScript + Vite\nReact Flow graph (custom nodes)\nMotion layout transitions\nZustand store: household + scenario versions, abort, stale-response discard\nHosted on GitHub Pages', 0.8, 2.1, 3.0, 4.2, { fontSize: 14, color: C.INK, paraSpaceAfter: 14 })
  mono(s, 'HTTPS · JSON', 4.0, 3.62, 1.5, 0.25, { fontSize: 10, color: C.SLATE, align: 'center' })
  edge(s, 3.98, 3.95, 5.5, 3.95, { color: C.COBALT, w: 2, arrow: true })
  edge(s, 5.5, 4.15, 3.98, 4.15, { color: C.COBALT, w: 2, arrow: true })
  box(s, 5.5, 1.55, 5.15, 4.95, { fill: C.WHITE, line: C.COBALT, lw: 1.5 })
  T(s, 'FastAPI backend (Python)  ·  Pydantic validation  ·  Docker on Render', 5.65, 1.62, 4.9, 0.3, { fontSize: 12, bold: true, color: C.NAVY })
  const tb = (...a) => tbox(s, ...a)
  const m = (t, sub, x, y, fill, line, color = C.INK) => tb([{ text: t, options: { bold: true, fontSize: 12, breakLine: true } }, { text: sub, options: { fontSize: 10 } }], x, y, 2.4, 0.95, { fill, line, color })
  m('Interpreter', 'LANGUAGE AI · Gemini + rule parser', 5.7, 2.05, C.SOFT, C.NAVY, C.NAVY)
  m('Household model', 'Pydantic schemas · integrity checks', 8.1, 2.05, C.ICE, C.COBALT)
  m('Dependency graph', 'NetworkX · typed edges · BFS', 5.7, 3.15, C.ICE, C.COBALT)
  m('Candidate generation', 'skills · permissions · windows', 8.1, 3.15, C.ICE, C.COBALT)
  m('CP-SAT optimizer', 'Google OR-Tools · lexicographic', 5.7, 4.25, C.COBALT, C.COBALT, C.WHITE)
  m('Independent verifier', 'no shared code with the optimizer', 8.1, 4.25, C.OK, C.OK, C.WHITE)
  m('Explanations', 'generated from computed records', 5.7, 5.35, C.ICE, C.COBALT)
  m('Benchmarks + baselines', '51 cases · greedy · no-recovery', 8.1, 5.35, C.ICE, C.COBALT)
  box(s, 10.95, 2.05, 1.75, 1.0, { fill: C.WHITE, line: C.SLATE, dash: 'dash' })
  T(s, 'Google Gemini API\nstructured JSON', 11.02, 2.15, 1.6, 0.8, { fontSize: 11, align: 'center', color: C.NAVY, bold: true })
  edge(s, 10.55, 2.5, 10.95, 2.5, { color: C.SLATE, w: 1.5, dash: 'dash', arrow: true })
  box(s, 10.95, 3.4, 1.75, 1.0, { fill: C.WHITE, line: C.SLATE })
  T(s, 'JSON fixtures\n3 fictional households', 11.02, 3.5, 1.6, 0.8, { fontSize: 11, align: 'center', color: C.NAVY, bold: true })
  pill(s, 'Language AI', 10.95, 4.7, 1.75, 0.32, { fill: C.SOFT, color: C.NAVY, fontSize: 10 })
  pill(s, 'Deterministic', 10.95, 5.1, 1.75, 0.32, { fill: C.COBALT, color: C.WHITE, fontSize: 10 })
  pill(s, 'Independent check', 10.95, 5.5, 1.75, 0.32, { fill: C.OK, color: C.WHITE, fontSize: 10 })
  source(s, 'Source: repository structure (backend/app/services/*, frontend/src/*); deployment per render.yaml and pages.yml. Native, editable diagram.')
}

// 12 ---------------------------------------------------------------- digital twin data
{
  const s = slide('LIGHT', {
    kicker: 'Act II · The intelligence', title: 'The household digital twin',
    notes: `The twin is just data, but carefully typed. A FamilyMember has skills, explicit permissions, restrictions, availability windows and which dependents they are authorized to care for. A HouseholdTask has a tier from zero to three, a priority weight, a duration, an allowed time window, required skills, permissions and resource types, prerequisites, and whether it needs the assignee's consent. Resources have a capacity and may be exclusive, like the sedan. A Milestone records which tasks satisfy it. An Assignment links a task, a member, a time and resources. A Disruption is one of five supported types — member unavailable, resource unavailable, task rescheduled, availability changed, capacity changed — and it only counts once confirmed.\n\nExample at the bottom is real: Amina is forty-one, can drive, is authorized for pickup and for Yusuf, and is available from 14:30 to 18:30. Times are integer minutes on one simulated day, in the Asia/Dubai time zone, and intervals are half-open.` + NOTE_END,
  })
  const ent = (title, fields, x, y, fill) => {
    box(s, x, y, 3.9, 2.05, { fill: C.WHITE, line: fill, lw: 1.5 })
    tbox(s, [{ text: title, options: { bold: true } }], x, y, 3.9, 0.4, { fill, color: C.WHITE, fontSize: 13, round: false, margin: [0, 10, 0, 10] })
    mono(s, fields, x + 0.15, y + 0.5, 3.6, 1.5, { fontSize: 10.5, color: C.INK })
  }
  ent('FamilyMember', 'id · name · age · role · isDependent\nskills[] · permissions[] · restrictions[]\navailability[ {startMin,endMin} ]\nauthorizedDependentIds[]', 0.6, 1.55, C.COBALT)
  ent('HouseholdTask', 'id · tier 0–3 · priorityWeight · durationMin\nearliestStart · latestEnd · fixedStart?\nrequiredSkills[] · requiredPermissions[]\nrequiredResourceTypes[] · requiredConsent\npredecessorTaskIds[] · requiredMilestoneIds[]', 4.7, 1.55, C.COBALT)
  ent('HouseholdResource', 'id · name · type · capacity · exclusive\navailability[] · unavailableWindows[]\nallowedMemberIds?  (vehicle, kitchen, …)', 8.8, 1.55, C.SLATE)
  ent('Assignment', 'taskId → memberId\nstartMin · endMin · resourceIds[]\nchangedFromBaseline', 0.6, 3.85, C.NAVY)
  ent('Milestone', 'id · title\nenabledByTaskIds[]\ndependentId?   e.g. “Yusuf arrived home”', 4.7, 3.85, C.SLATE)
  ent('Disruption (5 types)', 'member_unavailable · resource_unavailable\ntask_rescheduled · availability_changed\nresource_capacity_changed\naffectedEntityIds[] · window · confirmed', 8.8, 3.85, C.BAD)
  edge(s, 4.5, 2.6, 4.7, 2.6, { color: C.SLATE, w: 1.5 }); edge(s, 8.6, 2.6, 8.8, 2.6, { color: C.SLATE, w: 1.5 })
  edge(s, 2.55, 3.6, 2.55, 3.85, { color: C.SLATE, w: 1.5 }); edge(s, 6.65, 3.6, 6.65, 3.85, { color: C.SLATE, w: 1.5 })
  box(s, 0.6, 6.05, 12.1, 0.6, { fill: C.ICE })
  mono(s, 'P01 Amina · adult · skills [driving, shopping, homework_assist] · permissions [drive, pickup_authorized] · authorized for P04 · available 14:30–18:30', 0.75, 6.2, 11.8, 0.3, { fontSize: 11, color: C.NAVY })
  source(s, 'Source: backend/app/models/domain.py; example from data/households/amina.json. Simplified diagram: fields abbreviated.')
}

// 13 ---------------------------------------------------------------- natural-language intelligence
{
  const s = slide('ICE', {
    kicker: 'Act II · The intelligence', title: 'Natural-language interpretation',
    notes: `Families do not think in forms, so DOMINO accepts a sentence like Amina cannot help until 6 PM. The important thing is what the language model is allowed to do.\n\nThe workflow: text goes in; Gemini, called through the official Google SDK with a JSON schema, returns only mentions and clock times. Then deterministic code resolves those mentions against the current household — an unknown name is flagged and never invented, a duplicate name becomes an ambiguity. Times are validated, and a phrase like until 6 PM with no start time and no scenario clock is sent back for clarification instead of guessed. Finally the structured event is shown for editing and a human must confirm it. The event is created unconfirmed and cannot reach the solver otherwise.\n\nGemini does not authorize assignments and does not produce schedules. We also built a deterministic rule parser that needs no key: in auto mode Gemini is tried first and any failure falls back to the parser, and the screen says which engine answered.\n\nObserved evidence on ${DATE}: the hosted backend called Gemini (model gemini-3.5-flash-lite) and returned member_unavailable for Amina, 14:30 to 18:00, unconfirmed. On our 12 annotated sentences Gemini matched all 12; on 12 held-out sentences it matched 11, missing a case that needs the task's baseline time. The rule parser scored 12 of 12 on both sets, but its held-out score was 11 of 12 on its first run and was fixed afterwards, so that number is not an independent measurement. These are small sanity checks, not general accuracy claims.` + NOTE_END,
  })
  const steps = ['Natural-language description', 'Structured interpretation', 'Entity resolution', 'Time extraction', 'Schema validation', 'Human confirmation']
  steps.forEach((t, i) => {
    const y = 1.6 + i * 0.78
    tbox(s, [{ text: String(i + 1), options: { bold: true } }], 0.6, y + 0.04, 0.5, 0.5, { shape: pres.shapes.OVAL, fill: i === 1 ? C.SOFT : (i === 5 ? C.NAVY : C.COBALT), color: i === 1 ? C.NAVY : C.WHITE, fontSize: 16, align: 'center', margin: 0 })
    T(s, t, 1.25, y + 0.1, 3.0, 0.4, { fontSize: 15, bold: true, color: C.NAVY })
    if (i < 5) edge(s, 0.85, y + 0.54, 0.85, y + 0.82, { color: C.SLATE, w: 1.5 })
  })
  pill(s, 'Gemini: step 2 only', 1.25, 6.3, 2.2, 0.34, { fill: C.SOFT, color: C.NAVY, fontSize: 11 })
  box(s, 4.35, 1.6, 3.55, 4.65, { fill: C.NAVY })
  mono(s, 'Observed output (live API)', 4.5, 1.7, 3.3, 0.3, { fontSize: 11, color: C.SOFT })
  mono(s, '“Amina cannot help\n until 6 PM”\n   │ clock 14:30\n   ▼\n{\n  "type": "member_unavailable",\n  "affectedEntityIds": ["P01"],\n  "startMin": 870,   // 14:30\n  "endMin": 1080,   // 18:00\n  "confirmed": false\n}\nengine: gemini-3.5-flash-lite\nassumption: start = scenario\nclock 14:30', 4.5, 2.05, 3.3, 4.1, { fontSize: 11, color: C.WHITE })
  const ni = fit(img.nlReview, 4.4, 4.65)
  shot(s, img.nlReview.f, 8.15, 1.6, ni.w, ni.h, 'Disruption Studio natural-language panel showing an interpreted, unconfirmed event (real screenshot)')
  T(s, 'Gemini interprets. It never authorizes or schedules.', 8.15, 6.3, 4.5, 0.4, { fontSize: 12, bold: true, color: C.COBALT })
  source(s, `Source: backend/app/services/interpreter.py + rule_parser.py; live probe ${DATE}; accuracy in TESTING.md (12-sentence sets).`)
}

// ================================================================= ACT III — THE PROTOTYPE
act('Act III — The prototype')
// 14 ---------------------------------------------------------------- launch
{
  const s = slide('DARK', {
    kicker: 'Act III · The prototype · screen 1 of 7', title: 'System launch',
    notes: `The published launch screen. The headline is our proposition. The constellation on the right is not an illustration: every node is a real member, responsibility, resource or milestone of the selected household, projected into a restrained 3D space; it rotates with the pointer, and reduced-motion users get a static frame.\n\nBelow the hero are the three fictional households and a Configure Household workflow with live validation. The top bar shows the connection state to the backend — in this capture the API was online and reporting OR-Tools CP-SAT, and the language layer was Gemini plus the built-in parser. That indicator tells you the state at capture time; it does not promise permanent uptime.\n\nThe app has seven screens connected by the left rail, which we go through next. Everything is public at the URL on the final slide.` + NOTE_END,
  })
  const f = fit(img.launch, 7.55, 5.05)
  shot(s, img.launch.f, 0.6, 1.55, f.w, f.h, 'DOMINO launch screen (real screenshot of the published prototype)')
  const P = (fx, fy) => [0.6 + fx * f.w - 0.17, 1.55 + fy * f.h - 0.17]
  const ann = [
    [1, 'Central proposition; project identity and the team credited under the title', 0.10, 0.30],
    [2, 'Interactive constellation: real entities of the selected household', 0.80, 0.45],
    [3, 'Navigation across the seven screens', 0.045, 0.64],
    [4, 'Live status: API online · OR-Tools CP-SAT · language engines', 0.625, 0.045],
  ]
  ann.forEach((a) => { const [x, y] = P(a[2], a[3]); callout(s, a[0], x, y) })
  ann.forEach((a, i) => { callout(s, a[0], 8.55, 1.7 + i * 0.95); T(s, a[1], 9.05, 1.72 + i * 0.95, 3.7, 0.8, { fontSize: 13, color: C.WHITE }) })
  T(s, 'Below the hero: three fictional households and Configure Household (editing with live validation).', 8.55, 5.6, 4.2, 0.8, { fontSize: 12, color: C.SOFT })
  source(s, `Real screenshot of https://maymourad.github.io/DOMINO/ captured ${DATE}. Status chips show the state at capture time only.`, true)
}

// 15 ---------------------------------------------------------------- family network
{
  const s = slide('LIGHT', {
    kicker: 'Act III · The prototype · screen 2 of 7', title: 'Family Network',
    notes: `The Family Network is the digital twin made visible and editable. Custom nodes show people, tasks with their tier badges, resources and the milestone; edges are typed and styled differently — solid, dashed, dotted. Here I have selected the school pickup task and the inspector on the right shows its editable fields: tier, duration, time window, required skills and permissions, resource types, prerequisites and whether consent is needed.\n\nEdits change the canonical household in the browser. The household version is incremented, any earlier simulation or plan is invalidated and aborted, and the backend re-validates the household — for example it rejects an unknown reference or a dependency cycle. You can add and remove members, resources and tasks, undo, or reset to the validated baseline. The graph has pan, zoom, fit, and a text alternative for screen readers.\n\nThis is also where the baseline schedule is displayed as a timeline strip, so you can see the plan before breaking it.` + NOTE_END,
  })
  const g = fit(img.netAmina, 6.3, 3.95)
  shot(s, img.netAmina.f, 0.6, 1.55, g.w, g.h, 'Family Network graph of the Amina household (real screenshot)')
  const i2 = fit(img.inspector, 2.3, 3.95)
  shot(s, img.inspector.f, 0.6 + g.w + 0.2, 1.55, i2.w, i2.h, 'Inspector editing the School pickup task (real screenshot)')
  const pts = ['Custom typed nodes: people, tasks, resources, milestone', 'Typed edges: assigned to, uses, enables, depends on, serves', 'Inspector edits tier, window, skills, permissions, prerequisites', 'Editing bumps the household version and invalidates old plans', 'Backend validation blocks invalid households']
  pts.forEach((t, i) => { callout(s, i + 1, 9.55, 1.62 + i * 0.82); T(s, t, 10.0, 1.62 + i * 0.82, 2.75, 0.75, { fontSize: 13, color: C.INK }) })
  box(s, 0.6, 4.55, 6.3, 1.2, { fill: C.WHITE, line: C.LINE })
  T(s, 'Toolbar: add task · add member · add resource · remove · undo · reset to the validated baseline. Select School pickup (T01) to edit it; the household is re-validated by the backend after every edit.', 0.8, 4.65, 5.95, 1.05, { fontSize: 13, color: C.NAVY })
  source(s, `Real screenshot of the published prototype, ${DATE}. Amina household, School pickup (T01) selected.`)
}

// 16 ---------------------------------------------------------------- disruption studio
{
  const s = slide('ICE', {
    kicker: 'Act III · The prototype · screen 3 of 7', title: 'Disruption Injection Studio',
    notes: `This is where a disruption is created, three ways. Presets are derived from the household itself — Amina unavailable, vehicle unavailable, caregiver conflict, critical task delayed, two simultaneous disruptions. The manual form lets you choose an event type, entities and times. And the natural-language panel interprets a sentence.\n\nIn the screenshot the Amina preset has been staged and confirmed. Look at the status trail at the top — draft, interpreting, needs review, confirmed, calculating — and at the confirmed badge on the event card. The Run button is disabled until every event is confirmed; an unconfirmed event can never reach the solver, even by accident. That is the human-in-the-loop principle applied at the very beginning of the pipeline.\n\nThe small panel on the right is the natural-language review: the structured fields are editable, assumptions are listed, unknown names are flagged, and the engine that produced the proposal is shown.` + NOTE_END,
  })
  const a = fit(img.presets, 2.9, 3.95)
  shot(s, img.presets.f, 0.6, 1.55, a.w, a.h, 'Scenario presets derived from the household (real screenshot)')
  const b = fit(img.nl, 2.9, 3.95)
  shot(s, img.nl.f, 0.6 + a.w + 0.2, 1.55, b.w, b.h, 'Natural-language panel with a reviewed proposal (real screenshot)')
  const c = fit(img.scenario, 6.4, 1.2)
  shot(s, img.scenario.f, 0.6, 5.7, c.w, c.h, 'Scenario card: one confirmed event, Run scenario enabled (real screenshot)')
  const pts = ['Presets are derived from the household itself', 'Manual form works with no AI at all', 'Interpretation → review → confirm: Gemini or the built-in parser', 'Run is disabled until every event is confirmed']
  pts.forEach((t, i) => { callout(s, i + 1, 7.4, 1.65 + i * 0.95); T(s, t, 7.9, 1.65 + i * 0.95, 4.8, 0.8, { fontSize: 14, color: C.INK }) })
  box(s, 7.4, 5.55, 5.3, 1.0, { fill: C.NAVY })
  T(s, 'Why confirm first? A mistaken interpretation should never silently become a computed plan.', 7.6, 5.65, 4.9, 0.8, { fontSize: 14, bold: true, color: C.WHITE })
  source(s, `Real screenshots of the published prototype, ${DATE}.`)
}

// 17 ---------------------------------------------------------------- cascade lab
{
  const s = slide('DARK', {
    kicker: 'Act III · The prototype · screen 4 of 7', title: 'Cascade Laboratory',
    notes: `This is the real impact graph after the flagship event, computed by the backend and played back as an animation. The timeline at the bottom is scrubbable: at step zero only the event is visible, at step one Amina, at step two the three directly disrupted tasks, at step three the milestone and Yusuf. Because the playback is driven by the engine's own depth ordering, nothing unaffected ever lights up — dinner, Khalid and Noura stay dim.\n\nThe inspector on the right answers why is this affected. Homework assistance is directly disrupted because it is assigned to Amina, who is unavailable 14:30 to 18:00, and the engine lists both causal paths with their edge types. A banner can also show whether recovery is possible; here the solver probe says yes for each affected task.\n\nCounters at the top of the real screen report the direct and indirect numbers; toggles let you show direct effects only or indirect only, and playback speed is adjustable. If a scenario affects nothing, the screen says so honestly instead of animating something.` + NOTE_END,
  })
  const f = fit(img.cascade, 9.0, 5.05)
  shot(s, img.cascade.f, 0.6, 1.55, f.w, f.h, 'Cascade Laboratory after the Amina disruption, with causal paths (real screenshot)')
  stat(s, `${ev.sim.directEntityIds.length}`, 'directly disrupted\n(Amina + 3 tasks)', 9.95, 1.55, 2.7, { color: 'E08A8E', size: 40, lcolor: C.SOFT, gap: 0.62, lsize: 12 })
  stat(s, `${ev.sim.indirectEntityIds.length}`, 'at risk through\ndependency', 9.95, 3.0, 2.7, { color: 'E6B756', size: 40, lcolor: C.SOFT, gap: 0.62, lsize: 12 })
  stat(s, `${ev.sim.maxDepth}`, 'cascade depth\n(scrubbable)', 9.95, 4.45, 2.7, { color: C.SOFT, size: 40, lcolor: C.SOFT, gap: 0.62, lsize: 12 })
  T(s, 'Inspect any node: category, reason codes, every causal path.', 9.95, 5.9, 2.8, 0.7, { fontSize: 12, color: C.WHITE })
  source(s, `Real screenshot of the published prototype, ${DATE}. Homework assistance (T03) selected; both causal paths shown.`, true)
}

// 18 ---------------------------------------------------------------- recovery studio
{
  const s = slide('LIGHT', {
    kicker: 'Act III · The prototype · screen 5 of 7', title: 'Recovery Studio',
    notes: `The output of the optimizer. On the left, the same schedule before and after, drawn natively from the result. Above is the original plan. Below is the recovery: Amina's row is hatched because she is unavailable; school pickup and groceries moved to Khalid, homework moved to Noura, and dinner did not change at all. On the right is the real Recovery Studio graph, where the three affected task nodes slide from Amina's lane to their new assignees — we call it the magnetic transition — and each reassigned node carries a badge.\n\nHow it was produced: for the flagship run on ${DATE} all three strategies — priority first, minimum change and balanced workload — gave the same single arrangement, so the app shows one plan labelled with all three, and says so, instead of fabricating three different-looking plans. The solver status was OPTIMAL and it took ${plan.solverElapsedMs} milliseconds on the hosted server in this run; across ten repeated hosted runs it ranged from ${solverMs[0]} to ${solverMs[solverMs.length - 1]} milliseconds. The plan then passed independent verification.\n\nThe user can reject or pin any assignment, which triggers a fresh solve, ask for another distinct arrangement, compare plans, and approve only a verified plan.` + NOTE_END,
  })
  const bar = (a, b, t, o = {}) => ({ s: a, e: b, text: t, size: 10, ...o })
  T(s, 'ORIGINAL SCHEDULE', 0.6, 1.5, 4, 0.25, { fontFace: F.mono, fontSize: 11, color: C.SLATE })
  gantt(s, 0.6, 1.75, 6.8, [
    { label: 'Amina', shade: [{ s: 870, e: 1110 }], bars: [bar(885, 925, 'Pickup'), bar(955, 990, 'Grocery'), bar(1005, 1035, 'Homework')] },
    { label: 'Khalid', shade: [{ s: 870, e: 1110 }], bars: [bar(1050, 1080, 'Dinner')] },
    { label: 'Noura', shade: [{ s: 990, e: 1080 }] },
  ], { t0: 870, t1: 1110, rowH: 0.52, labelW: 0.95, labelSize: 13 })
  T(s, 'AFTER OPTIMIZATION · ' + plan.solverStatus, 0.6, 3.95, 5, 0.25, { fontFace: F.mono, fontSize: 11, color: C.OK })
  gantt(s, 0.6, 4.2, 6.8, [
    { label: 'Amina', shade: [{ s: 870, e: 1110 }], away: [{ s: 870, e: 1080 }] },
    { label: 'Khalid', shade: [{ s: 870, e: 1110 }], bars: [bar(885, 925, 'Pickup', { fill: C.OK }), bar(955, 990, 'Grocery', { fill: C.OK }), bar(1050, 1080, 'Dinner')] },
    { label: 'Noura', shade: [{ s: 990, e: 1080 }], bars: [bar(1005, 1035, 'Homework', { fill: C.OK })] },
  ], { t0: 870, t1: 1110, rowH: 0.52, labelW: 0.95, labelSize: 13 })
  const g = fit(img.recGraph, 4.7, 2.4)
  shot(s, img.recGraph.f, 8.0, 1.55, g.w, g.h, 'Recovery Studio graph with reassigned tasks highlighted (real screenshot)')
  pill(s, '✓ Verified complete recovery', 8.0, 3.45, 3.0, 0.4, { fill: C.OKBG, line: C.OK, color: C.OK, fontSize: 13 })
  T(s, `3 reassigned (pickup, groceries → Khalid; homework → Noura) · dinner unchanged · 0 min displacement\nSolver ${plan.solverStatus} · ${plan.solverElapsedMs} ms (hosted run) · independent check ${plan.validation.checks.length}/${plan.validation.checks.length} passed · 3 strategies agree on 1 arrangement`, 8.0, 4.0, 4.7, 1.9, { fontSize: 13, color: C.INK })
  T(s, 'Green = reassigned and verified', 0.6, 6.1, 5, 0.3, { fontSize: 11, color: C.MUTED })
  source(s, `Source: POST /v1/recovery-plans (live), ${DATE}; graph is a real screenshot, schedules redrawn from the returned assignments.`)
}

// 19 ---------------------------------------------------------------- futures lab
{
  const s = slide('ICE', {
    kicker: 'Act III · The prototype · screen 6 of 7', title: 'Family Futures Laboratory',
    notes: `Counterfactual intelligence: what if? The Futures Laboratory clones the current scenario, applies your change, and then runs the entire pipeline again — graph analysis, CP-SAT, independent verification — so the right-hand result is computed, not predetermined. The original reference scenario stays untouched on the left until you choose Apply scenario.\n\nYou can change caregiver availability, vehicle availability, resource capacity, task priority tier, time-window flexibility, remove a permission, or add one of the preset secondary disruptions. In this capture we added the caregiver-conflict preset: Khalid is unavailable during school pickup while Amina stays unavailable.\n\nThe result is shown side by side: coverage fell from 100 to 33 percent, two critical responsibilities are now uncovered, reassignments dropped from three to one, and the table at the bottom of the real screen lists exactly which tasks differ. The solver status was still OPTIMAL — it found the best possible arrangement for what is actually possible — and verification reported zero violations, in about 14 milliseconds of solving and under a second round trip. We will come back to what this result means two slides from now.` + NOTE_END,
  })
  const r = fit(img.futRef, 4.5, 3.75)
  shot(s, img.futRef.f, 0.6, 1.55, r.w, r.h, 'Reference scenario: verified complete recovery (real screenshot)')
  shot(s, img.futMod.f, 0.6 + r.w + 0.15, 1.55, r.w, r.h, 'Modified future: valid partial plan after a recalculation (real screenshot)')
  const bf = fit(img.futBanner, r.w * 2 + 0.15, 0.7)
  shot(s, img.futBanner.f, 0.6, 1.55 + r.h + 0.15, bf.w, bf.h, 'Different-result banner from the Futures Laboratory (real screenshot)')
  T(s, 'Change one variable', 9.95, 1.55, 2.8, 0.35, { fontSize: 16, bold: true, color: C.NAVY })
  const vars = [['Caregiver availability', 'mark a member unavailable'], ['Vehicle availability', 'take the sedan out'], ['Resource capacity', 'e.g. seats 5 → 1'], ['Task priority', 'change a task’s tier'], ['Time-window flexibility', 'widen or narrow by ± minutes']]
  vars.forEach((v, i) => {
    T(s, v[0], 9.95, 2.0 + i * 0.78, 2.8, 0.3, { fontSize: 14, bold: true, color: C.COBALT })
    T(s, v[1], 9.95, 2.3 + i * 0.78, 2.8, 0.3, { fontSize: 12, color: C.MUTED })
  })
  T(s, 'Every change re-runs graph analysis → CP-SAT → independent verification. Nothing here is a stored alternative.', 0.6, 6.15, 12.1, 0.5, { fontSize: 13, bold: true, color: C.NAVY })
  source(s, `Real screenshot of the published prototype, ${DATE}: fresh recalculation (solver OPTIMAL, verification 0 violations). Reference preserved on the left.`)
}

// 20 ---------------------------------------------------------------- evaluation lab
{
  const s = slide('DARK', {
    kicker: 'Act III · The prototype · screen 7 of 7', title: 'Intelligence & Evaluation Laboratory',
    notes: `The seventh screen is about evidence rather than features. Before anything is run it says benchmark not yet executed — it never ships invented statistics. After pressing Run benchmark suite, the backend loads each case from data files, executes the real engine, checks declared invariants with the independent verifier, and returns measured results.\n\nWhat you see is the run we executed on ${DATE} against the hosted API: fifty-one cases are defined, fifty-one were processed, forty-six passed, zero failed, and five were not run — four are executed by the browser test suite or the build instead of the backend runner, and one is skipped because a Gemini key is configured. Failures would be shown in red; there were none to show, and we say that plainly.\n\nThe tabs cover verification, optimization, dependency analysis, AI interpretation and the full scenario list, where every case can be inspected for expected versus observed behaviour and replayed. Results can be exported as JSON or CSV, and the methodology is one click away. The wall clock for this run was about twenty-two seconds.` + NOTE_END,
  })
  const f = fit(img.eval, 8.4, 4.75)
  shot(s, img.eval.f, 0.6, 1.55, f.w, f.h, 'Evaluation Laboratory after a completed benchmark run (real screenshot)')
  stat(s, `${suite.totalCases}`, 'cases defined and processed', 9.4, 1.55, 3.3, { size: 44, color: C.WHITE, lcolor: C.SOFT, gap: 0.7 })
  stat(s, `${suite.counts.pass}`, 'passed', 9.4, 2.9, 1.5, { size: 44, color: '6FCAA0', lcolor: C.SOFT, gap: 0.7 })
  stat(s, `${suite.counts.fail}`, 'failed', 10.95, 2.9, 1.5, { size: 44, color: C.WHITE, lcolor: C.SOFT, gap: 0.7 })
  stat(s, `${suite.counts.not_run}`, 'not run (external / key configured)', 9.4, 4.25, 3.3, { size: 44, color: 'E6B756', lcolor: C.SOFT, gap: 0.7 })
  T(s, 'Defined ≠ passed: every number comes from a run, never a static page.', 0.6, 6.4, 8.4, 0.3, { fontSize: 14, bold: true, color: C.WHITE })
  source(s, `Real screenshot of the published prototype after pressing “Run benchmark suite”, ${DATE} (hosted API, Linux, OR-Tools ${suite.environment.ortools}).`, true)
}

// ================================================================= ACT IV — THE EVIDENCE
act('Act IV — The evidence')
// 21 ---------------------------------------------------------------- math optimization
{
  const s = slide('LIGHT', {
    kicker: 'Act IV · The evidence', title: 'Mathematical optimization with CP-SAT',
    notes: `Now the mathematics, simplified. Constraint programming with Google's CP-SAT solver. For every task t, every member p who is statically eligible, every start time s on a five-minute grid, and every compatible resource arrangement r, we create one binary variable x of t, p, s, r. It equals one if that exact assignment is chosen.\n\nThe constraints are: each task is covered at most once — the sum of its x variables equals its covered flag, and we never force coverage, which is what allows honest infeasibility. A member cannot do two things at once, modeled with optional fixed-size intervals and a no-overlap constraint. An exclusive resource such as the sedan is also a no-overlap; a shared resource is a cumulative constraint with its capacity. Precedence: if a task is covered, its prerequisite must be covered and must end before it starts. And optimization is lexicographic: maximize weighted coverage of Tier 0, fix that optimum, then Tier 1, then Tier 2, then Tier 3, and only then minimize displacement and changes. That prevents several small tasks from ever outweighing an essential one.\n\nThe flagship numbers: after static filtering only 56 candidates remain — school pickup has six legal start times for Khalid, groceries twenty-four, homework thirteen for Noura, dinner thirteen. Five passes, status OPTIMAL, objective values Tier 0 ten, Tier 1 twelve, Tier 3 two, displacement zero, three changes. The solver uses one worker and a fixed seed so results are reproducible.` + NOTE_END,
  })
  box(s, 0.6, 1.55, 7.55, 5.0, { fill: C.NAVY })
  const eq = [
    ['Variable', 'x[t,p,s,r] ∈ {0,1}   (task, person, start, resources)'],
    ['Coverage', 'covered[t] = Σ x[t,p,s,r]  ≤ 1    (never forced)'],
    ['People', 'NoOverlap( { [s, s+dur_t) : x[t,p,s,r]=1 } )  ∀ p'],
    ['Resources', 'exclusive → NoOverlap     shared → Cumulative(capacity)'],
    ['Precedence', 'covered[t] ⇒ covered[π]  ∧  start[t] ≥ end[π]'],
    ['Objective', 'lexicographic:  max Σ w_t·covered[t]  over Tier 0 → fix →\nTier 1 → Tier 2 → Tier 3 → then min displacement, changes'],
  ]
  eq.forEach((e, i) => {
    const y = 1.72 + i * 0.8
    mono(s, e[0].toUpperCase(), 0.8, y, 1.4, 0.3, { fontSize: 10, color: C.SOFT })
    mono(s, e[1], 2.2, y - 0.02, 5.8, 0.75, { fontSize: 12.5, color: C.WHITE })
  })
  T(s, 'Flagship instance (live run)', 8.45, 1.55, 4.3, 0.35, { fontSize: 16, bold: true, color: C.NAVY })
  const rows = [['T01 pickup · Tier 0', 'Khalid', 6, 885], ['T02 grocery · Tier 3', 'Khalid', 24, 955], ['T03 homework · Tier 1', 'Noura', 13, 1005], ['T04 dinner · Tier 1', 'Khalid', 13, 1050]]
  rows.forEach((r, i) => {
    const y = 2.0 + i * 0.5
    T(s, r[0], 8.45, y, 2.2, 0.35, { fontSize: 12, bold: true, color: C.INK })
    T(s, `${r[1]} × ${r[2]}`, 10.6, y, 1.2, 0.35, { fontSize: 12, color: C.MUTED })
    mono(s, fmt(r[3]), 11.7, y, 0.9, 0.35, { fontSize: 12, color: C.OK, bold: true })
  })
  mono(s, `${ev.rec.candidateCounts.candidates} candidates → chosen start shown →`, 8.45, 4.05, 4.3, 0.3, { fontSize: 11, color: C.COBALT })
  T(s, 'T01 candidate start times (Khalid)', 8.45, 4.45, 4.3, 0.3, { fontSize: 11, color: C.MUTED })
  ;[880, 885, 890, 895, 900, 905].forEach((m, i) => {
    tbox(s, [{ text: fmt(m), options: { fontFace: F.mono, bold: m === 885 } }], 8.45 + i * 0.7, 4.8, 0.66, 0.42, { fill: m === 885 ? C.OK : C.ICE, color: m === 885 ? C.WHITE : C.NAVY, fontSize: 10, align: 'center', margin: 0 })
  })
  box(s, 8.45, 5.45, 4.3, 1.1, { fill: C.ICE })
  mono(s, `passes: Tier0=${plan.objectives[0].value} → Tier1=${plan.objectives[1].value} → Tier3=${plan.objectives[2].value} → displacement=${plan.objectives[3].value} → changes=${plan.objectives[4].value}\nstatus ${plan.solverStatus} · 1 worker · seed 1`, 8.6, 5.55, 4.1, 0.9, { fontSize: 10.5, color: C.NAVY })
  source(s, 'Source: backend/app/services/{candidate_generation,optimizer}.py; candidate counts and objective values from the live flagship run. Simplified formulation.')
}

// 22 ---------------------------------------------------------------- priorities & constraints
{
  const s = slide('ICE', {
    kicker: 'Act IV · The evidence', title: 'Priorities and constraints',
    notes: `How does DOMINO choose safe and useful plans? It separates what is forbidden from what is merely preferred.\n\nHard constraints can never be violated. Assignments must be authorized — skills and explicit permissions, and for dependents the carer must be specifically authorized. The member must be available for the whole interval. A member never does two things at once. Resources must be available and within capacity. Dependent safety: the dependent is never assigned tasks and care is only given by an authorized person. And prerequisites must complete first.\n\nSoft objectives only matter after the essential coverage is secured: keep original assignments, minimize schedule displacement, balance workload, and reduce unnecessary changes. The lexicographic ladder means Tier 0 coverage is optimized first and fixed; a pile of Tier 3 tasks can never outweigh a school pickup.\n\nThe red card is a real rejected candidate. Noura is sixteen and present, but the model says she lacks the driving skill and the drive and pickup-authorized permissions and carries restrictions on both. Yusuf is a dependent and cannot be assigned. So DOMINO rejects them with explicit reason codes, and these come from computed records.` + NOTE_END,
  })
  const colH = (t, fill) => tbox(s, [{ text: t, options: { bold: true } }], 0.6, 1.55, 3.9, 0.45, { fill, color: C.WHITE, fontSize: 15, round: false, margin: [0, 12, 0, 12] })
  colH('HARD CONSTRAINTS — never violated', C.NAVY)
  const hard = ['Authorized assignments (skills + explicit permissions)', 'Member availability for the full interval', 'No overlapping responsibilities', 'Resource availability and capacity', 'Dependent safety: only authorized carers', 'Prerequisites complete before dependents']
  hard.forEach((t, i) => { T(s, '✓', 0.75, 2.2 + i * 0.68, 0.3, 0.4, { fontSize: 16, bold: true, color: C.OK }); T(s, t, 1.1, 2.22 + i * 0.68, 3.4, 0.6, { fontSize: 13, color: C.INK }) })
  tbox(s, [{ text: 'SOFT OBJECTIVES — after coverage', options: { bold: true } }], 4.7, 1.55, 3.9, 0.45, { fill: C.COBALT, color: C.WHITE, fontSize: 15, round: false, margin: [0, 12, 0, 12] })
  const ladder = [['Tier 0', 'essential safety & dependent care'], ['Tier 1', 'important caregiving'], ['Tier 2', 'routine commitments'], ['Tier 3', 'deferrable convenience'], ['then', 'preserve assignments · least displacement · balance']]
  ladder.forEach((l, i) => {
    const w = 3.9 - i * 0.35
    tbox(s, [{ text: l[0] + '  ', options: { bold: true, fontFace: F.mono } }, { text: l[1], options: {} }], 4.7, 2.2 + i * 0.78, w, 0.62, { fill: i === 4 ? C.WHITE : C.WHITE, line: i === 4 ? C.SLATE : C.COBALT, color: C.NAVY, fontSize: 12, round: true })
  })
  T(s, 'Lexicographic: optimize Tier 0, fix it, then Tier 1 … so low tiers can never outweigh essentials.', 4.7, 6.15, 3.9, 0.55, { fontSize: 11, italic: true, color: C.MUTED })
  tbox(s, [{ text: 'REJECTED CANDIDATE — reason codes', options: { bold: true } }], 8.8, 1.55, 3.9, 0.45, { fill: C.BAD, color: C.WHITE, fontSize: 15, round: false, margin: [0, 12, 0, 12] })
  box(s, 8.8, 2.0, 3.9, 4.6, { fill: C.WHITE, line: C.BAD })
  T(s, 'Noura → School pickup  ✗', 9.0, 2.15, 3.5, 0.4, { fontSize: 17, bold: true, color: C.BAD })
  mono(s, "MISSING_SKILL\n  lacks skill 'driving'\nMISSING_PERMISSION\n  lacks 'drive'\n  lacks 'pickup_authorized'\nRESTRICTED\n  restriction 'drive'\n  restriction 'pickup_authorized'", 9.0, 2.65, 3.6, 2.6, { fontSize: 11, color: C.INK })
  T(s, 'Yusuf: DEPENDENT_MEMBER — never assigned responsibilities.', 9.0, 5.35, 3.5, 0.6, { fontSize: 12, color: C.INK })
  T(s, 'DOMINO will not invent a caregiver, permission or resource.', 9.0, 6.0, 3.5, 0.55, { fontSize: 12, bold: true, color: C.BAD })
  source(s, 'Source: candidate_generation.py / explanations.py; reason codes copied from the solver’s explanation records (live run).')
}

// 23 ---------------------------------------------------------------- verification
{
  const s = slide('LIGHT', {
    kicker: 'Act IV · The evidence', title: 'Independent verification',
    notes: `This is our credibility slide. The optimizer proposes a plan; a different module decides whether the plan is acceptable. The verifier is a standalone Python module that imports nothing from the optimizer or the candidate generator. It re-computes every rule straight from the household data, the confirmed disruptions and the proposed assignments with plain interval arithmetic.\n\nIt checks eligibility and skills, explicit permissions, task windows, member availability, overlaps including travel gaps, resource availability and capacity, resource types, dependent authorization, prerequisite completion, that the plan matches the current scenario hash, that critical-task coverage is reported accurately, that consent-dependent actions are still pending, and that user rejections are honored. That is eighteen rules.\n\nObserved on ${DATE} for the flagship plan: ${plan.validation.checks.length} individual checks across those 18 rules, all passed, zero hard violations — I re-ran it fresh before finalizing this slide. We also test the verifier against deliberately wrong plans — an unauthorized driver, a double-booked vehicle, a stale hash, a missing prerequisite — and it rejects every one. Verification status, recovery completeness and human approval are three separate fields, so a valid plan can still be partial.` + NOTE_END,
  })
  tbox(s, [{ text: 'CP-SAT optimizer', options: { bold: true, breakLine: true } }, { text: 'proposes assignments', options: { fontSize: 11 } }], 0.6, 1.6, 4.0, 0.85, { fill: C.NAVY, color: C.WHITE, fontSize: 15, align: 'center' })
  edge(s, 2.6, 2.5, 2.6, 3.05, { color: C.SLATE, w: 2, arrow: true })
  mono(s, 'no shared code', 2.75, 2.65, 1.8, 0.25, { fontSize: 10, color: C.SLATE })
  tbox(s, [{ text: 'Independent verifier', options: { bold: true, breakLine: true } }, { text: 'recomputes every rule from raw data', options: { fontSize: 11 } }], 0.6, 3.1, 4.0, 0.85, { fill: C.OK, color: C.WHITE, fontSize: 15, align: 'center' })
  edge(s, 2.6, 4.0, 2.6, 4.55, { color: C.SLATE, w: 2, arrow: true })
  box(s, 0.6, 4.6, 4.0, 1.95, { fill: C.OKBG, line: C.OK })
  T(s, `${plan.validation.checks.length} / ${plan.validation.checks.length}`, 0.8, 4.68, 3.6, 0.8, { fontSize: 44, bold: true, color: C.OK })
  T(s, 'checks passed · 18 rules · 0 hard violations\n(flagship plan, re-run live)', 0.8, 5.5, 3.6, 0.9, { fontSize: 12, color: C.INK })
  T(s, 'What it checks', 4.95, 1.55, 4.2, 0.35, { fontSize: 17, bold: true, color: C.NAVY })
  const checks = ['Eligibility and skills', 'Explicit permissions & restrictions', 'Member availability', 'Scheduling conflicts and travel gaps', 'Resource availability, exclusivity, capacity', 'Dependent-person authorization', 'Prerequisite / dependency completion', 'Scenario version (hash) consistency', 'Human consent remains pending', 'Critical coverage reported accurately']
  checks.forEach((t, i) => { T(s, '✓', 4.95, 2.0 + i * 0.46, 0.3, 0.4, { fontSize: 14, bold: true, color: C.OK }); T(s, t, 5.3, 2.03 + i * 0.46, 3.9, 0.4, { fontSize: 13, color: C.INK }) })
  const f = fit(img.verify, 3.1, 5.0)
  shot(s, img.verify.f, 9.6, 1.55, f.w, f.h, 'Independent verification panel from the Recovery Studio (real screenshot)')
  source(s, `Source: backend/app/services/verifier.py; panel is a real screenshot (${DATE}). Negative tests: backend/tests/unit/test_optimizer_verifier.py, benchmark T16, T24, T25, T30.`)
}

// 24 ---------------------------------------------------------------- recovery result
{
  const s = slide('ICE', {
    kicker: 'Act IV · The evidence', title: 'The recovery result',
    notes: `Three states of the same household, with measured numbers. The original schedule: all four responsibilities are assigned and valid, weighted coverage 100 percent. Right after Amina's disruption, before any recovery, only dinner is still valid: one of four tasks, and weighted coverage drops to 25 percent because the pickup, homework and groceries carry most of the weight. Three tasks are directly affected, and two more entities, the milestone and Yusuf, are at risk.\n\nAfter optimization all four responsibilities are covered, weighted coverage is back to 100 percent with three assignments changed and zero minutes of displacement. That result came from the solver and passed independent verification with no violations.\n\nCoverage is not approval. A person still has to approve. The school pickup requires its new assignee's consent, which stays pending, and approval only records an internal simulation receipt — DOMINO never notifies anyone.\n\nTimings from a documented fresh execution: ten consecutive hosted solves of this scenario took between ${solverMs[0]} and ${solverMs[solverMs.length - 1]} milliseconds of solver time, median about ${Math.round(median(solverMs))}. The variation reflects the free-tier server's CPU, not the model. One end-to-end request, simulation plus recovery, took about ${(ev.sim_ms_roundtrip / 1000).toFixed(1)} and ${(ev.rec_ms_roundtrip / 1000).toFixed(1)} seconds including network.` + NOTE_END,
  })
  const cols = [
    ['Original schedule', '4 / 4', 'responsibilities covered', '100%', 'weighted coverage', C.COBALT, [1, 1, 1]],
    ['After Amina’s disruption', '1 / 4', 'still valid (dinner)', '25%', 'weighted coverage', C.BAD, [0, 0.5, 0]],
    ['After optimization', '4 / 4', 'covered · 3 reassigned', '100%', 'weighted coverage', C.OK, [1, 1, 1]],
  ]
  cols.forEach((c, i) => {
    const x = 0.6 + i * 4.12
    box(s, x, 1.6, 3.9, 3.35, { fill: C.WHITE, line: c[5], lw: 1.5 })
    T(s, c[0], x + 0.25, 1.75, 3.4, 0.4, { fontSize: 16, bold: true, color: c[5] })
    T(s, c[1], x + 0.25, 2.2, 3.4, 0.9, { fontSize: 50, bold: true, color: C.NAVY, fontFace: F.mono })
    T(s, c[2], x + 0.25, 3.1, 3.4, 0.3, { fontSize: 12, color: C.MUTED })
    T(s, c[3], x + 0.25, 3.5, 1.6, 0.6, { fontSize: 30, bold: true, color: c[5] })
    T(s, c[4], x + 1.75, 3.62, 2.0, 0.4, { fontSize: 11, color: C.MUTED })
    ;['Tier 0', 'Tier 1', 'Tier 3'].forEach((t, j) => {
      mono(s, t, x + 0.25, 4.2 + j * 0.2, 0.7, 0.2, { fontSize: 9, color: C.MUTED })
      box(s, x + 1.0, 4.23 + j * 0.2, 2.5, 0.12, { fill: C.LINE, round: false })
      if (c[6][j]) box(s, x + 1.0, 4.23 + j * 0.2, 2.5 * c[6][j], 0.12, { fill: c[5], round: false })
    })
  })
  edge(s, 4.52, 3.2, 4.72, 3.2, { color: C.SLATE, w: 2, arrow: true }); edge(s, 8.64, 3.2, 8.84, 3.2, { color: C.SLATE, w: 2, arrow: true })
  box(s, 0.6, 5.15, 7.4, 1.45, { fill: C.NAVY })
  T(s, 'Coverage ≠ approval', 0.85, 5.25, 7, 0.4, { fontSize: 18, bold: true, color: C.WHITE })
  T(s, 'A human must still approve. School pickup needs the new assignee’s consent (pending). Approval records an internal simulation receipt only — no one is notified.', 0.85, 5.7, 6.95, 0.85, { fontSize: 13, color: C.SOFT })
  box(s, 8.2, 5.15, 4.5, 1.45, { fill: C.WHITE, line: C.LINE })
  mono(s, `Solver, 10 hosted runs: ${Math.round(solverMs[0])}–${Math.round(solverMs[solverMs.length - 1])} ms
median ${Math.round(median(solverMs))} ms · status ${plan.solverStatus} · 0 violations
Round trip incl. network:
${(ev.sim_ms_roundtrip / 1000).toFixed(1)} s simulate · ${(ev.rec_ms_roundtrip / 1000).toFixed(1)} s recover`, 8.35, 5.25, 4.25, 1.3, { fontSize: 10.5, color: C.NAVY })
  source(s, `Source: live API runs on ${DATE} (evidence/live_flagship.json). Free-tier hosting: timings vary; they are measurements, not guarantees.`)
}

// 25 ---------------------------------------------------------------- when recovery is impossible
{
  const s = slide('DARK', {
    kicker: 'Act IV · The evidence', title: 'When recovery is impossible',
    notes: `This slide shows the principle we are proudest of. Add a second disruption: Khalid is unavailable during school pickup, 14:40 to 15:45, while Amina remains unavailable. The Amina household has exactly two authorized adult pickup drivers, so no one who is allowed to drive is left.\n\nThe tempting wrong answer is to give the pickup to Noura. DOMINO refuses, and the screenshot shows why in the engine's own words: Noura lacks the driving skill, lacks the drive and pickup-authorized permissions and has restrictions on both; Yusuf is a dependent. Assigning anyone else would violate the model's declared permissions.\n\nSo the solver does the honest thing: it covers what it can — groceries and dinner with Khalid after his unavailable window — and leaves school pickup and homework uncovered. Homework is also uncovered because its prerequisite, Yusuf arriving home, cannot be satisfied, even though Noura is free. The status is valid partial plan, human intervention required. All thirty checks passed — the plan is valid; it is just not complete. Weighted coverage fell to 33 percent and two critical tasks remain unresolved. The solver status is still OPTIMAL: it found the best possible answer to a problem that has no complete one.\n\nDOMINO never labels an incomplete recovery as a complete one, and approval of this plan requires explicit acknowledgement of the unresolved critical tasks.` + NOTE_END,
  })
  const bf = fit(img.futBanner, 12.1, 0.9)
  shot(s, img.futBanner.f, 0.6, 1.55, bf.w, bf.h, 'Engine explanation of why School pickup cannot be covered (real screenshot)')
  const r = fit(img.futRef, 4.2, 2.75)
  const y1 = 1.55 + bf.h + 0.12
  shot(s, img.futRef.f, 0.6, y1, r.w, r.h, 'Reference: verified complete recovery (real screenshot)')
  shot(s, img.futMod.f, 0.6 + r.w + 0.2, y1, r.w, r.h, 'Modified: valid partial plan, critical tasks uncovered (real screenshot)')
  const y0 = y1 + r.h + 0.1
  T(s, 'Why not give the pickup to Noura?', 0.6, y0, 8.4, 0.3, { fontSize: 14, bold: true, color: C.WHITE })
  const why = ['lacks the driving skill', 'lacks drive and pickup_authorized permissions', 'carries restrictions on drive and pickup', 'Yusuf is a dependent — never assigned']
  why.forEach((t, i) => { const x = 0.6 + (i % 2) * 4.3, y = y0 + 0.32 + Math.floor(i / 2) * 0.28; T(s, '✗  ' + (i < 3 ? 'Noura ' : '') + t, x, y, 4.25, 0.28, { fontSize: 12, color: C.WHITE }) })
  box(s, 9.3, y1, 3.4, 1.8, { fill: C.DARK2, line: '6FCAA0' })
  T(s, 'Amina out', 9.5, y1 + 0.08, 3.0, 0.3, { fontSize: 12, bold: true, color: '6FCAA0' })
  T(s, 'Verified complete recovery', 9.5, y1 + 0.4, 3.0, 0.4, { fontSize: 16, bold: true, color: C.WHITE })
  mono(s, `4/4 covered · 100%\n${plan.validation.checks.length}/${plan.validation.checks.length} checks · 0 violations`, 9.5, y1 + 0.95, 3.0, 0.7, { fontSize: 12, color: C.SOFT })
  box(s, 9.3, y1 + 1.95, 3.4, 2.1, { fill: '3A1B22', line: 'E08A8E' })
  T(s, 'Amina + Khalid out 14:40–15:45', 9.5, y1 + 2.03, 3.0, 0.3, { fontSize: 12, bold: true, color: 'E08A8E' })
  T(s, 'Valid partial plan — human intervention required', 9.5, y1 + 2.35, 3.0, 0.75, { fontSize: 15, bold: true, color: C.WHITE })
  mono(s, `${plan2.uncoveredCriticalTaskIds.length} critical uncovered: pickup, homework\n${Math.round(plan2.metrics.weightedCoverage * 100)}% coverage · ${plan2.validation.checks.length}/${plan2.validation.checks.length} checks\nsolver ${plan2.solverStatus}`, 9.5, y1 + 3.15, 3.0, 0.85, { fontSize: 11, color: C.SOFT })
  source(s, `Source: real screenshot + live run ${DATE}. An uncovered critical task is never presented as a complete recovery.`, true)
}

// 26 ---------------------------------------------------------------- benchmark evidence
{
  const kinds = {}
  for (const r of suite.results) if (r.status === 'pass') kinds[r.kind] = (kinds[r.kind] ?? 0) + 1
  const order = [['recovery', 'Recovery scenarios'], ['system', 'Safety / AI / graph checks'], ['baseline', 'Baseline validation'], ['mutation', 'Invalid plans rejected'], ['repeat', 'Determinism'], ['household_validation', 'Input validation'], ['reset', 'Reset'], ['rejection', 'Rejection re-solve'], ['stale', 'Stale scenario'], ['alternative', 'Distinct alternative']]
  const labels = order.map((o) => o[1]), vals = order.map((o) => kinds[o[0]] ?? 0)
  const cmp = suite.baselineComparison
  const s = slide('LIGHT', {
    kicker: 'Act IV · The evidence', title: 'Benchmarking and test evidence',
    notes: `All numbers here come from the run we executed on ${DATE} on the hosted API (Linux, Python 3.12, OR-Tools ${suite.environment.ortools}, single solver worker, fixed seed) and are saved in the repository.\n\nFifty-one cases are defined. Fifty-one were processed: forty-six passed, none failed, five were not run — four are checked by the browser test suite and the build, and one is the missing-credentials test, skipped because a Gemini key is configured. The chart shows what the forty-six passes cover: twenty-two recovery scenarios across the three households, safety and AI-logic checks, baseline validation, rejection of deliberately invalid plans such as unauthorized drivers and double-booked vehicles, determinism, input validation, reset, rejection re-solve, stale-scenario handling and distinct-alternative search.\n\nDependency detection was scored against hand-written expected sets: eleven cases, precision, recall and F1 all 1.0. That is a small, hand-authored set, so it supports correctness on these cases, not generality.\n\nWe also compared with two baselines. Greedy first-fit tied DOMINO on critical coverage in all twenty-one disruption cases — we report that plainly — while DOMINO made fewer changes on average, 2.5 against 3.1, and carries the lexicographic guarantee. Doing nothing left a critical task uncovered in twenty of the twenty-one cases. Timing: per recovery case, solver time had a median of ${Math.round(median(suite.results.filter((r) => r.metrics.solver).map((r) => r.metrics.solver.elapsedMs)))} milliseconds; the whole case including three strategies, analysis, verification and baselines had a median of ${suite.latency.medianMs} milliseconds and a 95th percentile of ${suite.latency.p95Ms}. Engineering targets are separate from these measurements: for example two seconds per strategy is a configured limit, not a result.` + NOTE_END,
  })
  s.addChart(pres.charts.DOUGHNUT, [{ name: 'Status', labels: ['Passed', 'Failed', 'Not run'], values: [suite.counts.pass, suite.counts.fail, suite.counts.not_run] }], {
    x: 0.5, y: 1.5, w: 3.6, h: 3.3, holeSize: 62, chartColors: [C.OK, C.BAD, C.WARN], showLegend: true, legendPos: 'b', legendFontSize: 11, legendFontFace: F.sans, legendColor: C.INK,
    showPercent: false, showValue: true, dataLabelColor: C.WHITE, dataLabelFontSize: 12, dataLabelFontFace: F.sans, showTitle: true, title: `${suite.totalCases} cases processed`, titleFontSize: 13, titleColor: C.NAVY, titleFontFace: F.sans,
  })
  s.addChart(pres.charts.BAR, [{ name: 'Passed', labels: labels.slice().reverse(), values: vals.slice().reverse() }], {
    x: 4.2, y: 1.5, w: 4.5, h: 3.9, barDir: 'bar', chartColors: [C.COBALT], showLegend: false, showValue: true, dataLabelFontSize: 11, dataLabelColor: C.NAVY, dataLabelFontFace: F.sans,
    catAxisLabelFontSize: 10, catAxisLabelColor: C.INK, catAxisLabelFontFace: F.sans, valAxisHidden: true, valGridLine: { style: 'none' }, catGridLine: { style: 'none' }, showTitle: true, title: 'What the 46 passes cover', titleFontSize: 13, titleColor: C.NAVY, titleFontFace: F.sans,
  })
  const hdr = (t) => ({ text: t, options: { bold: true, color: C.WHITE, fill: { color: C.NAVY }, fontSize: 11, align: 'center' } })
  const c = (t, o = {}) => ({ text: t, options: { fill: { color: C.WHITE }, color: C.INK, fontSize: 12, align: 'center', ...o } })
  s.addTable([
    [hdr('Method'), hdr('Mean weighted coverage'), hdr('Cases with uncovered critical'), hdr('Mean changes')],
    [c('DOMINO', { bold: true, align: 'left' }), c(`${(cmp.domino.meanWeightedCoverage * 100).toFixed(1)}%`), c(`${cmp.domino.casesWithUncoveredCritical} / ${cmp.cases}`), c(String(cmp.domino.meanChanges))],
    [c('Greedy first-fit', { align: 'left' }), c(`${(cmp.greedy.meanWeightedCoverage * 100).toFixed(1)}%`), c(`${cmp.greedy.casesWithUncoveredCritical} / ${cmp.cases}`), c(String(cmp.greedy.meanChanges))],
    [c('No recovery', { align: 'left' }), c(`${(cmp.noRecovery.meanWeightedCoverage * 100).toFixed(1)}%`), c(`${cmp.noRecovery.casesWithUncoveredCritical} / ${cmp.cases}`), c('0')],
  ], { x: 8.85, y: 1.55, w: 3.9, colW: [1.1, 0.95, 1.0, 0.85], rowH: 0.6, border: { type: 'solid', color: C.LINE, pt: 0.75 }, fontFace: F.sans, valign: 'middle', margin: [0.02, 0.05, 0.02, 0.05] })
  T(s, 'DOMINO tied greedy on critical coverage in all 21 cases; it made fewer changes. All baseline outputs also passed the independent verifier.', 8.85, 4.1, 3.9, 0.95, { fontSize: 12, color: C.INK })
  mono(s, `Dependency detection: ${suite.dependencyDetection.cases} cases
P ${suite.dependencyDetection.precision} · R ${suite.dependencyDetection.recall} · F1 ${suite.dependencyDetection.f1}`, 8.85, 5.1, 3.9, 0.5, { fontSize: 10.5, color: C.NAVY })
  const sv = suite.results.filter((r) => r.metrics.solver).map((r) => r.metrics.solver.elapsedMs)
  mono(s, `Solver per case (n=${sv.length}): median ${Math.round(median(sv))} ms · max ${Math.round(Math.max(...sv))} ms · case wall: median ${suite.latency.medianMs} ms, p95 ${suite.latency.p95Ms} ms`, 0.6, 5.55, 8.1, 0.5, { fontSize: 10.5, color: C.NAVY })
  T(s, 'Categories covered: baseline validation · overlaps · missing permissions · resource unavailability · conflicting schedules · dependent restrictions · secondary disruptions · stale scenario versions.', 0.6, 5.95, 12.1, 0.6, { fontSize: 12, color: C.MUTED })
  source(s, `Source: POST /v1/benchmarks/run on the hosted API, ${DATE} (Linux, Python ${suite.environment.python}, OR-Tools ${suite.environment.ortools}, 1 worker, seed 1). Synthetic, hand-authored cases; targets are not results.`)
}

// ================================================================= ACT V — THE IMPACT
act('Act V — The impact')
// 27 ---------------------------------------------------------------- security / responsible AI / deployment
{
  const s = slide('ICE', {
    kicker: 'Act V · The impact', title: 'Security, responsible AI and deployment',
    notes: `Responsible design is built into the product. All household data is synthetic. Gemini credentials live only on the server as environment variables, never in browser code — we scanned the published JavaScript for key patterns and found none. Every request is validated by Pydantic, with request-size limits, rate limits on the AI and benchmark endpoints, a CORS allow-list that accepts only our published site, bounded solver concurrency and structured errors without stack traces.\n\nOn the AI side: assignments are permission-aware by construction, language AI only proposes a structured event that a human confirms, the plan is verified independently, a human approves, and the limitations are documented.\n\nDeployment: the React frontend is a static site on GitHub Pages; the FastAPI backend runs in a Docker container on Render and calls Google OR-Tools locally and the Gemini API for language interpretation. At capture time on ${DATE} the health endpoint reported status ok with OR-Tools CP-SAT. A status check is a snapshot, not a promise of uptime: the free tier sleeps when idle and the first request can be slow, and if the backend is unreachable the interface says so and disables computation rather than showing canned results. We never show keys, project numbers or dashboard links.` + NOTE_END,
  })
  const items = [['Synthetic data only', 'three fictional households'], ['Server-side secrets', 'no keys in browser code'], ['Input validation', 'Pydantic · size & rate limits · CORS allow-list'], ['Permission-aware assignment', 'age never grants permission'], ['Human approval', 'simulation receipt; no one is notified'], ['Independent verification', '18 rules, 0 violations required'], ['Transparent limitations', 'single day · fictional · no prediction']]
  items.forEach((it, i) => {
    const y = 1.55 + i * 0.7
    tbox(s, [{ text: '✓', options: { bold: true } }], 0.6, y + 0.02, 0.42, 0.42, { shape: pres.shapes.OVAL, fill: C.OK, color: C.WHITE, fontSize: 14, align: 'center', margin: 0 })
    T(s, it[0], 1.2, y - 0.02, 3.3, 0.3, { fontSize: 14, bold: true, color: C.NAVY })
    T(s, it[1], 1.2, y + 0.28, 3.4, 0.3, { fontSize: 11, color: C.MUTED })
  })
  const bx = (t, sub, x, y, w, fill, color, line) => tbox(s, [{ text: t, options: { bold: true, breakLine: true } }, { text: sub, options: { fontSize: 11 } }], x, y, w, 1.0, { fill, color, line, fontSize: 14, align: 'center' })
  bx('Browser', 'any device', 5.2, 1.6, 2.2, C.WHITE, C.NAVY, C.SLATE)
  bx('GitHub Pages', 'React + TypeScript (static)', 5.2, 3.0, 2.2, C.COBALT, C.WHITE)
  bx('FastAPI on Render', 'Docker · Pydantic · CP-SAT', 8.1, 3.0, 2.6, C.NAVY, C.WHITE)
  bx('Google OR-Tools', 'local solver', 8.1, 4.6, 2.6, C.ICE, C.NAVY, C.COBALT)
  bx('Gemini API', 'language only', 11.0, 3.0, 1.75, C.SOFT, C.NAVY)
  edge(s, 6.3, 2.62, 6.3, 3.0, { color: C.SLATE, w: 2, arrow: true })
  edge(s, 7.42, 3.5, 8.1, 3.5, { color: C.COBALT, w: 2, arrow: true })
  edge(s, 10.72, 3.5, 11.0, 3.5, { color: C.SLATE, w: 2, dash: 'dash', arrow: true })
  edge(s, 9.4, 4.02, 9.4, 4.6, { color: C.COBALT, w: 2, arrow: true })
  mono(s, 'HTTPS', 7.42, 3.22, 0.68, 0.22, { fontSize: 9, color: C.SLATE, align: 'center' })
  box(s, 8.1, 1.6, 4.65, 1.0, { fill: C.WHITE, line: C.LINE })
  T(s, 'Secrets stay on the server: the browser never sees the Gemini key, and CORS accepts only the published site.', 8.3, 1.72, 4.3, 0.8, { fontSize: 12, color: C.NAVY })
  box(s, 5.2, 5.95, 7.55, 0.7, { fill: C.WHITE, line: C.LINE })
  T(s, `Status snapshot ${DATE}: /v1/health → ok · OR-Tools CP-SAT · language engines: Gemini + built-in parser. Not an uptime guarantee.`, 5.35, 6.02, 7.3, 0.55, { fontSize: 11, color: C.INK })
  source(s, 'Source: render.yaml, Dockerfile, pages.yml, backend/app/main.py (middleware, CORS, limits). No credentials or private URLs are shown anywhere in this deck.')
}

// 28 ---------------------------------------------------------------- wellbeing and UAE relevance
{
  const s = slide('DARK', {
    kicker: 'Act V · The impact', title: 'Family wellbeing and UAE relevance',
    notes: `The UAE has designated 2026 as the Year of Family, which puts family stability, shared responsibility and cohesion at the centre of national attention. DOMINO connects to that theme; it is not sponsored or endorsed by any government body.\n\nWhat DOMINO could contribute is practical: clearer coordination when plans change, a visible picture of who is responsible for what, a better understanding of interdependencies, less uncertainty in the moment a plan fails, and transparent decision support in which a human stays in charge. Notice the word could. Everything on the right-hand side is potential benefit that follows from the design; it has not been measured with real families. We have not run user studies, so we make no claims about stress, wellbeing or population-level outcomes, and DOMINO makes no clinical or psychological claims.\n\nWhat we can show is that the computation works on three fictional households, that it is verifiable, and that it refuses to hide what it cannot solve. Reference: u.ae Year of Family 2026. The graphic on the left is a conceptual illustration of a household network, not a measurement.` + NOTE_END,
  })
  constellation(s, 3.4, 4.0, 2.2, { line: C.SLATE })
  T(s, 'Conceptual illustration — not data', 0.6, 6.42, 5.6, 0.25, { fontSize: 10, italic: true, color: C.SOFT })
  T(s, 'Potential contribution (not yet measured with real families)', 6.8, 1.55, 5.9, 0.7, { fontSize: 20, bold: true, color: C.WHITE })
  const pts = ['More reliable family coordination when plans change', 'Clearer sharing of responsibilities', 'Better understanding of interdependencies', 'Less uncertainty when something goes wrong', 'Transparent decision support, with a human in charge']
  pts.forEach((t, i) => { tbox(s, [{ text: String(i + 1), options: { bold: true } }], 6.8, 2.4 + i * 0.68, 0.42, 0.42, { shape: pres.shapes.OVAL, fill: C.COBALT, color: C.WHITE, fontSize: 13, align: 'center', margin: 0 }); T(s, t, 7.4, 2.45 + i * 0.68, 5.3, 0.55, { fontSize: 15, color: C.WHITE }) })
  box(s, 6.8, 5.9, 5.9, 0.75, { fill: C.DARK2, line: C.SLATE })
  T(s, '2026 is the UAE Year of Family. DOMINO relates to the theme only; it is not sponsored or endorsed by any government body. No clinical, psychological or population-level claims are made.', 6.95, 5.95, 5.6, 0.65, { fontSize: 11, color: C.SOFT })
  source(s, 'Reference: https://u.ae/en/Year-of-family/Family-year-2026 (UAE Government portal). Benefits are design-level potential, not demonstrated outcomes.', true)
}

// 29 ---------------------------------------------------------------- status and future
{
  const s = slide('LIGHT', {
    kicker: 'Act V · The impact', title: 'Development status and future potential',
    notes: `We separate what exists from what we hope to build. On the left, everything is implemented and tested in the published prototype: interactive household modeling with validation, working disruption analysis with causal paths, optimization-based recovery with CP-SAT, independent validation, counterfactual simulation and evaluation infrastructure with fifty-one defined cases of which forty-six passed in our run. Natural-language input works two ways — Gemini and a built-in parser — with human confirmation.\n\nOn the right is future potential, clearly labelled as not built: larger and more complex households, more constraint types such as real travel times and multi-day planning, broader accessibility work beyond what we tested, full bilingual Arabic and English support, real-world usability studies with families, and stronger privacy-preserving data management.\n\nBefore this could be used by real families we would need much more: user studies and consent, a privacy and data-protection design for real personal data, a security review, accessibility audits, validation of the model's assumptions against real routines, and professional review of any safety-related assumptions. Today it is a research-grade prototype on fictional data.` + NOTE_END,
  })
  const hdr = (t, fill) => ({ text: t, options: { bold: true, color: C.WHITE, fill: { color: fill }, fontSize: 15 } })
  const imp = ['Interactive household modeling and validation', 'Disruption analysis with causal paths', 'CP-SAT optimization-based recovery', 'Independent 18-rule validation', 'Counterfactual (what-if) recalculation', 'Evaluation infrastructure: 51 cases · 46 passed in our run', 'Natural language: Gemini + built-in parser, human-confirmed']
  const fut = ['More complex households and constraint types', 'Real travel-time models, multi-day planning', 'Broader accessibility work and audits', 'Expanded bilingual (Arabic / English) support', 'Real-world usability studies with families', 'Privacy-preserving data management']
  s.addTable([[hdr('IMPLEMENTED AND TESTED', C.OK), hdr('FUTURE POTENTIAL — NOT BUILT', C.SLATE)]], { x: 0.6, y: 1.55, w: 12.1, colW: [6.05, 6.05], rowH: 0.5, fontFace: F.sans, valign: 'middle', margin: [0, 0.15, 0, 0.15] })
  imp.forEach((t, i) => { T(s, '✓', 0.75, 2.2 + i * 0.5, 0.3, 0.4, { fontSize: 15, bold: true, color: C.OK }); T(s, t, 1.1, 2.23 + i * 0.5, 5.4, 0.45, { fontSize: 13, color: C.INK }) })
  fut.forEach((t, i) => { T(s, '○', 6.85, 2.2 + i * 0.5, 0.3, 0.4, { fontSize: 15, color: C.SLATE }); T(s, t, 7.2, 2.23 + i * 0.5, 5.4, 0.45, { fontSize: 13, color: C.MUTED }) })
  box(s, 0.6, 5.85, 12.1, 0.78, { fill: C.WARNBG, line: C.WARN })
  T(s, 'Before real-family use: user studies with consent · privacy & data-protection design · security review · accessibility audits · validation of model assumptions · expert review. Today: a research-grade prototype on fictional data.', 0.8, 5.92, 11.7, 0.65, { fontSize: 12, color: C.INK })
  source(s, `Source: TESTING.md and ${DATE} benchmark run; future items are plans, not features.`)
}

act('Close')
// 30 ---------------------------------------------------------------- closing
{
  const s = slide('COVER', {
    notes: `Close with the idea, then the invitation. When one thing changes, everything connects. DOMINO helps families understand disruption and calculate a verified way forward — and when no valid way forward exists, it says so honestly and hands the decision back to a person.\n\nThe prototype is public: scan the QR code or open maymourad.github.io/DOMINO, choose the Amina family, inject Amina's unavailability, and then add Khalid's. You will see the full journey: cascade, optimized recovery, independent verification, and an honest unresolved result. The code, tests and the saved benchmark results are in the public repository.\n\nThank you from May Ahmed Mourad, Shamsa Faris Almazrouei and Fatima Mohamed Almazrouei, ADNOC Schools — Madinat Zayed. We are happy to take questions on any slide: the solver formulation, how dependents are protected, how we tested, or the limitations.\n\nLikely questions and where to answer them: how is it different from a shared calendar — slide 4; what makes it AI — slides 13 and 21 (language AI plus constraint optimization); why CP-SAT — slide 21; how eligibility works — slides 12 and 22; can the solver return an impossible assignment — slide 23; what if no recovery exists — slide 25; how dependents are protected — slide 22; how it was tested — slide 26; limitations and real-family use — slide 29.` + NOTE_END,
  })
  constellation(s, 9.6, 2.55, 1.85, { line: C.SLATE })
  T(s, 'DOMINO', 0.8, 1.2, 7, 1.2, { fontSize: 72, bold: true, color: C.WHITE })
  T(s, '“When one thing changes, everything connects.”', 0.8, 2.55, 6.8, 0.8, { fontSize: 24, italic: true, color: C.WHITE })
  T(s, 'DOMINO helps families understand disruption and calculate a verified way forward.', 0.8, 3.45, 6.4, 0.9, { fontSize: 16, color: C.SOFT })
  mono(s, 'May Ahmed Mourad · Grade 12\nShamsa Faris Almazrouei · Grade 12\nFatima Mohamed Almazrouei · Grade 11', 0.8, 4.6, 6.5, 0.95, { fontSize: 13, color: C.WHITE })
  T(s, 'ADNOC Schools — Madinat Zayed  ·  Abu Dhabi University 6th Annual COE STEM Programming with AI Competition  ·  AI for Family', 0.8, 5.75, 6.4, 0.6, { fontSize: 11, color: C.SOFT })
  box(s, 11.15, 4.55, 1.55, 1.55, { fill: C.WHITE })
  s.addImage({ path: S('qr.png'), x: 11.22, y: 4.62, w: 1.41, h: 1.41, altText: 'QR code linking to the live DOMINO prototype', hyperlink: { url: 'https://maymourad.github.io/DOMINO/#/launch', tooltip: 'Open the DOMINO prototype' } })
  T(s, [{ text: 'maymourad.github.io/DOMINO', options: { hyperlink: { url: 'https://maymourad.github.io/DOMINO/#/launch', tooltip: 'Open the DOMINO prototype' }, color: C.SOFT, underline: { style: 'sng' }, bold: true } }], 8.7, 6.22, 4.0, 0.3, { fontSize: 14, align: 'right' })
  T(s, 'Scan the QR code or open the link — the live prototype is public', 7.7, 6.6, 5.0, 0.3, { fontSize: 11, color: C.SOFT, align: 'right' })
}

if (count() !== 30) throw new Error(`Expected exactly 30 slides, built ${count()}`)
const OUT = path.join(here, 'DOMINO_Presentation.pptx')
await pres.writeFile({ fileName: OUT })
const req = createRequire(import.meta.url)
const { applyTheme } = req('C:/Users/aaa/AppData/Local/Claude-Data/claude_pzs8sxrjxfjjc/local-agent-mode-sessions/skills-plugin/35552a5f-98f9-4e0e-b06f-d1a96e9ca10a/e54784a8-37a4-4cc2-9d86-5fb6e5584d2c/skills/pptx/scripts/apply_theme.js')
await applyTheme(OUT, THEME)
console.log('written', count(), 'slides')
void THEME

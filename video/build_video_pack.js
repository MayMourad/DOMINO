// Builds DOMINO_Video_Production_Pack.docx from clips.js (24 clips x 5 s = 2:00).
const fs = require('fs')
const path = require('path')
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  AlignmentType, Footer, PageNumber, LevelFormat, TableLayoutType, VerticalAlign,
} = require('docx')
const { clips, characterSheet, SCENE, GRAPHIC, NEG, AMINA, KHALID, NOURA, YUSUF } = require('./clips.js')

const NAVY = '102B4E', COBALT = '255E99', SLATE = '47789F', SOFT = '82B2D6', ICE = 'EAF3FA', GREY = '4A5968', LINE = 'B9CBDB'
const FONT = 'Calibri', MONO = 'Consolas', BODY = 20, CW = 9864

function runs(s, base = {}) {
  const out = []
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
  let last = 0, m
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(new TextRun({ text: s.slice(last, m.index), ...base }))
    const t = m[0]
    if (t.startsWith('**')) out.push(new TextRun({ text: t.slice(2, -2), bold: true, ...base }))
    else if (t.startsWith('`')) out.push(new TextRun({ text: t.slice(1, -1), font: MONO, size: (base.size || BODY) - 1, color: NAVY }))
    else out.push(new TextRun({ text: t.slice(1, -1), italics: true, ...base }))
    last = m.index + t.length
  }
  if (last < s.length) out.push(new TextRun({ text: s.slice(last), ...base }))
  return out
}
const para = (s, o = {}) => new Paragraph({ spacing: { after: 80, line: 250 }, alignment: AlignmentType.LEFT, ...o, children: runs(s) })
const h1 = (s) => new Paragraph({ heading: 'Heading1', keepNext: true, spacing: { before: 200, after: 80 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LINE, space: 1 } }, children: [new TextRun({ text: s, bold: true, size: 28, color: NAVY, font: FONT })] })
const h2 = (s) => new Paragraph({ heading: 'Heading2', keepNext: true, spacing: { before: 120, after: 40 }, children: [new TextRun({ text: s, bold: true, size: 22, color: COBALT, font: FONT })] })
const bullet = (s) => new Paragraph({ numbering: { reference: 'bul', level: 0 }, spacing: { after: 40, line: 245 }, children: runs(s) })
const gap = (n = 60) => new Paragraph({ spacing: { after: n }, children: [] })

const cb = { style: BorderStyle.SINGLE, size: 4, color: LINE }
const borders = { top: cb, bottom: cb, left: cb, right: cb }
function cell(text, w, o = {}) {
  const size = o.size || 17
  const paras = (Array.isArray(text) ? text : [text]).map((t, i, a) => new Paragraph({
    keepNext: o.keep, spacing: { after: i < a.length - 1 ? 40 : 0, line: 235 }, alignment: AlignmentType.LEFT,
    children: runs(String(t), { size, color: o.color, bold: o.bold }),
  }))
  return new TableCell({
    width: { size: w, type: WidthType.DXA }, borders, columnSpan: o.span, verticalAlign: o.valign || VerticalAlign.TOP,
    margins: { top: 40, bottom: 40, left: 90, right: 90 },
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: 'auto' } : undefined, children: paras,
  })
}
function table(widths, header, rows, o = {}) {
  const size = o.size || 17
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED,
    rows: [new TableRow({ tableHeader: true, cantSplit: true, children: header.map((t, j) => cell(t, widths[j], { fill: NAVY, color: 'FFFFFF', bold: true, size, keep: true })) })]
      .concat(rows.map((r, i) => new TableRow({ cantSplit: true, children: r.map((t, j) => cell(t, widths[j], { size, fill: i % 2 ? ICE : undefined, keep: o.keepAll && i < rows.length - 1 })) }))),
  })
}
const timeOf = (n) => { const s = (n - 1) * 5, e = n * 5; const f = (x) => `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`; return `${f(s)}–${f(e)}` }
const vowords = clips.reduce((a, c) => a + c.vo.split(/\s+/).length, 0)
const kinds = clips.reduce((a, c) => { a[c.type] = (a[c.type] || 0) + 1; return a }, {})

function card(c) {
  const isCap = c.type === 'Real capture'
  const rows = [
    ['Visual', c.visual],
    [isCap ? 'Capture script' : (c.type.includes('capture') ? 'Image prompt + capture' : (c.prompt.startsWith('ASSEMBLE') ? 'Assembly' : 'Image prompt')), c.prompt, true],
    [isCap ? 'Motion graphics' : 'Animation prompt', c.anim, true],
    ['On-screen text', c.text],
    ['Voiceover', '“' + c.vo + '”  (' + c.vo.split(/\s+/).length + ' words)'],
    ['Audio', c.audio],
    ['Transition', c.trans],
  ]
  const LW = 1500, RW = CW - LW
  return [new Table({
    width: { size: CW, type: WidthType.DXA }, columnWidths: [LW, RW], layout: TableLayoutType.FIXED,
    rows: [new TableRow({ cantSplit: true, children: [cell(`**CLIP ${String(c.n).padStart(2, '0')}**  ·  ${timeOf(c.n)}  ·  ${c.type}  ·  ${c.act}`, CW, { span: 2, fill: NAVY, color: 'FFFFFF', size: 19, keep: true })] })]
      .concat(rows.map((r, i) => new TableRow({ cantSplit: true, children: [cell(r[0], LW, { bold: true, fill: ICE, size: 17, keep: i < rows.length - 1, color: NAVY }), cell(r[1], RW, { size: 17, fill: r[2] ? 'F7FAFC' : undefined, keep: i < rows.length - 1 })] }))),
  }), gap(120)]
}

const short = ['“Illustrative” tag', 'Time chips: 14:45 · 15:55 · 16:45 · 17:30', '14:30 — Amina unavailable until 18:00', '—', 'One cancelled slot / What depends on it?', 'DOMINO — Family Resilience Intelligence System', 'People · Tasks · Vehicles · Dependencies', 'Describe → AI proposes → You confirm', '4 directly · 2 indirectly · 3 levels deep', 'At risk through dependency', '56 candidate arrangements', 'Pickup, Groceries → Khalid · Homework → Noura', '“Illustrative” tag', '18 rules · 56/56 checks · 0 violations', 'Human decision', 'What if Khalid is unavailable too?', 'Partial plan · 33 % coverage', '“Illustrative” tag', '51 cases · 46 passed · 0 failed · 5 not run', 'Describe · Optimize · Verify · Decide', 'Inspired by UAE Year of Family (theme only)', 'Team names + school', 'When one thing changes, everything connects.', 'QR · URL · competition line']
const kids = []
kids.push(
  new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: 'DOMINO', bold: true, size: 52, color: NAVY, font: FONT }), new TextRun({ text: '  Video Production Pack', size: 36, color: COBALT, font: FONT })] }),
  new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: 'Two-minute video advertisement · 24 clips × 5 seconds · image prompts, animation prompts, voiceover script and structure', size: 21, color: GREY, font: FONT })] }),
  new Paragraph({ spacing: { after: 120 }, children: runs('May Ahmed Mourad (G12) · Shamsa Faris Almazrouei (G12) · Fatima Mohamed Almazrouei (G11) — ADNOC Schools, Madinat Zayed · 28 October 2026', { size: 18, color: GREY }) }),

  h1('1  At a glance'),
  table([2300, 7564], ['Item', 'Plan'], [
    ['Runtime', '**2:00** exactly: 24 clips × 5 s, no gaps. Deliver at 1920×1080, 16:9, 24 or 30 fps.'],
    ['Clip mix', `${kinds['Real capture'] || 0} real prototype captures · ${kinds['AI scene'] || 0} AI-generated scenes · ${kinds['AI scene + real capture'] || 0} hybrid (clip 10) · ${kinds['Motion graphic'] || 0} motion-graphic clips.`],
    ['Voiceover', `${vowords} words in total, 5–12 words per clip (about 2.4 words per second, calm and clear). Every line fits inside its 5 seconds with room to breathe.`],
    ['Music', '96 BPM, so each clip is exactly 2 bars of 4/4 (8 beats). Warm piano and soft synth pulse; builds through Act II, tense and thin in Act IV, resolves in Act V.'],
    ['Story arc', 'I The hook (1–5) · II The product (6–9) · III The intelligence (10–15) · IV The honesty (16–20) · V The impact (21–24). It mirrors the five acts of the deck.'],
    ['Tools', 'Tool-neutral. Use any image generator, any image-to-video model (5 s output, or longer and trimmed), and any editor. Prompts are written to be pasted as they are.'],
  ], { size: 18 }),
  gap(40),
  h2('Rules that keep the video honest'),
  bullet('**Real is real.** Every scene that shows DOMINO is genuine footage of the published prototype, recorded from the live site. Nothing that looks like the interface is generated or mocked up. AI-generated scenes carry a small “Illustrative” tag, and the end card says so.'),
  bullet('**Only recorded numbers.** The figures in the video come from the 28 Oct 2026 run in `presentation/EVIDENCE_LEDGER.md`: unavailable 14:30–18:00 · 4 directly affected, 2 indirectly, 3 levels deep · 56 candidates · 18 rules, 56/56 checks, 0 hard violations · partial plan at 33 % coverage · 51 cases, 46 passed, 0 failed, 5 not run. See the claim check in section 7.'),
  bullet('**No overclaiming.** DOMINO simulates hypothetical events; it does not predict emergencies. “Calmer days” is a goal, not a measured result; there has been no study with families. The UAE Year of Family is a theme reference only.'),
  bullet('**No secrets on screen.** No API keys, Google project identifiers, Render dashboard or service URLs, tokens, e-mail addresses, bookmarks or other tabs. Record in a clean browser profile.'),
  bullet('**Fictional people.** The family in the AI scenes is the fictional Amina household. Do not generate or imitate real people, and do not generate faces for the team (use a real photo if you want one).'),
)

kids.push(
  h1('2  Style bible and character sheet'),
  table([2300, 7564], ['Element', 'Direction'], [
    ['Palette', 'Midnight Navy #102B4E (backgrounds, shadows) · Cobalt #255E99 · Slate Blue #47789F · Soft Blue #82B2D6 (lines, highlights) · Ice Blue #EAF3FA (text on dark). Warm golden light in home scenes; cool navy in system scenes. Red and amber only where they mean “disrupted” and “at risk”, as in the prototype.'],
    ['Type', 'Manrope (titles, 700–800) and IBM Plex Mono (numbers, times, labels). These are the fonts of the prototype; both are free (SIL Open Font Licence).'],
    ['Look', 'Premium, calm, cinematic. Shallow depth of field, 35 mm look, slow camera moves, no shaky cam, no whip-pans, no neon, no sci-fi clichés (no glowing brains, no robots).'],
    ['Motion', '300–500 ms ease-out for graphics; slow 5-second camera moves for scenes; one idea per clip.'],
    ['Labels', 'Small “Illustrative scene” tag, lower left, on all AI scenes; “Conceptual visualization” on clip 11; “Illustrative planner” on clip 5.'],
  ], { size: 18 }),
  gap(40),
  h2('The family (fixed descriptions: paste these exact phrases into every prompt)'),
  table([1400, 8464], ['Name', 'Description to reuse'], [
    ['Amina', AMINA], ['Khalid', KHALID], ['Noura', NOURA], ['Yusuf', YUSUF],
  ], { size: 17 }),
  gap(40),
  h2('Prompt 0 — character reference sheet (generate this first)'),
  table([CW], ['Copy-ready prompt'], [[characterSheet]], { size: 17 }),
  para('Generate 4 variations and pick one. Then attach that image as the reference (character or style reference, depending on the tool) to every AI-scene prompt so faces, clothes and proportions stay consistent. If the tool supports seeds, keep one seed for the whole family.', { spacing: { before: 60, after: 60 } }),
  h2('Style suffixes used in the prompts (already included in each clip)'),
  table([2300, 7564], ['Suffix', 'Text'], [
    ['Scene style', SCENE], ['Graphic style', GRAPHIC], ['Negative prompt (paste into every image prompt)', NEG],
  ], { size: 17 }),
  para('**Image-to-video settings** (adjust to the model): 16:9, 5 s (or 6–8 s, then trim), 24 fps, motion strength low to medium, camera “smooth/steady”, and in every animation prompt keep the words “no morphing, consistent faces, no text”. Generate 2–3 takes per clip and keep the one with the least face or hand drift. Text is added in the editor, never generated.', { spacing: { before: 80, after: 60 } }),
)

kids.push(
  h1('3  Storyboard at a glance'),
  table([450, 1000, 1500, 4300, 2614], ['#', 'Time', 'Type', 'Voiceover', 'On-screen text'],
    clips.map((c) => [String(c.n), timeOf(c.n), c.type, c.vo, short[c.n - 1]]),
    { size: 16 }),
)

kids.push(
  h1('4  Voiceover script'),
  para('Read at a calm, confident pace (about 150 words per minute). A short breath before each new clip line is built in. Mark each take with its clip number so the editor can place it on the beat.', { spacing: { after: 60 } }),
  ...[['I · The hook', 1, 5], ['II · The product', 6, 9], ['III · The intelligence', 10, 15], ['IV · The honesty', 16, 20], ['V · The impact', 21, 24]].flatMap(([t, a, b]) => [
    h2(`Act ${t}  (${timeOf(a).split('–')[0]}–${timeOf(b).split('–')[1]})`),
    ...clips.filter((c) => c.n >= a && c.n <= b).map((c) => new Paragraph({ spacing: { after: 50, line: 250 }, children: [new TextRun({ text: `${String(c.n).padStart(2, '0')}  ${timeOf(c.n)}   `, font: MONO, size: 17, color: SLATE }), new TextRun({ text: c.vo, size: 21, color: NAVY })] })),
  ]),
  gap(40),
  h2('Voice direction'),
  bullet('Warm, clear, young-adult voice; confident, not salesy. A team member can record it (more authentic for a student competition) or use a text-to-speech voice; if you use a synthetic voice, say so in the submission notes.'),
  bullet('Pronunciation: **DOMINO** (DOM-ih-noh) · **Almazrouei** (al-maz-ROO-ee) · **Madinat Zayed** (ma-DEE-nat ZAH-yed) · “ADNOC” as a word (AD-nock) unless the school says otherwise.'),
  bullet('Numbers are spoken as words: “two-thirty”, “fifty-six”, “eighteen”, “fifty-one”, “forty-six”. Keep the pause between sentences in clips 2, 12 and 17.'),
)

kids.push(h1('5  Clip-by-clip cards'), para('Each card is self-contained: **image prompt** (or **capture script** for real footage), **animation prompt**, on-screen text, audio and transition. Times are cumulative on the 2:00 timeline.', { spacing: { after: 100 } }))
for (const c of clips) kids.push(...card(c))

kids.push(
  h1('6  Audio plan and assembly'),
  table([2300, 7564], ['Layer', 'Plan'], [
    ['Music map', 'Clips 1–5 sparse piano + room tone (tension builds at clip 3). Clip 6 theme enters on the downbeat. Clips 6–15 build one layer every 2–3 clips. Clips 16–17 drop to a low pad. Clips 18–20 re-build. Clips 21–23 resolve and swell. Clip 24 final note and silence. Keep the music 10 dB below the voice, with a gentle duck on speech.'],
    ['Sound design', 'Subtle only: domino clicks (4), soft UI ticks, magnetic “clack” on reconnection (12), checkbox clicks (15), odometer ticks (19). No explosions, no stock “whooshes” louder than the voice.'],
    ['Licences', 'Use royalty-free or self-composed music; keep the licence page (the AI chats PDF and credits may need it). Do not use commercial songs.'],
    ['Captions', 'Burn in no captions, but export an .srt of the voiceover for accessibility.'],
    ['Loudness', 'Master at about −16 LUFS (web) with true peak below −1 dB.'],
    ['Export', 'MP4 (H.264), 1920×1080, 24 or 30 fps, AAC 192 kbps. Check the file plays from the start with sound, and that the length is 2:00 (do not exceed it).'],
  ], { size: 17 }),
  gap(40),
  h2('Recording setup for every real capture (clips 6–19)'),
  bullet('**Wake the backend first.** Open https://maymourad.github.io/DOMINO/ a few minutes earlier (the free-tier service sleeps when idle and the first request can take 30–60 s). If an “API offline” indicator shows, stop and retry; never record the offline view as solver output.'),
  bullet('**Clean screen.** 1920×1080 window, browser toolbars hidden (F11), a clean browser profile with no bookmarks, extensions, other tabs or notifications; normal motion enabled (not “reduce motion”); 60 fps so clips can be slowed in the editor.'),
  bullet('**Same state, one session.** Start from Network → “Reset household”, then run the flow in the order of clips 6 → 19 so the household, scenario and plan are consistent. Move the cursor slowly and deliberately; click once per action.'),
  bullet('**Do a dry run first**, especially for the typed sentence in clip 8 and the benchmark run in clip 19; keep a spare take of each.'),
  h2('Assembly order'),
  bullet('**1.** Generate the character sheet (Prompt 0), then stills for clips 1, 2, 3, 4, 10 (first 3 s), 13, 18 and 21, and the graphic plates for clips 5, 11, 20, 22 and 23.'),
  bullet('**2.** Animate each still (image-to-video), trim to exactly 5 s (or 3 s for clip 10).'),
  bullet('**3.** Record the real captures (clips 6, 7, 8, 9, 10 last 2 s, 12, 14, 15, 16, 17, 19) following each capture script, in one session so the household state is consistent.'),
  bullet('**4.** Add the motion graphics and on-screen text in the editor; add the QR tile on clip 24 from `presentation/shots/qr.png`.'),
  bullet('**5.** Record or generate the voiceover, cut each line to its clip, lay in the music on the 96 BPM grid, mix, export, and check the claim table below before submitting.'),
)

const claims = [
  ['14:30 – 18:00 unavailable', 'Clip 3', 'Ledger row 1; fixture `amina.json`', 'Fictional household, one simulated day'],
  ['4 directly affected, 2 indirectly, 3 levels deep', 'Clip 9', 'Ledger row 2; `live_flagship.json`', 'Single scenario'],
  ['Nine-year-old; pickup enables “Yusuf arrived home”', 'Clip 10', 'Ledger rows 1–3', 'Fictional dependent'],
  ['56 candidate arrangements', 'Clip 11', 'Ledger row 5', 'After static filtering, flagship run'],
  ['Pickup, groceries → Khalid; homework → Noura; dinner unchanged', 'Clip 12', 'Ledger row 1; recovery result', 'Flagship scenario only'],
  ['18 rules · 56/56 checks · 0 hard violations', 'Clip 14', 'Ledger row 7', 'Checks the model’s declared rules, not real-world safety'],
  ['Approval needs a person; nobody is notified', 'Clip 15', 'Approval dialog; `DEMO_GUIDE.md`', 'Approval is a simulation receipt'],
  ['Khalid also unavailable → partial plan, 33 % coverage', 'Clips 16–17', 'Ledger row 11', 'Depends on declared permissions'],
  ['51 cases · 46 passed · 0 failed · 5 not run', 'Clip 19', 'Ledger row 15; `live_benchmark.json`', 'Hand-written cases; 5 not run (state it on screen)'],
  ['UAE Year of Family', 'Clip 21', 'Ledger row 21; u.ae reference', 'Theme only, no endorsement'],
]
kids.push(
  h1('7  Claim check before export'),
  table([3300, 900, 2800, 2864], ['Claim in the video', 'Clip', 'Source', 'Limitation to respect'], claims, { size: 16 }),
  gap(60),
  h2('Open decisions for you'),
  bullet('**Voice:** a team member’s voice or a synthetic voice? **Tone:** keep this warm and calm, or more energetic?'),
  bullet('**Team photo:** a real photo for clip 22, or the typographic credit as written?'),
  bullet('**Real footage:** I can record clips 6–19 automatically from the live site at 1080p/60 fps, and render the overlays, QR end card and timeline, leaving only the AI scenes and the voiceover to you. Say so if you want that.'),
)

const doc = new Document({
  creator: 'May Ahmed Mourad, Shamsa Faris Almazrouei, Fatima Mohamed Almazrouei',
  title: 'DOMINO — Video Production Pack',
  description: '24-clip, two-minute video plan with image prompts, animation prompts and voiceover',
  styles: {
    default: { document: { run: { font: FONT, size: BODY } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 28, bold: true, color: NAVY, font: FONT }, paragraph: { outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 22, bold: true, color: COBALT, font: FONT }, paragraph: { outlineLevel: 1 } },
    ],
  },
  numbering: { config: [{ reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 300, hanging: 220 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 900, bottom: 950, left: 1021, right: 1021, footer: 450 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, border: { top: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 4 } }, children: [
      new TextRun({ text: 'DOMINO — Video Production Pack · page ', size: 15, color: GREY, font: FONT }), new TextRun({ children: [PageNumber.CURRENT], size: 15, color: GREY, font: FONT }),
      new TextRun({ text: ' of ', size: 15, color: GREY, font: FONT }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 15, color: GREY, font: FONT })] })] }) },
    children: kids,
  }],
})
const out = path.join(__dirname, 'DOMINO_Video_Production_Pack.docx')
Packer.toBuffer(doc).then((b) => { fs.writeFileSync(out, b); console.log('wrote', out, b.length, 'bytes; VO words', vowords, kinds) })

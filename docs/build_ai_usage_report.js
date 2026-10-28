// Builds DOMINO_AI_Usage_Report.docx in the DOMINO / deck palette (Midnight Navy, Cobalt, Slate, Soft Blue, Ice Blue).
const fs = require('fs')
const path = require('path')
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  AlignmentType, Footer, PageNumber, LevelFormat, TableLayoutType, VerticalAlign,
} = require('docx')

const NAVY = '102B4E', COBALT = '255E99', SLATE = '47789F', SOFT = '82B2D6', ICE = 'EAF3FA', GREY = '4A5968', LINE = 'B9CBDB', WHITE = 'FFFFFF'
const FONT = 'Calibri', MONO = 'Consolas', BODY = 19, CW = 9864

function runs(s, base = {}) {
  const out = []
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|==[^=]+==)/g
  let last = 0, m
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(new TextRun({ text: s.slice(last, m.index), ...base }))
    const t = m[0]
    if (t.startsWith('**')) out.push(new TextRun({ text: t.slice(2, -2), bold: true, ...base }))
    else if (t.startsWith('==')) out.push(new TextRun({ text: t.slice(2, -2), shading: { type: ShadingType.CLEAR, fill: 'FFF200', color: 'auto' }, ...base }))
    else if (t.startsWith('`')) out.push(new TextRun({ text: t.slice(1, -1), font: MONO, size: (base.size || BODY) - 1, color: NAVY }))
    else out.push(new TextRun({ text: t.slice(1, -1), italics: true, ...base }))
    last = m.index + t.length
  }
  if (last < s.length) out.push(new TextRun({ text: s.slice(last), ...base }))
  return out
}
const para = (s, o = {}) => new Paragraph({ spacing: { after: 90, line: 252 }, alignment: AlignmentType.LEFT, ...o, children: runs(s) })
const h1 = (n, s) => new Paragraph({
  heading: 'Heading1', keepNext: true, spacing: { before: 150, after: 70 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: COBALT, space: 2 } },
  children: [new TextRun({ text: n + '  ', bold: true, size: 26, color: SOFT, font: FONT }), new TextRun({ text: s, bold: true, size: 26, color: NAVY, font: FONT })],
})
const bullet = (s) => new Paragraph({ numbering: { reference: 'bul', level: 0 }, spacing: { after: 50, line: 250 }, children: runs(s) })
const gap = (n = 60) => new Paragraph({ spacing: { after: n }, children: [] })

const cb = { style: BorderStyle.SINGLE, size: 4, color: LINE }
const borders = { top: cb, bottom: cb, left: cb, right: cb }
const none = { style: BorderStyle.NONE, size: 0, color: WHITE }
const noBorders = { top: none, bottom: none, left: none, right: none }
function cell(text, w, o = {}) {
  const size = o.size || 18
  const paras = (Array.isArray(text) ? text : [text]).map((t, i, a) => new Paragraph({
    keepNext: o.keep, spacing: { after: i < a.length - 1 ? 40 : 0, line: 238 }, alignment: o.align || AlignmentType.LEFT,
    children: runs(String(t), Object.fromEntries(Object.entries({ size, color: o.color, bold: o.bold }).filter(([, v]) => v !== undefined))),
  }))
  return new TableCell({
    width: { size: w, type: WidthType.DXA }, borders: o.borders || borders, verticalAlign: o.valign || VerticalAlign.TOP, columnSpan: o.span,
    margins: { top: o.pad || 55, bottom: o.pad || 55, left: 100, right: 100 },
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: 'auto' } : undefined, children: paras,
  })
}
function table(widths, header, rows, o = {}) {
  const size = o.size || 17
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED,
    rows: [new TableRow({ tableHeader: true, cantSplit: true, children: header.map((t, j) => cell(t, widths[j], { fill: NAVY, color: WHITE, bold: true, size, keep: true })) })]
      .concat(rows.map((r, i) => new TableRow({ cantSplit: true, children: r.map((t, j) => cell(t, widths[j], { size, fill: i % 2 ? ICE : undefined, keep: !!o.keepAll && i < rows.length - 1, bold: j === 0 && o.boldFirst })) }))),
  })
}

const kids = []

// ---- title band ----
kids.push(new Table({
  width: { size: CW, type: WidthType.DXA }, columnWidths: [CW], layout: TableLayoutType.FIXED,
  rows: [new TableRow({ children: [new TableCell({
    width: { size: CW, type: WidthType.DXA }, borders: noBorders, shading: { type: ShadingType.CLEAR, fill: NAVY, color: 'auto' },
    margins: { top: 220, bottom: 220, left: 320, right: 320 },
    children: [
      new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: 'AI USAGE REPORT', bold: true, size: 20, color: SOFT, font: FONT, characterSpacing: 40 })] }),
      new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: 'DOMINO', bold: true, size: 56, color: WHITE, font: FONT }), new TextRun({ text: '  Family Resilience Intelligence System', size: 30, color: SOFT, font: FONT })] }),
      new Paragraph({ spacing: { after: 20 }, children: runs('May Ahmed Mourad (Grade 12) · Shamsa Faris Almazrouei (Grade 12) · Fatima Mohamed Almazrouei (Grade 11)', { size: 20, color: ICE }) }),
      new Paragraph({ spacing: { after: 0 }, children: runs('ADNOC Schools — Madinat Zayed · Abu Dhabi University 6th Annual COE STEM Programming with AI Competition · AI for Family · Cycle 3 · 28 October 2026', { size: 17, color: SOFT }) }),
    ],
  })] })],
}), gap(100))

// ---- stat strip ----
const stats = [['3', 'AI tools used'], ['89', 'automated tests'], ['46 / 51', 'benchmark cases pass, 0 fail'], ['18', 'independent verifier rules']]
const sw = CW / 4
kids.push(new Table({
  width: { size: CW, type: WidthType.DXA }, columnWidths: stats.map(() => sw), layout: TableLayoutType.FIXED,
  rows: [new TableRow({ children: stats.map(([n, l], i) => new TableCell({
    width: { size: sw, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: i % 2 ? ICE : 'DCEAF6', color: 'auto' },
    borders: { top: none, bottom: { style: BorderStyle.SINGLE, size: 12, color: COBALT }, left: none, right: none }, margins: { top: 110, bottom: 90, left: 120, right: 120 },
    children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 10 }, children: [new TextRun({ text: n, bold: true, size: 40, color: NAVY, font: FONT })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: l, size: 17, color: GREY, font: FONT })] })],
  })) })],
}), gap(60))

// ---- 1 summary ----
kids.push(
  h1('1', 'Summary'),
  para('AI was used in four ways: **(1) to build** the prototype (code, tests, documentation and deployment files); **(2) as a runtime feature**, where Gemini turns a typed sentence into a proposed event that a person must confirm; **(3) to plan and draft prompts**, using ChatGPT; and **(4) to produce the submission materials**: the slide deck, the technical report, the video production pack and the footage.'),
  para('The team directed the work, supplied the competition brief and the accounts, made the project decisions and reviewed the results. Every factual statement in the deck and report is tied to a recorded run, and the limits of that evidence are stated alongside it.'),

  h1('2', 'Where AI sits inside DOMINO'),
  para('Language AI has one narrow job in the product. It never schedules, validates or approves anything.', { spacing: { after: 70 } }),
)
const steps = [['1  Describe', 'AI proposes an event', COBALT], ['2  Resolve', 'code checks names and times', SLATE], ['3  Optimize', 'CP-SAT finds assignments', SLATE], ['4  Verify', 'independent 18-rule check', SLATE], ['5  Approve', 'a person decides', NAVY]]
const fw = Math.floor(CW / 5)
kids.push(new Table({
  width: { size: fw * 5, type: WidthType.DXA }, columnWidths: steps.map(() => fw), layout: TableLayoutType.FIXED,
  rows: [new TableRow({ children: steps.map(([a, b, c]) => new TableCell({
    width: { size: fw, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: c, color: 'auto' },
    borders: { top: { style: BorderStyle.SINGLE, size: 8, color: WHITE }, bottom: { style: BorderStyle.SINGLE, size: 8, color: WHITE }, left: { style: BorderStyle.SINGLE, size: 12, color: WHITE }, right: { style: BorderStyle.SINGLE, size: 12, color: WHITE } },
    margins: { top: 100, bottom: 100, left: 90, right: 90 }, verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [new TextRun({ text: a, bold: true, size: 20, color: WHITE, font: FONT })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: b, size: 16, color: ICE, font: FONT })] })],
  })) })],
}), gap(40))

// ---- 3 tools ----
kids.push(
  h1('3', 'AI tools used'),
  table([2150, 1750, 5964], ['Tool', 'Where and when', 'What it did'], [
    ['**Claude Code**\nClaude Sonnet 5.5, in the Claude desktop app'.split('\n'), 'One working session, 27–28 Oct 2026 (with context continuations)',
      'Wrote the backend, frontend, tests and documentation; deployed to GitHub Pages and Render; ran live tests; built the 30-slide deck, evidence ledger and oral path; wrote the six-page technical report; wrote the video production pack and recorded the real prototype footage; fixed defects found along the way.'],
    ['**ChatGPT** (OpenAI)\nShared chat “Assess DOMINO Competition Alignment”'.split('\n'), '27–28 Oct 2026',
      'Assessed the project against the competition brief, drafted the “Additional Visual and Interaction Requirements” addendum and the master prompt for the 30-slide deck, and inspected the published prototype for that purpose. The prompts were then given to Claude Code.'],
    ['**Google Gemini API**\n`gemini-3.5-flash-lite` via `google-genai`'.split('\n'), 'Runtime, from 27 Oct 2026',
      'Natural-language interpretation inside the prototype only; also used to run two 12-sentence interpretation tests (annotated 12/12, held-out 11/12). It is not used to write code, schedule or approve plans.'],
    ['**AI image and video generation**', 'Video production, October 2026',
      ['Eight photographic scenes of the fictional family for the two-minute video. Tool and date: ==______________________==']],
  ], { size: 17 }),

  h1('4', 'What AI produced, and how it was checked'),
  table([2300, 3100, 4464], ['Area', 'AI contribution', 'Checks that were run'], [
    ['Prototype code\n(about 2,800 lines of Python, about 3,300 of TypeScript)'.split('\n'), 'Written by Claude Code from the team’s master prompt', '63 backend tests, 11 frontend tests, 15 end-to-end tests, GitHub Actions CI, live smoke tests against the hosted site; every plan re-checked by an independent 18-rule verifier'],
    ['Data\n(3 fictional households, 51 benchmark cases)'.split('\n'), 'Authored by Claude Code', 'Schema and integrity validation; baselines verified; hand-written expectations declared as a limitation'],
    ['Slide deck\n(30 slides, PPTX and PDF)'.split('\n'), 'Built by Claude Code from real screenshots of the published site', 'Evidence ledger of 22 claims with source and limitation; 30 slides, 30 speaker notes; secrets scan'],
    ['Technical report\n(six pages, Word and PDF)'.split('\n'), 'Written by Claude Code', 'Numbers taken from recorded runs of 28 Oct 2026; page count confirmed in Word; secrets scan'],
    ['Video\n(24 clips of 5 seconds)'.split('\n'), 'Production pack, scripts, real footage and motion graphics by Claude Code; photographic scenes generated with an AI image and video tool', 'Footage recorded from the live site; a claim-check table ties every figure in the video to the evidence ledger'],
  ], { size: 17, boldFirst: false }),

  h1('5', 'Human direction and oversight'),
  bullet('The team supplied the competition brief, decided to make the repository public and to host the API on Render, created the accounts and the Gemini key, and reviewed the deck before work moved on.'),
  bullet('**Safety by design.** The language model only proposes an event; every event starts unconfirmed; deterministic code resolves names and times; the CP-SAT optimizer finds assignments; an independent verifier checks them; a person approves. When no valid plan exists, the system reports the task as uncovered instead of inventing an assignee.'),
  bullet('**Honest reporting.** The report states that a greedy baseline ties DOMINO on critical-task coverage, that 5 of 51 benchmark cases were not run, that the rule parser’s held-out score is not independent, and that no study with families was done.'),

  h1('6', 'Mistakes found and corrected'),
  para('AI-written work contained mistakes. They were found by review or live testing and then fixed:'),
  bullet('an unfair baseline comparison (the greedy baseline ignored user rejections);'),
  bullet('a graph view that did nothing because node sizes were not fed back; an alias “car” that matched two resources;'),
  bullet('a model setting that held a project identifier instead of a model name (now detected and reported); provider errors misread as rate limits;'),
  bullet('a navigation race after a hosted household loaded; a scenario clock that was shown but not sent;'),
  bullet('a wrong source cited in the evidence ledger; outdated statements and garbled characters in the repository documents (updated 28 Oct 2026);'),
  bullet('an approval dialog that opened in the top-left corner, found while recording the video and fixed on 28 Oct 2026 (commit `379d09a`).'),

  h1('7', 'Data, privacy and security'),
  bullet('Only fictional household data is used. Nothing about real families is stored, and only fictional household text is sent to Gemini.'),
  bullet('The API key exists only in the server’s environment settings. It is not in the browser code, the repository, the deck, the report or the video; the published JavaScript was scanned for key patterns.'),
  bullet('Private account identifiers were kept out of every deliverable. Where they appear in a chat record, they are replaced by visible `[REDACTED]` markers.'),

  h1('8', 'Third-party material and attribution'),
  para('Libraries are permissively licensed and credited in `docs/references/ATTRIBUTION.md`: React Flow (MIT), Motion (MIT), Google OR-Tools (Apache-2.0), google-genai (Apache-2.0), FastAPI, Pydantic, NetworkX, lucide-react, and the Manrope and IBM Plex Mono fonts (SIL Open Font Licence). Spline Community and Recent.design were visual inspiration only; no code, scene or artwork was copied. The UAE Year of Family 2026 is referenced as a theme only and does not imply endorsement.'),

  h1('9', 'Chat records'),
  para('The genuine AI chats are submitted as a separate PDF. They are not reconstructed or edited, except that private identifiers are replaced by visible `[REDACTED]` markers. The sources are the Claude Code session, exported from the project owner’s computer, and the shared ChatGPT chat. `AI_DEVELOPMENT_LOG.md` in the repository indexes the sessions by date, tool, task and decision.'),

  h1('10', 'Limits of AI use'),
  para('AI output can be wrong. Natural-language extraction needs human confirmation; recovery plans are checked only against the rules the model declares; and no claim is made about real-world safety or wellbeing outcomes. All results come from fictional households and one simulated day.'),
)

const doc = new Document({
  creator: 'May Ahmed Mourad, Shamsa Faris Almazrouei, Fatima Mohamed Almazrouei',
  title: 'DOMINO — AI Usage Report',
  description: 'How AI was used to build, run and document DOMINO, and how it was checked',
  styles: {
    default: { document: { run: { font: FONT, size: BODY } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 26, bold: true, color: NAVY, font: FONT }, paragraph: { outlineLevel: 0 } },
    ],
  },
  numbering: { config: [{ reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 320, hanging: 230 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 740, bottom: 880, left: 1021, right: 1021, footer: 420 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, border: { top: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 4 } }, children: [
      new TextRun({ text: 'DOMINO — AI usage report · ADU COE STEM Programming with AI Competition 2026 · page ', size: 15, color: GREY, font: FONT }),
      new TextRun({ children: [PageNumber.CURRENT], size: 15, color: GREY, font: FONT }),
      new TextRun({ text: ' of ', size: 15, color: GREY, font: FONT }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 15, color: GREY, font: FONT })] })] }) },
    children: kids,
  }],
})
const out = path.join(__dirname, 'DOMINO_AI_Usage_Report.docx')
Packer.toBuffer(doc).then((b) => { fs.writeFileSync(out, b); console.log('wrote', out, b.length, 'bytes') })

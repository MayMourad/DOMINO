// Renders the report's diagrams and charts (HTML/SVG -> PNG through Chromium so fonts match the document).
// Every number in the charts is read from presentation/evidence/live_benchmark.json (the recorded run).
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const here = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.join(here, '..', 'frontend', 'package.json'))
const { chromium } = require('@playwright/test')
const OUT = path.join(here, 'figs')
fs.mkdirSync(OUT, { recursive: true })
const bench = JSON.parse(fs.readFileSync(path.join(here, '..', 'presentation', 'evidence', 'live_benchmark.json'), 'utf8')).suite
const bc = bench.baselineComparison

const NAVY = '#102B4E', COBALT = '#255E99', SLATE = '#47789F', SOFT = '#82B2D6', ICE = '#EAF3FA', RED = '#B4414A', GREY = '#5B6B7B'

const box = (x, y, w, h, fill, stroke, rx = 10, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="2" ${extra}/>`
const text = (x, y, s, size = 22, color = NAVY, weight = 400, anchor = 'middle', font = 'Calibri') =>
  `<text x="${x}" y="${y}" font-family="${font}, 'Segoe UI', sans-serif" font-size="${size}" fill="${color}" font-weight="${weight}" text-anchor="${anchor}">${s}</text>`
const lines = (x, y, arr, size = 22, color = NAVY, weight = 400, lh = 27) => arr.map((s, i) => text(x, y + i * lh, s, size, color, i === 0 ? 700 : weight)).join('')
const arrow = (x1, y1, x2, y2, color = COBALT, dash = '') =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="3" ${dash ? `stroke-dasharray="${dash}"` : ''} marker-end="url(#ah-${color.slice(1)})"/>`
const marker = (c) => `<marker id="ah-${c.slice(1)}" markerUnits="userSpaceOnUse" markerWidth="14" markerHeight="14" refX="12" refY="7" orient="auto"><path d="M0,1 L13,7 L0,13 z" fill="${c}"/></marker>`

// ---------- Figure 1: architecture ----------
const W1 = 1810, H1 = 450
const fig1 = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W1}" height="${H1}" viewBox="0 0 ${W1} ${H1}">
<defs>${marker(COBALT)}${marker(GREY)}${marker(SLATE)}</defs>
<rect width="${W1}" height="${H1}" fill="#fff"/>
${box(20, 20, 540, 410, ICE, SOFT, 16)}
${text(290, 58, 'Browser (GitHub Pages)', 26, NAVY, 700)}
${text(290, 86, 'React 19 · TypeScript · Vite', 20, GREY)}
${box(50, 112, 480, 62, '#fff', SLATE)}${text(290, 151, 'Seven screens (Launch … Evaluation Lab)', 21)}
${box(50, 190, 480, 78, '#fff', SLATE)}${lines(290, 220, ['Zustand store', 'versions · abort · stale-response discard'], 20, GREY)}
${box(50, 284, 480, 62, '#fff', SLATE)}${text(290, 323, 'React Flow graph · Gantt · cascade scrubber', 21)}
${box(50, 366, 480, 44, NAVY, NAVY, 8)}${text(290, 396, 'Human review and approval', 21, '#fff', 700)}

${box(620, 20, 1170, 410, '#F6FAFD', SOFT, 16)}
${text(1205, 58, 'FastAPI service (Render, Docker) · Python 3.12 · /v1 REST', 26, NAVY, 700)}
${box(645, 76, 200, 40, '#fff', GREY, 8, 'stroke-dasharray="7 5"')}${text(745, 103, 'Gemini API (optional)', 19, GREY)}
${box(870, 76, 200, 40, '#fff', GREY, 8)}${text(970, 103, 'Fixtures (JSON)', 19, GREY)}
${box(1320, 76, 200, 40, '#fff', GREY, 8)}${text(1420, 103, 'OR-Tools CP-SAT', 19, GREY)}
${arrow(745, 118, 745, 148, GREY, '6 5')}${arrow(970, 118, 970, 148, GREY)}${arrow(1420, 118, 1420, 148, GREY)}
${[['Interpreter', 'rule parser +', 'Gemini proposal'], ['Dependency graph', 'impact simulation', 'causal paths'], ['Candidate generation', '(task, member, start,', 'resources) · filters'], ['CP-SAT optimizer', 'lexicographic', 'passes · 3 strategies']]
  .map((b, i) => { const x = 645 + i * 225; return box(x, 152, 200, 112, '#fff', COBALT) + lines(x + 100, 187, b, 20, GREY, 400, 26) + (i < 3 ? arrow(x + 202, 208, x + 223, 208) : '') }).join('')}
${arrow(1547, 208, 1568, 208)}
${box(1570, 152, 200, 112, '#FDF3F3', RED, 10, 'stroke-dasharray="8 6"')}${lines(1670, 187, ['Independent verifier', '18 rules · no imports', 'from the optimizer'], 20, GREY, 400, 26)}
${box(645, 290, 360, 60, '#fff', SLATE)}${lines(825, 316, ['Domain models + validation', 'Pydantic · hashes · 409 on stale'], 19, GREY, 400, 24)}
${box(1030, 290, 340, 60, '#fff', SLATE)}${lines(1200, 316, ['Explanations', 'from computed records only'], 19, GREY, 400, 24)}
${box(1395, 290, 375, 60, '#fff', SLATE)}${lines(1582, 316, ['Evaluation harness', '51 cases · baselines · metrics'], 19, GREY, 400, 24)}
${box(645, 368, 1125, 44, '#fff', SLATE)}${text(1207, 396, 'Safeguards: server-side key · CORS allow-list · 512 KB limit · per-IP rate limits · bounded solver concurrency · no stack traces', 19, GREY)}

${arrow(562, 150, 616, 150)}${text(589, 138, 'HTTPS', 16, GREY)}
${arrow(616, 330, 562, 330, SLATE)}${text(589, 354, 'JSON', 16, GREY)}
</svg>`

// ---------- Figure 3: baseline comparison ----------
const panels = [
  { title: 'Mean weighted coverage (%)', max: 100, unit: '%', data: [['DOMINO', bc.domino.meanWeightedCoverage * 100, COBALT], ['Greedy', bc.greedy.meanWeightedCoverage * 100, SOFT], ['No recovery', bc.noRecovery.meanWeightedCoverage * 100, '#B8C4D0']], fmt: (v) => v.toFixed(1) },
  { title: 'Cases with an uncovered critical task (of ' + bc.cases + ')', max: 21, unit: '', data: [['DOMINO', bc.domino.casesWithUncoveredCritical, COBALT], ['Greedy', bc.greedy.casesWithUncoveredCritical, SOFT], ['No recovery', bc.noRecovery.casesWithUncoveredCritical, '#B8C4D0']], fmt: (v) => String(v) },
  { title: 'Mean reassignments per case', max: 4, unit: '', data: [['DOMINO', bc.domino.meanChanges, COBALT], ['Greedy', bc.greedy.meanChanges, SOFT], ['No recovery', bc.noRecovery.meanChanges, '#B8C4D0']], fmt: (v) => v.toFixed(2) },
]
const W3 = 1810, H3 = 400, pw = 560, gap = 45
const fig3 = `<svg xmlns="http://www.w3.org/2000/svg" width="${W3}" height="${H3}" viewBox="0 0 ${W3} ${H3}"><rect width="${W3}" height="${H3}" fill="#fff"/>
${panels.map((p, i) => {
  const x0 = 30 + i * (pw + gap), top = 80, base = 330, bh = base - top
  const bw = 130, step = 175, off = (pw - 3 * step + (step - bw)) / 2
  return text(x0 + pw / 2, 38, p.title, 23, NAVY, 700) +
    `<line x1="${x0}" y1="${base}" x2="${x0 + pw}" y2="${base}" stroke="#9AA9B8" stroke-width="2"/>` +
    p.data.map(([n, v, c], j) => {
      const h = Math.max(2, (v / p.max) * bh), x = x0 + off + j * step
      return `<rect x="${x}" y="${base - h}" width="${bw}" height="${h}" rx="5" fill="${c}"/>` + text(x + bw / 2, base - h - 10, p.fmt(v), 24, NAVY, 700) + text(x + bw / 2, base + 32, n, 21, GREY)
    }).join('')
}).join('')}</svg>`

const browser = await chromium.launch()
const ctx = await browser.newContext({ deviceScaleFactor: 1.5 })
const page = await ctx.newPage()
for (const [name, svg, w, h] of [['fig1_architecture', fig1, W1, H1], ['fig3_baselines', fig3, W3, H3]]) {
  await page.setViewportSize({ width: w, height: h })
  await page.setContent(`<html><body style="margin:0;background:#fff">${svg}</body></html>`)
  await page.screenshot({ path: path.join(OUT, name + '.png'), clip: { x: 0, y: 0, width: w, height: h } })
  console.log('wrote', name)
}
await browser.close()

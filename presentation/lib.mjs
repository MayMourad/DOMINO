// Shared design system + diagram helpers for the DOMINO deck (all diagrams are native, editable PowerPoint objects).
import pptxgen from 'pptxgenjs'

export const C = {
  NAVY: '102B4E', COBALT: '255E99', SLATE: '47789F', SOFT: '82B2D6', ICE: 'EAF3FA',
  INK: '1B2533', MUTED: '5B6B7F', WHITE: 'FFFFFF', LINE: 'D3DDE8',
  WARN: 'B7791F', WARNBG: 'FBF1DC', BAD: 'A23A3D', BADBG: 'F8E6E6', OK: '2B7557', OKBG: 'E2F2EA',
  DARK2: '17375F', DARK3: '1F4672',
}
export const F = { sans: 'Calibri', mono: 'Consolas' }
export const W = 13.333
export const H = 7.5

export const THEME = {
  name: 'DOMINO', headFontFace: F.sans, bodyFontFace: F.sans,
  colors: { dk1: C.INK, lt1: C.WHITE, dk2: C.NAVY, lt2: C.ICE, accent1: C.COBALT, accent2: C.SLATE, accent3: C.SOFT, accent4: C.WARN, accent5: C.OK, accent6: C.BAD, hlink: C.COBALT, folHlink: C.SLATE },
}

export const pres = new pptxgen()
pres.layout = 'LAYOUT_WIDE'
pres.author = 'May Ahmed Mourad, Shamsa Faris Almazrouei, Fatima Mohamed Almazrouei'
pres.title = 'DOMINO — Family Resilience Intelligence System'
pres.subject = '6th Annual COE STEM Programming with AI Competition — AI for Family'
pres.company = 'ADNOC Schools — Madinat Zayed'

const footer = (color) => ({ text: { text: 'DOMINO  ·  Family Resilience Intelligence System', options: { x: 0.6, y: 7.1, w: 7, h: 0.26, fontFace: F.sans, fontSize: 10, color, margin: 0 } } })
pres.defineSlideMaster({
  title: 'LIGHT', background: { color: C.WHITE },
  objects: [footer(C.SLATE), { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.62, w: 12.1, h: 0.8, fontFace: F.sans, fontSize: 32, bold: true, color: C.NAVY, valign: 'top', align: 'left', margin: 0 }, text: '' } }],
  slideNumber: { x: 11.9, y: 7.1, w: 0.85, h: 0.26, fontFace: F.mono, fontSize: 10, color: C.SLATE, align: 'right' },
})
pres.defineSlideMaster({
  title: 'ICE', background: { color: C.ICE },
  objects: [footer(C.SLATE), { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.62, w: 12.1, h: 0.8, fontFace: F.sans, fontSize: 32, bold: true, color: C.NAVY, valign: 'top', align: 'left', margin: 0 }, text: '' } }],
  slideNumber: { x: 11.9, y: 7.1, w: 0.85, h: 0.26, fontFace: F.mono, fontSize: 10, color: C.SLATE, align: 'right' },
})
pres.defineSlideMaster({
  title: 'DARK', background: { color: C.NAVY },
  objects: [footer(C.SOFT), { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.62, w: 12.1, h: 0.8, fontFace: F.sans, fontSize: 32, bold: true, color: C.WHITE, valign: 'top', align: 'left', margin: 0 }, text: '' } }],
  slideNumber: { x: 11.9, y: 7.1, w: 0.85, h: 0.26, fontFace: F.mono, fontSize: 10, color: C.SOFT, align: 'right' },
})
pres.defineSlideMaster({
  title: 'COVER', background: { color: C.NAVY },
  objects: [], slideNumber: { x: 11.9, y: 7.1, w: 0.85, h: 0.26, fontFace: F.mono, fontSize: 10, color: C.SOFT, align: 'right' },
})

let nth = 0
let currentSection
export const act = (title) => { currentSection = title; pres.addSection({ title }) }
export function slide(layout, { kicker, title, notes, section }) {
  const s = pres.addSlide({ masterName: layout, sectionTitle: section ?? currentSection })
  nth++
  const dark = layout === 'DARK' || layout === 'COVER'
  if (kicker) s.addText(kicker.toUpperCase(), { x: 0.6, y: 0.3, w: 10, h: 0.26, fontFace: F.mono, fontSize: 11, color: dark ? C.SOFT : C.SLATE, charSpacing: 2, isTextBox: true, margin: 0, objectName: 'Kicker' })
  if (title) s.addText(title, { placeholder: 'title' })
  if (notes) s.addNotes(notes)
  s._dark = dark
  return s
}
export const count = () => nth

// ---------------------------------------------------------------- primitives
export function T(s, text, x, y, w, h, o = {}) {
  s.addText(text, { x, y, w, h, fontFace: F.sans, fontSize: 14, color: C.INK, margin: 0, valign: 'top', isTextBox: true, ...o })
}
export const mono = (s, text, x, y, w, h, o = {}) => T(s, text, x, y, w, h, { fontFace: F.mono, fontSize: 12, ...o })
export function source(s, text, dark = false) {
  T(s, text, 0.6, 6.72, 12.1, 0.3, { fontSize: 10, color: dark ? C.SOFT : C.MUTED, italic: true, objectName: 'Source' })
}
export function box(s, x, y, w, h, o = {}) {
  s.addShape(o.round === false ? pres.shapes.RECTANGLE : pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h, fill: { color: o.fill ?? C.ICE, transparency: o.transparency ?? 0 }, line: o.line ? { color: o.line, width: o.lw ?? 1, dashType: o.dash } : { type: 'none' },
    rectRadius: o.round === false ? undefined : (o.radius ?? 0.08), shadow: o.shadow ? { type: 'outer', color: '000000', opacity: 0.12, blur: 8, offset: 2, angle: 90 } : undefined, objectName: o.name,
  })
}
/** Shape with text inside it (stays one editable object). */
export function tbox(s, runs, x, y, w, h, o = {}) {
  s.addText(runs, {
    shape: o.shape ?? pres.shapes.ROUNDED_RECTANGLE, x, y, w, h, fill: { color: o.fill ?? C.ICE, transparency: o.transparency ?? 0 }, line: o.line ? { color: o.line, width: o.lw ?? 1, dashType: o.dash } : { type: 'none' },
    rectRadius: o.shape ? undefined : (o.radius ?? 0.08), fontFace: F.sans, fontSize: o.fontSize ?? 12, color: o.color ?? C.INK, valign: o.valign ?? 'middle', align: o.align ?? 'left', margin: o.margin ?? [4, 8, 4, 8],
    objectName: o.name,
  })
}
export function edge(s, x1, y1, x2, y2, o = {}) {
  s.addShape(pres.shapes.LINE, {
    x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), flipH: x2 < x1, flipV: y2 < y1,
    line: { color: o.color ?? C.SLATE, width: o.w ?? 1.5, dashType: o.dash, endArrowType: o.arrow ? 'triangle' : undefined },
  })
}
export function pill(s, text, x, y, w, h, o = {}) {
  tbox(s, [{ text, options: { bold: o.bold ?? true } }], x, y, w, h, { shape: pres.shapes.ROUNDED_RECTANGLE, radius: 0.5, fill: o.fill ?? C.ICE, line: o.line, fontSize: o.fontSize ?? 11, color: o.color ?? C.NAVY, align: 'center', margin: [0, 6, 0, 6] })
}
export function stat(s, big, label, x, y, w, o = {}) {
  T(s, big, x, y, w, 0.85, { fontSize: o.size ?? 54, bold: true, color: o.color ?? C.NAVY, fontFace: o.mono ? F.mono : F.sans })
  T(s, label, x, y + (o.gap ?? 0.88), w, 0.6, { fontSize: o.lsize ?? 13, color: o.lcolor ?? C.MUTED })
}
export function shot(s, path, x, y, w, h, alt) {
  s.addImage({ path, x, y, w, h, altText: alt })
  s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { type: 'none' }, line: { color: C.LINE, width: 0.75 } })
}
export function callout(s, n, x, y, o = {}) {
  tbox(s, [{ text: String(n), options: { bold: true } }], x, y, 0.34, 0.34, { shape: pres.shapes.OVAL, fill: o.fill ?? C.COBALT, color: C.WHITE, align: 'center', margin: 0, fontSize: 12 })
}

// ---------------------------------------------------------------- time helpers / gantt
export const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
/** rows: [{label, sub, bars:[{s,e,text,fill,color,dash}], shade:[{s,e}], away:[{s,e}]}] */
export function gantt(s, x, y, w, rows, o = {}) {
  const t0 = o.t0 ?? 870, t1 = o.t1 ?? 1140, lab = o.labelW ?? 1.35, rh = o.rowH ?? 0.62, dark = !!o.dark
  const gx = x + lab, gw = w - lab
  const px = (m) => gx + ((m - t0) / (t1 - t0)) * gw
  for (let m = Math.ceil(t0 / 30) * 30; m <= t1; m += 30) {
    mono(s, fmt(m), px(m) - 0.3, y, 0.6, 0.22, { fontSize: 10, align: 'center', color: dark ? C.SOFT : C.MUTED })
    edge(s, px(m), y + 0.26, px(m), y + 0.3 + rows.length * rh, { color: dark ? C.DARK3 : C.LINE, w: 0.5 })
  }
  rows.forEach((r, i) => {
    const ry = y + 0.3 + i * rh
    T(s, r.label, x, ry + 0.06, lab - 0.1, 0.28, { fontSize: o.labelSize ?? 14, bold: true, color: r.labelColor ?? (dark ? C.WHITE : C.NAVY) })
    if (r.sub) T(s, r.sub, x, ry + 0.34, lab - 0.1, 0.22, { fontSize: 10, color: dark ? C.SOFT : C.MUTED })
    for (const a of r.shade ?? []) box(s, px(a.s), ry + 0.04, px(a.e) - px(a.s), rh - 0.08, { fill: dark ? C.DARK2 : C.ICE, round: false })
    for (const a of r.away ?? []) box(s, px(a.s), ry + 0.04, px(a.e) - px(a.s), rh - 0.08, { fill: dark ? '3A1B22' : C.BADBG, line: dark ? 'E08A8E' : C.BAD, dash: 'dash', lw: 0.75, round: false })
    for (const b of r.bars ?? []) tbox(s, [{ text: b.text, options: { bold: true } }], px(b.s), ry + 0.08, Math.max(0.3, px(b.e) - px(b.s)), rh - 0.16, { fill: b.fill ?? C.COBALT, color: b.color ?? C.WHITE, line: b.line, dash: b.dash, fontSize: b.size ?? 11, margin: [0, 4, 0, 4], align: 'left', radius: 0.06 })
  })
  return { px, height: 0.3 + rows.length * rh }
}

// ---------------------------------------------------------------- household network (native diagram)
const NODE = {
  person: { fill: C.COBALT, color: C.WHITE }, dep: { fill: C.SLATE, color: C.WHITE }, task: { fill: C.DARK2, color: C.WHITE, line: C.SOFT },
  res: { fill: C.NAVY, color: C.SOFT, line: C.SOFT, dash: 'dash' }, ms: { fill: C.NAVY, color: C.WHITE, line: C.SOFT },
}
const STATE = {
  direct: { fill: '4A2430', line: 'E08A8E', color: C.WHITE }, risk: { fill: '43361B', line: 'E6B756', color: C.WHITE }, event: { fill: '3A1B22', line: 'D98186', color: 'FFE6E6' },
  restored: { fill: '173D33', line: '6FCAA0', color: C.WHITE }, dim: { fill: '14304F', line: '2A4E7C', color: '7F9BB8' },
}
/** Amina household as a native diagram. mode: 'plain' | 'cascade' | 'recovered'. Returns nothing; draws into region (ox,oy) at scale k. */
export function aminaGraph(s, ox, oy, k, mode = 'plain', o = {}) {
  const fs = Math.max(10, Math.round(12 * k * 10) / 10)
  const ky = o.ky ?? 1
  const P = (gx, gy) => [ox + gx * k, oy + gy * k * ky]
  const nw = 2.1 * k, nh = 0.66 * k
  const owner = mode === 'recovered' ? { T01: 'P02', T02: 'P02', T03: 'P03', T04: 'P02' } : { T01: 'P01', T02: 'P01', T03: 'P01', T04: 'P02' }
  const laneX = { P01: 0, P02: 2.5, P03: 5.0 }
  const ty = { T01: 1.55, T02: 2.45, T03: 3.35, T04: 4.25 }
  const st = (id) => {
    if (mode === 'cascade') return { P01: 'direct', T01: 'direct', T02: 'direct', T03: 'direct', M01: 'risk', P04: 'risk' }[id] ?? 'dim'
    if (mode === 'recovered') return { T01: 'restored', T02: 'restored', T03: 'restored', M01: 'restored', P04: 'restored' }[id] ?? null
    return null
  }
  const style = (id, base) => { const x = st(id); return x ? STATE[x] : base }
  const nodes = {}
  const place = (id, gx, gy, label, sub, base, w = nw) => {
    const [x, y] = P(gx, gy); const sty = style(id, base)
    tbox(s, [{ text: label, options: { bold: true, fontSize: fs, breakLine: true } }, { text: sub, options: { fontFace: F.mono, fontSize: Math.max(10, fs - 1) } }], x, y, w, nh,
      { fill: sty.fill, line: sty.line, color: sty.color, dash: sty.dash, fontSize: fs, margin: [2, 6, 2, 6], name: `node-${id}` })
    nodes[id] = { x, y, w, h: nh }
  }
  // edges first so nodes sit above them
  const L = (a, b, e = {}) => {
    const A = nodes[a], B = nodes[b]; if (!A || !B) return
    edge(s, e.ax ?? A.x + A.w / 2, e.ay ?? A.y + A.h, e.bx ?? B.x + B.w / 2, e.by ?? B.y, { color: e.color ?? C.SLATE, w: e.w ?? 1.25, dash: e.dash, arrow: e.arrow })
  }
  // two passes: compute node geometry without drawing, then draw edges, then draw nodes
  const geo = (gx, gy, w = nw) => { const [x, y] = P(gx, gy); return { x, y, w, h: nh } }
  Object.assign(nodes, {
    P01: geo(laneX.P01, 0), P02: geo(laneX.P02, 0), P03: geo(laneX.P03, 0), P04: geo(7.9, 0),
    T01: geo(laneX[owner.T01], ty.T01), T02: geo(laneX[owner.T02], ty.T02), T03: geo(laneX[owner.T03], ty.T03), T04: geo(laneX[owner.T04], ty.T04),
    M01: geo(7.9, 2.35, 2.0 * k), R01: geo(10.3, 1.4, 1.9 * k), R04: geo(10.3, 2.2, 1.9 * k), R03: geo(10.3, 3.0, 1.9 * k), R02: geo(10.3, 3.8, 1.9 * k),
  })
  const dimE = mode === 'cascade' ? '2A4E7C' : C.SLATE
  for (const t of ['T01', 'T02', 'T03', 'T04']) {
    const m = owner[t]; const T_ = nodes[t], M = nodes[m]
    const hot = mode === 'cascade' && m === 'P01'
    const x = Math.min(Math.max(T_.x + T_.w / 2, M.x + 0.05), M.x + M.w - 0.05)
    edge(s, x, T_.y, x, M.y + M.h, { color: hot ? 'E08A8E' : (mode === 'recovered' && t !== 'T04' ? '6FCAA0' : dimE), w: hot ? 2 : 1.25 })
  }
  const R = (t, r, c = dimE) => { const T_ = nodes[t], R_ = nodes[r]; edge(s, T_.x + T_.w, T_.y + T_.h / 2, R_.x, R_.y + R_.h / 2, { color: c, w: 1, dash: 'dash' }) }
  R('T01', 'R01'); R('T01', 'R04'); R('T02', 'R01'); R('T03', 'R03'); R('T04', 'R02')
  const hotE = mode === 'cascade' ? 'E6B756' : (mode === 'recovered' ? '6FCAA0' : dimE)
  edge(s, nodes.T01.x + nodes.T01.w, nodes.T01.y + nodes.T01.h * 0.35, nodes.M01.x, nodes.M01.y + nodes.M01.h * 0.35, { color: hotE, w: 2, arrow: true })       // enables
  edge(s, nodes.T03.x + nodes.T03.w, nodes.T03.y + nodes.T03.h * 0.3, nodes.M01.x + nodes.M01.w * 0.3, nodes.M01.y + nodes.M01.h, { color: hotE, w: 1.5, dash: 'sysDot', arrow: true })   // depends_on
  edge(s, nodes.T01.x + nodes.T01.w, nodes.T01.y + 0.1, nodes.P04.x + 0.1, nodes.P04.y + nodes.P04.h, { color: hotE, w: 1, dash: 'sysDot', arrow: true })   // serves
  // nodes
  const draw = (id, label, sub, base, w) => place(id, 0, 0, label, sub, base, w) // geometry fixed below
  const redraw = (id, label, sub, base) => {
    const g = nodes[id]; const sty = style(id, base)
    tbox(s, [{ text: label, options: { bold: true, fontSize: fs, breakLine: true } }, { text: sub, options: { fontFace: F.mono, fontSize: Math.max(10, fs - 1) } }], g.x, g.y, g.w, g.h,
      { fill: sty.fill, line: sty.line, color: sty.color, dash: sty.dash, fontSize: fs, margin: [2, 6, 2, 6], name: `node-${id}` })
  }
  void draw
  redraw('P01', 'Amina', mode === 'recovered' ? 'unavailable' : (mode === 'cascade' ? 'out 14:30–18:00' : 'adult · 41'), NODE.person)
  redraw('P02', 'Khalid', 'adult · 43', NODE.person)
  redraw('P03', 'Noura', 'teen · 16', NODE.person)
  redraw('P04', 'Yusuf', 'dependent', NODE.dep)
  redraw('T01', 'School pickup', '14:45–15:25', NODE.task)
  redraw('T02', 'Grocery', '15:55–16:30', NODE.task)
  redraw('T03', 'Homework', '16:45–17:15', NODE.task)
  redraw('T04', 'Dinner', '17:30–18:00', NODE.task)
  redraw('M01', 'Yusuf arrived home', 'milestone M01', NODE.ms)
  redraw('R01', 'Family sedan', 'vehicle · 5', NODE.res)
  redraw('R04', 'Child restraint', 'cap 1', NODE.res)
  redraw('R03', 'Homework area', 'cap 1', NODE.res)
  redraw('R02', 'Home kitchen', 'cap 1', NODE.res)
  return nodes
}

/** Small constellation (conceptual, derived from the Amina fixture's entities) — native shapes. */
export function constellation(s, cx, cy, r, o = {}) {
  const pts = [
    ['A', 0.0, -0.55, 'p'], ['K', 0.62, -0.15, 'p'], ['N', 0.28, 0.58, 'p'], ['Y', -0.5, 0.38, 'd'],
    ['t', -0.72, -0.5, 't'], ['t', 0.95, -0.62, 't'], ['t', 0.3, -0.98, 't'], ['t', -0.2, 0.95, 't'],
    ['r', 0.98, 0.45, 'r'], ['r', -0.98, 0.0, 'r'], ['r', 0.55, 0.98, 'r'], ['m', -0.15, 0.1, 'm'],
  ].map(([l, x, y, k]) => ({ l, k, x: cx + x * r, y: cy + y * r }))
  const links = [[0, 4], [0, 6], [0, 11], [1, 5], [1, 8], [2, 7], [2, 10], [3, 9], [3, 11], [11, 1], [4, 9], [6, 5], [7, 10]]
  for (const [a, b] of links) edge(s, pts[a].x, pts[a].y, pts[b].x, pts[b].y, { color: o.line ?? C.SLATE, w: 0.9 })
  for (const p of pts) {
    const z = p.k === 'p' ? 0.52 : p.k === 'd' ? 0.4 : p.k === 't' ? 0.3 : p.k === 'r' ? 0.3 : 0.2
    const shape = p.k === 't' ? pres.shapes.DIAMOND : p.k === 'r' ? pres.shapes.HEXAGON : pres.shapes.OVAL
    tbox(s, p.k === 'p' || p.k === 'd' ? [{ text: p.l, options: { bold: true } }] : '', p.x - z / 2, p.y - z / 2, z, z,
      { shape, fill: p.k === 'p' ? C.COBALT : p.k === 'd' ? C.SLATE : p.k === 't' ? C.SOFT : p.k === 'r' ? C.NAVY : C.ICE, line: p.k === 'r' ? C.SOFT : (p.k === 'p' || p.k === 'd' ? C.ICE : undefined), color: C.WHITE, fontSize: 12, align: 'center', margin: 0 })
  }
}

export const fmt = (m: number): string => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
export const fmtRange = (a: number, b: number): string => `${fmt(a)}–${fmt(b)}`

export function parseHHMM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim())
  if (!m) return null
  const h = Number(m[1]), mi = Number(m[2])
  return h > 23 || mi > 59 ? null : h * 60 + mi
}

export const uid = (() => {
  let n = 0
  return (p: string) => `${p}-${Date.now().toString(36)}${(n++).toString(36)}`
})()

export function normalizeWindows(ws: { startMin: number; endMin: number }[]) {
  const s = [...ws].sort((a, b) => a.startMin - b.startMin)
  const out: { startMin: number; endMin: number }[] = []
  for (const w of s) {
    const last = out[out.length - 1]
    if (last && w.startMin <= last.endMin) last.endMin = Math.max(last.endMin, w.endMin)
    else out.push({ ...w })
  }
  return out
}

export function subtractWindow(ws: { startMin: number; endMin: number }[], s: number, e: number) {
  const out: { startMin: number; endMin: number }[] = []
  for (const w of normalizeWindows(ws)) {
    if (e <= w.startMin || s >= w.endMin) { out.push(w); continue }
    if (w.startMin < s) out.push({ startMin: w.startMin, endMin: s })
    if (e < w.endMin) out.push({ startMin: e, endMin: w.endMin })
  }
  return out
}

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Household } from '../../types'
import { buildEdges } from '../../lib/graph'
import { useStore } from '../../state/store'

interface P3 { id: string; kind: 'person' | 'task' | 'resource' | 'milestone'; label: string; x: number; y: number; z: number; r: number; dep?: boolean }

/** Original, restrained 3D constellation: every point is a real member, responsibility, resource or milestone of the selected household. */
function layout3d(h: Household): { pts: P3[]; edges: [string, string][] } {
  const workers = h.members.filter((m) => !m.isDependent)
  const deps = h.members.filter((m) => m.isDependent)
  const pts: P3[] = []
  const ang = new Map<string, number>()
  workers.forEach((m, i) => {
    const a = (i / workers.length) * Math.PI * 2 + 0.5
    ang.set(m.id, a)
    pts.push({ id: m.id, kind: 'person', label: m.name, x: Math.cos(a) * 150, y: Math.sin(a * 2) * 24, z: Math.sin(a) * 150, r: 15 })
  })
  deps.forEach((m, i) => pts.push({ id: m.id, kind: 'person', label: m.name, x: (i - (deps.length - 1) / 2) * 60, y: -10, z: 0, r: 11, dep: true }))
  const order = [...h.tasks].sort((a, b) => (h.baselineAssignments.find((x) => x.taskId === a.id)?.startMin ?? 0) - (h.baselineAssignments.find((x) => x.taskId === b.id)?.startMin ?? 0))
  order.forEach((t, i) => {
    const a = h.baselineAssignments.find((x) => x.taskId === t.id)
    const th = (a ? ang.get(a.memberId) : 0) ?? 0
    const rad = 245 + (i % 2) * 28
    pts.push({ id: t.id, kind: 'task', label: t.title, x: Math.cos(th + 0.14 * (i % 3 - 1)) * rad, y: (i - (order.length - 1) / 2) * 46, z: Math.sin(th + 0.14 * (i % 3 - 1)) * rad, r: 9 + (3 - t.tier) * 1.4 })
  })
  h.resources.forEach((r, i) => {
    const a = (i / h.resources.length) * Math.PI * 2
    pts.push({ id: r.id, kind: 'resource', label: r.name, x: Math.cos(a) * 62, y: 80 + (i % 2) * 36, z: Math.sin(a) * 62 - 40, r: 8 })
  })
  h.milestones.forEach((m, i) => pts.push({ id: m.id, kind: 'milestone', label: m.title, x: 0, y: -90 - i * 28, z: 40, r: 7 }))
  const ids = new Set(pts.map((p) => p.id))
  const edges = buildEdges(h, h.baselineAssignments).filter((e) => e.type !== 'requires_permission' && ids.has(e.source) && ids.has(e.target)).map((e) => [e.source, e.target] as [string, string])
  return { pts, edges }
}

export function Constellation({ h, height = 460 }: { h: Household; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduced = useStore((s) => s.reducedMotion)
  const data = useMemo(() => layout3d(h), [h])
  const [hover, setHover] = useState<string | null>(null)
  const hoverRef = useRef<string | null>(null)
  hoverRef.current = hover
  const mouse = useRef({ x: 0, y: 0, tx: 0, ty: 0, inside: false, px: 0, py: 0 })

  useEffect(() => {
    const cv = ref.current!
    const ctx = cv.getContext('2d')!
    let raf = 0, w = 0, hgt = 0
    const t0 = performance.now()
    const resize = () => {
      const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1)
      w = r.width; hgt = r.height
      cv.width = Math.round(w * dpr); cv.height = Math.round(hgt * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize); ro.observe(cv)
    const byId = new Map(data.pts.map((p) => [p.id, p]))
    const proj: Record<string, { sx: number; sy: number; s: number; z: number }> = {}
    const draw = (now: number) => {
      const t = (now - t0) / 1000
      const m = mouse.current
      m.x += (m.tx - m.x) * 0.06; m.y += (m.ty - m.y) * 0.06
      const yaw = (reduced ? 0.6 : t * 0.18) + m.x * 0.55
      const pitch = -0.28 + m.y * 0.3
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch)
      const f = 640, scale = Math.min(w, hgt * 1.5) / 640
      ctx.clearRect(0, 0, w, hgt)
      for (const p of data.pts) {
        const x1 = p.x * cy - p.z * sy, z1 = p.x * sy + p.z * cy
        const y2 = p.y * cp - z1 * sp, z2 = p.y * sp + z1 * cp
        const k = f / (f + z2 + 260)
        proj[p.id] = { sx: w / 2 + x1 * k * scale * 1.1, sy: hgt / 2 + y2 * k * scale * 1.1, s: k, z: z2 }
      }
      // edges back-to-front
      const es = data.edges.map(([a, b]) => ({ a, b, z: (proj[a].z + proj[b].z) / 2 })).sort((p, q) => q.z - p.z)
      const hv = hoverRef.current
      for (const e of es) {
        const A = proj[e.a], B = proj[e.b]
        const depth = Math.max(0.15, Math.min(1, 0.7 - e.z / 700))
        const hot = hv && (e.a === hv || e.b === hv)
        ctx.strokeStyle = hot ? `rgba(234,243,250,${0.95})` : `rgba(130,178,214,${0.16 + depth * 0.32})`
        ctx.lineWidth = hot ? 2 : 1
        ctx.beginPath(); ctx.moveTo(A.sx, A.sy)
        ctx.quadraticCurveTo((A.sx + B.sx) / 2, (A.sy + B.sy) / 2 - 18 * Math.max(A.s, B.s), B.sx, B.sy); ctx.stroke()
      }
      const ps = [...data.pts].sort((p, q) => proj[q.id].z - proj[p.id].z)
      for (const p of ps) {
        const P = proj[p.id], r = p.r * P.s * scale * 1.15
        const a = Math.max(0.35, Math.min(1, 0.95 - P.z / 600))
        const isH = hv === p.id
        ctx.save(); ctx.translate(P.sx, P.sy); ctx.globalAlpha = a
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 3.2)
        grad.addColorStop(0, isH ? 'rgba(234,243,250,0.55)' : 'rgba(130,178,214,0.22)'); grad.addColorStop(1, 'rgba(130,178,214,0)')
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(0, 0, r * 3.2, 0, 7); ctx.fill()
        ctx.lineWidth = 1.6
        if (p.kind === 'person') {
          ctx.fillStyle = p.dep ? '#47789f' : '#255e99'; ctx.strokeStyle = '#eaf3fa'
          ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.stroke()
          ctx.fillStyle = '#eaf3fa'; ctx.font = `700 ${Math.max(9, r * 0.85)}px Manrope Variable, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText(p.label.slice(0, 1).toUpperCase(), 0, 1)
        } else if (p.kind === 'task') {
          ctx.rotate(Math.PI / 4); ctx.fillStyle = '#82b2d6'; ctx.strokeStyle = '#eaf3fa'
          ctx.beginPath(); ctx.roundRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6, r * 0.28); ctx.fill(); ctx.stroke()
        } else if (p.kind === 'resource') {
          ctx.fillStyle = '#102b4e'; ctx.strokeStyle = '#82b2d6'; ctx.beginPath()
          for (let i = 0; i < 6; i++) { const q = (i / 6) * Math.PI * 2; ctx.lineTo(Math.cos(q) * r, Math.sin(q) * r) }
          ctx.closePath(); ctx.fill(); ctx.stroke()
        } else {
          ctx.fillStyle = '#eaf3fa'; ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, 7); ctx.fill()
        }
        ctx.restore()
        if (isH || p.kind === 'person') {
          ctx.globalAlpha = isH ? 1 : a * 0.8; ctx.fillStyle = '#eaf3fa'; ctx.font = `${isH ? 700 : 500} ${isH ? 13 : 11}px Manrope Variable, sans-serif`; ctx.textAlign = 'center'
          ctx.fillText(p.label, P.sx, P.sy + r + 14); ctx.globalAlpha = 1
        }
      }
      if (!reduced) raf = requestAnimationFrame(draw)
    }
    draw(performance.now())
    if (!reduced) raf = requestAnimationFrame(draw)
    const onMove = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect()
      mouse.current.tx = ((e.clientX - r.left) / r.width - 0.5) * 2
      mouse.current.ty = ((e.clientY - r.top) / r.height - 0.5) * 2
      let best: string | null = null, bd = 28
      for (const p of data.pts) { const P = proj[p.id]; if (!P) continue; const d = Math.hypot(P.sx - (e.clientX - r.left), P.sy - (e.clientY - r.top)); if (d < bd) { bd = d; best = p.id } }
      setHover(best)
      if (reduced) draw(performance.now())
    }
    const onLeave = () => { mouse.current.tx = 0; mouse.current.ty = 0; setHover(null); if (reduced) draw(performance.now()) }
    cv.addEventListener('pointermove', onMove); cv.addEventListener('pointerleave', onLeave)
    void byId
    return () => { cancelAnimationFrame(raf); ro.disconnect(); cv.removeEventListener('pointermove', onMove); cv.removeEventListener('pointerleave', onLeave) }
  }, [data, reduced])

  const summary = `Interactive 3D constellation of the ${h.name}: ${h.members.map((m) => m.name).join(', ')}; ${h.tasks.length} responsibilities; ${h.resources.length} shared resources.`
  return (
    <canvas ref={ref} role="img" aria-label={summary} style={{ width: '100%', height, display: 'block', touchAction: 'pan-y', cursor: hover ? 'pointer' : 'default' }} />
  )
}

// Records the REAL prototype footage for video clips 6-19 from the published site (no mock-ups).
// Usage: node record.mjs            -> footage/raw/*.webm      (clean takes)
//        OVERLAY=1 node record.mjs  -> footage/overlay/*.webm  (same takes with the planned on-screen text burned in)
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const here = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.join(here, '..', 'frontend', 'package.json'))
const { chromium } = require('@playwright/test')
const SITE = 'https://maymourad.github.io/DOMINO/'
const OVERLAY = process.env.OVERLAY === '1'
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean)
const OUT = path.join(here, 'footage', OVERLAY ? 'overlay' : 'raw')
fs.mkdirSync(OUT, { recursive: true })
const W = 1920, H = 1080, FPS = 60

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
const sleep = (ms) => page.waitForTimeout(ms)
const link = (re) => page.getByRole('link', { name: re }).first()
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)
// event markers (seconds from the start of each take) so the 5-second cuts can be computed exactly
const marks = {}; let T0 = 0, CUR = ''
const mark = (n) => { marks[CUR + '.' + n] = +((Date.now() - T0) / 1000).toFixed(2) }

// ---- cursor: Playwright's pointer is invisible, so draw our own and glide it ----
await page.addInitScript(() => {
  const mk = () => {
    if (document.getElementById('dv-cursor')) return
    const c = document.createElement('div'); c.id = 'dv-cursor'
    c.style.cssText = 'position:fixed;left:0;top:0;width:26px;height:26px;z-index:2147483647;pointer-events:none;transform:translate(-100px,-100px);transition:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))'
    c.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M3 2l7.5 19 2.6-7.9L21 10.5z" fill="#fff" stroke="#102B4E" stroke-width="1.6" stroke-linejoin="round"/></svg>'
    document.documentElement.appendChild(c)
    // smooth 60 fps cursor animation inside the page; the real pointer only jumps once the glide has arrived
    const ez = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
    window.__dvPos = { x: -100, y: -100 }
    window.__dvMove = (x, y, ms) => new Promise((res) => {
      const a = { ...window.__dvPos }, t0 = performance.now()
      const step = (now) => {
        const p = Math.min(1, (now - t0) / ms), e = ez(p)
        const cx = a.x + (x - a.x) * e, cy = a.y + (y - a.y) * e
        c.style.transform = `translate(${cx}px,${cy}px)`; window.__dvPos = { x: cx, y: cy }
        p < 1 ? requestAnimationFrame(step) : res()
      }
      requestAnimationFrame(step)
    })
    window.__dvScroll = (dy, ms) => new Promise((res) => {
      const y0 = window.scrollY, t0 = performance.now()
      const step = (now) => { const p = Math.min(1, (now - t0) / ms); window.scrollTo(0, y0 + dy * ez(p)); p < 1 ? requestAnimationFrame(step) : res() }
      requestAnimationFrame(step)
    })
    window.addEventListener('mousedown', () => { c.firstChild.style.transform = 'scale(.82)' }, true)
    window.addEventListener('mouseup', () => { c.firstChild.style.transform = '' }, true)
  }
  document.addEventListener('DOMContentLoaded', mk); if (document.readyState !== 'loading') mk()
})
let pos = { x: 1500, y: 900 }
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
async function glide(x, y, ms = 700) {
  await page.evaluate(([x, y, ms]) => window.__dvMove(x, y, ms), [x, y, ms])
  await page.mouse.move(x, y); pos = { x, y }
}
async function glideTo(locator, ms = 700, dx = 0, dy = 0) {
  await locator.scrollIntoViewIfNeeded()
  const b = await locator.boundingBox(); await glide(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy, ms)
}
async function clickAt(locator, ms = 700) { await glideTo(locator, ms); await sleep(120); await page.mouse.down(); await sleep(70); await page.mouse.up(); await sleep(120) }
async function smoothScrollBy(dy, ms = 900) { await page.evaluate(([dy, ms]) => window.__dvScroll(dy, ms), [dy, ms]) }

// ---- overlays (OVERLAY=1 only): the on-screen text planned in the production pack ----
async function overlay(items, { backdrop = 0 } = {}) {
  if (!OVERLAY) return
  await page.evaluate(({ items, backdrop }) => {
    document.querySelectorAll('.dv-ov').forEach((n) => n.remove())
    if (!document.getElementById('dv-ov-style')) {
      const s = document.createElement('style'); s.id = 'dv-ov-style'
      s.textContent = '@keyframes dvIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}@keyframes dvBack{0%,70%{opacity:1}100%{opacity:0}}' +
        '.dv-ov{position:fixed;z-index:2147483000;pointer-events:none;font-family:Manrope,Calibri,sans-serif;color:#fff}.dv-chip{background:rgba(16,43,78,.94);border:1.5px solid #82B2D6;border-radius:12px;padding:10px 18px;font-weight:700;font-size:26px;letter-spacing:.2px}' +
        '.dv-mono{font-family:"IBM Plex Mono",Consolas,monospace;font-weight:600}'
      document.head.appendChild(s)
    }
    if (backdrop) { const b = document.createElement('div'); b.className = 'dv-ov'; b.style.cssText = `inset:0;background:rgba(16,43,78,.88);animation:dvBack ${backdrop}ms ease-in both`; document.body.appendChild(b) }
    for (const it of items) {
      const d = document.createElement('div'); d.className = 'dv-ov ' + (it.cls || '')
      d.style.cssText = `${it.pos};animation:dvIn 450ms cubic-bezier(.2,.8,.2,1) ${it.delay || 0}ms both;${it.style || ''}`
      d.innerHTML = it.html; document.body.appendChild(d); if (it.life) setTimeout(() => d.remove(), it.life)
    }
  }, { items, backdrop })
}
const clearOverlay = () => page.evaluate(() => document.querySelectorAll('.dv-ov').forEach((n) => n.remove()))
const chip = (html, pos, delay, extra = {}) => ({ html, pos, delay, life: extra.life, cls: 'dv-chip ' + (extra.mono ? 'dv-mono' : ''), style: extra.style })

// ---- take: record webm for the duration of fn ----
async function take(name, fn) {
  if (ONLY.length && !ONLY.includes(name.slice(0, 3)) && !ONLY.includes(name)) return
  const file = path.join(OUT, name + '.webm')
  await page.screencast.start({ path: file, size: { width: W, height: H }, fps: FPS, quality: 95 })
  const t0 = Date.now(); T0 = t0; CUR = name.slice(0, 3)
  try { await fn() } finally { await clearOverlay(); await page.screencast.stop() }
  log('recorded', name, ((Date.now() - t0) / 1000).toFixed(1) + 's')
}

// ---- prepare a clean state ----
await page.goto(SITE + '#/launch'); await page.evaluate(() => localStorage.clear()); await page.reload()
await page.getByText('Choose a fictional household').waitFor(); await sleep(2500)
await glide(1500, 900, 10)

// clip 6 - Launch
await take('c06_launch', async () => {
  await overlay([
    { html: '<div style="font-size:112px;font-weight:800;line-height:1;letter-spacing:2px">DOMINO</div>', pos: 'left:1010px;top:500px', delay: 800 },
    { html: '<div style="font-size:34px;font-weight:600;color:#82B2D6">Family Resilience Intelligence System</div>', pos: 'left:1014px;top:628px', delay: 1600 },
  ])
  await sleep(1800); await glide(420, 520, 1200); await glide(1180, 380, 1900); await sleep(2000)
})

// clip 7 - Family Network
await page.getByRole('button', { name: /Explore The Amina Family/ }).first().click()
await page.getByText('0 errors · 0 warnings').waitFor(); await sleep(2500)
await take('c07_network', async () => {
  const tags = ['People', 'Tasks', 'Vehicles', 'Dependencies']
  await overlay(tags.map((t, i) => chip(t, `left:${90 + i * 230}px;bottom:70px`, 900 + i * 300)))
  await sleep(1700); await clickAt(page.locator('[data-id="T01"]').first(), 1200); mark('click'); await sleep(3300)
})

// clip 8 - Disruption Studio (typed sentence -> interpreted event -> user confirms)
await link(/Disrupt/).click(); await page.getByLabel('Message').waitFor(); await sleep(1200)
await take('c08_studio', async () => {
  await clickAt(page.getByLabel('Message'), 900)
  mark('typeStart'); await page.keyboard.type('Amina is unavailable from 2:30 PM until 6 PM', { delay: 45 }); mark('typeEnd'); await sleep(500)
  await clickAt(page.getByRole('button', { name: 'Interpret with AI' }), 800); mark('interpretClick')
  await page.getByText(/Review extracted details/).waitFor({ timeout: 60000 }); mark('reviewVisible'); await sleep(1300)
  await clickAt(page.getByRole('button', { name: /Confirm interpretation/ }), 900); mark('confirmClick')
  await overlay([chip('You confirm', 'right:90px;top:120px', 100)])
  await sleep(2200)
})
// make sure the scenario is confirmed (the interpretation may add an unconfirmed event)
const confirmAll = page.getByRole('button', { name: 'Confirm all' })
if (await confirmAll.isEnabled().catch(() => false)) await confirmAll.click()
await sleep(500)

// clip 9 - Cascade Laboratory (replay)
await page.getByRole('button', { name: 'Run scenario' }).last().click()
await page.waitForURL(/#\/cascade/); await page.getByText('How the disruption propagates').waitFor(); await sleep(5500)
await take('c09_cascade', async () => {
  await overlay([
    chip('4 directly affected', 'left:90px;bottom:34px', 1200, { mono: true }),
    chip('2 indirectly', 'left:470px;bottom:34px', 2400, { mono: true }),
    chip('3 levels deep', 'left:760px;bottom:34px', 3600, { mono: true }),
  ])
  await sleep(400); await clickAt(page.getByRole('button', { name: /Replay/ }).first(), 900); mark('replayClick'); await sleep(6200)
})
// clip 10 - the dependent at risk
await take('c10_yusuf', async () => {
  await overlay([chip('At risk through dependency', 'left:90px;bottom:80px', 700)])
  await clickAt(page.locator('[data-id="P04"]').first(), 1100); mark('click'); await sleep(3600)
})

// clip 12 - Recovery Studio (magnetic reassignment)
await take('c12_recovery', async () => {
  await overlay([
    chip('Pickup → Khalid 14:45', 'left:90px;bottom:34px', 1800, { mono: true }),
    chip('Groceries → Khalid 15:55', 'left:530px;bottom:34px', 2300, { mono: true }),
    chip('Homework → Noura 16:45', 'left:1030px;bottom:34px', 2800, { mono: true }),
  ])
  await sleep(300); await clickAt(link(/Recover/), 900); mark('navClick')
  await page.getByText('Verified complete recovery').first().waitFor({ timeout: 60000 }); mark('verified'); await sleep(5500)
})

// clip 14 - Independent verification
const ver = page.locator('[aria-label="Independent verification"]')
await take('c14_verify', async () => {
  await overlay([
    chip('CP-SAT solver  |  Independent verifier · no shared code', 'left:90px;top:96px', 700),
    chip('18 rules · 56/56 checks · 0 hard violations', 'left:90px;bottom:34px', 1600, { mono: true }),
  ])
  const b = await ver.boundingBox(); mark('scrollStart'); await smoothScrollBy(Math.max(0, b.y - 160), 1400); mark('scrollEnd'); await sleep(500)
  await clickAt(ver.locator('summary').filter({ hasText: 'V07' }).first(), 800); mark('expandClick'); await sleep(900)
  await smoothScrollBy(260, 1000); await sleep(1500)
})

// clip 15 - Approval dialog
await smoothScrollBy(-4000, 600); await sleep(600)
await take('c15_approval', async () => {
  await overlay([chip('Human decision', 'right:110px;top:140px', 2600)])
  await sleep(500); await clickAt(page.getByRole('button', { name: /Review & approve/ }).first(), 900); mark('dialogOpen'); await sleep(900)
  const boxes = page.getByRole('dialog').getByRole('checkbox'); const n = await boxes.count()
  for (let i = 0; i < n; i++) { await clickAt(boxes.nth(i), 600); await sleep(300) }
  await glideTo(page.getByRole('dialog').getByRole('button', { name: /Approve verified plan/ }), 700); mark('ticksDone'); await sleep(1500)
})
await page.keyboard.press('Escape'); await sleep(600)

// clip 16 - Futures Laboratory: add the secondary disruption and recalculate
await link(/Futures/).click(); await page.locator('#f-pre').waitFor(); await sleep(1000)
await page.locator('#f-pre').selectOption('caregiver-conflict'); await page.getByRole('button', { name: 'Add secondary disruption' }).click(); await sleep(600)
await take('c16_futures', async () => {
  await overlay([chip('What if Khalid is unavailable too?', 'left:50%;top:44%;transform:translateX(-50%);font-size:46px;padding:20px 32px', 100, { style: 'font-size:46px', life: 2300 })], { backdrop: 1700 })
  await sleep(1900); await clickAt(page.getByRole('button', { name: 'Run counterfactual' }), 1000); mark('runClick')
  await page.getByText(/Different result: School pickup/).waitFor({ timeout: 60000 }); mark('resultVisible'); await sleep(2800)
})
// clip 17 - the honest partial plan
await take('c17_partial', async () => {
  await overlay([
    chip('Valid partial plan — human intervention required', 'left:90px;bottom:34px', 600),
    chip('33% weighted coverage', 'left:1010px;bottom:34px', 1500, { mono: true }),
  ])
  await glideTo(page.locator('.banner.bad').first(), 1100); await sleep(1500)
  await smoothScrollBy(380, 1200); await sleep(2800)
})

// clip 19 - Evaluation Laboratory: run the real suite
await link(/Evaluate/).click(); await page.getByRole('button', { name: 'Run benchmark suite' }).waitFor(); await sleep(1000)
let evalText = ''
await take('c19_eval', async () => {
  await sleep(800); await clickAt(page.getByRole('button', { name: 'Run benchmark suite' }), 900); mark('runClick')
  await page.getByText('Passed', { exact: true }).waitFor({ timeout: 180000 }); mark('resultVisible'); await sleep(1200)
  await overlay([chip('Hosted run · 28 Oct 2026 · 5 cases not run (4 frontend/build, 1 key-dependent)', 'left:90px;bottom:60px', 200)])
  evalText = (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 400)
  await sleep(4200)
})
log('evaluation text:', evalText)

fs.writeFileSync(path.join(OUT, 'marks.json'), JSON.stringify(marks, null, 1))
await browser.close()
log('done', OVERLAY ? 'overlay' : 'raw')

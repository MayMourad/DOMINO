// Captures genuine screenshots of the PUBLISHED DOMINO prototype for the deck (no mock-ups).
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const here = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.join(here, '..', 'frontend', 'package.json'))
const { chromium } = require('@playwright/test')
const URL = 'https://maymourad.github.io/DOMINO/'
const OUT = path.join(here, 'shots')
fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
await page.addInitScript(() => { const st = document.createElement('style'); st.textContent = '.topbar{position:static !important}'; document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st)) })
const shot = async (name, target = page, opts = {}) => { await target.screenshot({ path: path.join(OUT, name + '.png'), ...opts }); console.log('captured', name) }
const sleep = (ms) => page.waitForTimeout(ms)
const link = (re) => page.getByRole('link', { name: re }).first().click()

async function fresh(card) {
  await page.goto(URL + '#/launch')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByRole('button', { name: card }).first().waitFor()
  await sleep(1500)
}

// 1. Launch (constellation)
await page.goto(URL + '#/launch'); await page.evaluate(() => localStorage.clear()); await page.reload()
await page.getByText('Choose a fictional household').waitFor(); await sleep(2500)
await page.mouse.move(1100, 350); await sleep(800)
await shot('01_launch')
await shot('01_launch_viewport', page, { fullPage: false })
await shot('01_launch_hero', page.locator('.hero'))

// other two households (network graphs) for slide 6
for (const [card, name] of [[/Explore The Al-Mansoori/, '12_net_multigen'], [/Explore The Salma Family/, '13_net_restricted']]) {
  await fresh(card); await page.getByRole('button', { name: card }).first().click()
  await page.getByText('0 errors · 0 warnings').waitFor(); await sleep(2500)
  await shot(name, page.locator('.graph-field'))
}

// 2. Amina family network with an inspected node
await fresh(/Explore The Amina Family/); await page.getByRole('button', { name: /Explore The Amina Family/ }).first().click()
await page.getByText('0 errors · 0 warnings').waitFor(); await sleep(2500)
await shot('02_network_overview', page.locator('.grid-3').first())
await page.locator('[data-id="T01"]').first().click(); await sleep(600)
await shot('02_network_inspected', page.locator('.grid-3').first())
await shot('02_network_full', page, { fullPage: true })
await shot('02_network_graph', page.locator('.graph-field'))
await shot('02_inspector', page.locator('aside[aria-label="Inspector"]'))

// 3. Disruption studio with the staged + confirmed Amina event
await link(/Disrupt/); await page.getByRole('button', { name: /^Amina unavailable/ }).waitFor()
await page.getByRole('button', { name: /^Amina unavailable/ }).click()
await shot('03_studio_staged', page, { fullPage: true })
await page.getByRole('button', { name: 'Confirm all' }).click(); await sleep(500)
await shot('03_studio_confirmed', page, { fullPage: true })
await shot('03_presets', page.locator('section[aria-labelledby="presets"]'))
await shot('03_scenario', page.locator('section[aria-labelledby="scenario"]'))

// natural-language proposal (Gemini with built-in fallback)
await page.getByLabel('Message').fill('Amina cannot help until 6 PM')
await page.getByRole('button', { name: 'Interpret with AI' }).click()
await page.getByText(/Review extracted details/).waitFor({ timeout: 60000 }); await sleep(800)
await shot('03_studio_nl', page.locator('section[aria-labelledby="nl"]'))
await page.getByRole('button', { name: 'Discard' }).click()

// 4. Cascade laboratory
await page.getByRole('button', { name: 'Run scenario' }).last().click()
await page.waitForURL(/#\/cascade/); await page.getByText('How the disruption propagates').waitFor()
await sleep(4500)                                   // playback finishes
await page.locator('[data-id="T03"]').first().click(); await sleep(700)
await shot('04_cascade_full', page, { fullPage: true })
await shot('04_cascade_top', page.locator('.grid-3').first())
await shot('04_cascade_graph', page.locator('.graph-field'))
await page.getByRole('slider').fill('1'); await sleep(700)
await shot('04_cascade_step1', page.locator('.graph-field'))
await page.getByRole('slider').fill('3'); await sleep(500)
await shot('04_cascade_timeline', page.locator('.cinema-track'))

// 5. Recovery studio
await link(/Recover/); await page.getByText('Verified complete recovery').first().waitFor({ timeout: 60000 }); await sleep(4000)
await shot('05_recovery_full', page, { fullPage: true })
await shot('05_recovery_graph', page.locator('.graph-field'))
await shot('05_recovery_main', page.locator('.grid-3').first())
const gantt = page.locator('.gantt').first(); await shot('05_recovery_gantt', gantt)
const ver = page.locator('[aria-label="Independent verification"]')
for (const rule of ['V07', 'V10', 'V13']) await ver.locator('summary').filter({ hasText: rule }).first().click()
await sleep(400)
await shot('06_verification', ver)
await shot('05_recovery_table', page.getByRole('table', { name: 'Proposed assignments' }))
await page.getByRole('table', { name: 'Proposed assignments' }).locator('tr').filter({ hasText: 'School pickup' }).getByRole('button', { name: /Inspect/ }).click(); await sleep(500)
await shot('05_recovery_explain', page.locator('aside').first())
await page.getByRole('button', { name: /Review & approve/ }).click(); await sleep(500)
await shot('09_approval', page.getByRole('dialog'))
await page.keyboard.press('Escape')

// 6. Futures laboratory: secondary disruption
await link(/Futures/); await page.locator('#f-pre').waitFor()
await page.locator('#f-pre').selectOption('caregiver-conflict'); await page.getByRole('button', { name: 'Add secondary disruption' }).click()
await page.getByRole('button', { name: 'Run counterfactual' }).click()
await page.getByText(/Different result: School pickup/).waitFor({ timeout: 60000 }); await sleep(800)
await shot('07_futures_full', page, { fullPage: true })
await shot('07_ref', page.locator('section[aria-label="Reference scenario"]'))
await shot('07_mod', page.locator('section[aria-label="Modified future scenario"]'))
await shot('07_banner', page.locator('.banner.bad').first())
// apply -> partial recovery in Recovery Studio
await page.getByRole('button', { name: 'Apply scenario' }).click()
await page.waitForURL(/#\/recovery/, { timeout: 60000 }); await page.getByText(/Critical responsibilities uncovered/).waitFor(); await sleep(4000)
await shot('08_recovery_partial_full', page, { fullPage: true })
await shot('08_recovery_partial_graph', page.locator('.graph-field'))
await shot('08_recovery_partial_main', page.locator('.grid-3').first())
const ver2 = page.locator('[aria-label="Independent verification"]'); await shot('08_verification_partial', ver2)

// 7. Evaluation laboratory (real suite run)
await link(/Evaluate/); await page.getByRole('button', { name: 'Run benchmark suite' }).click()
await page.getByText('Passed', { exact: true }).waitFor({ timeout: 180000 }); await sleep(800)
await shot('10_eval_overview', page, { fullPage: true })
await page.getByRole('tab', { name: 'Optimization' }).click(); await sleep(600)
await shot('10_eval_optimization', page, { fullPage: true })
await page.getByRole('tab', { name: 'Dependency Analysis' }).click(); await sleep(600)
await shot('10_eval_dependency', page, { fullPage: true })

await browser.close()
console.log('done')

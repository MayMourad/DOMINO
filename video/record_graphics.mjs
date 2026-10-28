// Renders the three motion-graphic clips that need no AI imagery (credits 22, tagline 23, end card 24) at 1080p / 60 fps.
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const here = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.join(here, '..', 'frontend', 'package.json'))
const { chromium } = require('@playwright/test')
const OUT = path.join(here, 'footage', 'graphics'); fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
const ONLY = (process.env.CLIPS || '').split(',').filter(Boolean)
for (const [clip, name] of [['05', 'c05_planner'], ['11', 'c11_solver'], ['20', 'c20_steps'], ['22', 'c22_credits'], ['23', 'c23_tagline'], ['24', 'c24_endcard']]) {
  if (ONLY.length && !ONLY.includes(clip)) continue
  const page = await ctx.newPage()
  await page.goto(pathToFileURL(path.join(here, 'graphics.html')).href + '?clip=' + clip)
  await page.waitForFunction(() => window.ready === true); await page.waitForTimeout(500)
  await page.screencast.start({ path: path.join(OUT, name + '.webm'), size: { width: 1920, height: 1080 }, fps: 60, quality: 95 })
  await page.evaluate(() => window.start()); await page.waitForTimeout(5400)
  await page.screencast.stop(); await page.close()
  console.log('rendered', name)
}
await browser.close()

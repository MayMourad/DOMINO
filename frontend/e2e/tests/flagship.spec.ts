import { expect, test, type Page } from '@playwright/test'

const nav = (p: Page, name: RegExp | string) => p.getByRole('link', { name }).first().click()

async function start(page: Page, card: RegExp) {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByRole('button', { name: card }).first().click()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

test('flagship: disruption → cascade → verified recovery → honest infeasibility → reset', async ({ page }) => {
  // 1-2. launch and select the Amina household
  await start(page, /Explore The Amina Family/)
  // 3. confirm the validated baseline
  await expect(page.getByText('4/4').first()).toBeVisible()
  await expect(page.getByText('0 errors · 0 warnings')).toBeVisible()
  // 4. inject Amina's unavailability; unconfirmed events never run
  await nav(page, /Disrupt/)
  await page.getByRole('button', { name: /^Amina unavailable/ }).click()
  await expect(page.getByText('needs confirmation').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Run scenario' }).first()).toBeDisabled()
  await page.getByRole('button', { name: 'Confirm all' }).click()
  await page.getByRole('button', { name: 'Run scenario' }).last().click()
  // 5. cascade: impacts come from the backend graph analysis
  await expect(page).toHaveURL(/#\/cascade/)
  await expect(page.getByText('Directly disrupted').first()).toBeVisible()
  await page.getByRole('button', { name: 'Replay' }).click()
  await page.getByRole('slider').fill('3')
  await expect(page.locator('[data-id="T04"] .gnode')).not.toHaveAttribute('data-state', /.+/)
  // 6-7. recovery is generated and independently verified
  await page.getByRole('button', { name: /Continue to Recovery Studio/ }).click()
  await expect(page.getByText('Verified complete recovery').first()).toBeVisible()
  await expect(page.getByText('0 hard violations')).toBeVisible()
  await expect(page.getByText(/3 strategies produced 1 distinct/)).toBeVisible()
  const row = page.getByRole('table', { name: 'Proposed assignments' }).locator('tr').filter({ hasText: 'School pickup' })
  await expect(row).toContainText('Khalid')
  // rejecting an assignment triggers a fresh solve
  await row.getByRole('button', { name: /Reject/ }).click()
  await expect(page.getByText('Active constraints')).toBeVisible()
  await expect(page.getByText(/Valid partial plan/).first()).toBeVisible()
  await page.getByRole('button', { name: 'Clear constraints' }).click()
  await expect(page.getByText('Verified complete recovery').first()).toBeVisible()
  // 8-10. counterfactual: Khalid unavailable during pickup → pickup uncovered
  await nav(page, /Futures/)
  await page.locator('#f-pre').selectOption('caregiver-conflict')
  await page.getByRole('button', { name: 'Add secondary disruption' }).click()
  await page.getByRole('button', { name: 'Run counterfactual' }).click()
  await expect(page.getByText(/Different result: School pickup/)).toBeVisible()
  await expect(page.getByText(/will not invent a caregiver/).first()).toBeVisible()
  await expect(page.getByText('Valid partial plan — human intervention required').first()).toBeVisible()
  // reference scenario is preserved alongside it
  await expect(page.getByText('Verified complete recovery').first()).toBeVisible()
  // 11-12. reset restores the baseline
  await nav(page, /Network/)
  await page.getByRole('button', { name: /Reset household/ }).click()
  await nav(page, /Cascade/)
  await expect(page.getByText('No scenario has been run')).toBeVisible()
})

test('multigenerational: a disruption is recovered and verified', async ({ page }) => {
  await start(page, /Explore The Al-Mansoori/)
  await nav(page, /Disrupt/)
  await page.getByRole('button', { name: /unavailable/ }).first().click()
  await page.getByRole('button', { name: 'Confirm all' }).click()
  await page.getByRole('button', { name: 'Run scenario' }).last().click()
  await expect(page).toHaveURL(/#\/cascade/)
  await nav(page, /Recover/)
  await expect(page.getByText(/Verified (complete|critical) recovery|Valid partial/).first()).toBeVisible()
  await expect(page.getByText('0 hard violations')).toBeVisible()
})

test('restricted transport: only driver lost → pickup uncovered; approval demands acknowledgement', async ({ page }) => {
  await start(page, /Explore The Salma Family/)
  await nav(page, /Disrupt/)
  await page.getByRole('button', { name: /^Salma unavailable/ }).click()
  await page.getByRole('button', { name: 'Confirm all' }).click()
  await page.getByRole('button', { name: 'Run scenario' }).last().click()
  await expect(page).toHaveURL(/#\/cascade/)
  await nav(page, /Recover/)
  await expect(page.getByText('Valid partial plan — human intervention required').first()).toBeVisible()
  await expect(page.getByText(/Critical responsibilities uncovered/)).toBeVisible()
  await page.getByRole('button', { name: /Review & approve/ }).click()
  const dlg = page.getByRole('dialog')
  await expect(dlg.getByRole('button', { name: 'Approve verified plan' })).toBeDisabled()
  await dlg.getByLabel(/critical tasks remain uncovered/).check()
  await dlg.getByLabel(/I, a human, approve/).check()
  await dlg.getByRole('button', { name: 'Approve verified plan' }).click()
  await expect(dlg.getByText(/No message, booking or instruction was sent/)).toBeVisible()
})

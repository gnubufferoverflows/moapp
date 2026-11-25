import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { chromium, expect } from '@playwright/test'

const baseURL = process.env.MO_TEST_URL || 'http://localhost:7100/'
const apiURL = process.env.MO_TEST_API_URL || new URL(baseURL).origin
const syncId = crypto.randomBytes(32).toString('hex')
const headers = { 'X-Mo-Sync-Id': syncId }
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
await context.addInitScript(id => localStorage.setItem('mo-cloud-sync-id-v1', id), syncId)
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })

async function navigate(name) {
  await page.locator('.main-nav').getByRole('button', { name, exact: true }).click()
}

async function drawStroke(strokeIndex) {
  const data = JSON.parse(fs.readFileSync(path.resolve('node_modules/hanzi-writer-data/永.json'), 'utf8'))
  const target = page.locator('.practice-layout').getByTestId('writer-target')
  const box = await target.boundingBox()
  assert(box)
  const points = data.medians[strokeIndex].map(([x, y]) => ({
    x: box.x + (54 + x * 492 / 900) / 600 * box.width,
    y: box.y + (546 - y * 492 / 900) / 600 * box.height,
  }))
  await page.mouse.move(points[0].x, points[0].y)
  await page.mouse.down()
  for (const point of points.slice(1)) await page.mouse.move(point.x, point.y, { steps: 2 })
  await page.mouse.up()
  await page.waitForTimeout(300)
}

async function remoteSnapshot() {
  const response = await fetch(`${apiURL}/api/progress`, { headers })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.exists, true)
  return body
}

async function waitSynced() {
  await expect(page.getByTestId('cloud-sync-status')).toContainText('Cloud backup up to date', { timeout: 20000 })
}

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' })
  await expect(page.locator('.practice-layout .paper-state')).toHaveCount(0)
  for (let index = 0; index < 5; index += 1) await drawStroke(index)
  await page.getByTestId('review-writing').click()
  await expect(page.getByTestId('grade-result')).toContainText('100')

  await navigate('Sentences')
  await page.getByRole('button', { name: 'New sentence pack' }).click()
  const packDialog = page.getByRole('dialog')
  await packDialog.getByLabel('Pack name').fill('Cloud conversations')
  await packDialog.getByLabel('Sentences', { exact: true }).fill('我爱学习。 | Wǒ ài xuéxí. | I love studying.')
  await packDialog.getByRole('button', { name: 'Create pack' }).click()
  await expect(page.locator('.sentence-text')).toHaveText('我爱学习。')

  await navigate('Characters')
  await page.getByRole('button', { name: 'New character palette' }).click()
  const paletteDialog = page.getByRole('dialog')
  await paletteDialog.getByLabel('Palette name').fill('Cloud elements')
  await paletteDialog.locator('textarea').fill('水 火 木')
  await paletteDialog.getByRole('button', { name: 'Create palette' }).click()
  await expect(page.locator('.character-card')).toHaveCount(3)

  await navigate('Progress')
  await waitSynced()
  const saved = await remoteSnapshot()
  assert.equal(saved.snapshot.progress.characters['永'].bestScore, 100)
  assert.equal(saved.snapshot.customContent.packs[0].name, 'Cloud conversations')
  assert.deepEqual(saved.snapshot.customContent.palettes[0].characters, ['水', '火', '木'])
  console.log('PASS: real browser drawing and custom collections reached the cloud database')

  await page.evaluate(() => {
    localStorage.removeItem('mo-hanzi-progress-v1')
    localStorage.removeItem('mo-custom-content-v1')
    localStorage.removeItem('mo-cloud-updated-at-v1')
  })
  await page.reload({ waitUntil: 'networkidle' })
  await navigate('Progress')
  await waitSynced()
  await expect(page.locator('.recent-list')).toContainText('yǒng')
  const restored = await page.evaluate(() => ({
    progress: JSON.parse(localStorage.getItem('mo-hanzi-progress-v1')),
    custom: JSON.parse(localStorage.getItem('mo-custom-content-v1')),
  }))
  assert.equal(restored.progress.characters['永'].bestScore, 100)
  assert.equal(restored.custom.packs[0].name, 'Cloud conversations')
  assert.deepEqual(restored.custom.palettes[0].characters, ['水', '火', '木'])
  console.log('PASS: clearing local data and reloading restores the newer cloud snapshot')

  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Reset progress' }).click()
  await expect.poll(async () => (await remoteSnapshot()).snapshot.progress.attempts, { timeout: 20000 }).toBe(0)
  await waitSynced()
  const afterReset = await remoteSnapshot()
  assert.deepEqual(afterReset.snapshot.progress.characters, {})
  assert.equal(afterReset.snapshot.customContent.packs.length, 1)
  assert.equal(afterReset.snapshot.customContent.palettes.length, 1)
  console.log('PASS: reset syncs empty progress without deleting custom collections')

  assert.deepEqual(errors, [])
  console.log('PASS: cloud browser flow has no console or runtime errors')
  console.log('ALL CLOUD BROWSER CHECKS PASSED')
} finally {
  await fetch(`${apiURL}/api/progress`, { method: 'DELETE', headers }).catch(() => {})
  await context.close()
  await browser.close()
}

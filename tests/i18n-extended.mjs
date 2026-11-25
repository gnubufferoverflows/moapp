import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { chromium, expect } from '@playwright/test'

const baseURL = process.env.MO_TEST_URL || 'http://localhost:7100/'
const apiURL = process.env.MO_TEST_API_URL || new URL(baseURL).origin
const artifacts = path.resolve('tests/artifacts')
fs.mkdirSync(artifacts, { recursive: true })
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await context.newPage()
const errors = []
const failures = []
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`) })
let syncId = ''

async function navigate(name) {
  await page.locator('.main-nav').getByRole('button', { name, exact: true }).click()
}

async function drawCharacter(char) {
  const data = JSON.parse(fs.readFileSync(path.resolve(`node_modules/hanzi-writer-data/${char}.json`), 'utf8'))
  const target = page.locator('.practice-layout').getByTestId('writer-target')
  for (let strokeIndex = 0; strokeIndex < data.medians.length; strokeIndex += 1) {
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
}

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  syncId = await page.evaluate(() => localStorage.getItem('mo-cloud-sync-id-v1'))
  assert.match(syncId, /^[a-f0-9]{64}$/)
  await expect(page.locator('.practice-layout .paper-state')).toHaveCount(0)
  await expect(page.locator('.example-word')).toHaveText('他永远忘不了那一天。')
  await expect(page.locator('.example-pinyin')).toContainText('yǒngyuǎn')
  await expect(page.locator('.example-block p')).toHaveText('He will never forget that day.')
  await page.screenshot({ path: path.join(artifacts, 'example-sentence-desktop.png') })
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.locator('.example-word')).toContainText('一')
  await expect(page.locator('.example-word')).not.toHaveText('一个')
  console.log('PASS: sourced bilingual sentences appear for foundation and HSK characters')

  await page.getByRole('button', { name: '中文界面' }).click()
  await expect(page.locator('.practice-intro h2')).toHaveText('少写一点，多悟一分。')
  await expect(page.locator('.main-nav')).toContainText('练习')
  await expect(page.locator('.main-nav')).toContainText('句子')
  await expect(page.locator('.main-nav')).toContainText('字库')
  await expect(page.locator('.main-nav')).toContainText('进度')
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.getByRole('button', { name: '中文界面' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.practice-intro h2')).toHaveText('少写一点，多悟一分。')
  console.log('PASS: Chinese interface translates navigation and persists after reload')

  await page.getByRole('button', { name: 'English interface' }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.locator('.paper-caption')).toContainText('一')
  await page.getByRole('button', { name: '中文界面' }).click()
  await drawCharacter('一')
  await page.getByRole('button', { name: '为我的书写评分' }).click()
  await expect(page.getByTestId('grade-result')).toContainText('形状')
  await expect(page.getByTestId('grade-result')).toContainText('100')
  console.log('PASS: real drawing receives Chinese scoring feedback')

  await page.getByRole('button', { name: 'English interface' }).click()
  await navigate('Sentences')
  await page.getByRole('button', { name: 'New sentence pack' }).click()
  const packDialog = page.getByRole('dialog')
  await packDialog.getByLabel('Pack name').fill('Name practice')
  await packDialog.getByLabel('Sentences', { exact: true }).fill('我是彩娜 | Wǒ shì Cǎinà | I am Caina.')
  await packDialog.getByRole('button', { name: 'Create pack' }).click()
  await expect(page.locator('.sentence-text')).toHaveText('我是彩娜')
  await expect(page.locator('.sentence-box')).toHaveCount(4)
  await expect(page.locator('.sentence-box .paper-state')).toHaveCount(0, { timeout: 20000 })
  await expect(page.getByTestId('sentence-box-2')).toContainText('彩')
  await expect(page.getByTestId('sentence-box-3')).toContainText('娜')
  await expect(page.getByTestId('sentence-box-2').getByTestId('writer-target').locator('svg')).toBeVisible()
  await expect(page.getByTestId('sentence-box-3').getByTestId('writer-target').locator('svg')).toBeVisible()
  console.log('PASS: custom pack “我是彩娜” validates and loads all four writing surfaces')

  await navigate('Characters')
  await page.getByRole('button', { name: 'New character palette' }).click()
  const paletteDialog = page.getByRole('dialog')
  await paletteDialog.getByLabel('Palette name').fill('Extended names')
  await paletteDialog.locator('textarea').fill('彩 娜 水')
  await paletteDialog.getByRole('button', { name: 'Create palette' }).click()
  await expect(page.locator('.character-card')).toHaveCount(3)
  await page.locator('.character-card').filter({ hasText: '彩' }).click()
  await expect(page.locator('.practice-layout .paper-caption')).toContainText('彩')
  await expect(page.locator('.practice-layout .paper-state')).toHaveCount(0)
  console.log('PASS: extended characters work in palettes and individual practice')

  await navigate('Progress')
  await expect(page.getByTestId('cloud-sync-status')).toContainText('Cloud backup up to date', { timeout: 20000 })
  const remote = await fetch(`${apiURL}/api/progress`, { headers: { 'X-Mo-Sync-Id': syncId } })
  assert.equal(remote.status, 200)
  const body = await remote.json()
  assert.equal(body.snapshot.customContent.packs[0].sentences[0].text, '我是彩娜')
  assert.deepEqual(body.snapshot.customContent.palettes[0].characters, ['彩', '娜', '水'])
  console.log('PASS: extended custom content is accepted by the cloud database')

  await navigate('Practice')
  await page.getByRole('button', { name: '中文界面' }).click()
  await page.setViewportSize({ width: 375, height: 900 })
  await expect(page.getByTestId('language-switch')).toBeVisible()
  const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: window.innerWidth }))
  assert(dimensions.scroll <= dimensions.viewport, `Chinese mobile layout overflows: ${JSON.stringify(dimensions)}`)
  await page.screenshot({ path: path.join(artifacts, 'practice-zh-mobile.png'), fullPage: true })
  assert.deepEqual(errors, [])
  assert.deepEqual(failures, [])
  console.log('PASS: Chinese mobile layout has no overflow, console errors, or failed resources')
  console.log('ALL LANGUAGE, SENTENCE, AND EXTENDED CHARACTER CHECKS PASSED')
} finally {
  if (syncId) await fetch(`${apiURL}/api/progress`, { method: 'DELETE', headers: { 'X-Mo-Sync-Id': syncId } }).catch(() => {})
  await context.close()
  await browser.close()
}

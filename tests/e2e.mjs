import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { chromium, expect } from '@playwright/test'

const baseURL = process.env.MO_TEST_URL || 'http://localhost:7100/'
const artifacts = path.resolve('tests/artifacts')
fs.mkdirSync(artifacts, { recursive: true })
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, hasTouch: true })
const page = await context.newPage()
const errors = []
const failedResponses = []
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`))
page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`) })
page.on('response', response => { if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`) })
const cdp = await context.newCDPSession(page)
const strokeCache = new Map()

function strokesFor(char) {
  if (!strokeCache.has(char)) strokeCache.set(char, JSON.parse(fs.readFileSync(path.resolve(`node_modules/hanzi-writer-data/${char}.json`), 'utf8')))
  return strokeCache.get(char)
}

function writerLocator(boxIndex) {
  return boxIndex === undefined
    ? page.locator('.practice-layout').getByTestId('writer-target')
    : page.getByTestId(`sentence-box-${boxIndex}`).getByTestId('writer-target')
}

function boxLocator(boxIndex) {
  return boxIndex === undefined ? page.locator('.practice-layout') : page.getByTestId(`sentence-box-${boxIndex}`)
}

async function surfacePoints(char, strokeIndex, reverse = false, boxIndex) {
  const box = await writerLocator(boxIndex).boundingBox()
  assert(box, 'Writing surface has a bounding box')
  const medians = strokesFor(char).medians[strokeIndex]
  assert(medians, `Stroke ${strokeIndex + 1} exists for ${char}`)
  const points = reverse ? [...medians].reverse() : medians
  return points.map(([x, y]) => ({
    x: box.x + (54 + x * 492 / 900) / 600 * box.width,
    y: box.y + (546 - y * 492 / 900) / 600 * box.height,
  }))
}

async function drawStroke(char, strokeIndex, { input = 'mouse', reverse = false, releaseOutside = false, boxIndex } = {}) {
  const points = await surfacePoints(char, strokeIndex, reverse, boxIndex)
  const box = await writerLocator(boxIndex).boundingBox()
  assert(box)
  if (input === 'pen') {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: points[0].x, y: points[0].y, button: 'left', buttons: 1, clickCount: 1, pointerType: 'pen' })
    for (const point of points.slice(1)) {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y, button: 'left', buttons: 1, pointerType: 'pen' })
      await page.waitForTimeout(18)
    }
    const end = releaseOutside ? { x: box.x + box.width + 35, y: box.y + 20 } : points.at(-1)
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: end.x, y: end.y, button: 'left', buttons: 0, clickCount: 1, pointerType: 'pen' })
  } else if (input === 'touch') {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: points[0].x, y: points[0].y, id: 1 }] })
    for (const point of points.slice(1)) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: point.y, id: 1 }] })
      await page.waitForTimeout(18)
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  } else {
    await page.mouse.move(points[0].x, points[0].y)
    await page.mouse.down()
    for (const point of points.slice(1)) await page.mouse.move(point.x, point.y, { steps: 2 })
    const end = releaseOutside ? { x: box.x + box.width + 35, y: box.y + 20 } : points.at(-1)
    await page.mouse.move(end.x, end.y)
    await page.mouse.up()
  }
  await page.waitForTimeout(300)
}

async function waitForWriter(char, boxIndex) {
  const container = boxLocator(boxIndex)
  await expect(writerLocator(boxIndex).locator('svg')).toBeVisible()
  await expect(container.locator('.paper-state')).toHaveCount(0)
  await expect(container.locator('.paper-caption')).toContainText(char)
}

async function resetWriter(boxIndex) {
  await boxLocator(boxIndex).getByRole('button', { name: 'Reset', exact: true }).click()
  await page.waitForTimeout(200)
}

async function scoreAttempt(boxIndex) {
  const container = boxLocator(boxIndex)
  await container.getByTestId('review-writing').click()
  await expect(container.getByTestId('grade-result')).toBeVisible()
}

async function navigate(name) {
  await page.locator('.main-nav').getByRole('button', { name, exact: true }).click()
  await page.waitForTimeout(150)
}

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await expect(page).toHaveTitle('Mò — Hanzi Writing Studio')
  await expect(page.locator('.local-status')).toContainText('Local scoring')
  await waitForWriter('永')
  console.log('PASS: clean launch and local-scoring interface')

  for (let index = 0; index < 5; index++) await drawStroke('永', index)
  await expect(page.locator('.paper-caption')).toContainText('5 / 5 strokes')
  await scoreAttempt()
  await expect(page.locator('.score-ring strong')).toHaveText('100')
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mo-hanzi-progress-v1')))
  assert.equal(saved.characters['永'].bestScore, 100)
  await page.screenshot({ path: path.join(artifacts, 'practice-desktop.png') })
  await expect(page.locator('.next-button')).toHaveClass(/ready/)
  await expect(page.locator('.next-button')).toContainText('Next character')
  await page.locator('.next-button').click()
  await waitForWriter('一')
  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.locator('.mastery-note')).toContainText('100%')
  console.log('PASS: real drawing, perfect score, immediate next-character action, and persistence')

  await resetWriter()
  await drawStroke('永', 0)
  await expect(page.locator('.paper-caption')).toContainText('1 / 5 strokes')
  await scoreAttempt()
  await expect(page.locator('.score-ring strong')).toHaveText('20')
  await expect(page.getByTestId('grade-result')).toContainText('Finish the next 4 strokes')
  console.log('PASS: incomplete attempt receives deterministic partial credit')

  await resetWriter()
  await drawStroke('永', 0, { reverse: true })
  for (let index = 0; index < 5; index++) await drawStroke('永', index)
  await expect(page.locator('.paper-caption')).toContainText('5 / 5 strokes')
  await scoreAttempt()
  await expect(page.locator('.score-ring strong')).toHaveText('96')
  await expect(page.getByTestId('grade-result')).toContainText('1 correction')
  console.log('PASS: corrected attempt records a correction and scores 96')

  await resetWriter()
  await drawStroke('永', 0, { input: 'pen', releaseOutside: true })
  await drawStroke('永', 0, { input: 'pen' })
  await expect(page.locator('.paper-caption')).toContainText('1 / 5 strokes')
  for (let index = 1; index < 5; index++) await drawStroke('永', index, { input: 'pen' })
  await expect(page.locator('.paper-caption')).toContainText('5 / 5 strokes')
  console.log('PASS: tablet-pen events draw correctly and outside release does not stick')

  await resetWriter()
  await drawStroke('永', 0, { input: 'touch' })
  await expect(page.locator('.paper-caption')).toContainText('1 / 5 strokes')
  console.log('PASS: touch input draws an accepted stroke')

  await navigate('Characters')
  await expect(page.locator('.character-card')).toHaveCount(60)
  await expect(page.locator('.collection-result-count')).toContainText('3,088')
  await page.locator('.load-more').click()
  await expect(page.locator('.character-card')).toHaveCount(120)
  const levelCounts = { 'HSK 1': 246, 'HSK 2': 125, 'HSK 3': 284, 'HSK 4': 440, 'HSK 5': 431, 'HSK 6': 413, 'HSK 7–9': 1148 }
  for (const [level, count] of Object.entries(levelCounts)) {
    await page.locator('.level-tabs').getByRole('button', { name: level, exact: true }).click()
    await expect(page.locator('.collection-result-count')).toContainText(`of ${count.toLocaleString()} matching`)
    assert((await page.locator('.character-card').count()) <= 60)
  }
  console.log('PASS: all HSK filters, exact totals, and incremental rendering')

  await page.getByRole('textbox', { name: 'Search characters' }).fill('癌')
  await expect(page.locator('.character-card')).toHaveCount(1)
  await page.locator('.character-card').click()
  await waitForWriter('癌')
  await expect(page.locator('.lesson-topline')).toContainText('HSK 7–9')
  console.log('PASS: advanced HSK character loads its real stroke dataset')

  await navigate('Characters')
  await page.getByRole('textbox', { name: 'Search characters' }).fill('no-such-hanzi')
  await expect(page.locator('.empty-collection')).toBeVisible()
  await page.getByRole('button', { name: 'Show every character' }).click()
  await expect(page.locator('.character-card')).toHaveCount(60)
  await page.locator('.filter-tabs').getByRole('button', { name: 'Complete', exact: true }).click()
  await expect(page.locator('.character-card')).toHaveCount(1)
  await expect(page.locator('.character-card')).toContainText('永')
  await page.locator('.filter-tabs').getByRole('button', { name: 'To learn', exact: true }).click()
  await expect(page.locator('.collection-result-count')).toContainText('3,087')
  console.log('PASS: search, empty recovery, learning filter, and completion filter')

  await navigate('Sentences')
  await expect(page.locator('.sentence-text')).toHaveText('我爱我的家人。')
  await expect(page.locator('.sentence-box')).toHaveCount(6)
  await expect(page.locator('.sentence-view .paper-state')).toHaveCount(0)
  await waitForWriter('爱', 1)
  const firstSentenceBox = await page.getByTestId('sentence-box-0').boundingBox()
  const secondSentenceBox = await page.getByTestId('sentence-box-1').boundingBox()
  assert(firstSentenceBox && secondSentenceBox)
  assert.equal(Math.round(firstSentenceBox.y), Math.round(secondSentenceBox.y), 'Sentence boxes are side by side')
  assert(firstSentenceBox.width < 180, `Sentence boxes stay compact (got ${firstSentenceBox.width}px)`)
  await page.getByRole('button', { name: 'Next sentence' }).click()
  await expect(page.locator('.sentence-text')).toHaveText('我们八号去电影院。')
  await expect(page.locator('.sentence-box')).toHaveCount(8)
  await page.locator('.sentence-card-bottom select').selectOption('5')
  await expect(page.locator('.sentence-text')).toHaveText('一百个学生在这里上课。')
  await expect(page.locator('.sentence-box')).toHaveCount(10)
  await waitForWriter('一', 0)
  await drawStroke('一', 0, { boxIndex: 0 })
  await expect(page.getByTestId('sentence-box-0').locator('.paper-caption')).toContainText('1 / 1 strokes')
  await scoreAttempt(0)
  await expect(page.getByTestId('sentence-box-0').locator('.sentence-grade strong')).toHaveText('100')
  await expect(page.getByTestId('sentence-box-0')).toHaveClass(/complete/)
  await page.locator('.level-tabs').getByRole('button', { name: 'HSK 7–9', exact: true }).click()
  await expect(page.locator('.sentence-text')).toHaveText('孩子哭着哀求妈妈不要走。')
  await expect(page.locator('.sentence-box')).toHaveCount(11)
  await page.locator('.sentence-card-bottom select').selectOption('11')
  await expect(page.locator('.sentence-text')).toHaveText('妈妈轻声安抚哭闹的孩子。')
  await expect(page.locator('.sentence-box')).toHaveCount(11)
  await waitForWriter('哭', 6)
  await page.locator('.sentence-card-bottom .mode-switch').getByRole('button', { name: 'Recall' }).click()
  await expect(page.locator('.sentence-box')).toHaveCount(11)
  await expect(page.locator('.sentence-view .paper-state')).toHaveCount(0)
  await page.screenshot({ path: path.join(artifacts, 'sentences-desktop.png') })
  console.log('PASS: compact simultaneous sentence boxes, levels, lessons, scoring, and shared recall mode')

  await page.getByRole('button', { name: 'New sentence pack' }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel('Pack name').fill('Study conversations')
  await dialog.getByLabel('Sentences', { exact: true }).fill('我爱学习。 | Wǒ ài xuéxí. | I love studying.\n我们回家吧。 | Wǒmen huí jiā ba. | Let’s go home.')
  await dialog.getByRole('button', { name: 'Create pack' }).click()
  await expect(page.locator('.sentence-text')).toHaveText('我爱学习。')
  await expect(page.locator('.sentence-box')).toHaveCount(4)
  await page.getByRole('button', { name: 'Edit pack' }).click()
  await dialog.getByLabel('Pack name').fill('Daily conversations')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.locator('.level-tabs').getByRole('button', { name: 'Daily conversations' })).toBeVisible()
  await page.reload({ waitUntil: 'networkidle' })
  await navigate('Sentences')
  await page.locator('.level-tabs').getByRole('button', { name: 'Daily conversations' }).click()
  await expect(page.locator('.sentence-text')).toHaveText('我爱学习。')
  let custom = await page.evaluate(() => JSON.parse(localStorage.getItem('mo-custom-content-v1')))
  assert.equal(custom.packs.length, 1)
  assert.equal(custom.packs[0].sentences.length, 2)
  page.once('dialog', confirmation => confirmation.accept())
  await page.getByRole('button', { name: 'Delete pack' }).click()
  await expect(page.locator('.sentence-text')).toHaveText('我爱我的家人。')
  console.log('PASS: custom sentence pack creation, editing, reload persistence, and deletion')

  await navigate('Characters')
  await page.getByRole('button', { name: 'New character palette' }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('Palette name').fill('Elements')
  await dialog.locator('textarea').fill('水 火 水 木')
  await dialog.getByRole('button', { name: 'Create palette' }).click()
  await expect(page.locator('.character-card')).toHaveCount(3)
  await expect(page.locator('.character-card').nth(0)).toContainText('水')
  await expect(page.locator('.character-card').nth(1)).toContainText('火')
  await page.getByRole('button', { name: 'Edit palette' }).click()
  await dialog.locator('textarea').fill('水 火 木 心')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.locator('.character-card')).toHaveCount(4)
  await page.reload({ waitUntil: 'networkidle' })
  await navigate('Characters')
  await page.locator('.level-tabs').getByRole('button', { name: 'Elements' }).click()
  await expect(page.locator('.character-card')).toHaveCount(4)
  custom = await page.evaluate(() => JSON.parse(localStorage.getItem('mo-custom-content-v1')))
  assert.equal(custom.palettes.length, 1)
  assert.deepEqual(custom.palettes[0].characters, ['水', '火', '木', '心'])
  page.once('dialog', confirmation => confirmation.accept())
  await page.getByRole('button', { name: 'Delete palette' }).click()
  await expect(page.locator('.character-card')).toHaveCount(60)
  console.log('PASS: character palette creation, deduplication, editing, persistence, and deletion')

  await navigate('Progress')
  await expect(page.locator('.stats-row')).toContainText('Practice complete')
  await expect(page.locator('.recent-list')).toContainText('一')
  await page.screenshot({ path: path.join(artifacts, 'progress-desktop.png') })
  console.log('PASS: progress dashboard records sentence and character reviews')

  for (const width of [1024, 768, 375]) {
    await page.setViewportSize({ width, height: 900 })
    await navigate('Practice')
    await expect(page.locator('.practice-layout').getByTestId('writer-target').locator('svg')).toBeVisible()
    await expect(page.locator('.practice-layout .paper-state')).toHaveCount(0)
    await page.evaluate(() => window.scrollTo(0, 0))
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    assert(overflow <= 1, `No horizontal page overflow at ${width}px (got ${overflow})`)
    if (width === 375) await page.screenshot({ path: path.join(artifacts, 'practice-mobile.png') })
    await navigate('Sentences')
    await expect(page.locator('.sentence-card')).toBeVisible()
    await expect(page.locator('.sentence-box')).toHaveCount(6)
    const sentenceOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    assert(sentenceOverflow <= 1, `No sentence overflow at ${width}px`)
    if (width === 375) {
      const mobileBoxes = await page.locator('.sentence-box').evaluateAll(boxes => boxes.slice(0, 3).map(box => Math.round(box.getBoundingClientRect().y)))
      assert.equal(new Set(mobileBoxes).size, 1, 'Three compact sentence boxes share a mobile row')
      await page.screenshot({ path: path.join(artifacts, 'sentences-mobile.png') })
    }
    await navigate('Characters')
    await expect(page.locator('.character-card').first()).toBeVisible()
    const libraryOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    assert(libraryOverflow <= 1, `No library overflow at ${width}px`)
    if (width === 375) await page.screenshot({ path: path.join(artifacts, 'library-mobile.png') })
  }
  console.log('PASS: responsive practice, compact sentences, and library at 1024, 768, and 375 px')

  assert.deepEqual(errors, [], `Unexpected browser errors: ${errors.join('\n')}`)
  assert.deepEqual(failedResponses, [], `Unexpected failed resources: ${failedResponses.join('\n')}`)
  console.log('PASS: zero unexpected console errors, page errors, or failed resources')
  console.log('ALL END-TO-END CHECKS PASSED')
} finally {
  await browser.close()
}

import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createApp } from '../server/app.js'
import { ProgressStore } from '../server/store.js'

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mo-api-test-'))
const origin = 'http://localhost:7100'
const syncId = crypto.randomBytes(32).toString('hex')
const secondId = crypto.randomBytes(32).toString('hex')
const headers = { Origin: origin, 'X-Mo-Sync-Id': syncId }
let store
let server
let base

async function start() {
  store = new ProgressStore(dataDir)
  const app = createApp({ store, distDir: path.resolve('dist'), allowedOrigins: [origin] })
  await new Promise((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', resolve)
    server.once('error', reject)
  })
  base = `http://127.0.0.1:${server.address().port}`
}

async function stop() {
  if (server) await new Promise(resolve => server.close(resolve))
  store?.close()
}

async function request(route, options = {}, expected = 200) {
  const response = await fetch(`${base}${route}`, options)
  const text = await response.text()
  const body = text ? JSON.parse(text) : null
  assert.equal(response.status, expected, `${options.method || 'GET'} ${route}: ${JSON.stringify(body)}`)
  return { response, body }
}

const snapshot = {
  progress: {
    xp: 12,
    attempts: 2,
    characters: { '永': { bestScore: 100, attempts: 2, lastPracticed: new Date().toISOString() } },
    daily: { '2026-11-25': 2 },
  },
  customContent: {
    packs: [{ id: 'pack-test', name: 'Test pack', updatedAt: new Date().toISOString(), sentences: [{ id: 'custom-test', level: 'Custom', text: '我爱学习。', pinyin: 'Wǒ ài xuéxí.', meaning: 'I love studying.', characters: ['我', '爱', '学', '习'] }] }],
    palettes: [{ id: 'palette-test', name: 'Elements', characters: ['水', '火'], updatedAt: new Date().toISOString() }],
  },
  clientUpdatedAt: new Date().toISOString(),
}

try {
  await start()
  const health = await request('/api/health')
  assert.deepEqual(health.body, { ok: true, database: 'sqlite', service: 'mo-progress' })
  console.log('PASS: health and SQLite database probe')

  const preflight = await request('/api/progress', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,x-mo-sync-id' } }, 204)
  assert.equal(preflight.response.headers.get('access-control-allow-origin'), origin)
  assert.match(preflight.response.headers.get('access-control-allow-methods') || '', /POST/)
  assert.match(preflight.response.headers.get('access-control-allow-headers') || '', /x-mo-sync-id/i)
  console.log('PASS: configured frontend CORS preflight')

  const empty = await request('/api/progress', { headers })
  assert.equal(empty.body.exists, false)
  const created = await request('/api/progress', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(snapshot) })
  assert.equal(created.body.exists, true)
  assert.equal(created.body.revision, 1)
  assert.equal(created.body.snapshot.customContent.packs[0].sentences.length, 1)
  console.log('PASS: snapshot creation with progress, pack, and palette')

  const read = await request('/api/progress', { headers })
  assert.equal(read.body.snapshot.progress.characters['永'].bestScore, 100)
  const updatedSnapshot = structuredClone(snapshot)
  updatedSnapshot.progress.characters['永'].bestScore = 96
  updatedSnapshot.customContent.palettes[0].characters.push('木')
  const updated = await request('/api/progress', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(updatedSnapshot) })
  assert.equal(updated.body.revision, 2)
  assert.equal(updated.body.snapshot.customContent.palettes[0].characters.length, 3)
  console.log('PASS: read, update, and revision increment')

  await stop()
  await start()
  const restarted = await request('/api/progress', { headers })
  assert.equal(restarted.body.revision, 2)
  assert.equal(restarted.body.snapshot.progress.characters['永'].bestScore, 96)
  assert.deepEqual(restarted.body.snapshot.customContent.palettes[0].characters, ['水', '火', '木'])
  console.log('PASS: SQLite snapshots survive a complete server restart')

  const isolated = await request('/api/progress', { headers: { Origin: origin, 'X-Mo-Sync-Id': secondId } })
  assert.equal(isolated.body.exists, false)
  const unauthorized = await request('/api/progress', { headers: { Origin: origin } }, 401)
  assert.equal(unauthorized.body.error.code, 'INVALID_SYNC_ID')
  const invalid = await request('/api/progress', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...updatedSnapshot, progress: { ...updatedSnapshot.progress, characters: { '永': { bestScore: 999, attempts: 1, lastPracticed: new Date().toISOString() } } } }) }, 400)
  assert.equal(invalid.body.error.code, 'INVALID_SNAPSHOT')
  console.log('PASS: device isolation, missing ID rejection, and score validation')

  const wrongType = await request('/api/progress', { method: 'POST', headers: { ...headers, 'Content-Type': 'text/plain' }, body: 'not-json' }, 415)
  assert.equal(wrongType.body.error.code, 'UNSUPPORTED_MEDIA_TYPE')
  const malformed = await request('/api/progress', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{bad-json' }, 400)
  assert.equal(malformed.body.error.code, 'INVALID_JSON')
  console.log('PASS: media-type and malformed-JSON errors')

  const removed = await request('/api/progress', { method: 'DELETE', headers })
  assert.equal(removed.body.deleted, true)
  const afterDelete = await request('/api/progress', { headers })
  assert.equal(afterDelete.body.exists, false)
  console.log('PASS: snapshot deletion and empty readback')

  const unknown = await fetch(`${base}/api/progress`, { method: 'OPTIONS', headers: { Origin: 'https://untrusted.example', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,x-mo-sync-id' } })
  assert.equal(unknown.status, 403)
  assert.equal(unknown.headers.get('access-control-allow-origin') === '*', false)
  assert.equal((await unknown.json()).error.code, 'ORIGIN_NOT_ALLOWED')
  console.log('PASS: unknown-origin preflight is rejected before browser access')
  console.log('ALL SELF-HOSTED API CHECKS PASSED')
} finally {
  await stop()
  fs.rmSync(dataDir, { recursive: true, force: true })
}

import path from 'node:path'
import express from 'express'
import { snapshotSchema, syncIdSchema } from './validation.js'

function errorResponse(res, status, code, message) {
  return res.status(status).json({ error: { code, message } })
}

export function createApp({ store, distDir, allowedOrigins = [] }) {
  const app = express()
  const externalOrigins = new Set(allowedOrigins.map(origin => origin.trim()).filter(Boolean))
  app.disable('x-powered-by')
  if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1)

  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'DENY',
    })
    next()
  })

  app.use('/api', (req, res, next) => {
    const origin = req.get('Origin')
    if (!origin) return next()
    const ownOrigin = `${req.protocol}://${req.get('Host')}`
    if (origin !== ownOrigin && !externalOrigins.has(origin)) {
      if (req.method === 'OPTIONS') return errorResponse(res, 403, 'ORIGIN_NOT_ALLOWED', 'This origin is not allowed')
      return next()
    }
    res.set({
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Mo-Sync-Id',
      'Access-Control-Max-Age': '600',
      Vary: 'Origin',
    })
    if (req.method === 'OPTIONS') return res.sendStatus(204)
    next()
  })

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, database: 'sqlite', service: 'mo-progress' })
  })

  app.use('/api/progress', (req, res, next) => {
    const parsed = syncIdSchema.safeParse(req.get('X-Mo-Sync-Id'))
    if (!parsed.success) return errorResponse(res, 401, 'INVALID_SYNC_ID', 'A valid 64-character sync ID is required')
    req.syncId = parsed.data
    next()
  })

  app.get('/api/progress', (req, res) => {
    res.json(store.read(req.syncId))
  })

  app.post(
    '/api/progress',
    (req, res, next) => {
      if (!req.is('application/json')) return errorResponse(res, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Use application/json')
      next()
    },
    express.json({ limit: '2mb' }),
    (req, res) => {
      const parsed = snapshotSchema.safeParse(req.body)
      if (!parsed.success) return errorResponse(res, 400, 'INVALID_SNAPSHOT', 'The progress snapshot is invalid')
      res.json(store.write(req.syncId, parsed.data))
    },
  )

  app.delete('/api/progress', (req, res) => {
    res.json(store.delete(req.syncId))
  })

  app.use('/api', (req, res) => errorResponse(res, 404, 'NOT_FOUND', 'API endpoint not found'))

  app.use(express.static(distDir, {
    index: 'index.html',
    setHeaders(res, filePath) {
      if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache')
      else if (filePath.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      else res.setHeader('Cache-Control', 'public, max-age=86400')
    },
  }))

  app.use((req, res, next) => {
    if (req.method !== 'GET' || !req.accepts('html')) return next()
    res.set('Cache-Control', 'no-cache')
    res.sendFile(path.join(distDir, 'index.html'))
  })

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error)
    if (error?.type === 'entity.parse.failed') return errorResponse(res, 400, 'INVALID_JSON', 'Malformed JSON')
    if (error?.type === 'entity.too.large') return errorResponse(res, 413, 'SNAPSHOT_TOO_LARGE', 'Snapshot exceeds 2 MB')
    console.error('Request failed', error)
    return errorResponse(res, 500, 'INTERNAL_ERROR', 'The server could not complete the request')
  })

  return app
}

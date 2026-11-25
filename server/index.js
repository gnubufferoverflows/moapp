import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from './app.js'
import { ProgressStore } from './store.js'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const port = Number.parseInt(process.env.PORT || '8080', 10)
const host = process.env.HOST || '0.0.0.0'
const store = new ProgressStore(process.env.DATA_DIR || path.join(rootDir, 'data'))
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',')
const app = createApp({ store, distDir: path.join(rootDir, 'dist'), allowedOrigins })
const server = app.listen(port, host, () => {
  console.log(`Mò is listening on http://${host}:${port}`)
})

function shutdown(signal) {
  console.log(`${signal} received; closing Mò`)
  server.close(() => {
    store.close()
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

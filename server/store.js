import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export class ProgressStore {
  constructor(dataDir) {
    mkdirSync(dataDir, { recursive: true })
    this.database = new DatabaseSync(path.join(dataDir, 'mo.sqlite'))
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS progress_snapshots (
        sync_id TEXT PRIMARY KEY,
        revision INTEGER NOT NULL,
        snapshot TEXT NOT NULL,
        server_updated_at TEXT NOT NULL
      );
    `)
    this.readStatement = this.database.prepare(
      'SELECT revision, snapshot, server_updated_at AS serverUpdatedAt FROM progress_snapshots WHERE sync_id = ?',
    )
    this.writeStatement = this.database.prepare(`
      INSERT INTO progress_snapshots (sync_id, revision, snapshot, server_updated_at)
      VALUES (?, 1, ?, ?)
      ON CONFLICT(sync_id) DO UPDATE SET
        revision = progress_snapshots.revision + 1,
        snapshot = excluded.snapshot,
        server_updated_at = excluded.server_updated_at
      RETURNING revision, server_updated_at AS serverUpdatedAt
    `)
    this.deleteStatement = this.database.prepare('DELETE FROM progress_snapshots WHERE sync_id = ?')
  }

  read(syncId) {
    const row = this.readStatement.get(syncId)
    if (!row) return { exists: false }
    return {
      exists: true,
      revision: row.revision,
      serverUpdatedAt: row.serverUpdatedAt,
      snapshot: JSON.parse(row.snapshot),
    }
  }

  write(syncId, snapshot) {
    const serverUpdatedAt = new Date().toISOString()
    const row = this.writeStatement.get(syncId, JSON.stringify(snapshot), serverUpdatedAt)
    return {
      exists: true,
      revision: row.revision,
      serverUpdatedAt: row.serverUpdatedAt,
      snapshot,
    }
  }

  delete(syncId) {
    return { deleted: this.deleteStatement.run(syncId).changes > 0 }
  }

  close() {
    this.database.close()
  }
}

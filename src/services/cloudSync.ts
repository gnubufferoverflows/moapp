import type { CustomContentState } from '@/hooks/useCustomContent'
import type { ProgressState } from '@/types'

const SYNC_ID_KEY = 'mo-cloud-sync-id-v1'
// Same-origin by default; split deployments can provide an API origin at build time.
const baseUrl = (import.meta.env.VITE_SYNC_BASE_URL || '').trim().replace(/\/+$/, '')

export interface CloudSnapshot {
  progress: ProgressState
  customContent: CustomContentState
  clientUpdatedAt: string
}

export interface CloudReadResult {
  exists: boolean
  revision?: number
  serverUpdatedAt?: string
  snapshot?: CloudSnapshot
}

export function getDeviceSyncId() {
  try {
    const existing = localStorage.getItem(SYNC_ID_KEY)
    if (existing && /^[a-f0-9]{64}$/.test(existing)) return existing
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    const id = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
    localStorage.setItem(SYNC_ID_KEY, id)
    return id
  } catch {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('')
  }
}

async function request(path: string, syncId: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { 'X-Mo-Sync-Id': syncId, ...init?.headers },
    signal: AbortSignal.timeout(12000),
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error?.message || 'Cloud sync is temporarily unavailable')
  if (!body) throw new Error('Cloud sync returned an invalid response')
  return body
}

export function readCloudSnapshot(syncId: string): Promise<CloudReadResult> {
  return request('/api/progress', syncId)
}

export function writeCloudSnapshot(syncId: string, snapshot: CloudSnapshot): Promise<{ revision: number; serverUpdatedAt: string }> {
  return request('/api/progress', syncId, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshot),
  })
}

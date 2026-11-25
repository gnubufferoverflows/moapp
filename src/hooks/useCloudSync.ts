import { useCallback, useEffect, useRef, useState } from 'react'
import type { CustomContentState } from '@/hooks/useCustomContent'
import { getDeviceSyncId, readCloudSnapshot, writeCloudSnapshot, type CloudSnapshot } from '@/services/cloudSync'
import type { ProgressState } from '@/types'

const UPDATED_AT_KEY = 'mo-cloud-updated-at-v1'

export type CloudSyncStatus = 'connecting' | 'syncing' | 'synced' | 'offline'

interface CloudSyncInput {
  progress: ProgressState
  customContent: CustomContentState
  replaceProgress: (progress: ProgressState) => void
  replaceContent: (content: CustomContentState) => void
}

function signatureFor(progress: ProgressState, customContent: CustomContentState) {
  return JSON.stringify({ progress, customContent })
}

function validTime(value?: string) {
  const time = value ? Date.parse(value) : 0
  return Number.isFinite(time) ? time : 0
}

function storedTimestamp() {
  try { return localStorage.getItem(UPDATED_AT_KEY) || '' } catch { return '' }
}

function persistTimestamp(value: string) {
  try { localStorage.setItem(UPDATED_AT_KEY, value) } catch { /* Local storage may be unavailable. */ }
}

function deriveTimestamp(progress: ProgressState, content: CustomContentState) {
  const times = [
    ...Object.values(progress.characters).map(item => item.lastPracticed),
    ...content.packs.map(item => item.updatedAt),
    ...content.palettes.map(item => item.updatedAt),
  ]
  return times.reduce((latest, value) => validTime(value) > validTime(latest) ? value : latest, '')
}

export function useCloudSync({ progress, customContent, replaceProgress, replaceContent }: CloudSyncInput) {
  const [status, setStatusState] = useState<CloudSyncStatus>('connecting')
  const [lastSyncedAt, setLastSyncedAt] = useState('')
  const [retryToken, setRetryToken] = useState(0)
  const [syncId] = useState(getDeviceSyncId)
  const statusRef = useRef(status)
  const latestRef = useRef({ progress, customContent })
  const initialSignature = useRef(signatureFor(progress, customContent))
  const lastWrittenSignature = useRef('')
  const localUpdatedAt = useRef(storedTimestamp() || deriveTimestamp(progress, customContent))
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const uploadingRef = useRef(false)
  latestRef.current = { progress, customContent }

  const setStatus = useCallback((next: CloudSyncStatus) => {
    statusRef.current = next
    setStatusState(next)
  }, [])

  const markModified = useCallback(() => {
    localUpdatedAt.current = new Date().toISOString()
    persistTimestamp(localUpdatedAt.current)
  }, [])

  const upload = useCallback(async () => {
    if (uploadingRef.current) return
    uploadingRef.current = true
    const current = latestRef.current
    const sentSignature = signatureFor(current.progress, current.customContent)
    if (!localUpdatedAt.current) markModified()
    try {
      const result = await writeCloudSnapshot(syncId, {
        progress: current.progress,
        customContent: current.customContent,
        clientUpdatedAt: localUpdatedAt.current,
      })
      lastWrittenSignature.current = sentSignature
      setLastSyncedAt(result.serverUpdatedAt || new Date().toISOString())
      setStatus('synced')
    } catch {
      setStatus('offline')
    } finally {
      uploadingRef.current = false
      if (signatureFor(latestRef.current.progress, latestRef.current.customContent) !== lastWrittenSignature.current) {
        setRetryToken(token => token + 1)
      }
    }
  }, [markModified, setStatus, syncId])

  useEffect(() => {
    let active = true
    const initialize = async () => {
      try {
        const remote = await readCloudSnapshot(syncId)
        if (!active) return
        if (remote.exists && remote.snapshot) {
          const snapshot = remote.snapshot
          const remoteSignature = signatureFor(snapshot.progress, snapshot.customContent)
          const localSignature = signatureFor(latestRef.current.progress, latestRef.current.customContent)
          if (validTime(snapshot.clientUpdatedAt) > validTime(localUpdatedAt.current)) {
            lastWrittenSignature.current = remoteSignature
            localUpdatedAt.current = snapshot.clientUpdatedAt
            persistTimestamp(snapshot.clientUpdatedAt)
            replaceProgress(snapshot.progress)
            replaceContent(snapshot.customContent)
          } else if (remoteSignature === localSignature) {
            lastWrittenSignature.current = remoteSignature
          }
          setLastSyncedAt(remote.serverUpdatedAt || '')
        }
        setStatus('synced')
      } catch {
        if (active) setStatus('offline')
      }
    }
    void initialize()
    return () => { active = false }
  }, [replaceContent, replaceProgress, setStatus, syncId])

  const signature = signatureFor(progress, customContent)
  useEffect(() => {
    if (status === 'connecting') {
      if (signature !== initialSignature.current) markModified()
      return
    }
    if (signature === lastWrittenSignature.current) return
    markModified()
    setStatus('syncing')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => { void upload() }, 700)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [markModified, retryToken, setStatus, signature, status, upload])

  useEffect(() => {
    const retry = () => setRetryToken(token => token + 1)
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [])

  const retry = useCallback(() => {
    lastWrittenSignature.current = ''
    setRetryToken(token => token + 1)
  }, [])

  return { status, lastSyncedAt, retry, syncId }
}

export type CloudSyncController = ReturnType<typeof useCloudSync>
export type { CloudSnapshot }

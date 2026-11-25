import { useCallback, useEffect, useState } from 'react'
import type { GradeResult, ProgressState } from '@/types'
import { emptyProgress } from '@/types'

const STORAGE_KEY = 'mo-hanzi-progress-v1'
const todayKey = () => new Date().toLocaleDateString('en-CA')

function loadProgress(): ProgressState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyProgress
    const parsed = JSON.parse(raw) as Partial<ProgressState>
    return {
      xp: typeof parsed.xp === 'number' ? parsed.xp : 0,
      attempts: typeof parsed.attempts === 'number' ? parsed.attempts : 0,
      characters: parsed.characters && typeof parsed.characters === 'object' ? parsed.characters : {},
      daily: parsed.daily && typeof parsed.daily === 'object' ? parsed.daily : {},
    }
  } catch {
    return emptyProgress
  }
}

export function useProgress() {
  const [progress, setProgress] = useState<ProgressState>(loadProgress)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)) } catch { /* Storage may be unavailable. */ }
  }, [progress])

  const recordGrade = useCallback((char: string, result: GradeResult) => {
    setProgress(previous => {
      const old = previous.characters[char]
      return {
        xp: previous.xp + Math.max(2, Math.round(result.score / 10)),
        attempts: previous.attempts + 1,
        characters: {
          ...previous.characters,
          [char]: {
            bestScore: Math.max(old?.bestScore || 0, result.score),
            attempts: (old?.attempts || 0) + 1,
            lastPracticed: new Date().toISOString(),
          },
        },
        daily: { ...previous.daily, [todayKey()]: (previous.daily[todayKey()] || 0) + 1 },
      }
    })
  }, [])

  const resetProgress = useCallback(() => setProgress(emptyProgress), [])
  const replaceProgress = useCallback((next: ProgressState) => setProgress(next), [])
  return { progress, recordGrade, resetProgress, replaceProgress }
}

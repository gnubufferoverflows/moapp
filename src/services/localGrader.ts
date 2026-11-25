import { translate, type Language } from '@/i18n'
import type { GradeResult, PracticeMode } from '@/types'

interface LocalGradeInput {
  char: string
  expectedStrokes: number
  correctStrokes: number
  mistakes: number
  mode: PracticeMode
  language?: Language
}

export function gradeLocally({ char, expectedStrokes, correctStrokes, mistakes, mode, language = 'en' }: LocalGradeInput): GradeResult {
  const safeExpected = Math.max(1, expectedStrokes)
  const accepted = Math.max(0, Math.min(safeExpected, correctStrokes))
  const corrections = Math.max(0, mistakes)
  const completion = accepted / safeExpected
  const complete = accepted === safeExpected
  const rawScore = Math.round(completion * 100 - Math.min(40, corrections * 4) * completion)
  const score = complete ? Math.max(0, Math.min(100, rawScore)) : Math.min(69, Math.max(0, rawScore))
  const remaining = safeExpected - accepted
  const isCorrect = complete && score >= 75
  const t = (key: Parameters<typeof translate>[1], variables?: Record<string, string | number>) => translate(language, key, variables)

  let summary = t('grade.incomplete', { accepted, total: safeExpected, char, remaining })
  if (complete && corrections === 0) summary = t('grade.clean', { char, total: safeExpected })
  else if (complete) summary = t('grade.corrected', { char, count: corrections })

  const feedback: string[] = []
  if (remaining > 0) feedback.push(t('grade.finishNext', { count: remaining }))
  if (corrections > 0) feedback.push(t('grade.reviewCorrections', { count: corrections }))
  if (complete && corrections === 0) feedback.push(t('grade.keepRhythm'))
  if (mode === 'guided' && complete) feedback.push(t('grade.switchRecall'))
  if ((mode === 'recall' || mode === 'hard') && !complete) feedback.push(t('grade.returnGuided'))

  return {
    attemptId: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    score,
    isCorrect,
    summary,
    feedback: feedback.slice(0, 3),
    strokeFeedback: t('grade.validation', { accepted, total: safeExpected, count: corrections }),
    engine: 'local',
    evaluatedAt: new Date().toISOString(),
  }
}

export type PracticeMode = 'guided' | 'recall'
export type AppView = 'practice' | 'sentences' | 'characters' | 'progress'

export interface GradeResult {
  attemptId: string
  score: number
  isCorrect: boolean
  summary: string
  feedback: string[]
  strokeFeedback: string
  engine: 'local'
  evaluatedAt: string
}

export interface CharacterProgress {
  bestScore: number
  attempts: number
  lastPracticed: string
}

export interface ProgressState {
  xp: number
  attempts: number
  characters: Record<string, CharacterProgress>
  daily: Record<string, number>
}

export const emptyProgress: ProgressState = {
  xp: 0,
  attempts: 0,
  characters: {},
  daily: {},
}

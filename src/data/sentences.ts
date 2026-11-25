import sentenceData from './sentences.json'
import type { HSKLevel } from './characters'

export interface SentenceItem {
  id: string
  level: HSKLevel | 'Custom'
  text: string
  pinyin: string
  meaning: string
  characters: string[]
}

export const sentences = sentenceData as SentenceItem[]

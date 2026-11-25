import { z } from 'zod'

const timestamp = z.string().max(64).refine(value => Number.isFinite(Date.parse(value)), 'Invalid timestamp')
const identifier = z.string().trim().min(1).max(160)
const character = z.string().min(1).max(12)
const count = z.number().int().min(0).max(1_000_000_000)

const characterProgress = z.object({
  bestScore: z.number().int().min(0).max(100),
  attempts: count,
  lastPracticed: timestamp,
}).strict()

const sentence = z.object({
  id: identifier,
  level: z.enum(['HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5', 'HSK 6', 'HSK 7–9', 'Custom']),
  text: z.string().min(1).max(500),
  pinyin: z.string().max(2_000),
  meaning: z.string().max(2_000),
  characters: z.array(character).max(128),
}).strict()

const boundedRecord = (schema, maximum) => z.record(z.string().min(1).max(32), schema)
  .refine(value => Object.keys(value).length <= maximum, `Record exceeds ${maximum} entries`)

export const snapshotSchema = z.object({
  progress: z.object({
    xp: count,
    attempts: count,
    characters: boundedRecord(characterProgress, 12_000),
    daily: boundedRecord(count, 3_700),
  }).strict(),
  customContent: z.object({
    packs: z.array(z.object({
      id: identifier,
      name: z.string().trim().min(1).max(160),
      sentences: z.array(sentence).max(1_000),
      updatedAt: timestamp,
    }).strict()).max(200),
    palettes: z.array(z.object({
      id: identifier,
      name: z.string().trim().min(1).max(160),
      characters: z.array(character).max(512),
      updatedAt: timestamp,
    }).strict()).max(200),
  }).strict(),
  clientUpdatedAt: timestamp,
}).strict()

export const syncIdSchema = z.string().regex(/^[a-f0-9]{64}$/)

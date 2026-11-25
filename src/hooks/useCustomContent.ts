import { useCallback, useEffect, useState } from 'react'
import type { SentenceItem } from '@/data/sentences'

export interface SentencePack {
  id: string
  name: string
  sentences: SentenceItem[]
  updatedAt: string
}

export interface CharacterPalette {
  id: string
  name: string
  characters: string[]
  updatedAt: string
}

export interface CustomContentState {
  packs: SentencePack[]
  palettes: CharacterPalette[]
}

export type SentencePackInput = Omit<SentencePack, 'id' | 'updatedAt'>
export type CharacterPaletteInput = Omit<CharacterPalette, 'id' | 'updatedAt'>

const STORAGE_KEY = 'mo-custom-content-v1'
const emptyContent: CustomContentState = { packs: [], palettes: [] }

function loadContent(): CustomContentState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyContent
    const parsed = JSON.parse(raw) as Partial<CustomContentState>
    return {
      packs: Array.isArray(parsed.packs) ? parsed.packs : [],
      palettes: Array.isArray(parsed.palettes) ? parsed.palettes : [],
    }
  } catch {
    return emptyContent
  }
}

export function useCustomContent() {
  const [content, setContent] = useState<CustomContentState>(loadContent)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(content)) } catch { /* Storage may be unavailable. */ }
  }, [content])

  const savePack = useCallback((input: SentencePackInput, id?: string) => {
    const pack: SentencePack = { ...input, id: id || `pack-${crypto.randomUUID()}`, updatedAt: new Date().toISOString() }
    setContent(previous => ({ ...previous, packs: [pack, ...previous.packs.filter(item => item.id !== pack.id)] }))
    return pack.id
  }, [])

  const deletePack = useCallback((id: string) => {
    setContent(previous => ({ ...previous, packs: previous.packs.filter(item => item.id !== id) }))
  }, [])

  const savePalette = useCallback((input: CharacterPaletteInput, id?: string) => {
    const palette: CharacterPalette = { ...input, id: id || `palette-${crypto.randomUUID()}`, updatedAt: new Date().toISOString() }
    setContent(previous => ({ ...previous, palettes: [palette, ...previous.palettes.filter(item => item.id !== palette.id)] }))
    return palette.id
  }, [])

  const deletePalette = useCallback((id: string) => {
    setContent(previous => ({ ...previous, palettes: previous.palettes.filter(item => item.id !== id) }))
  }, [])

  const replaceContent = useCallback((next: CustomContentState) => setContent(next), [])

  return { content, savePack, deletePack, savePalette, deletePalette, replaceContent }
}

export type CustomContentController = ReturnType<typeof useCustomContent>

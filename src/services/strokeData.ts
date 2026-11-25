import type { CharDataLoaderFn, CharacterJson } from 'hanzi-writer'
import { characterByChar } from '@/data/characters'

const packByLevel: Record<string, string> = {
  Foundation: 'foundation',
  'HSK 1': 'hsk-1',
  'HSK 2': 'hsk-2',
  'HSK 3': 'hsk-3',
  'HSK 4': 'hsk-4',
  'HSK 5': 'hsk-5',
  'HSK 6': 'hsk-6',
  'HSK 7–9': 'hsk-7-9',
}

const packCache = new Map<string, Promise<Record<string, CharacterJson>>>()

function loadPack(pack: string) {
  const cached = packCache.get(pack)
  if (cached) return cached
  const request = fetch(`${import.meta.env.BASE_URL}stroke-packs/${pack}.json`)
    .then(response => {
      if (!response.ok) throw new Error(`Stroke pack ${pack} is unavailable`)
      return response.json() as Promise<Record<string, CharacterJson>>
    })
  packCache.set(pack, request)
  request.catch(() => packCache.delete(pack))
  return request
}

export const localCharDataLoader: CharDataLoaderFn = (char, onLoad, onError) => {
  const level = characterByChar.get(char)?.level
  const codePoint = char.codePointAt(0)
  const pack = level === 'Extended' && codePoint !== undefined
    ? `extended-${Math.floor(codePoint / 256).toString(16)}`
    : level ? packByLevel[level] : undefined
  if (!pack) {
    onError(new Error(`No stroke pack is available for ${char}`))
    return
  }
  loadPack(pack)
    .then(data => {
      const character = data[char]
      if (!character) throw new Error(`Stroke data is missing for ${char}`)
      onLoad(character)
    })
    .catch(onError)
}

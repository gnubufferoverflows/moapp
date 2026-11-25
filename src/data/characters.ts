import hskCharacters from './hskCharacters.json'
import extendedCharacters from './extendedCharacters.json'

export type HSKLevel = 'HSK 1' | 'HSK 2' | 'HSK 3' | 'HSK 4' | 'HSK 5' | 'HSK 6' | 'HSK 7–9'

export interface CharacterItem {
  char: string
  pinyin: string
  meaning: string
  strokes: number
  level: 'Foundation' | HSKLevel | 'Extended'
  example: string
  examplePinyin: string
  exampleMeaning: string
  note: string
}

const curated: CharacterItem[] = [
  { char: '永', pinyin: 'yǒng', meaning: 'forever · eternal', strokes: 5, level: 'Foundation', example: '他永远忘不了那一天。', examplePinyin: 'Tā yǒngyuǎn wàng bù liǎo nà yì tiān.', exampleMeaning: 'He will never forget that day.', note: 'The classic five-stroke study: a small universe of dots, turns, and sweeping lines.' },
  { char: '一', pinyin: 'yī', meaning: 'one · a', strokes: 1, level: 'HSK 1', example: '一个', examplePinyin: 'yí ge', exampleMeaning: 'one (of something)', note: 'One confident horizontal line. Let it settle slightly upward rather than perfectly flat.' },
  { char: '二', pinyin: 'èr', meaning: 'two', strokes: 2, level: 'HSK 1', example: '二月', examplePinyin: 'èryuè', exampleMeaning: 'February', note: 'Two horizontals, with the lower line longer. Give the top stroke room to breathe.' },
  { char: '三', pinyin: 'sān', meaning: 'three', strokes: 3, level: 'HSK 1', example: '三天', examplePinyin: 'sāntiān', exampleMeaning: 'three days', note: 'Three lines, three rhythms. The middle stroke is shortest; the final stroke anchors the form.' },
  { char: '人', pinyin: 'rén', meaning: 'person · people', strokes: 2, level: 'HSK 1', example: '人们', examplePinyin: 'rénmen', exampleMeaning: 'people', note: 'Two strokes lean into balance. Begin the left fall high, then open the right sweep.' },
  { char: '大', pinyin: 'dà', meaning: 'big · great', strokes: 3, level: 'HSK 1', example: '大家', examplePinyin: 'dàjiā', exampleMeaning: 'everyone', note: 'A person with arms stretched wide. Keep the crossing point above center.' },
  { char: '小', pinyin: 'xiǎo', meaning: 'small · little', strokes: 3, level: 'HSK 1', example: '小心', examplePinyin: 'xiǎoxīn', exampleMeaning: 'careful', note: 'A central hook held between two light dots. Symmetry matters more than size.' },
  { char: '上', pinyin: 'shàng', meaning: 'up · above', strokes: 3, level: 'HSK 1', example: '上学', examplePinyin: 'shàngxué', exampleMeaning: 'to go to school', note: 'Build upward from a steady base. The short horizontal sits to the right of the vertical.' },
  { char: '下', pinyin: 'xià', meaning: 'down · below', strokes: 3, level: 'HSK 1', example: '下雨', examplePinyin: 'xiàyǔ', exampleMeaning: 'to rain', note: 'A long top line, a descending vertical, then a small dot that resolves the gesture.' },
  { char: '中', pinyin: 'zhōng', meaning: 'middle · center', strokes: 4, level: 'HSK 1', example: '中国', examplePinyin: 'Zhōngguó', exampleMeaning: 'China', note: 'The vertical passes cleanly through the center of the box. Keep both sides balanced.' },
  { char: '口', pinyin: 'kǒu', meaning: 'mouth · opening', strokes: 3, level: 'HSK 1', example: '人口', examplePinyin: 'rénkǒu', exampleMeaning: 'population', note: 'Three strokes make the enclosure. Leave the corners crisp without making them rigid.' },
  { char: '日', pinyin: 'rì', meaning: 'sun · day', strokes: 4, level: 'HSK 1', example: '日子', examplePinyin: 'rìzi', exampleMeaning: 'day · date', note: 'A tall, narrow frame with one centered line. Keep the verticals nearly parallel.' },
  { char: '月', pinyin: 'yuè', meaning: 'moon · month', strokes: 4, level: 'HSK 1', example: '月亮', examplePinyin: 'yuèliang', exampleMeaning: 'the moon', note: 'The left falling stroke curves gently; two inner lines stay light and evenly spaced.' },
  { char: '山', pinyin: 'shān', meaning: 'mountain', strokes: 3, level: 'HSK 1', example: '山水', examplePinyin: 'shānshuǐ', exampleMeaning: 'landscape', note: 'Three peaks rise from one connected base. The middle peak stands tallest.' },
  { char: '水', pinyin: 'shuǐ', meaning: 'water', strokes: 4, level: 'HSK 1', example: '水果', examplePinyin: 'shuǐguǒ', exampleMeaning: 'fruit', note: 'A strong central hook gathers four flowing movements. Let the outer strokes spread.' },
  { char: '火', pinyin: 'huǒ', meaning: 'fire', strokes: 4, level: 'HSK 1', example: '火车', examplePinyin: 'huǒchē', exampleMeaning: 'train', note: 'Two sparks precede the larger person-like form. Keep the final sweep open and warm.' },
  { char: '木', pinyin: 'mù', meaning: 'tree · wood', strokes: 4, level: 'HSK 1', example: '木头', examplePinyin: 'mùtou', exampleMeaning: 'wood', note: 'Root, trunk, then branches. The vertical crosses the horizontal above its midpoint.' },
  { char: '心', pinyin: 'xīn', meaning: 'heart · mind', strokes: 4, level: 'HSK 1', example: '心情', examplePinyin: 'xīnqíng', exampleMeaning: 'mood', note: 'Four light movements orbit a low central hook. Avoid making the base too heavy.' },
  { char: '手', pinyin: 'shǒu', meaning: 'hand', strokes: 4, level: 'HSK 1', example: '手机', examplePinyin: 'shǒujī', exampleMeaning: 'mobile phone', note: 'Three horizontals gather around a hooked vertical. The top stroke has a slight sweep.' },
  { char: '女', pinyin: 'nǚ', meaning: 'woman · female', strokes: 3, level: 'HSK 1', example: '女儿', examplePinyin: "nǚ’ér", exampleMeaning: 'daughter', note: 'Three interlocking strokes create the form. Write slowly enough to feel the crossing points.' },
  { char: '子', pinyin: 'zǐ', meaning: 'child · son', strokes: 3, level: 'HSK 1', example: '孩子', examplePinyin: 'háizi', exampleMeaning: 'child', note: 'A folded top, a long hooked center, and a final horizontal that steadies everything.' },
  { char: '我', pinyin: 'wǒ', meaning: 'I · me', strokes: 7, level: 'HSK 1', example: '我们', examplePinyin: 'wǒmen', exampleMeaning: 'we · us', note: 'A lively diagonal carries the character. Keep the left side compact so the right can extend.' },
  { char: '你', pinyin: 'nǐ', meaning: 'you', strokes: 7, level: 'HSK 1', example: '你好', examplePinyin: 'nǐhǎo', exampleMeaning: 'hello', note: 'The person radical stands narrow on the left, leaving space for the familiar 小-like form.' },
  { char: '好', pinyin: 'hǎo', meaning: 'good · well', strokes: 6, level: 'HSK 1', example: '好人', examplePinyin: 'hǎorén', exampleMeaning: 'a good person', note: 'Woman and child sit side by side. Give each half its own space, then bring them into balance.' },
  { char: '学', pinyin: 'xué', meaning: 'to learn · study', strokes: 8, level: 'HSK 1', example: '学生', examplePinyin: 'xuésheng', exampleMeaning: 'student', note: 'A bright crown above 子. Keep the upper marks light and the lower structure grounded.' },
  { char: '爱', pinyin: 'ài', meaning: 'love · to love', strokes: 10, level: 'HSK 1', example: '爱人', examplePinyin: 'àirén', exampleMeaning: 'beloved · spouse', note: 'A layered character with a warm center. Work from top to bottom and keep the middle open.' },
]

export const hskLevels: HSKLevel[] = ['HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5', 'HSK 6', 'HSK 7–9']

const curatedByChar = new Map(curated.map(item => [item.char, item]))

export const characters: CharacterItem[] = [
  curated[0],
  ...hskCharacters
    .filter(item => item.char !== '永')
    .map(item => {
      const base = { ...item, level: item.level as HSKLevel }
      const custom = curatedByChar.get(item.char)
      return custom ? {
        ...base,
        ...custom,
        level: base.level,
        example: base.example,
        examplePinyin: base.examplePinyin,
        exampleMeaning: base.exampleMeaning,
      } : base
    }),
]

const extended: CharacterItem[] = (extendedCharacters as [string, number][]).map(([char, strokes]) => ({
  char,
  pinyin: '',
  meaning: 'Extended character',
  strokes,
  level: 'Extended',
  example: char,
  examplePinyin: '',
  exampleMeaning: 'Extended stroke practice',
  note: `Extended character · ${strokes} strokes. Follow the validated stroke sequence, then try it again from memory.`,
}))

export const characterByChar = new Map(
  [...characters, ...extended].map(item => [item.char, item]),
)

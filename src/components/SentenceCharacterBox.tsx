import { useCallback, useEffect, useRef, useState } from 'react'
import HanziWriter, { type CharDataLoaderFn, type CharacterJson } from 'hanzi-writer'
import { Check, Gauge, Lightbulb, LoaderCircle, RotateCcw } from 'lucide-react'
import type { CharacterItem } from '@/data/characters'
import { useLanguage } from '@/i18n'
import { gradeLocally } from '@/services/localGrader'
import { captureFirstStroke, gradeFirstStroke, type FirstStrokeCapture } from '@/services/firstStroke'
import { localCharDataLoader } from '@/services/strokeData'
import type { GradeResult, PracticeMode } from '@/types'

interface SentenceCharacterBoxProps {
  item: CharacterItem
  position: number
  mode: PracticeMode
  bestScore?: number
  onGraded: (char: string, result: GradeResult, position: number) => void
}

export default function SentenceCharacterBox({ item, position, mode, bestScore, onGraded }: SentenceCharacterBoxProps) {
  const { language, t } = useLanguage()
  const targetRef = useRef<HTMLDivElement>(null)
  const writerRef = useRef<HanziWriter | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [correctStrokes, setCorrectStrokes] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [hasInk, setHasInk] = useState(false)
  const [grade, setGrade] = useState<GradeResult | null>(null)
  const charDataRef = useRef<CharacterJson | null>(null)
  const firstStrokeRef = useRef<FirstStrokeCapture | null>(null)
  const firstStrokeMissesRef = useRef(0)
  const mistakesOffsetRef = useRef(0)

  const startQuiz = useCallback<(startStroke?: number) => void>((startStroke = 0) => {
    writerRef.current?.quiz({
      leniency: mode === 'guided' ? 1 : 0.82,
      quizStartStrokeNum: startStroke,
      showHintAfterMisses: 3,
      highlightOnComplete: true,
      onMistake: data => setMistakes(mistakesOffsetRef.current + data.totalMistakes),
      onCorrectStroke: data => {
        setCorrectStrokes(data.strokeNum + 1)
        setMistakes(mistakesOffsetRef.current + data.totalMistakes)
      },
      onComplete: summary => {
        setCorrectStrokes(item.strokes)
        setMistakes(mistakesOffsetRef.current + summary.totalMistakes)
      },
    })
  }, [item.strokes, mode])

  // The opening stroke is graded with a custom matcher that is generous about
  // where the stroke lands in the box but keeps normal shape strictness.
  // Once accepted, hanzi-writer's quiz resumes from stroke 2 unchanged.
  const beginFirstStroke = useCallback(() => {
    const target = targetRef.current
    const charData = charDataRef.current
    if (!target || !charData) return
    firstStrokeRef.current?.destroy()
    firstStrokeRef.current = captureFirstStroke(target, {
      onStrokeDrawn: points => {
        const grade = gradeFirstStroke(points, charData, mode === 'guided' ? 1 : 0.82)
        if (grade.pass) {
          firstStrokeRef.current?.destroy()
          firstStrokeRef.current = null
          setCorrectStrokes(1)
          startQuiz(1)
        } else {
          firstStrokeRef.current?.rejectInk()
          firstStrokeMissesRef.current += 1
          mistakesOffsetRef.current += 1
          setMistakes(mistakesOffsetRef.current)
          if (firstStrokeMissesRef.current % 3 === 0) writerRef.current?.highlightStroke(0)
        }
      },
    })
  }, [mode, startQuiz])

  const beginStrokePhase = useCallback(() => {
    if (item.strokes > 1) beginFirstStroke()
    else startQuiz(0)
  }, [item.strokes, beginFirstStroke, startQuiz])

  useEffect(() => {
    const target = targetRef.current
    if (!target) return
    let active = true
    target.replaceChildren()
    const writer = HanziWriter.create(target, item.char, {
      width: 600,
      height: 600,
      padding: 54,
      renderer: 'svg',
      showCharacter: false,
      showOutline: mode === 'guided',
      strokeColor: '#263a35',
      outlineColor: '#d5cfc1',
      drawingColor: '#183d35',
      highlightColor: '#d9624c',
      drawingWidth: 9,
      strokeWidth: 4,
      outlineWidth: 2,
      delayBetweenStrokes: 160,
      charDataLoader: ((char, onLoad, onError) =>
        localCharDataLoader(char, data => {
          charDataRef.current = data
          onLoad(data)
        }, onError)) as CharDataLoaderFn,
      onLoadCharDataSuccess: () => {
        if (!active) return
        setLoading(false)
        mistakesOffsetRef.current = 0
        firstStrokeMissesRef.current = 0
        beginStrokePhase()
      },
      onLoadCharDataError: () => {
        if (!active) return
        setLoading(false)
        setError(true)
      },
    })
    writerRef.current = writer
    const svg = target.querySelector('svg')
    svg?.setAttribute('viewBox', '0 0 600 600')
    svg?.setAttribute('preserveAspectRatio', 'xMidYMid meet')
    return () => {
      active = false
      firstStrokeRef.current?.destroy()
      firstStrokeRef.current = null
      writer.cancelQuiz()
      writer.pauseAnimation()
      writerRef.current = null
    }
  }, [item.char, mode, beginStrokePhase])

  const reset = () => {
    const writer = writerRef.current
    if (!writer) return
    firstStrokeRef.current?.destroy()
    firstStrokeRef.current = null
    writer.cancelQuiz()
    writer.pauseAnimation()
    writer.hideCharacter({ duration: 0 })
    if (mode === 'guided') writer.showOutline({ duration: 0 })
    else writer.hideOutline({ duration: 0 })
    setCorrectStrokes(0)
    setMistakes(0)
    mistakesOffsetRef.current = 0
    firstStrokeMissesRef.current = 0
    setHasInk(false)
    setGrade(null)
    setError(false)
    beginStrokePhase()
  }

  const hint = async () => {
    const writer = writerRef.current
    if (!writer || correctStrokes >= item.strokes) return
    await writer.highlightStroke(correctStrokes)
    if (correctStrokes === 0 && item.strokes > 1) beginFirstStroke()
    else startQuiz(correctStrokes)
  }

  const score = () => {
    if (!hasInk || loading) return
    const result = gradeLocally({ char: item.char, expectedStrokes: item.strokes, correctStrokes, mistakes, mode, language })
    setGrade(result)
    onGraded(item.char, result, position)
  }

  return (
    <article className={`sentence-box ${grade?.isCorrect ? 'complete' : ''}`} data-testid={`sentence-box-${position}`}>
      <div className="sentence-box-heading">
        <div><span>{String(position + 1).padStart(2, '0')}</span><strong lang="zh-CN">{item.char}</strong><small>{item.pinyin}</small></div>
        {bestScore !== undefined && <span className="sentence-best">{t('common.best', { score: bestScore })}</span>}
      </div>
      <div className="writing-paper sentence-paper">
        <div className="practice-grid" aria-hidden="true" />
        <div ref={targetRef} className="writer-target" data-testid="writer-target" onPointerDown={() => { setHasInk(true); setGrade(null) }} aria-label={t('sentence.boxWrite', { char: item.char, position: position + 1 })} />
        {loading && <div className="paper-state"><LoaderCircle className="spin" size={22} /><span>{t('common.preparing')}</span></div>}
        {error && <div className="paper-state error"><span>{t('sentence.boxLoadError')}</span><button type="button" onClick={reset}>{t('common.tryAgain')}</button></div>}
        <div className="paper-caption"><span>{item.char}</span><span>{t('practice.paperStrokes', { accepted: correctStrokes, total: item.strokes })}</span></div>
      </div>
      {grade && <div className={`sentence-grade ${grade.isCorrect ? 'passed' : ''}`} data-testid="grade-result" aria-live="polite"><strong>{grade.isCorrect && <Check size={14} />}{grade.score}</strong><span>{grade.isCorrect ? t('sentence.complete') : t('sentence.left', { count: item.strokes - correctStrokes })}</span></div>}
      <div className="sentence-box-actions">
        <button type="button" onClick={hint} disabled={loading || correctStrokes >= item.strokes} aria-label={t('sentence.hintAria', { position: position + 1 })}><Lightbulb size={15} /> {t('common.hint')}</button>
        <button type="button" onClick={reset} disabled={loading} aria-label={t('sentence.resetAria', { position: position + 1 })}><RotateCcw size={15} /> {t('common.reset')}</button>
        <button className="sentence-score" type="button" onClick={score} disabled={!hasInk || loading} data-testid="review-writing"><Gauge size={15} /> {t('sentence.score')}</button>
      </div>
    </article>
  )
}

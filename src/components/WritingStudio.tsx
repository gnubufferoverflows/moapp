import { useCallback, useEffect, useRef, useState } from 'react'
import HanziWriter, { type CharDataLoaderFn, type CharacterJson } from 'hanzi-writer'
import { ArrowRight, Check, Gauge, Lightbulb, LoaderCircle, Play, RotateCcw, ShieldCheck, Volume2 } from 'lucide-react'
import type { CharacterItem } from '@/data/characters'
import { useLanguage } from '@/i18n'
import { gradeLocally } from '@/services/localGrader'
import { captureFirstStroke, gradeFirstStroke, type FirstStrokeCapture } from '@/services/firstStroke'
import { localCharDataLoader } from '@/services/strokeData'
import type { GradeResult, PracticeMode } from '@/types'

interface WritingStudioProps {
  item: CharacterItem
  mode: PracticeMode
  onModeChange: (mode: PracticeMode) => void
  onNext: () => void
  onGraded: (char: string, result: GradeResult) => void
  masteredScore?: number
  sessionCount: number
  dailyCount: number
}

function speak(text: string) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'zh-CN'
  utterance.rate = 0.78
  window.speechSynthesis.speak(utterance)
}

export default function WritingStudio({ item, mode, onModeChange, onNext, onGraded, masteredScore, sessionCount, dailyCount }: WritingStudioProps) {
  const { language, t } = useLanguage()
  const targetRef = useRef<HTMLDivElement>(null)
  const writerRef = useRef<HanziWriter | null>(null)
  const loadIdRef = useRef(0)
  const [correctStrokes, setCorrectStrokes] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [hasInk, setHasInk] = useState(false)
  const [localComplete, setLocalComplete] = useState(false)
  const [loading, setLoading] = useState(true)
  const [writerError, setWriterError] = useState(false)
  const [isDemo, setIsDemo] = useState(false)
  const [grade, setGrade] = useState<GradeResult | null>(null)
  const charDataRef = useRef<CharacterJson | null>(null)
  const firstStrokeRef = useRef<FirstStrokeCapture | null>(null)
  const firstStrokeMissesRef = useRef(0)
  const mistakesOffsetRef = useRef(0)

  const startQuiz = useCallback<(startStroke?: number) => void>((startStroke = 0) => {
    const writer = writerRef.current
    if (!writer) return
    writer.quiz({
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
        setLocalComplete(true)
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
    const loadId = ++loadIdRef.current
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
      delayBetweenStrokes: 220,
      strokeAnimationSpeed: 1.25,
      charDataLoader: ((char, onLoad, onError) =>
        localCharDataLoader(char, data => {
          charDataRef.current = data
          onLoad(data)
        }, onError)) as CharDataLoaderFn,
      onLoadCharDataSuccess: () => {
        if (loadId !== loadIdRef.current) return
        setLoading(false)
        mistakesOffsetRef.current = 0
        firstStrokeMissesRef.current = 0
        beginStrokePhase()
      },
      onLoadCharDataError: () => {
        if (loadId !== loadIdRef.current) return
        setLoading(false)
        setWriterError(true)
      },
    })
    writerRef.current = writer
    const svg = target.querySelector('svg')
    svg?.setAttribute('viewBox', '0 0 600 600')
    svg?.setAttribute('preserveAspectRatio', 'xMidYMid meet')
    return () => {
      firstStrokeRef.current?.destroy()
      firstStrokeRef.current = null
      writer.cancelQuiz()
      writer.pauseAnimation()
      writerRef.current = null
    }
  }, [item.char, item.strokes, mode, beginStrokePhase])

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
    setLocalComplete(false)
    setGrade(null)
    setWriterError(false)
    setIsDemo(false)
    beginStrokePhase()
  }

  const showDemo = async () => {
    const writer = writerRef.current
    if (!writer || isDemo) return
    setIsDemo(true)
    setGrade(null)
    firstStrokeRef.current?.destroy()
    firstStrokeRef.current = null
    writer.cancelQuiz()
    await writer.showCharacter({ duration: 100 })
    await writer.animateCharacter()
    await writer.hideCharacter({ duration: 120 })
    setIsDemo(false)
    if (correctStrokes === 0) beginStrokePhase()
    else startQuiz(correctStrokes)
  }

  const requestHint = async () => {
    const writer = writerRef.current
    if (!writer || localComplete || isDemo) return
    await writer.highlightStroke(Math.min(correctStrokes, item.strokes - 1))
    if (correctStrokes === 0 && item.strokes > 1) beginFirstStroke()
    else startQuiz(correctStrokes)
  }

  const reviewAttempt = () => {
    if (!hasInk || loading || isDemo) return
    const result = gradeLocally({ char: item.char, expectedStrokes: item.strokes, correctStrokes, mistakes, mode, language })
    setGrade(result)
    onGraded(item.char, result)
  }

  return (
    <section className="practice-layout" aria-label={t('practice.aria')}>
      <aside className="lesson-panel">
        <div className="lesson-topline">
          <span>{item.level === 'Foundation' && language === 'zh' ? '基础' : item.level === 'Extended' && language === 'zh' ? '扩展' : item.level}</span>
          <span>{item.strokes === 1 ? t('common.strokeOne') : t('common.strokes', { count: item.strokes })}</span>
        </div>
        <div className="pronunciation-row">
          <div>
            <div className="pinyin">{item.pinyin || (language === 'zh' ? '扩展字' : 'Extended')}</div>
            <h1>{language === 'zh' && item.level === 'Extended' ? '扩展汉字' : item.meaning}</h1>
          </div>
          <button className="icon-button dark" type="button" onClick={() => speak(item.char)} aria-label={t('practice.hear', { char: item.char })} title={t('practice.hearTitle')}>
            <Volume2 size={20} />
          </button>
        </div>

        <div className="character-index" aria-hidden="true">{item.char}</div>

        <div className="example-block">
          <span className="section-label">{t('practice.example')}</span>
          <div className="example-word"><span lang="zh-CN">{item.example}</span></div>
          <span className="example-pinyin">{item.examplePinyin}</span>
          <p>{item.exampleMeaning}</p>
        </div>
        <div className="writing-note">
          <span className="section-label">{t('practice.brushNote')}</span>
          <p>{item.note}</p>
        </div>
        {masteredScore !== undefined && <div className="mastery-note"><Check size={15} /> {t('practice.personalBest', { score: masteredScore })}</div>}
      </aside>

      <div className="writing-column">
        <div className="paper-toolbar">
          <div className="mode-switch" aria-label={t('practice.mode')}>
            <button type="button" className={mode === 'guided' ? 'active' : ''} onClick={() => onModeChange('guided')} aria-pressed={mode === 'guided'}>{t('common.guided')}</button>
            <button type="button" className={mode === 'recall' ? 'active' : ''} onClick={() => onModeChange('recall')} aria-pressed={mode === 'recall'}>{t('common.recall')}</button>
          </div>
          <span className="paper-instruction">{mode === 'guided' ? t('practice.trace') : t('practice.memory')}</span>
        </div>

        <div className={`writing-paper ${localComplete ? 'complete' : ''}`}>
          <div className="practice-grid" aria-hidden="true" />
          <div className="paper-seal" aria-hidden="true">写</div>
          <div
            ref={targetRef}
            className="writer-target"
            data-testid="writer-target"
            onPointerDown={() => { setHasInk(true); setGrade(null) }}
            aria-label={t('practice.writeAria', { char: item.char })}
          />
          {loading && <div className="paper-state"><LoaderCircle className="spin" size={24} /><span>{t('practice.preparing')}</span></div>}
          {writerError && <div className="paper-state error"><span>{t('practice.loadError')}</span><button type="button" onClick={reset}>{t('common.tryAgain')}</button></div>}
          {isDemo && <div className="demo-label"><Play size={14} /> {t('practice.watch')}</div>}
          <div className="paper-caption"><span>{item.char}</span><span>{t('practice.paperStrokes', { accepted: correctStrokes, total: item.strokes })}</span></div>
        </div>

        <div className="writing-tools">
          <button type="button" onClick={showDemo} disabled={loading || isDemo}><Play size={16} /> {t('common.demo')}</button>
          <button type="button" onClick={requestHint} disabled={loading || localComplete || isDemo}><Lightbulb size={16} /> {t('common.hint')}</button>
          <button type="button" onClick={reset} disabled={loading}><RotateCcw size={16} /> {t('common.reset')}</button>
        </div>

        <div className="primary-actions">
          <button className="local-button" type="button" onClick={reviewAttempt} disabled={!hasInk || loading || isDemo} data-testid="review-writing">
            <Gauge size={18} /> {grade ? t('practice.scoreAgain') : t('practice.score')}
          </button>
          <button className={`next-button ${localComplete ? 'ready' : ''}`} type="button" onClick={onNext}>{localComplete ? t('practice.nextCharacter') : t('practice.next')} <ArrowRight size={17} /></button>
        </div>
        <p className="microcopy"><ShieldCheck size={13} /> {t('practice.privacy')}</p>
      </div>

      <aside className="coach-panel" aria-live="polite">
        <div className="coach-heading">
          <div><Gauge size={17} /><span>{t('practice.coach')}</span></div>
          <span className="status-dot online" title={t('practice.ready')} />
        </div>

        {!grade && (
          <div className="coach-empty">
            <div className="coach-glyph" aria-hidden="true">墨</div>
            <h2>{localComplete ? t('practice.sequenced') : t('practice.inkStory')}</h2>
            <p>{localComplete ? mistakes ? t('practice.completeCorrections', { count: mistakes }) : t('practice.completeFirstPass') : t('practice.startCoaching')}</p>
            <div className="coach-tip"><span>{t('practice.localScoring')}</span><p>{mistakes > 0 ? t('practice.correctionTip', { count: mistakes }) : t('practice.scoreTip')}</p></div>
          </div>
        )}

        {grade && (
          <div className="grade-result" data-testid="grade-result">
            <div className="score-block">
              <div className="score-ring" style={{ '--score': grade.score } as React.CSSProperties}><strong>{grade.score}</strong><span>/ 100</span></div>
              <div><span className="section-label">{grade.isCorrect ? t('practice.complete') : t('practice.keepShaping')}</span><h2>{grade.isCorrect ? t('practice.everyStroke') : t('practice.more')}</h2></div>
            </div>
            <p className="grade-summary">{grade.summary}</p>
            <div className="feedback-list">
              {grade.feedback.map((tip, index) => <div key={`${index}-${tip}`}><span>0{index + 1}</span><p>{tip}</p></div>)}
            </div>
            <div className="stroke-feedback"><Check size={15} /><p>{grade.strokeFeedback}</p></div>
          </div>
        )}

        <div className="session-meter">
          <div><span>{t('practice.todayRhythm')}</span><strong>{t('practice.reviews', { count: Math.min(dailyCount, 5) })}</strong></div>
          <div className="meter-track"><span style={{ width: `${Math.min(100, dailyCount / 5 * 100)}%` }} /></div>
          <p>{dailyCount >= 5 ? t('practice.goalComplete') : sessionCount > 0 ? t('practice.sessionReviews', { count: sessionCount }) : t('practice.fiveReviews')}</p>
        </div>
      </aside>
    </section>
  )
}

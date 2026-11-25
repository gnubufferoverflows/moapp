import { useMemo, useState } from 'react'
import { ArrowRight, Check, Pencil, Plus, Trash2, Volume2 } from 'lucide-react'
import SentenceCharacterBox from '@/components/SentenceCharacterBox'
import SentencePackEditor from '@/components/SentencePackEditor'
import { characterByChar, hskLevels, type HSKLevel } from '@/data/characters'
import { sentences, type SentenceItem } from '@/data/sentences'
import type { CustomContentController } from '@/hooks/useCustomContent'
import { useLanguage } from '@/i18n'
import type { GradeResult, PracticeMode, ProgressState } from '@/types'

interface SentencePracticeProps {
  mode: PracticeMode
  onModeChange: (mode: PracticeMode) => void
  onGraded: (char: string, result: GradeResult) => void
  progress: ProgressState
  customContent: CustomContentController
}

function speakSentence(text: string) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'zh-CN'
  utterance.rate = 0.75
  window.speechSynthesis.speak(utterance)
}

export default function SentencePractice({ mode, onModeChange, onGraded, progress, customContent }: SentencePracticeProps) {
  const { t } = useLanguage()
  const [source, setSource] = useState<HSKLevel | `pack:${string}`>('HSK 1')
  const [sentenceIndexes, setSentenceIndexes] = useState<Record<string, number>>({})
  const [completed, setCompleted] = useState<Record<string, number[]>>({})
  const [editorOpen, setEditorOpen] = useState(false)
  const activePack = customContent.content.packs.find(pack => source === `pack:${pack.id}`)
  const levelSentences: SentenceItem[] = useMemo(() => activePack?.sentences || sentences.filter(sentence => sentence.level === source), [activePack, source])
  const sentenceIndex = (sentenceIndexes[source] || 0) % levelSentences.length
  const sentence = levelSentences[sentenceIndex]
  const sourceLabel = activePack?.name || source
  const completedPositions = completed[sentence.id] || []
  const sentenceComplete = completedPositions.length === sentence.characters.length

  const selectSentence = (index: number) => {
    setSentenceIndexes(previous => ({ ...previous, [source]: index }))
  }

  const nextSentence = () => selectSentence((sentenceIndex + 1) % levelSentences.length)

  const handleGraded = (char: string, result: GradeResult, position: number) => {
    onGraded(char, result)
    if (result.isCorrect) {
      setCompleted(previous => {
        const positions = previous[sentence.id] || []
        return positions.includes(position) ? previous : { ...previous, [sentence.id]: [...positions, position] }
      })
    }
  }

  const deleteActivePack = () => {
    if (!activePack || !window.confirm(t('sentences.deleteConfirm', { name: activePack.name }))) return
    customContent.deletePack(activePack.id)
    setSource('HSK 1')
  }

  return (
    <section className="sentence-view">
      <div className="view-heading sentence-heading">
        <div><span className="section-label">{t('sentences.kicker')}</span><h1>{t('sentences.title')}</h1><p>{t('sentences.subtitle')}</p></div>
        <div className="custom-heading-action"><div className="collection-total"><strong>84</strong><span>{t('sentences.hskLessons')}</span></div><button type="button" onClick={() => setEditorOpen(true)}><Plus size={16} /> {t('sentences.newPack')}</button></div>
      </div>
      <div className="level-tabs" aria-label={t('sentences.levelAria')}>
        {hskLevels.map(itemLevel => <button type="button" key={itemLevel} className={source === itemLevel ? 'active' : ''} onClick={() => setSource(itemLevel)} aria-pressed={source === itemLevel}>{itemLevel}</button>)}
        {customContent.content.packs.map(pack => <button className={source === `pack:${pack.id}` ? 'active custom-tab' : 'custom-tab'} type="button" key={pack.id} onClick={() => setSource(`pack:${pack.id}`)} aria-pressed={source === `pack:${pack.id}`}>{pack.name}</button>)}
      </div>
      <div className="sentence-card">
        <div className="sentence-card-top"><span>{t('sentences.lessonCount', { source: sourceLabel, current: sentenceIndex + 1, total: levelSentences.length })}</span><button className="icon-button dark" type="button" onClick={() => speakSentence(sentence.text)} aria-label={t('sentences.hear')} title={t('sentences.hear')}><Volume2 size={19} /></button></div>
        <div className="sentence-text" lang="zh-CN">{sentence.text}</div>
        <div className="sentence-translation"><strong>{sentence.pinyin}</strong><span>{sentence.meaning}</span></div>
        <div className="sentence-card-bottom">
          <span>{sentenceComplete ? <><Check size={15} /> {t('sentences.complete')}</> : t('sentences.progress', { completed: completedPositions.length, total: sentence.characters.length })}</span>
          <div className="mode-switch" aria-label={t('sentences.mode')}><button type="button" className={mode === 'guided' ? 'active' : ''} onClick={() => onModeChange('guided')} aria-pressed={mode === 'guided'}>{t('common.guided')}</button><button type="button" className={mode === 'recall' ? 'active' : ''} onClick={() => onModeChange('recall')} aria-pressed={mode === 'recall'}>{t('common.recall')}</button></div>
          <label>{t('sentences.choose')}<select value={sentenceIndex} onChange={event => selectSentence(Number(event.target.value))}>{levelSentences.map((option, index) => <option key={option.id} value={index}>{index + 1}. {option.text}</option>)}</select></label>
          <button type="button" onClick={nextSentence}>{t('sentences.next')} <ArrowRight size={15} /></button>
        </div>
        {activePack && <div className="custom-item-actions"><span>{t('sentences.customSaved')}</span><button type="button" onClick={() => setEditorOpen(true)}><Pencil size={14} /> {t('sentences.editPack')}</button><button className="danger" type="button" onClick={deleteActivePack}><Trash2 size={14} /> {t('sentences.deletePack')}</button></div>}
      </div>
      <div className="sentence-grid">
        {sentence.characters.map((char, position) => {
          const item = characterByChar.get(char)
          if (!item) return null
          return <SentenceCharacterBox key={`${sentence.id}-${position}-${char}-${mode}`} item={item} position={position} mode={mode} bestScore={progress.characters[char]?.bestScore} onGraded={handleGraded} />
        })}
      </div>
      <p className="sentence-privacy">{t('sentences.privacy')}</p>
      {editorOpen && <SentencePackEditor pack={activePack} onClose={() => setEditorOpen(false)} onSave={customContent.savePack} onSaved={id => setSource(`pack:${id}`)} />}
    </section>
  )
}

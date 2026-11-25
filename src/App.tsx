import { useEffect, useState } from 'react'
import './App.css'
import { BookOpen, Brush, ChartNoAxesColumnIncreasing, ChevronRight, MessageSquareText, ShieldCheck } from 'lucide-react'
import WritingStudio from '@/components/WritingStudio'
import SentencePractice from '@/components/SentencePractice'
import CharacterCollection from '@/components/CharacterCollection'
import ProgressView from '@/components/ProgressView'
import { characters, type CharacterItem } from '@/data/characters'
import { useProgress } from '@/hooks/useProgress'
import { useCustomContent } from '@/hooks/useCustomContent'
import { useCloudSync } from '@/hooks/useCloudSync'
import { useLanguage } from '@/i18n'
import type { AppView, GradeResult, PracticeMode } from '@/types'

export default function App() {
  const [view, setView] = useState<AppView>('practice')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [extendedCharacter, setExtendedCharacter] = useState<CharacterItem | null>(null)
  const [mode, setMode] = useState<PracticeMode>(() => {
    const saved = localStorage.getItem('mo-practice-mode')
    return saved === 'recall' || saved === 'hard' ? saved : 'guided'
  })
  const [sessionCount, setSessionCount] = useState(0)
  const { language, setLanguage, t } = useLanguage()
  const { progress, recordGrade, resetProgress, replaceProgress } = useProgress()
  const customContent = useCustomContent()
  const cloudSync = useCloudSync({ progress, customContent: customContent.content, replaceProgress, replaceContent: customContent.replaceContent })
  const current = extendedCharacter || characters[currentIndex]
  const today = new Date().toLocaleDateString('en-CA')

  useEffect(() => { localStorage.setItem('mo-practice-mode', mode) }, [mode])

  const selectCharacter = (item: CharacterItem) => {
    const index = characters.findIndex(character => character.char === item.char)
    if (index >= 0) {
      setCurrentIndex(index)
      setExtendedCharacter(null)
    } else {
      setExtendedCharacter(item)
    }
    setView('practice')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleGraded = (char: string, result: GradeResult) => {
    recordGrade(char, result)
    setSessionCount(count => count + 1)
  }

  const navigate = (next: AppView) => {
    setView(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="app-shell">
      <div className="ambient-ink" aria-hidden="true"><svg viewBox="0 0 800 500"><path d="M-40 430C160 410 210 70 440 130c170 45 40 245 220 205 70-15 110-75 190-120" /><path d="M60 480c170-80 245-40 330-160" /></svg></div>
      <header className="app-header">
        <button className="brand" type="button" onClick={() => navigate('practice')} aria-label={t('brand.home')}>
          <span className="brand-seal" lang="zh-CN">墨</span>
          <span className="brand-word"><strong>Mò</strong><small>HANZI STUDIO</small></span>
        </button>
        <nav className="main-nav" aria-label={t('nav.main')}>
          <button type="button" className={view === 'practice' ? 'active' : ''} onClick={() => navigate('practice')}><Brush size={16} /><span>{t('nav.practice')}</span></button>
          <button type="button" className={view === 'sentences' ? 'active' : ''} onClick={() => navigate('sentences')}><MessageSquareText size={16} /><span>{t('nav.sentences')}</span></button>
          <button type="button" className={view === 'characters' ? 'active' : ''} onClick={() => navigate('characters')}><BookOpen size={16} /><span>{t('nav.characters')}</span></button>
          <button type="button" className={view === 'progress' ? 'active' : ''} onClick={() => navigate('progress')}><ChartNoAxesColumnIncreasing size={16} /><span>{t('nav.progress')}</span></button>
        </nav>
        <div className="header-meta">
          <div className="local-status" title={t('header.localHint')}><span /><ShieldCheck size={14} /><span>{t('header.local')}</span></div>
          <div className="language-switch" role="group" aria-label={t('language.label')} data-testid="language-switch">
            <span className={`language-slider ${language === 'zh' ? 'show-zh' : 'show-en'}`} aria-hidden="true" />
            <button type="button" lang="zh-CN" className={language === 'zh' ? 'active' : ''} onClick={() => setLanguage('zh')} aria-pressed={language === 'zh'} aria-label="中文界面">中</button>
            <button type="button" lang="en" className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')} aria-pressed={language === 'en'} aria-label="English interface">英</button>
          </div>
          <div className="header-progress"><span>{t('header.today', { count: progress.daily[today] || 0 })}</span><ChevronRight size={14} /></div>
        </div>
      </header>

      <main>
        {view === 'practice' && (
          <>
            <div className="practice-intro"><div><span className="section-label">{t('practice.dailyPage', { index: String(currentIndex + 1).padStart(2, '0') })}</span><h2>{t('practice.title')}</h2></div><p>{t('practice.subtitle')}</p></div>
            <WritingStudio
              key={`${current.char}-${mode}`}
              item={current}
              mode={mode}
              onModeChange={setMode}
              onNext={() => { setExtendedCharacter(null); setCurrentIndex(index => (index + 1) % characters.length) }}
              onGraded={handleGraded}
              masteredScore={progress.characters[current.char]?.bestScore}
              sessionCount={sessionCount}
              dailyCount={progress.daily[today] || 0}
            />
          </>
        )}
        {view === 'sentences' && <SentencePractice mode={mode} onModeChange={setMode} onGraded={handleGraded} progress={progress} customContent={customContent} />}
        {view === 'characters' && <CharacterCollection progress={progress} onSelect={selectCharacter} customContent={customContent} />}
        {view === 'progress' && <ProgressView progress={progress} cloudSync={cloudSync} onSelect={selectCharacter} onReset={resetProgress} />}
      </main>
      <footer><span>Mò <span lang="zh-CN">墨</span></span><p>{t('footer.motto')}</p><span>汉字 · 一笔一画</span></footer>
    </div>
  )
}

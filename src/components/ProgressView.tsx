import { ArrowUpRight, Award, BookOpen, Cloud, CloudOff, Flame, LoaderCircle, RotateCcw, Target } from 'lucide-react'
import { characterByChar, type CharacterItem } from '@/data/characters'
import type { CloudSyncController } from '@/hooks/useCloudSync'
import { useLanguage } from '@/i18n'
import type { ProgressState } from '@/types'

interface ProgressViewProps {
  progress: ProgressState
  cloudSync: CloudSyncController
  onSelect: (item: CharacterItem) => void
  onReset: () => void
}

function dayKey(date: Date) { return date.toLocaleDateString('en-CA') }

const statusCopy = {
  connecting: { title: 'cloud.connecting', detail: 'cloud.connectingDetail' },
  syncing: { title: 'cloud.syncing', detail: 'cloud.syncingDetail' },
  synced: { title: 'cloud.synced', detail: 'cloud.syncedDetail' },
  offline: { title: 'cloud.offline', detail: 'cloud.offlineDetail' },
} as const

export default function ProgressView({ progress, cloudSync, onSelect, onReset }: ProgressViewProps) {
  const { language, t } = useLanguage()
  const practiced = Object.keys(progress.characters).length
  const mastered = Object.values(progress.characters).filter(item => item.bestScore >= 75).length
  const scores = Object.values(progress.characters).map(item => item.bestScore)
  const average = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0
  const locale = language === 'zh' ? 'zh-CN' : 'en'
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    return { date, count: progress.daily[dayKey(date)] || 0 }
  })
  const recent = [...characterByChar.values()].filter(item => progress.characters[item.char]).sort((a, b) => progress.characters[b.char].lastPracticed.localeCompare(progress.characters[a.char].lastPracticed)).slice(0, 5)
  const syncCopy = statusCopy[cloudSync.status]

  const reset = () => {
    if (window.confirm(t('progress.resetConfirm'))) onReset()
  }

  return (
    <section className="progress-view">
      <div className="view-heading">
        <div><span className="section-label">{t('progress.kicker')}</span><h1>{t('progress.title')}</h1><p>{t('progress.subtitle')}</p></div>
        {progress.attempts > 0 && <button className="reset-progress" type="button" onClick={reset}><RotateCcw size={15} /> {t('progress.reset')}</button>}
      </div>
      <div className={`cloud-backup ${cloudSync.status}`} data-testid="cloud-sync-status" role="status">
        <span className="cloud-backup-icon" aria-hidden="true">
          {cloudSync.status === 'offline' ? <CloudOff size={21} /> : cloudSync.status === 'synced' ? <Cloud size={21} /> : <LoaderCircle className="spin" size={21} />}
        </span>
        <div><strong>{t(syncCopy.title)}</strong><p>{t(syncCopy.detail)}</p><small>{t('cloud.privacy')}</small></div>
        {cloudSync.status === 'offline' && <button type="button" onClick={cloudSync.retry}>{t('cloud.retry')}</button>}
      </div>
      <div className="stats-row">
        <div className="stat"><BookOpen size={19} /><span>{t('progress.explored')}</span><strong>{practiced}<small> / {characterByChar.size.toLocaleString()}</small></strong></div>
        <div className="stat"><Award size={19} /><span>{t('progress.complete')}</span><strong>{mastered}<small> {t('progress.passed')}</small></strong></div>
        <div className="stat"><Target size={19} /><span>{t('progress.average')}</span><strong>{average}<small>%</small></strong></div>
        <div className="stat accent"><Flame size={19} /><span>{t('progress.energy')}</span><strong>{progress.xp}<small> {t('progress.ink')}</small></strong></div>
      </div>
      <div className="progress-panels">
        <div className="activity-panel">
          <div className="panel-heading"><div><span className="section-label">{t('progress.lastSeven')}</span><h2>{t('progress.rhythm')}</h2></div><strong>{t('progress.totalReviews', { count: progress.attempts })}</strong></div>
          <div className="activity-chart" aria-label={t('progress.chartAria')}>
            {days.map(({ date, count }) => <div className="activity-day" key={dayKey(date)}><span className="activity-count">{count || ''}</span><div className="activity-bar-track"><div className={count ? 'activity-bar filled' : 'activity-bar'} style={{ height: `${count ? Math.max(18, Math.min(100, count / 5 * 100)) : 5}%` }} title={t('progress.dayTitle', { count, date: date.toLocaleDateString(locale) })} /></div><span>{date.toLocaleDateString(locale, { weekday: 'narrow' })}</span><small>{date.getDate()}</small></div>)}
          </div>
        </div>
        <div className="recent-panel">
          <div className="panel-heading"><div><span className="section-label">{t('progress.recent')}</span><h2>{t('progress.recentCharacters')}</h2></div></div>
          {recent.length ? <div className="recent-list">{recent.map(item => <button type="button" key={item.char} onClick={() => onSelect(item)}><span className="recent-char">{item.char}</span><span><strong>{item.pinyin || (language === 'zh' ? '扩展汉字' : 'Extended character')}</strong><small>{progress.characters[item.char].attempts} {t(progress.characters[item.char].attempts === 1 ? 'progress.review' : 'progress.reviews')}</small></span><span className="recent-score">{progress.characters[item.char].bestScore}%</span><ArrowUpRight size={17} /></button>)}</div> : <div className="recent-empty"><span aria-hidden="true">一</span><p>{t('progress.first')}</p></div>}
        </div>
      </div>
      <p className="storage-note">{t('progress.storage')}</p>
    </section>
  )
}

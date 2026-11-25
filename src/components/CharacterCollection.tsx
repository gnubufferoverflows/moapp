import { useMemo, useState } from 'react'
import { ArrowUpRight, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import CharacterPaletteEditor from '@/components/CharacterPaletteEditor'
import { characterByChar, characters, hskLevels, type CharacterItem } from '@/data/characters'
import type { CustomContentController } from '@/hooks/useCustomContent'
import { useLanguage } from '@/i18n'
import type { ProgressState } from '@/types'

interface CharacterCollectionProps {
  progress: ProgressState
  onSelect: (item: CharacterItem) => void
  customContent: CustomContentController
}

type Filter = 'all' | 'learning' | 'mastered'
const PAGE_SIZE = 60

export default function CharacterCollection({ progress, onSelect, customContent }: CharacterCollectionProps) {
  const { language, t } = useLanguage()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [level, setLevel] = useState('all')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [editorOpen, setEditorOpen] = useState(false)
  const activePalette = customContent.content.palettes.find(palette => level === `palette:${palette.id}`)

  const filtered = useMemo(() => {
    const source = activePalette ? activePalette.characters.map(char => characterByChar.get(char)).filter((item): item is CharacterItem => Boolean(item)) : characters
    return source.filter(item => {
      const matchesLevel = Boolean(activePalette) || level === 'all' || item.level === level
      const matchesQuery = `${item.char} ${item.pinyin} ${item.meaning} ${item.example}`.toLowerCase().includes(query.trim().toLowerCase())
      const score = progress.characters[item.char]?.bestScore || 0
      const matchesFilter = filter === 'all' || (filter === 'mastered' ? score >= 75 : score < 75)
      return matchesLevel && matchesQuery && matchesFilter
    })
  }, [activePalette, filter, level, progress.characters, query])

  const visible = filtered.slice(0, visibleCount)
  const updateQuery = (value: string) => { setQuery(value); setVisibleCount(PAGE_SIZE) }
  const updateFilter = (value: Filter) => { setFilter(value); setVisibleCount(PAGE_SIZE) }
  const updateLevel = (value: string) => { setLevel(value); setVisibleCount(PAGE_SIZE) }
  const clearFilters = () => {
    setQuery('')
    setFilter('all')
    setLevel('all')
    setVisibleCount(PAGE_SIZE)
  }
  const deleteActivePalette = () => {
    if (!activePalette || !window.confirm(t('characters.deleteConfirm', { name: activePalette.name }))) return
    customContent.deletePalette(activePalette.id)
    updateLevel('all')
  }

  return (
    <section className="collection-view">
      <div className="view-heading">
        <div><span className="section-label">{t('characters.kicker')}</span><h1>{t('characters.title')}</h1><p>{t('characters.subtitle')}</p></div>
        <div className="custom-heading-action"><div className="collection-total"><strong>{characters.length.toLocaleString()}</strong><span>{t('characters.forms')}</span></div><button type="button" onClick={() => setEditorOpen(true)}><Plus size={16} /> {t('characters.newPalette')}</button></div>
      </div>
      <div className="level-tabs" aria-label={t('characters.levelAria')}>
        <button type="button" className={level === 'all' ? 'active' : ''} onClick={() => updateLevel('all')} aria-pressed={level === 'all'}>{t('characters.allLevels')}</button>
        {hskLevels.map(item => <button type="button" key={item} className={level === item ? 'active' : ''} onClick={() => updateLevel(item)} aria-pressed={level === item}>{item}</button>)}
        {customContent.content.palettes.map(palette => <button type="button" key={palette.id} className={level === `palette:${palette.id}` ? 'active custom-tab' : 'custom-tab'} onClick={() => updateLevel(`palette:${palette.id}`)} aria-pressed={level === `palette:${palette.id}`}>{palette.name}</button>)}
      </div>
      {activePalette && <div className="custom-item-actions palette-actions"><span>{t('characters.paletteCount', { count: activePalette.characters.length })}</span><button type="button" onClick={() => setEditorOpen(true)}><Pencil size={14} /> {t('characters.editPalette')}</button><button className="danger" type="button" onClick={deleteActivePalette}><Trash2 size={14} /> {t('characters.deletePalette')}</button></div>}
      <div className="collection-controls">
        <label className="search-field"><Search size={18} /><input value={query} onChange={event => updateQuery(event.target.value)} placeholder={t('characters.searchPlaceholder')} aria-label={t('characters.search')} />{query && <button type="button" onClick={() => updateQuery('')} aria-label={t('characters.clearSearch')}><X size={16} /></button>}</label>
        <div className="filter-tabs" aria-label={t('characters.filterAria')}>
          <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => updateFilter('all')} aria-pressed={filter === 'all'}>{t('characters.all')}</button>
          <button type="button" className={filter === 'learning' ? 'active' : ''} onClick={() => updateFilter('learning')} aria-pressed={filter === 'learning'}>{t('characters.learning')}</button>
          <button type="button" className={filter === 'mastered' ? 'active' : ''} onClick={() => updateFilter('mastered')} aria-pressed={filter === 'mastered'}>{t('characters.complete')}</button>
        </div>
      </div>
      <div className="collection-result-count" aria-live="polite">{t('characters.showing', { visible: visible.length.toLocaleString(), total: filtered.length.toLocaleString() })}</div>
      {filtered.length > 0 ? (
        <>
          <div className="character-grid">
            {visible.map(item => {
              const score = progress.characters[item.char]?.bestScore
              const meaning = language === 'zh' && item.level === 'Extended' ? '扩展汉字' : item.meaning
              const levelLabel = language === 'zh' && item.level === 'Extended' ? '扩展' : language === 'zh' && item.level === 'Foundation' ? '基础' : item.level
              return (
                <button className="character-card" type="button" key={item.char} onClick={() => onSelect(item)} aria-label={t('characters.practiceAria', { char: item.char, meaning })}>
                  <div className="character-card-top"><span>{levelLabel}</span>{score !== undefined && <span className={score >= 75 ? 'mastered' : ''}>{t('characters.best', { score })}</span>}</div>
                  <span className="collection-char" lang="zh-CN">{item.char}</span>
                  <div className="character-card-bottom"><div><strong>{item.pinyin || levelLabel}</strong><span>{meaning}</span></div><ArrowUpRight size={20} /></div>
                </button>
              )
            })}
          </div>
          {visible.length < filtered.length && <button className="load-more" type="button" onClick={() => setVisibleCount(count => count + PAGE_SIZE)}><Plus size={17} /> {t('characters.loadMore', { count: Math.min(PAGE_SIZE, filtered.length - visible.length) })}</button>}
        </>
      ) : (
        <div className="empty-collection"><Search size={28} /><h2>{t('characters.none')}</h2><p>{t('characters.noneHint')}</p><button type="button" onClick={clearFilters}>{t('characters.showAll')}</button></div>
      )}
      <p className="data-credit">{t('characters.credit')}</p>
      {editorOpen && <CharacterPaletteEditor palette={activePalette} onClose={() => setEditorOpen(false)} onSave={customContent.savePalette} onSaved={id => updateLevel(`palette:${id}`)} />}
    </section>
  )
}

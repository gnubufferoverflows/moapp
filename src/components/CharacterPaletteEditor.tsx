import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import { characterByChar } from '@/data/characters'
import type { CharacterPalette, CharacterPaletteInput } from '@/hooks/useCustomContent'
import { useLanguage } from '@/i18n'

interface CharacterPaletteEditorProps {
  palette?: CharacterPalette
  onClose: () => void
  onSave: (input: CharacterPaletteInput, id?: string) => string
  onSaved: (id: string) => void
}

export default function CharacterPaletteEditor({ palette, onClose, onSave, onSaved }: CharacterPaletteEditorProps) {
  const { t } = useLanguage()
  const [name, setName] = useState(palette?.name || '')
  const [characterText, setCharacterText] = useState(palette?.characters.join(' ') || '')
  const [error, setError] = useState('')

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const save = (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return setError(t('palette.nameRequired'))
    const found = Array.from(characterText).filter(char => /\p{Script=Han}/u.test(char))
    if (!found.length) return setError(t('palette.characterRequired'))
    const characters = [...new Set(found)]
    const unsupported = characters.filter(char => !characterByChar.has(char))
    if (unsupported.length) return setError(t('palette.unsupported', { characters: unsupported.join('、') }))
    const id = onSave({ name: name.trim(), characters }, palette?.id)
    onSaved(id)
    onClose()
  }

  return (
    <div className="editor-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <section className="custom-editor" role="dialog" aria-modal="true" aria-labelledby="palette-editor-title">
        <button className="editor-close" type="button" onClick={onClose} aria-label={t('palette.close')}><X size={19} /></button>
        <span className="section-label">{t('palette.kicker')}</span>
        <h2 id="palette-editor-title">{t(palette ? 'palette.editTitle' : 'palette.createTitle')}</h2>
        <p>{t('palette.description')}</p>
        <form onSubmit={save}>
          <label>{t('palette.name')}<input autoFocus value={name} onChange={event => setName(event.target.value)} placeholder={t('palette.namePlaceholder')} maxLength={60} /></label>
          <label>{t('palette.characters')}<textarea aria-label={t('palette.characters')} value={characterText} onChange={event => setCharacterText(event.target.value)} placeholder="永 水 心 木 火" rows={5} /></label>
          <div className="editor-format"><code>永 水 心 木 火</code><span>{t('palette.dedupe')}</span></div>
          {error && <p className="editor-error" role="alert">{error}</p>}
          <div className="editor-actions"><button type="button" onClick={onClose}>{t('common.cancel')}</button><button className="editor-primary" type="submit"><Check size={16} /> {palette ? t('common.saveChanges') : t('palette.create')}</button></div>
        </form>
      </section>
    </div>
  )
}

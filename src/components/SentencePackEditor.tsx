import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { characterByChar } from '@/data/characters'
import type { SentencePack, SentencePackInput } from '@/hooks/useCustomContent'
import { useLanguage } from '@/i18n'

interface SentencePackEditorProps {
  pack?: SentencePack
  onClose: () => void
  onSave: (input: SentencePackInput, id?: string) => string
  onSaved: (id: string) => void
}

function toEditorText(pack?: SentencePack) {
  return pack?.sentences.map(sentence => [sentence.text, sentence.pinyin, sentence.meaning].filter(Boolean).join(' | ')).join('\n') || ''
}

export default function SentencePackEditor({ pack, onClose, onSave, onSaved }: SentencePackEditorProps) {
  const { t } = useLanguage()
  const [name, setName] = useState(pack?.name || '')
  const [lessonText, setLessonText] = useState(toEditorText(pack))
  const [error, setError] = useState('')

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const save = (event: React.FormEvent) => {
    event.preventDefault()
    const lines = lessonText.split('\n').map(line => line.trim()).filter(Boolean)
    if (!name.trim()) return setError(t('pack.nameRequired'))
    if (!lines.length) return setError(t('pack.sentenceRequired'))

    const sentences = []
    for (let index = 0; index < lines.length; index++) {
      const [text = '', pinyin = '', meaning = ''] = lines[index].split('|').map(part => part.trim())
      const characters = Array.from(text).filter(char => /\p{Script=Han}/u.test(char))
      if (!characters.length) return setError(t('pack.lineCharacter', { line: index + 1 }))
      const unsupported = [...new Set(characters.filter(char => !characterByChar.has(char)))]
      if (unsupported.length) return setError(t('pack.unsupported', { line: index + 1, characters: unsupported.join('、') }))
      sentences.push({
        id: pack?.sentences[index]?.id || `custom-${crypto.randomUUID()}`,
        level: 'Custom' as const,
        text,
        pinyin: pinyin || t('common.customReading'),
        meaning: meaning || t('common.customSentence'),
        characters,
      })
    }
    const id = onSave({ name: name.trim(), sentences }, pack?.id)
    onSaved(id)
    onClose()
  }

  return (
    <div className="editor-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <section className="custom-editor" role="dialog" aria-modal="true" aria-labelledby="pack-editor-title">
        <button className="editor-close" type="button" onClick={onClose} aria-label={t('pack.close')}><X size={19} /></button>
        <span className="section-label">{t('pack.kicker')}</span>
        <h2 id="pack-editor-title">{t(pack ? 'pack.editTitle' : 'pack.createTitle')}</h2>
        <p>{t('pack.description')}</p>
        <form onSubmit={save}>
          <label>{t('pack.name')}<input autoFocus value={name} onChange={event => setName(event.target.value)} placeholder={t('pack.namePlaceholder')} maxLength={60} /></label>
          <label>{t('pack.sentences')}<textarea aria-label={t('pack.sentences')} value={lessonText} onChange={event => setLessonText(event.target.value)} placeholder={'今天我去公园。 | Jīntiān wǒ qù gōngyuán. | I am going to the park today.\n我们一起喝茶吧。 | Wǒmen yìqǐ hē chá ba. | Let’s have tea together.'} rows={7} /></label>
          <div className="editor-format"><code>{t('pack.format')}</code><span>{t('pack.formatHint')}</span></div>
          {error && <p className="editor-error" role="alert">{error}</p>}
          <div className="editor-actions"><button type="button" onClick={onClose}>{t('common.cancel')}</button><button className="editor-primary" type="submit"><Plus size={16} /> {pack ? t('common.saveChanges') : t('pack.create')}</button></div>
        </form>
      </section>
    </div>
  )
}

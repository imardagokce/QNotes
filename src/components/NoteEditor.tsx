import { useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { Note } from '../App'

interface Props {
  note: Note | null
  onSaved: () => void
}

export default function NoteEditor({ note, onSaved }: Props) {
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setContent(note?.content ?? '')
  }, [note])

  const scheduleSave = (text: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      save(text)
    }, 600)
  }

  const save = async (text: string) => {
    setSaving(true)
    try {
      if (note) {
        await invoke('update_note', { id: note.id, content: text })
      } else {
        await invoke('create_note', { content: text })
      }
      onSaved()
    } catch (err) {
      console.error('Failed to save note:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setContent(val)
    scheduleSave(val)
  }

  const handleNewNote = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setContent('')
    invoke('create_note', { content: '' }).then(onSaved).catch(console.error)
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-overlay-border bg-overlay-surface">
        <span className="text-overlay-muted text-xs">
          {saving ? 'Saving…' : note ? `Note #${note.id}` : 'New note'}
        </span>
        <button
          onClick={handleNewNote}
          className="text-xs px-2 py-0.5 rounded bg-overlay-border hover:bg-overlay-accent text-overlay-text hover:text-white transition-colors"
        >
          + New
        </button>
      </div>
      <textarea
        className="flex-1 p-3 bg-overlay-bg text-overlay-text text-sm resize-none outline-none placeholder-overlay-muted leading-relaxed"
        placeholder="Start typing your note…"
        value={content}
        onChange={handleChange}
        spellCheck
        autoFocus
      />
    </div>
  )
}

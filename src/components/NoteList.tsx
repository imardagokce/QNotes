import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { Note } from '../App'

interface Props {
  selectedNote: Note | null
  onSelect: (note: Note) => void
}

export default function NoteList({ selectedNote, onSelect }: Props) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    invoke<Note[]>('list_notes')
      .then(setNotes)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="w-48 border-r border-overlay-border flex items-center justify-center">
        <span className="text-overlay-muted text-xs">Loading…</span>
      </div>
    )
  }

  return (
    <div className="w-48 border-r border-overlay-border flex flex-col overflow-y-auto">
      {notes.length === 0 ? (
        <p className="p-3 text-overlay-muted text-xs">No notes yet.</p>
      ) : (
        notes.map((note) => {
          const preview = note.content.trim().slice(0, 60) || '(empty)'
          const isSelected = selectedNote?.id === note.id
          return (
            <button
              key={note.id}
              onClick={() => onSelect(note)}
              className={`text-left px-3 py-2 text-xs border-b border-overlay-border truncate transition-colors ${
                isSelected
                  ? 'bg-overlay-accent text-white'
                  : 'text-overlay-text hover:bg-overlay-border'
              }`}
            >
              {preview}
            </button>
          )
        })
      )}
    </div>
  )
}

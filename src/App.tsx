import { useState, useEffect, useRef, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

export interface Note {
  id: number
  content: string
  created_at: string
  updated_at: string
}

export default function App() {
  const [notes, setNotes] = useState<Note[]>([])
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [activeNote, setActiveNote] = useState<Note | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const activeTextareaRef = useRef<HTMLTextAreaElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Fetch all notes from SQLite backend
  const loadNotes = async () => {
    try {
      const data = await invoke<Note[]>('list_notes')
      setNotes(data)
    } catch (err) {
      console.error('Failed to load notes:', err)
    }
  }

  useEffect(() => {
    loadNotes()
  }, [])

  // Focus input on mount / window show
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Filter notes based on query
  const filteredNotes = useMemo(() => {
    if (!query.trim()) return notes
    const q = query.toLowerCase()
    return notes.filter((n) => n.content.toLowerCase().includes(q))
  }, [notes, query])

  // Keep selected index within bounds
  useEffect(() => {
    if (selectedIndex >= filteredNotes.length) {
      setSelectedIndex(Math.max(0, filteredNotes.length - 1))
    }
  }, [filteredNotes.length, selectedIndex])

  // Hide window handler
  const handleHide = async () => {
    try {
      await invoke('hide_window')
    } catch {
      try {
        const win = getCurrentWindow()
        await win.hide()
      } catch (e) {
        console.error('Failed to hide window:', e)
      }
    }
  }

  // Flash temporary status message
  const flashStatus = (msg: string) => {
    setStatusMessage(msg)
    setTimeout(() => setStatusMessage(null), 1800)
  }

  // Create new note
  const handleCreateNote = async (text?: string) => {
    const content = (text !== undefined ? text : query).trim()
    if (!content) return

    try {
      await invoke('create_note', { content })
      setQuery('')
      flashStatus('Note captured!')
      await loadNotes()
      setSelectedIndex(0)
      inputRef.current?.focus()
    } catch (err) {
      console.error('Failed to create note:', err)
    }
  }

  // Delete note
  const handleDeleteNote = async (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation()
    try {
      await invoke('delete_note', { id })
      if (activeNote?.id === id) {
        setActiveNote(null)
      }
      flashStatus('Note deleted')
      await loadNotes()
    } catch (err) {
      console.error('Failed to delete note:', err)
    }
  }

  // Copy note to clipboard
  const handleCopyNote = async (note: Note, e?: React.MouseEvent) => {
    e?.stopPropagation()
    try {
      await navigator.clipboard.writeText(note.content)
      setCopiedId(note.id)
      flashStatus('Copied to clipboard')
      setTimeout(() => setCopiedId(null), 1500)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Update existing note
  const handleSaveActiveNote = async (content: string) => {
    if (!activeNote) return
    try {
      await invoke('update_note', { id: activeNote.id, content })
      setActiveNote((prev) => (prev ? { ...prev, content } : null))
      await loadNotes()
    } catch (err) {
      console.error('Failed to update note:', err)
    }
  }

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape: close active note or hide overlay
      if (e.key === 'Escape') {
        e.preventDefault()
        if (activeNote) {
          setActiveNote(null)
          setTimeout(() => inputRef.current?.focus(), 50)
        } else if (query) {
          setQuery('')
        } else {
          handleHide()
        }
        return
      }

      // If viewing/editing active note
      if (activeNote) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault()
          setActiveNote(null)
          setTimeout(() => inputRef.current?.focus(), 50)
        }
        return
      }

      // Navigation in search / quick capture mode
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev < filteredNotes.length - 1 ? prev + 1 : prev
        )
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        // If there's input text that is not matching existing note or explicitly creating
        if (query.trim() && (filteredNotes.length === 0 || e.ctrlKey || e.metaKey)) {
          handleCreateNote()
        } else if (filteredNotes[selectedIndex]) {
          setActiveNote(filteredNotes[selectedIndex])
        } else if (query.trim()) {
          handleCreateNote()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeNote, query, selectedIndex, filteredNotes])

  // Format relative date
  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="w-full h-full p-2 flex items-center justify-center select-none bg-transparent">
      {/* Spotlight Container Card */}
      <div className="w-full h-full flex flex-col bg-spotlight-bg/95 backdrop-blur-2xl rounded-2xl border border-spotlight-border shadow-spotlight overflow-hidden transition-all duration-200">
        
        {/* Header Drag Region & Spotlight Bar */}
        <div
          data-tauri-drag-region
          className="flex items-center px-4 py-3 border-b border-spotlight-border bg-spotlight-surface/60 gap-3"
        >
          {/* Logo / Spotlight Glyph */}
          <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0 text-indigo-400 font-semibold text-xs tracking-wider">
            Q
          </div>

          {/* If in Note Edit mode */}
          {activeNote ? (
            <div className="flex items-center justify-between flex-1 gap-2">
              <button
                onClick={() => {
                  setActiveNote(null)
                  setTimeout(() => inputRef.current?.focus(), 50)
                }}
                className="flex items-center gap-1.5 text-xs text-spotlight-muted hover:text-spotlight-text transition-colors px-2 py-1 rounded-md hover:bg-white/5"
              >
                <span>← Back</span>
                <span className="text-[10px] text-spotlight-dim bg-white/5 px-1 rounded">Esc</span>
              </button>
              <span className="text-xs text-spotlight-dim">
                Updated {formatTime(activeNote.updated_at)}
              </span>
            </div>
          ) : (
            /* Search & Quick Capture Input */
            <div className="flex items-center flex-1 gap-2">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setSelectedIndex(0)
                }}
                placeholder="Type a note to capture or search existing..."
                className="w-full bg-transparent text-sm text-spotlight-text placeholder-spotlight-dim outline-none"
                autoFocus
                spellCheck={false}
              />

              {/* Action Hint / Status */}
              {query.trim() && (
                <button
                  onClick={() => handleCreateNote()}
                  className="shrink-0 flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-sm"
                >
                  <span>Save Note</span>
                  <span className="opacity-75 text-[10px]">↵</span>
                </button>
              )}
            </div>
          )}

          {/* Close Window Button */}
          <button
            onClick={handleHide}
            className="w-6 h-6 flex items-center justify-center rounded-md text-spotlight-dim hover:text-spotlight-text hover:bg-white/5 transition-colors text-xs"
            title="Hide (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Status Toast Banner */}
        {statusMessage && (
          <div className="bg-indigo-600/20 border-b border-indigo-500/20 px-4 py-1 text-center text-xs font-medium text-indigo-300">
            {statusMessage}
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeNote ? (
            /* Active Note Editor View */
            <div className="flex-1 flex flex-col p-4 bg-spotlight-bg">
              <textarea
                ref={activeTextareaRef}
                value={activeNote.content}
                onChange={(e) => handleSaveActiveNote(e.target.value)}
                placeholder="Start typing your note here..."
                className="flex-1 w-full bg-transparent text-sm text-spotlight-text placeholder-spotlight-dim outline-none resize-none leading-relaxed"
                autoFocus
              />
              <div className="flex items-center justify-between pt-2 border-t border-spotlight-border/60 text-xs text-spotlight-dim">
                <span>{activeNote.content.length} characters</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => handleCopyNote(activeNote, e)}
                    className="hover:text-spotlight-text transition-colors flex items-center gap-1"
                  >
                    <span>{copiedId === activeNote.id ? '✓ Copied' : 'Copy'}</span>
                  </button>
                  <button
                    onClick={(e) => handleDeleteNote(activeNote.id, e)}
                    className="hover:text-rose-400 transition-colors flex items-center gap-1"
                  >
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Spotlight Results List */
            <div
              ref={listRef}
              className="flex-1 overflow-y-auto divide-y divide-spotlight-border/40 p-1.5"
            >
              {filteredNotes.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-spotlight-dim">
                  {query.trim() ? (
                    <div className="space-y-1">
                      <p className="text-sm text-spotlight-muted">No notes match &ldquo;{query}&rdquo;</p>
                      <p className="text-xs">
                        Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-spotlight-text font-mono text-[10px]">Enter</kbd> to save it as a new note.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-10 h-10 mx-auto rounded-full bg-white/5 flex items-center justify-center text-spotlight-muted text-lg">
                        ✎
                      </div>
                      <p className="text-sm font-medium text-spotlight-muted">Your notes will appear here</p>
                      <p className="text-xs max-w-xs">
                        Type anything above and hit <kbd className="px-1 py-0.5 rounded bg-white/10 text-spotlight-text font-mono text-[10px]">Enter</kbd> to quickly capture your thoughts.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                filteredNotes.map((note, index) => {
                  const isSelected = index === selectedIndex
                  return (
                    <div
                      key={note.id}
                      onClick={() => setActiveNote(note)}
                      className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-600/15 border-l-2 border-indigo-500 pl-2.5'
                          : 'hover:bg-spotlight-hover text-spotlight-text border-l-2 border-transparent'
                      }`}
                    >
                      <div className="flex-1 min-w-0 pr-3">
                        <p
                          className={`text-xs font-normal truncate ${
                            isSelected ? 'text-white' : 'text-spotlight-text'
                          }`}
                        >
                          {note.content.trim() || <span className="italic text-spotlight-dim">(Empty note)</span>}
                        </p>
                        <span className="text-[10px] text-spotlight-dim">
                          {formatTime(note.updated_at)}
                        </span>
                      </div>

                      {/* Quick item actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleCopyNote(note, e)}
                          title="Copy to clipboard"
                          className="p-1 rounded text-spotlight-dim hover:text-spotlight-text hover:bg-white/10 text-xs"
                        >
                          {copiedId === note.id ? '✓' : '⎘'}
                        </button>
                        <button
                          onClick={(e) => handleDeleteNote(note.id, e)}
                          title="Delete note"
                          className="p-1 rounded text-spotlight-dim hover:text-rose-400 hover:bg-white/10 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>

        {/* Spotlight Footer Bar */}
        <div
          data-tauri-drag-region
          className="flex items-center justify-between px-3.5 py-2 bg-spotlight-surface/80 border-t border-spotlight-border text-[11px] text-spotlight-dim"
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-[9px] text-spotlight-muted">
                Alt+Space
              </kbd>
              <span>Toggle</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-[9px] text-spotlight-muted">
                ↵
              </kbd>
              <span>{activeNote ? 'Done' : 'Save / Open'}</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-[9px] text-spotlight-muted">
                ↑↓
              </kbd>
              <span>Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-[9px] text-spotlight-muted">
                Esc
              </kbd>
              <span>Hide</span>
            </span>
          </div>

          <div className="font-mono text-[10px] text-spotlight-dim">
            {notes.length} {notes.length === 1 ? 'note' : 'notes'}
          </div>
        </div>

      </div>
    </div>
  )
}

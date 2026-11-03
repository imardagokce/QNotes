import { useState, useEffect, useRef, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

export interface Note {
  id: number
  title: string
  content: string
  tags: string
  created_at: string
  updated_at: string
  is_pinned: boolean
}

export default function App() {
  const [notes, setNotes] = useState<Note[]>([])
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [activeNote, setActiveNote] = useState<Note | null>(null)
  const [activeContent, setActiveContent] = useState('')
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const editorTextareaRef = useRef<HTMLTextAreaElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch all notes from SQLite
  const loadNotes = useCallback(async () => {
    try {
      const data = await invoke<Note[]>('get_notes')
      setNotes(data)
    } catch (err) {
      console.error('Failed to get notes:', err)
    }
  }, [])

  // Initial load
  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  // Focus input whenever returning to search mode
  useEffect(() => {
    if (!activeNote) {
      inputRef.current?.focus()
    }
  }, [activeNote])

  // Real-time search via Rust command `search_notes`
  useEffect(() => {
    if (activeNote) return

    const trimmed = query.trim()
    if (!trimmed) {
      loadNotes()
      return
    }

    const timer = setTimeout(async () => {
      try {
        const results = await invoke<Note[]>('search_notes', { query: trimmed })
        setNotes(results)
        setSelectedIndex(0)
      } catch (err) {
        console.error('Failed to search notes:', err)
      }
    }, 60)

    return () => clearTimeout(timer)
  }, [query, activeNote, loadNotes])

  // Keep selectedIndex within bounds
  useEffect(() => {
    if (selectedIndex >= notes.length) {
      setSelectedIndex(Math.max(0, notes.length - 1))
    }
  }, [notes.length, selectedIndex])

  // Scroll active list item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex])

  // Hide window helper
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

  // Temporary toast notification
  const flashStatus = (msg: string) => {
    setStatusMessage(msg)
    setTimeout(() => setStatusMessage(null), 1800)
  }

  // Parse JSON tags safely
  const parseTags = (tagsStr: string): string[] => {
    try {
      const parsed = JSON.parse(tagsStr)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  // Format date helper
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

  // CREATE Note
  const handleCreateNote = async (text?: string) => {
    const content = (text !== undefined ? text : query).trim()
    if (!content) return

    try {
      const newNote = await invoke<Note>('create_note', { content })
      setQuery('')
      flashStatus('Note created!')
      await loadNotes()
      setSelectedIndex(0)
      inputRef.current?.focus()
      return newNote
    } catch (err) {
      console.error('Failed to create note:', err)
    }
  }

  // UPDATE Note
  const handleUpdateNoteContent = (newContent: string) => {
    setActiveContent(newContent)
    if (!activeNote) return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const updated = await invoke<Note>('update_note', {
          id: activeNote.id,
          content: newContent,
        })
        setActiveNote(updated)
        // Refresh notes in background
        const refreshed = await invoke<Note[]>('get_notes')
        setNotes(refreshed)
      } catch (err) {
        console.error('Failed to update note:', err)
      }
    }, 300)
  }

  // Open note in editor
  const handleOpenNote = (note: Note) => {
    setActiveNote(note)
    setActiveContent(note.content)
    setTimeout(() => editorTextareaRef.current?.focus(), 50)
  }

  // Close editor and return to list
  const handleCloseEditor = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    setActiveNote(null)
    setActiveContent('')
    loadNotes()
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  // DELETE Note
  const handleDeleteNote = async (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation()
    try {
      await invoke('delete_note', { id })
      if (activeNote?.id === id) {
        handleCloseEditor()
      }
      flashStatus('Note deleted')
      await loadNotes()
    } catch (err) {
      console.error('Failed to delete note:', err)
    }
  }

  // TOGGLE PIN Note
  const handleTogglePin = async (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation()
    try {
      const isPinned = await invoke<boolean>('toggle_pin_note', { id })
      if (activeNote?.id === id) {
        setActiveNote((prev) => (prev ? { ...prev, is_pinned: isPinned } : null))
      }
      flashStatus(isPinned ? 'Note pinned' : 'Note unpinned')
      await loadNotes()
    } catch (err) {
      console.error('Failed to toggle pin:', err)
    }
  }

  // COPY Note content
  const handleCopyNote = async (note: Note, e?: React.MouseEvent) => {
    e?.stopPropagation()
    try {
      await navigator.clipboard.writeText(note.content)
      setCopiedId(note.id)
      flashStatus('Copied to clipboard')
      setTimeout(() => setCopiedId(null), 1500)
    } catch (err) {
      console.error('Failed to copy note:', err)
    }
  }

  // Keyboard navigation & global hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape: Back from editor or hide overlay
      if (e.key === 'Escape') {
        e.preventDefault()
        if (activeNote) {
          handleCloseEditor()
        } else if (query) {
          setQuery('')
        } else {
          handleHide()
        }
        return
      }

      // Inside Active Editor
      if (activeNote) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault()
          handleCloseEditor()
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'Delete') {
          e.preventDefault()
          handleDeleteNote(activeNote.id)
        }
        return
      }

      // Inside Spotlight Search / List
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev < notes.length - 1 ? prev + 1 : prev))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        // If user holds Ctrl/Meta or there are no search results, create note from query
        if ((e.ctrlKey || e.metaKey) && query.trim()) {
          handleCreateNote()
        } else if (notes.length === 0 && query.trim()) {
          handleCreateNote()
        } else if (notes[selectedIndex]) {
          handleOpenNote(notes[selectedIndex])
        } else if (query.trim()) {
          handleCreateNote()
        }
      } else if (e.key === 'Delete' && (e.ctrlKey || e.metaKey) && notes[selectedIndex]) {
        // Quick delete selected item with Ctrl+Delete
        e.preventDefault()
        handleDeleteNote(notes[selectedIndex].id)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeNote, query, selectedIndex, notes])

  return (
    <div className="w-full h-full p-2 flex items-center justify-center select-none bg-transparent">
      {/* Spotlight Card */}
      <div className="w-full h-full flex flex-col bg-spotlight-bg/95 backdrop-blur-2xl rounded-2xl border border-spotlight-border shadow-spotlight overflow-hidden transition-all duration-200">
        
        {/* Header Drag Region & Spotlight Bar */}
        <div
          data-tauri-drag-region
          className="flex items-center px-4 py-3 border-b border-spotlight-border bg-spotlight-surface/70 gap-3"
        >
          {/* Brand Glyph */}
          <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0 text-indigo-400 font-semibold text-xs tracking-wider">
            Q
          </div>

          {/* Active Editor Navigation OR Search Input */}
          {activeNote ? (
            <div className="flex items-center justify-between flex-1 gap-2 min-w-0">
              <div className="flex items-center gap-2 truncate">
                <button
                  onClick={handleCloseEditor}
                  className="flex items-center gap-1.5 text-xs text-spotlight-muted hover:text-spotlight-text transition-colors px-2 py-1 rounded-md hover:bg-white/5 shrink-0"
                >
                  <span>← Back</span>
                  <span className="text-[10px] text-spotlight-dim bg-white/5 px-1 rounded">Esc</span>
                </button>
                <span className="text-xs font-medium text-white truncate max-w-xs">
                  {activeNote.title || 'Untitled Note'}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => handleTogglePin(activeNote.id, e)}
                  title={activeNote.is_pinned ? 'Unpin note' : 'Pin note'}
                  className={`text-xs px-2 py-1 rounded-md transition-colors ${
                    activeNote.is_pinned
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'text-spotlight-dim hover:text-spotlight-text hover:bg-white/5'
                  }`}
                >
                  {activeNote.is_pinned ? '📌 Pinned' : 'Pin'}
                </button>
                <span className="text-[11px] text-spotlight-dim">
                  {formatTime(activeNote.updated_at)}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center flex-1 gap-2">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a note to capture or search existing..."
                className="w-full bg-transparent text-sm text-spotlight-text placeholder-spotlight-dim outline-none"
                autoFocus
                spellCheck={false}
              />

              {/* Action Pill: Create Note */}
              {query.trim() && (
                <button
                  onClick={() => handleCreateNote()}
                  className="shrink-0 flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-sm"
                  title="Press Enter (or Ctrl+Enter) to save"
                >
                  <span>Capture</span>
                  <span className="opacity-75 text-[10px]">↵</span>
                </button>
              )}
            </div>
          )}

          {/* Close / Hide Window */}
          <button
            onClick={handleHide}
            className="w-6 h-6 flex items-center justify-center rounded-md text-spotlight-dim hover:text-spotlight-text hover:bg-white/5 transition-colors text-xs shrink-0"
            title="Hide (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Temporary Toast Banner */}
        {statusMessage && (
          <div className="bg-indigo-600/20 border-b border-indigo-500/20 px-4 py-1 text-center text-xs font-medium text-indigo-300 transition-all">
            {statusMessage}
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeNote ? (
            /* Note Editor View */
            <div className="flex-1 flex flex-col p-4 bg-spotlight-bg">
              <textarea
                ref={editorTextareaRef}
                value={activeContent}
                onChange={(e) => handleUpdateNoteContent(e.target.value)}
                placeholder="Start typing your note here... (First line will be the title, use #tags for tags)"
                className="flex-1 w-full bg-transparent text-sm text-spotlight-text placeholder-spotlight-dim outline-none resize-none leading-relaxed select-text"
                autoFocus
              />

              {/* Editor Bottom Meta & Actions */}
              <div className="flex items-center justify-between pt-2.5 border-t border-spotlight-border/60 text-xs text-spotlight-dim">
                <div className="flex items-center gap-2">
                  <span>{activeContent.length} chars</span>
                  <span>•</span>
                  <span>
                    {activeContent.trim() ? activeContent.trim().split(/\s+/).length : 0} words
                  </span>
                  {parseTags(activeNote.tags).map((tag) => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 text-[10px] font-mono"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={(e) => handleCopyNote(activeNote, e)}
                    className="hover:text-spotlight-text transition-colors flex items-center gap-1 text-[11px]"
                  >
                    <span>{copiedId === activeNote.id ? '✓ Copied' : 'Copy'}</span>
                  </button>
                  <button
                    onClick={(e) => handleDeleteNote(activeNote.id, e)}
                    className="hover:text-rose-400 transition-colors flex items-center gap-1 text-[11px]"
                  >
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Spotlight Notes List */
            <div
              ref={listRef}
              className="flex-1 overflow-y-auto divide-y divide-spotlight-border/30 p-1.5"
            >
              {notes.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-spotlight-dim">
                  {query.trim() ? (
                    <div className="space-y-1.5">
                      <p className="text-sm text-spotlight-muted">
                        No notes found for &ldquo;{query}&rdquo;
                      </p>
                      <p className="text-xs">
                        Press{' '}
                        <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-spotlight-text font-mono text-[10px]">
                          Enter
                        </kbd>{' '}
                        to create it as a new note.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-10 h-10 mx-auto rounded-full bg-white/5 flex items-center justify-center text-spotlight-muted text-lg">
                        ✎
                      </div>
                      <p className="text-sm font-medium text-spotlight-muted">
                        No notes in your vault yet
                      </p>
                      <p className="text-xs max-w-xs">
                        Type any thought above and press{' '}
                        <kbd className="px-1 py-0.5 rounded bg-white/10 text-spotlight-text font-mono text-[10px]">
                          Enter
                        </kbd>{' '}
                        to capture it instantly.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                notes.map((note, index) => {
                  const isSelected = index === selectedIndex
                  const tags = parseTags(note.tags)
                  // Remaining snippet without title line
                  const contentLines = note.content.split('\n')
                  const snippet =
                    contentLines.length > 1
                      ? contentLines.slice(1).join(' ').trim()
                      : ''

                  return (
                    <div
                      key={note.id}
                      onClick={() => handleOpenNote(note)}
                      className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-600/15 border-l-2 border-indigo-500 pl-2.5'
                          : 'hover:bg-spotlight-hover text-spotlight-text border-l-2 border-transparent'
                      }`}
                    >
                      <div className="flex-1 min-w-0 pr-3">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {note.is_pinned && (
                            <span className="text-[10px] text-amber-400" title="Pinned">
                              📌
                            </span>
                          )}
                          <h4
                            className={`text-xs font-semibold truncate ${
                              isSelected ? 'text-white' : 'text-spotlight-text'
                            }`}
                          >
                            {note.title || 'Untitled Note'}
                          </h4>
                          {tags.slice(0, 2).map((t) => (
                            <span
                              key={t}
                              className="px-1 py-0.2 rounded bg-indigo-500/10 text-indigo-400 text-[9px] font-mono shrink-0"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>

                        {snippet ? (
                          <p className="text-[11px] text-spotlight-dim truncate mb-0.5">
                            {snippet}
                          </p>
                        ) : null}

                        <span className="text-[10px] text-spotlight-dim">
                          {formatTime(note.updated_at)}
                        </span>
                      </div>

                      {/* Item Quick Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={(e) => handleTogglePin(note.id, e)}
                          title={note.is_pinned ? 'Unpin' : 'Pin'}
                          className={`p-1 rounded text-xs transition-colors ${
                            note.is_pinned
                              ? 'text-amber-400'
                              : 'text-spotlight-dim hover:text-spotlight-text hover:bg-white/10'
                          }`}
                        >
                          📌
                        </button>
                        <button
                          onClick={(e) => handleCopyNote(note, e)}
                          title="Copy content"
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
              <span>{activeNote ? 'Done' : 'Open / Save'}</span>
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
              <span>{activeNote ? 'Back' : 'Hide'}</span>
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

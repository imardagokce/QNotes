import { useState, useEffect, useRef, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import Onboarding from './components/Onboarding'

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
  const [isFirstRun, setIsFirstRun] = useState<boolean | null>(null)
  const [activeShortcut, setActiveShortcut] = useState('Alt+Space')
  const [activeTheme, setActiveTheme] = useState('midnight')
  const [showSettings, setShowSettings] = useState(false)
  const [settingsInitialTab, setSettingsInitialTab] = useState<'general' | 'ai'>('general')

  const [notes, setNotes] = useState<Note[]>([])
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [activeNote, setActiveNote] = useState<Note | null>(null)
  const [activeContent, setActiveContent] = useState('')
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  // AI Assistant States
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<string | null>(null)
  const [aiTaskTitle, setAiTaskTitle] = useState<string>('')
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiCopied, setAiCopied] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const editorTextareaRef = useRef<HTMLTextAreaElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load Settings from SQLite
  const loadSettings = useCallback(async () => {
    try {
      const settings = await invoke<Record<string, string>>('get_settings')
      setIsFirstRun(settings['is_first_run'] === 'true')
      if (settings['shortcut']) setActiveShortcut(settings['shortcut'])
      if (settings['theme']) setActiveTheme(settings['theme'])
    } catch (err) {
      console.error('Failed to get settings:', err)
      setIsFirstRun(false)
    }
  }, [])

  // Fetch all notes from SQLite
  const loadNotes = useCallback(async () => {
    try {
      const data = await invoke<Note[]>('get_notes')
      setNotes(data)
    } catch (err) {
      console.error('Failed to get notes:', err)
    }
  }, [])

  useEffect(() => {
    loadSettings()
    loadNotes()
  }, [loadSettings, loadNotes])

  // Focus input whenever returning to search mode
  useEffect(() => {
    if (!activeNote && !isFirstRun && !showSettings) {
      inputRef.current?.focus()
    }
  }, [activeNote, isFirstRun, showSettings])

  // Real-time search via Rust command `search_notes`
  useEffect(() => {
    if (activeNote || isFirstRun || showSettings) return

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
  }, [query, activeNote, isFirstRun, showSettings, loadNotes])

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
    setTimeout(() => setStatusMessage(null), 2000)
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
      flashStatus('Not kaydedildi!')
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
    setAiResult(null)
    setAiError(null)
    setTimeout(() => editorTextareaRef.current?.focus(), 50)
  }

  // Close editor and return to list
  const handleCloseEditor = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    setActiveNote(null)
    setActiveContent('')
    setAiResult(null)
    setAiError(null)
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
      flashStatus('Not silindi')
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
      flashStatus(isPinned ? 'Not sabitlendi 📌' : 'Sabitleme kaldırıldı')
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
      flashStatus('Panoya kopyalandı ✓')
      setTimeout(() => setCopiedId(null), 1500)
    } catch (err) {
      console.error('Failed to copy note:', err)
    }
  }

  // ---------------------------------------------------------------------------
  // AI Actions Trigger
  // ---------------------------------------------------------------------------
  const handleRunAiAction = async (prompt: string, taskLabel: string) => {
    if (!activeContent.trim()) {
      flashStatus('İşlem için not içeriği boş olamaz')
      return
    }

    setAiLoading(true)
    setAiError(null)
    setAiResult(null)
    setAiTaskTitle(taskLabel)

    try {
      const result = await invoke<string>('generate_ai_response', {
        prompt,
        context: activeContent,
      })
      setAiResult(result)
    } catch (err) {
      console.error('AI Error:', err)
      const errStr = String(err)
      setAiError(
        errStr.includes('Connection failed')
          ? 'AI sunucusuna bağlanılamadı. Ayarlar (⚙) menüsünden endpoint ve API ayarlarınızı kontrol edin.'
          : errStr
      )
    } finally {
      setAiLoading(false)
    }
  }

  const handleAppendAiResult = () => {
    if (!aiResult) return
    const updated = `${activeContent.trim()}\n\n---\n**${aiTaskTitle}:**\n${aiResult}`
    handleUpdateNoteContent(updated)
    setAiResult(null)
    flashStatus('AI çıktısı nota eklendi')
  }

  const handleReplaceWithAiResult = () => {
    if (!aiResult) return
    handleUpdateNoteContent(aiResult)
    setAiResult(null)
    flashStatus('Not içeriği AI yanıtı ile değiştirildi')
  }

  const handleCopyAiResult = async () => {
    if (!aiResult) return
    await navigator.clipboard.writeText(aiResult)
    setAiCopied(true)
    setTimeout(() => setAiCopied(false), 1500)
    flashStatus('AI yanıtı kopyalandı')
  }

  // Keyboard navigation & global hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape handler
      if (e.key === 'Escape') {
        e.preventDefault()
        if (aiResult || aiError) {
          setAiResult(null)
          setAiError(null)
        } else if (showSettings) {
          setShowSettings(false)
        } else if (activeNote) {
          handleCloseEditor()
        } else if (query) {
          setQuery('')
        } else {
          handleHide()
        }
        return
      }

      // If in Settings
      if (showSettings || isFirstRun) return

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
        e.preventDefault()
        handleDeleteNote(notes[selectedIndex].id)
      } else if (e.key === ',' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setSettingsInitialTab('general')
        setShowSettings(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeNote, query, selectedIndex, notes, showSettings, isFirstRun, aiResult, aiError])

  // Still checking settings on startup
  if (isFirstRun === null) {
    return <div className="w-full h-full bg-transparent" />
  }

  // First Run Onboarding Wizard OR Settings Modal
  if (isFirstRun || showSettings) {
    return (
      <Onboarding
        isFirstRun={isFirstRun}
        initialTab={settingsInitialTab}
        onClose={() => setShowSettings(false)}
        onComplete={({ shortcut, theme }) => {
          setIsFirstRun(false)
          setShowSettings(false)
          setActiveShortcut(shortcut)
          setActiveTheme(theme)
          flashStatus('Ayarlar güncellendi!')
          loadNotes()
        }}
      />
    )
  }

  // Theme modifier classes
  const themeClasses =
    activeTheme === 'obsidian'
      ? 'bg-[#0a0a0c]/98 border-white/10'
      : activeTheme === 'slate'
      ? 'bg-[#0f172a]/98 border-emerald-500/20'
      : 'bg-spotlight-bg/95 border-spotlight-border'

  return (
    <div className="w-full h-full p-2 flex items-center justify-center select-none bg-transparent">
      {/* Spotlight Card */}
      <div
        className={`w-full h-full flex flex-col backdrop-blur-2xl rounded-2xl border shadow-spotlight overflow-hidden transition-all duration-200 ${themeClasses}`}
      >
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
                  <span>← Geri</span>
                  <span className="text-[10px] text-spotlight-dim bg-white/5 px-1 rounded">Esc</span>
                </button>
                <span className="text-xs font-medium text-white truncate max-w-xs">
                  {activeNote.title || 'Başlıksız Not'}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => handleTogglePin(activeNote.id, e)}
                  title={activeNote.is_pinned ? 'Sabitlemeyi kaldır' : 'Sabitle'}
                  className={`text-xs px-2 py-1 rounded-md transition-colors ${
                    activeNote.is_pinned
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'text-spotlight-dim hover:text-spotlight-text hover:bg-white/5'
                  }`}
                >
                  {activeNote.is_pinned ? '📌 Sabitli' : 'Sabitle'}
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
                placeholder="Not yaz veya aramak için yazmaya başla..."
                className="w-full bg-transparent text-sm text-spotlight-text placeholder-spotlight-dim outline-none"
                autoFocus
                spellCheck={false}
              />

              {/* Action Pill: Create Note */}
              {query.trim() && (
                <button
                  onClick={() => handleCreateNote()}
                  className="shrink-0 flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-sm"
                  title="Kaydetmek için Enter tuşuna bas"
                >
                  <span>Kaydet</span>
                  <span className="opacity-75 text-[10px]">↵</span>
                </button>
              )}
            </div>
          )}

          {/* AI Settings & Settings & Close Buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => {
                setSettingsInitialTab('ai')
                setShowSettings(true)
              }}
              className="w-6 h-6 flex items-center justify-center rounded-md text-spotlight-dim hover:text-indigo-400 hover:bg-white/5 transition-colors text-xs"
              title="AI Yapılandırması"
            >
              ✨
            </button>
            <button
              onClick={() => {
                setSettingsInitialTab('general')
                setShowSettings(true)
              }}
              className="w-6 h-6 flex items-center justify-center rounded-md text-spotlight-dim hover:text-spotlight-text hover:bg-white/5 transition-colors text-xs"
              title="Ayarlar (Ctrl+,)"
            >
              ⚙
            </button>
            <button
              onClick={handleHide}
              className="w-6 h-6 flex items-center justify-center rounded-md text-spotlight-dim hover:text-spotlight-text hover:bg-white/5 transition-colors text-xs"
              title="Kapat (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Temporary Toast Banner */}
        {statusMessage && (
          <div className="bg-indigo-600/20 border-b border-indigo-500/20 px-4 py-1 text-center text-xs font-medium text-indigo-300 transition-all">
            {statusMessage}
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-hidden flex flex-col relative">
          {activeNote ? (
            /* Note Editor View */
            <div className="flex-1 flex flex-col p-4 bg-spotlight-bg relative">
              
              {/* Quick AI Action Buttons Toolbar */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-spotlight-border/40 gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                    <span>✨ AI</span>
                  </span>
                  
                  <button
                    type="button"
                    onClick={() =>
                      handleRunAiAction(
                        'Bu notu 2-3 maddelik çok net ve öz bir özet haline getir.',
                        'Not Özeti'
                      )
                    }
                    disabled={aiLoading}
                    className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-indigo-600/20 text-spotlight-muted hover:text-indigo-300 text-[11px] font-medium border border-white/5 hover:border-indigo-500/30 transition-all disabled:opacity-50"
                  >
                    ⚡ Özetle
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleRunAiAction(
                        'Bu notun içindeki yapılacak işleri ve eylem maddelerini madde imleri [-] halinde listele.',
                        'Aksiyon Maddeleri'
                      )
                    }
                    disabled={aiLoading}
                    className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-indigo-600/20 text-spotlight-muted hover:text-indigo-300 text-[11px] font-medium border border-white/5 hover:border-indigo-500/30 transition-all disabled:opacity-50"
                  >
                    📋 Aksiyon Maddeleri
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleRunAiAction(
                        'Bu metnin dilbilgisini, yazım hatalarını düzelt ve daha akıcı, profesyonel bir üsluba getir.',
                        'Düzeltilmiş Metin'
                      )
                    }
                    disabled={aiLoading}
                    className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-indigo-600/20 text-spotlight-muted hover:text-indigo-300 text-[11px] font-medium border border-white/5 hover:border-indigo-500/30 transition-all disabled:opacity-50"
                  >
                    ✍️ Metni Düzelt
                  </button>
                </div>

                {/* AI Loading Indicator in Toolbar */}
                {aiLoading && (
                  <div className="flex items-center gap-1.5 text-xs text-indigo-400 animate-pulse">
                    <span className="inline-block animate-spin">🌀</span>
                    <span className="text-[10px]">AI Üretiyor...</span>
                  </div>
                )}
              </div>

              {/* Main Note Textarea */}
              <textarea
                ref={editorTextareaRef}
                value={activeContent}
                onChange={(e) => handleUpdateNoteContent(e.target.value)}
                placeholder="Notunuzu buraya yazın... (İlk satır başlık olur, #etiket kullanabilirsiniz)"
                className="flex-1 w-full bg-transparent text-sm text-spotlight-text placeholder-spotlight-dim outline-none resize-none leading-relaxed select-text"
                autoFocus
              />

              {/* AI Result Card Drawer */}
              {aiResult && (
                <div className="absolute inset-x-3 bottom-10 max-h-[190px] bg-spotlight-surface border border-indigo-500/40 rounded-xl p-3 shadow-2xl flex flex-col gap-2 animate-in slide-in-from-bottom-2 duration-200 z-10">
                  <div className="flex items-center justify-between border-b border-spotlight-border/60 pb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1">
                        <span>✨</span>
                        <span>{aiTaskTitle}</span>
                      </span>
                    </div>

                    <button
                      onClick={() => setAiResult(null)}
                      className="text-xs text-spotlight-dim hover:text-white"
                      title="Kapat"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto text-xs text-spotlight-text font-sans whitespace-pre-wrap leading-relaxed select-text bg-spotlight-bg/60 p-2 rounded-lg border border-white/5">
                    {aiResult}
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={handleCopyAiResult}
                      className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-spotlight-muted hover:text-white text-[10px] font-medium transition-colors"
                    >
                      {aiCopied ? '✓ Kopyalandı' : '📋 Kopyala'}
                    </button>

                    <button
                      type="button"
                      onClick={handleAppendAiResult}
                      className="px-2.5 py-1 rounded-md bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white text-[10px] font-medium transition-colors border border-indigo-500/40"
                    >
                      ➕ Sona Ekle
                    </button>

                    <button
                      type="button"
                      onClick={handleReplaceWithAiResult}
                      className="px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-medium transition-colors shadow-sm"
                    >
                      🔄 Metinle Değiştir
                    </button>
                  </div>
                </div>
              )}

              {/* AI Error Notification */}
              {aiError && (
                <div className="absolute inset-x-3 bottom-10 bg-rose-950/80 border border-rose-500/40 rounded-xl p-3 shadow-xl flex items-start justify-between gap-2 z-10">
                  <div className="text-xs text-rose-300 space-y-0.5">
                    <div className="font-semibold flex items-center gap-1">
                      <span>⚠️ AI Bağlantı Hatası</span>
                    </div>
                    <div className="text-[11px] text-rose-200/90 leading-relaxed">
                      {aiError}
                    </div>
                  </div>
                  <button
                    onClick={() => setAiError(null)}
                    className="text-xs text-rose-400 hover:text-rose-200 shrink-0"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Editor Bottom Meta & Actions */}
              <div className="flex items-center justify-between pt-2.5 border-t border-spotlight-border/60 text-xs text-spotlight-dim">
                <div className="flex items-center gap-2">
                  <span>{activeContent.length} karakter</span>
                  <span>•</span>
                  <span>
                    {activeContent.trim() ? activeContent.trim().split(/\s+/).length : 0} kelime
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
                    <span>{copiedId === activeNote.id ? '✓ Kopyalandı' : 'Kopyala'}</span>
                  </button>
                  <button
                    onClick={(e) => handleDeleteNote(activeNote.id, e)}
                    className="hover:text-rose-400 transition-colors flex items-center gap-1 text-[11px]"
                  >
                    <span>Sil</span>
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
                        &ldquo;{query}&rdquo; ile eşleşen not bulunamadı
                      </p>
                      <p className="text-xs">
                        Yeni not olarak kaydetmek için{' '}
                        <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-spotlight-text font-mono text-[10px]">
                          Enter
                        </kbd>{' '}
                        tuşuna basın.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-10 h-10 mx-auto rounded-full bg-white/5 flex items-center justify-center text-spotlight-muted text-lg">
                        ✎
                      </div>
                      <p className="text-sm font-medium text-spotlight-muted">
                        Kasanızda henüz not bulunmuyor
                      </p>
                      <p className="text-xs max-w-xs">
                        Hızlıca aklınızdaki bir düşünceyi yazıp{' '}
                        <kbd className="px-1 py-0.5 rounded bg-white/10 text-spotlight-text font-mono text-[10px]">
                          Enter
                        </kbd>{' '}
                        tuşuna basarak kaydedebilirsiniz.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                notes.map((note, index) => {
                  const isSelected = index === selectedIndex
                  const tags = parseTags(note.tags)
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
                            <span className="text-[10px] text-amber-400" title="Sabitlenmiş">
                              📌
                            </span>
                          )}
                          <h4
                            className={`text-xs font-semibold truncate ${
                              isSelected ? 'text-white' : 'text-spotlight-text'
                            }`}
                          >
                            {note.title || 'Başlıksız Not'}
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
                          title={note.is_pinned ? 'Sabitlemeyi kaldır' : 'Sabitle'}
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
                          title="İçeriği kopyala"
                          className="p-1 rounded text-spotlight-dim hover:text-spotlight-text hover:bg-white/10 text-xs"
                        >
                          {copiedId === note.id ? '✓' : '⎘'}
                        </button>
                        <button
                          onClick={(e) => handleDeleteNote(note.id, e)}
                          title="Notu sil"
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
                {activeShortcut}
              </kbd>
              <span>Aç/Kapat</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-[9px] text-spotlight-muted">
                ↵
              </kbd>
              <span>{activeNote ? 'Bitti' : 'Aç / Kaydet'}</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-[9px] text-spotlight-muted">
                ↑↓
              </kbd>
              <span>Gezin</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-[9px] text-spotlight-muted">
                Esc
              </kbd>
              <span>{activeNote ? 'Geri' : 'Gizle'}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-[10px] text-spotlight-dim">
            <span>
              {notes.length} {notes.length === 1 ? 'not' : 'not'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

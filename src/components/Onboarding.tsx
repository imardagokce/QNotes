import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { enable, disable } from '@tauri-apps/plugin-autostart'

interface Props {
  onComplete: (settings: { shortcut: string; autostart: boolean; theme: string }) => void
}

export default function Onboarding({ onComplete }: Props) {
  const [shortcut, setShortcut] = useState<'Alt+Space' | 'Ctrl+Space'>('Alt+Space')
  const [autostart, setAutostart] = useState(true)
  const [theme, setTheme] = useState<'midnight' | 'obsidian' | 'slate'>('midnight')
  const [saving, setSaving] = useState(false)

  const handleFinish = async () => {
    setSaving(true)
    try {
      // Save settings to SQLite
      await invoke('update_setting', { key: 'shortcut', value: shortcut })
      await invoke('update_setting', { key: 'autostart', value: String(autostart) })
      await invoke('update_setting', { key: 'theme', value: theme })
      await invoke('update_setting', { key: 'is_first_run', value: 'false' })

      // Register the selected shortcut
      await invoke('register_shortcut', { shortcut })

      // Apply autostart via plugin & Rust command
      try {
        if (autostart) {
          await enable()
        } else {
          await disable()
        }
      } catch (e) {
        // Fallback to Rust command
        await invoke('set_autostart', { enabled: autostart }).catch(() => {})
        console.warn('Autostart plugin note:', e)
      }

      onComplete({ shortcut, autostart, theme })
    } catch (err) {
      console.error('Failed to complete onboarding:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full h-full p-2 flex items-center justify-center select-none bg-transparent">
      {/* Onboarding Card */}
      <div className="w-full h-full flex flex-col justify-between bg-spotlight-bg/98 backdrop-blur-2xl rounded-2xl border border-spotlight-border shadow-spotlight overflow-hidden p-6 animate-in fade-in duration-300">
        
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="w-10 h-10 mx-auto rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-lg shadow-sm">
            Q
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            Welcome to QNotes
          </h2>
          <p className="text-xs text-spotlight-dim max-w-sm mx-auto">
            Your lightning-fast overlay scratchpad. Customize your preferences to get started.
          </p>
        </div>

        {/* Configuration Options */}
        <div className="space-y-4 my-auto">
          
          {/* 1. Global Shortcut Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-spotlight-text flex items-center justify-between">
              <span>1. Global Shortcut</span>
              <span className="text-[10px] text-spotlight-dim">Toggle overlay anytime</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShortcut('Alt+Space')}
                className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                  shortcut === 'Alt+Space'
                    ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-sm'
                    : 'bg-spotlight-surface border-spotlight-border text-spotlight-muted hover:border-white/20'
                }`}
              >
                <div>
                  <div className="text-xs font-mono font-medium">Alt + Space</div>
                  <div className="text-[10px] text-spotlight-dim">Recommended (Spotlight)</div>
                </div>
                {shortcut === 'Alt+Space' && <span className="text-indigo-400 text-xs">●</span>}
              </button>

              <button
                type="button"
                onClick={() => setShortcut('Ctrl+Space')}
                className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                  shortcut === 'Ctrl+Space'
                    ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-sm'
                    : 'bg-spotlight-surface border-spotlight-border text-spotlight-muted hover:border-white/20'
                }`}
              >
                <div>
                  <div className="text-xs font-mono font-medium">Ctrl + Space</div>
                  <div className="text-[10px] text-spotlight-dim">Alternative (Alfred)</div>
                </div>
                {shortcut === 'Ctrl+Space' && <span className="text-indigo-400 text-xs">●</span>}
              </button>
            </div>
          </div>

          {/* 2. Windows Autostart Toggle */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-spotlight-surface border border-spotlight-border">
            <div className="space-y-0.5">
              <div className="text-xs font-medium text-spotlight-text">
                2. Launch on System Startup
              </div>
              <div className="text-[10px] text-spotlight-dim">
                Runs silently in the background, ready whenever you press your hotkey.
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAutostart(!autostart)}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 ${
                autostart ? 'bg-indigo-600' : 'bg-white/10'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                  autostart ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 3. Theme Mode */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-spotlight-text flex items-center justify-between">
              <span>3. Appearance Theme</span>
              <span className="text-[10px] text-spotlight-dim">Visual styling</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTheme('midnight')}
                className={`p-2 rounded-xl border text-center transition-all ${
                  theme === 'midnight'
                    ? 'bg-indigo-600/15 border-indigo-500 text-white'
                    : 'bg-spotlight-surface border-spotlight-border text-spotlight-muted hover:border-white/20'
                }`}
              >
                <div className="w-4 h-4 mx-auto rounded-full bg-[#181820] border border-indigo-500/50 mb-1" />
                <span className="text-[11px] font-medium block">Midnight</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme('obsidian')}
                className={`p-2 rounded-xl border text-center transition-all ${
                  theme === 'obsidian'
                    ? 'bg-indigo-600/15 border-indigo-500 text-white'
                    : 'bg-spotlight-surface border-spotlight-border text-spotlight-muted hover:border-white/20'
                }`}
              >
                <div className="w-4 h-4 mx-auto rounded-full bg-[#0a0a0c] border border-white/20 mb-1" />
                <span className="text-[11px] font-medium block">Obsidian</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme('slate')}
                className={`p-2 rounded-xl border text-center transition-all ${
                  theme === 'slate'
                    ? 'bg-indigo-600/15 border-indigo-500 text-white'
                    : 'bg-spotlight-surface border-spotlight-border text-spotlight-muted hover:border-white/20'
                }`}
              >
                <div className="w-4 h-4 mx-auto rounded-full bg-[#1e293b] border border-emerald-500/50 mb-1" />
                <span className="text-[11px] font-medium block">Slate</span>
              </button>
            </div>
          </div>

        </div>

        {/* Footer Finish Action */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleFinish}
            disabled={saving}
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>{saving ? 'Saving Preferences...' : 'Complete Setup & Get Started'}</span>
            <span className="text-[10px] opacity-80">➔</span>
          </button>
        </div>

      </div>
    </div>
  )
}

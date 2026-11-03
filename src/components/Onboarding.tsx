import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { enable, disable } from '@tauri-apps/plugin-autostart'

interface Props {
  isFirstRun?: boolean
  initialTab?: 'general' | 'ai'
  onClose?: () => void
  onComplete: (settings: {
    shortcut: string
    autostart: boolean
    theme: string
    aiProvider: string
    aiEndpoint: string
    aiModel: string
  }) => void
}

const PROVIDER_DEFAULTS = {
  ollama: {
    endpoint: 'http://localhost:11434',
    model: 'llama3',
    requiresKey: false,
    label: 'Ollama (Yerel)',
    icon: '🦙',
  },
  lmstudio: {
    endpoint: 'http://localhost:1234',
    model: 'qwen2.5-coder',
    requiresKey: false,
    label: 'LM Studio (Yerel)',
    icon: '🧪',
  },
  openai: {
    endpoint: 'https://api.openai.com',
    model: 'gpt-4o-mini',
    requiresKey: true,
    label: 'OpenAI (Bulut)',
    icon: '🌐',
  },
  anthropic: {
    endpoint: 'https://api.anthropic.com',
    model: 'claude-3-5-haiku',
    requiresKey: true,
    label: 'Anthropic (Bulut)',
    icon: '🧠',
  },
  custom: {
    endpoint: 'http://localhost:11434',
    model: 'llama3',
    requiresKey: false,
    label: 'Özel / Custom',
    icon: '⚙️',
  },
} as const

type ProviderKey = keyof typeof PROVIDER_DEFAULTS

export default function Onboarding({
  isFirstRun = false,
  initialTab = 'general',
  onClose,
  onComplete,
}: Props) {
  const [activeTab, setActiveTab] = useState<'general' | 'ai'>(initialTab)

  // General Settings
  const [shortcut, setShortcut] = useState<'Alt+Space' | 'Ctrl+Space'>('Alt+Space')
  const [autostart, setAutostart] = useState(true)
  const [theme, setTheme] = useState<'midnight' | 'obsidian' | 'slate'>('midnight')

  // AI Settings
  const [aiProvider, setAiProvider] = useState<ProviderKey>('ollama')
  const [aiEndpoint, setAiEndpoint] = useState('http://localhost:11434')
  const [aiApiKey, setAiApiKey] = useState('')
  const [aiModel, setAiModel] = useState('llama3')
  const [showApiKey, setShowApiKey] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Load existing settings on mount
  useEffect(() => {
    invoke<Record<string, string>>('get_settings')
      .then((settings) => {
        if (settings['shortcut'] === 'Ctrl+Space' || settings['shortcut'] === 'Alt+Space') {
          setShortcut(settings['shortcut'])
        }
        if (settings['autostart']) {
          setAutostart(settings['autostart'] === 'true')
        }
        if (settings['theme'] === 'obsidian' || settings['theme'] === 'slate') {
          setTheme(settings['theme'])
        }
        if (settings['ai_provider'] && settings['ai_provider'] in PROVIDER_DEFAULTS) {
          setAiProvider(settings['ai_provider'] as ProviderKey)
        }
        if (settings['ai_endpoint']) setAiEndpoint(settings['ai_endpoint'])
        if (settings['ai_api_key']) setAiApiKey(settings['ai_api_key'])
        if (settings['ai_model']) setAiModel(settings['ai_model'])
      })
      .catch(console.error)
  }, [])

  const handleProviderSelect = (key: ProviderKey) => {
    setAiProvider(key)
    const defaults = PROVIDER_DEFAULTS[key]
    setAiEndpoint(defaults.endpoint)
    setAiModel(defaults.model)
  }

  const handleSaveAll = async () => {
    setSaving(true)
    try {
      // 1. Save general settings
      await invoke('update_setting', { key: 'shortcut', value: shortcut })
      await invoke('update_setting', { key: 'autostart', value: String(autostart) })
      await invoke('update_setting', { key: 'theme', value: theme })
      await invoke('update_setting', { key: 'is_first_run', value: 'false' })

      // 2. Save AI settings
      await invoke('update_setting', { key: 'ai_provider', value: aiProvider })
      await invoke('update_setting', { key: 'ai_endpoint', value: aiEndpoint.trim() })
      await invoke('update_setting', { key: 'ai_api_key', value: aiApiKey.trim() })
      await invoke('update_setting', { key: 'ai_model', value: aiModel.trim() })

      // 3. Register global shortcut
      await invoke('register_shortcut', { shortcut })

      // 4. Apply autostart
      try {
        if (autostart) {
          await enable()
        } else {
          await disable()
        }
      } catch (e) {
        await invoke('set_autostart', { enabled: autostart }).catch(() => {})
        console.warn('Autostart note:', e)
      }

      setSaveSuccess(true)
      setTimeout(() => {
        onComplete({
          shortcut,
          autostart,
          theme,
          aiProvider,
          aiEndpoint,
          aiModel,
        })
      }, 400)
    } catch (err) {
      console.error('Failed to save settings:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full h-full p-2 flex items-center justify-center select-none bg-transparent">
      {/* Modal Container */}
      <div className="w-full h-full flex flex-col justify-between bg-spotlight-bg/98 backdrop-blur-2xl rounded-2xl border border-spotlight-border shadow-spotlight overflow-hidden p-5 animate-in fade-in duration-200">
        
        {/* Top Header & Tab Navigation */}
        <div className="space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-xs shadow-sm">
                Q
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-tight">
                  {isFirstRun ? 'QNotes Hoş Geldiniz' : 'Ayarlar & Tercihler'}
                </h2>
                <p className="text-[10px] text-spotlight-dim">
                  {isFirstRun
                    ? 'Hızlı not deneyiminizi kişiselleştirin'
                    : 'Kısayollar, görünüm ve AI yapılandırması'}
                </p>
              </div>
            </div>

            {onClose && !isFirstRun && (
              <button
                onClick={onClose}
                className="w-6 h-6 flex items-center justify-center rounded-md text-spotlight-dim hover:text-white hover:bg-white/5 transition-colors text-xs"
                title="Kapat"
              >
                ✕
              </button>
            )}
          </div>

          {/* Tab Selector */}
          <div className="flex rounded-xl bg-spotlight-surface p-1 border border-spotlight-border">
            <button
              type="button"
              onClick={() => setActiveTab('general')}
              className={`flex-1 py-1 px-3 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'general'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-spotlight-dim hover:text-spotlight-text'
              }`}
            >
              ⚙️ Genel Tercihler
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ai')}
              className={`flex-1 py-1 px-3 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'ai'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-spotlight-dim hover:text-spotlight-text'
              }`}
            >
              ✨ AI Yapılandırması
            </button>
          </div>
        </div>

        {/* Tab 1: General Preferences */}
        {activeTab === 'general' && (
          <div className="space-y-3.5 my-auto overflow-y-auto pr-1">
            {/* Global Shortcut */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-spotlight-text flex items-center justify-between">
                <span>1. Global Kısayol Tuşu</span>
                <span className="text-[10px] text-spotlight-dim">Overlay penceresini anında aç/kapat</span>
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
                    <div className="text-[10px] text-spotlight-dim">Önerilen (Spotlight tarzı)</div>
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
                    <div className="text-[10px] text-spotlight-dim">Alternatif (Alfred tarzı)</div>
                  </div>
                  {shortcut === 'Ctrl+Space' && <span className="text-indigo-400 text-xs">●</span>}
                </button>
              </div>
            </div>

            {/* Autostart Toggle */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-spotlight-surface border border-spotlight-border">
              <div className="space-y-0.5">
                <div className="text-xs font-medium text-spotlight-text">
                  2. Windows Başlangıcında Çalıştır
                </div>
                <div className="text-[10px] text-spotlight-dim">
                  Arka planda sessizce bekler, kısayola bastığınızda anında ekrana gelir.
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

            {/* Theme Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-spotlight-text flex items-center justify-between">
                <span>3. Görünüm Teması</span>
                <span className="text-[10px] text-spotlight-dim">Arayüz renk paleti</span>
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
                  <div className="w-3.5 h-3.5 mx-auto rounded-full bg-[#181820] border border-indigo-500/50 mb-1" />
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
                  <div className="w-3.5 h-3.5 mx-auto rounded-full bg-[#0a0a0c] border border-white/20 mb-1" />
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
                  <div className="w-3.5 h-3.5 mx-auto rounded-full bg-[#1e293b] border border-emerald-500/50 mb-1" />
                  <span className="text-[11px] font-medium block">Slate</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: AI Configuration */}
        {activeTab === 'ai' && (
          <div className="space-y-3 my-auto overflow-y-auto pr-1 max-h-[300px]">
            {/* AI Provider Cards */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-spotlight-text flex items-center justify-between">
                <span>AI Sağlayıcısı (Provider)</span>
                <span className="text-[10px] text-spotlight-dim">Yerel LLM veya Bulut API</span>
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['ollama', 'lmstudio', 'openai', 'anthropic'] as ProviderKey[]).map((key) => {
                  const p = PROVIDER_DEFAULTS[key]
                  const isSelected = aiProvider === key
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleProviderSelect(key)}
                      className={`p-2 rounded-xl border text-center transition-all ${
                        isSelected
                          ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-sm'
                          : 'bg-spotlight-surface border-spotlight-border text-spotlight-muted hover:border-white/20'
                      }`}
                    >
                      <div className="text-sm mb-0.5">{p.icon}</div>
                      <div className="text-[10px] font-medium leading-tight">{p.label}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Endpoint Input */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-spotlight-text flex items-center justify-between">
                <span>API Endpoint Adresi</span>
                <span className="text-[9px] text-spotlight-dim">
                  Varsayılan: {PROVIDER_DEFAULTS[aiProvider].endpoint}
                </span>
              </label>
              <input
                type="text"
                value={aiEndpoint}
                onChange={(e) => setAiEndpoint(e.target.value)}
                placeholder="http://localhost:11434 veya https://api.openai.com"
                className="w-full px-3 py-1.5 rounded-lg bg-spotlight-surface border border-spotlight-border text-xs text-white placeholder-spotlight-dim outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            {/* API Key Input */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-spotlight-text flex items-center justify-between">
                <span>API Key (Gizli Anahtar)</span>
                <span className="text-[9px] text-spotlight-dim">
                  {PROVIDER_DEFAULTS[aiProvider].requiresKey
                    ? 'Zorunlu'
                    : 'Yerel modellerde (Ollama/LM Studio) boş bırakılabilir'}
                </span>
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                  placeholder={
                    PROVIDER_DEFAULTS[aiProvider].requiresKey
                      ? 'sk-...'
                      : 'Opsiyonel (Yerel LLM)'
                  }
                  className="w-full pl-3 pr-8 py-1.5 rounded-lg bg-spotlight-surface border border-spotlight-border text-xs text-white placeholder-spotlight-dim outline-none focus:border-indigo-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-spotlight-dim hover:text-white"
                >
                  {showApiKey ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Model Name Input */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-spotlight-text flex items-center justify-between">
                <span>Model Adı</span>
                <span className="text-[9px] text-spotlight-dim">Çalıştırılacak LLM modeli</span>
              </label>
              <input
                type="text"
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                placeholder="gpt-4o-mini, llama3, qwen2.5-coder..."
                className="w-full px-3 py-1.5 rounded-lg bg-spotlight-surface border border-spotlight-border text-xs text-white placeholder-spotlight-dim outline-none focus:border-indigo-500 font-mono"
              />

              {/* Quick Preset Model Chips */}
              <div className="flex flex-wrap gap-1 pt-1">
                {['gpt-4o-mini', 'claude-3-5-haiku', 'llama3', 'qwen2.5-coder', 'mistral'].map(
                  (m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setAiModel(m)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                        aiModel === m
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                          : 'bg-white/5 text-spotlight-dim hover:text-white'
                      }`}
                    >
                      {m}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-2 border-t border-spotlight-border/60 flex items-center gap-2 shrink-0">
          {onClose && !isFirstRun && (
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-spotlight-muted hover:text-white text-xs font-medium transition-all"
            >
              Vazgeç
            </button>
          )}

          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving}
            className="flex-1 py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>
              {saving
                ? 'Kaydediliyor...'
                : saveSuccess
                ? '✓ Ayarlar Kaydedildi!'
                : isFirstRun
                ? 'Kurulumu Tamamla & Başla ➔'
                : 'Ayarları Kaydet'}
            </span>
          </button>
        </div>

      </div>
    </div>
  )
}

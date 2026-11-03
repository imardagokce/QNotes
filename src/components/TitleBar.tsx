import { getCurrentWindow } from '@tauri-apps/api/window'

export default function TitleBar() {
  const appWindow = getCurrentWindow()

  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between px-4 py-2 bg-overlay-surface border-b border-overlay-border select-none"
    >
      <div className="flex items-center gap-2">
        <span className="text-overlay-accent font-bold text-sm tracking-widest">Q</span>
        <span className="text-overlay-text font-semibold text-sm">Notes</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => appWindow.minimize()}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-overlay-border text-overlay-muted hover:text-overlay-text transition-colors text-xs"
          title="Minimize"
        >
          ─
        </button>
        <button
          onClick={() => appWindow.hide()}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-overlay-accent text-overlay-muted hover:text-white transition-colors text-xs"
          title="Hide"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

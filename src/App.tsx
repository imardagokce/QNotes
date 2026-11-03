import { useState } from 'react'
import NoteEditor from './components/NoteEditor'
import NoteList from './components/NoteList'
import TitleBar from './components/TitleBar'

export interface Note {
  id: number
  content: string
  created_at: string
  updated_at: string
}

function App() {
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleNoteSaved = () => {
    setRefreshKey((k) => k + 1)
  }

  return (
    <div className="flex flex-col h-screen bg-overlay-bg rounded-2xl overflow-hidden border border-overlay-border shadow-2xl">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <NoteList
          key={refreshKey}
          selectedNote={selectedNote}
          onSelect={setSelectedNote}
        />
        <NoteEditor
          note={selectedNote}
          onSaved={handleNoteSaved}
        />
      </div>
    </div>
  )
}

export default App

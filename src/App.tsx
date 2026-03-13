import { useState, useEffect } from 'react'
import { CharacterScene } from './components/Character/CharacterScene'
import { CharacterPicker } from './components/Character/CharacterPicker'
import { ChatPanel } from './components/Chat/ChatPanel'
import { rehydrateStore } from './store'
import styles from './App.module.css'

export default function App() {
  const [showPicker, setShowPicker] = useState(false)
  const [threadOpen, setThreadOpen] = useState(false)
  const [suppressHover, setSuppressHover] = useState(false)

  useEffect(() => {
    return window.electron.onSuppressHover(setSuppressHover)
  }, [])

  // Reload store when settings window closes
  useEffect(() => {
    return window.electron.onSettingsChanged(() => rehydrateStore())
  }, [])

  return (
    <div className={`${styles.root} ${suppressHover ? styles.suppressHover : ''}`}>
      {/* Character always visible in top portion */}
      <div className={styles.character}>
        <CharacterScene />

        <button
          className={styles.minimizeBtn}
          onClick={() => window.electron.minimizeWindow()}
          title="Minimize"
        >
          ─
        </button>

        <button
          className={styles.settingsBtn}
          onClick={() => window.electron.openSettings()}
          title="Settings"
        >
          ⚙
        </button>

        <button
          className={styles.pickerBtn}
          onClick={() => setShowPicker(!showPicker)}
          title="Change character"
        >
          👤
        </button>
      </div>

      {/* Chat: visible on hover */}
      <div className={styles.chatWrap}>
        <ChatPanel threadOpen={threadOpen} onToggleThread={() => setThreadOpen(!threadOpen)} />
      </div>

      {/* Character picker */}
      {showPicker && (
        <CharacterPicker onClose={() => setShowPicker(false)} />
      )}

    </div>
  )
}

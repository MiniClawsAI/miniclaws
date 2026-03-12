import { useState, useEffect } from 'react'
import { CharacterScene } from './components/Character/CharacterScene'
import { CharacterPicker } from './components/Character/CharacterPicker'
import { ChatPanel } from './components/Chat/ChatPanel'
import { SettingsPanel } from './components/Chat/SettingsPanel'
import styles from './App.module.css'

export default function App() {
  const [showSettings, setShowSettings] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [threadOpen, setThreadOpen] = useState(false)
  const [suppressHover, setSuppressHover] = useState(false)

  useEffect(() => {
    return window.electron.onSuppressHover(setSuppressHover)
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
          onClick={() => setShowSettings(true)}
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

      {/* Settings modal */}
      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}

import { useState } from 'react'
import { CharacterScene } from './components/Character/CharacterScene'
import { CharacterPicker } from './components/Character/CharacterPicker'
import { ChatPanel } from './components/Chat/ChatPanel'
import { SettingsPanel } from './components/Chat/SettingsPanel'
import styles from './App.module.css'

export default function App() {
  const [showSettings, setShowSettings] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [threadOpen, setThreadOpen] = useState(false)

  return (
    <div className={styles.root}>
      {/* Character always visible in top portion */}
      <div className={styles.character}>
        <CharacterScene />

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

      {/* Chat: input always visible, thread expands */}
      <ChatPanel threadOpen={threadOpen} onToggleThread={() => setThreadOpen(!threadOpen)} />

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

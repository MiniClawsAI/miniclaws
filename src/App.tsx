import { useState } from 'react'
import { CharacterScene } from './components/Character/CharacterScene'
import { ChatPanel } from './components/Chat/ChatPanel'
import { SettingsPanel } from './components/Chat/SettingsPanel'
import styles from './App.module.css'

export default function App() {
  const [showSettings, setShowSettings] = useState(false)
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
      </div>

      {/* Chat: input always visible, thread expands */}
      <ChatPanel threadOpen={threadOpen} onToggleThread={() => setThreadOpen(!threadOpen)} />

      {/* Settings modal */}
      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}

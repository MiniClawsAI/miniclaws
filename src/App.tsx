import { useState, useEffect } from 'react'
import { CharacterScene } from './components/Character/CharacterScene'
import { CharacterPicker } from './components/Character/CharacterPicker'
import { ChatPanel } from './components/Chat/ChatPanel'
import { useStore, rehydrateStore } from './store'
import styles from './App.module.css'

export default function App() {
  const [showPicker, setShowPicker] = useState(false)
  const { isChatOpen: threadOpen, setChatOpen: setThreadOpen } = useStore()
  const [suppressHover, setSuppressHover] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)

  useEffect(() => {
    return window.electron.onSuppressHover(setSuppressHover)
  }, [])

  // Keep chat visible when input is focused
  useEffect(() => {
    const onFocus = () => setInputFocused(true)
    const onBlur = () => setInputFocused(false)
    window.addEventListener('miniclaws:input-focus', onFocus)
    window.addEventListener('miniclaws:input-blur', onBlur)
    return () => {
      window.removeEventListener('miniclaws:input-focus', onFocus)
      window.removeEventListener('miniclaws:input-blur', onBlur)
    }
  }, [])

  // Reload store when settings window closes — notify character of changes
  useEffect(() => {
    return window.electron.onSettingsChanged(() => {
      rehydrateStore()

      const store = useStore.getState()
      const { setEmotion, setSpeechText, addMessage } = store
      const config = store.aiConfig

      // Visual feedback
      setEmotion('happy')
      setSpeechText('Settings updated!')
      setTimeout(() => { setEmotion('idle'); setSpeechText('') }, 3000)

      // Inject hidden config summary so AI knows settings changed (no API keys!)
      const enabledTools = [
        config.webSearchEnabled && 'web_search',
        config.openAppEnabled && 'open_app',
        config.seeScreenEnabled && 'see_screen',
        config.mapsEnabled && 'maps',
        config.browseEnabled && 'browse'
      ].filter(Boolean).join(', ') || 'none'

      addMessage({
        role: 'user',
        content: `[System: Configuration updated — Provider: ${config.provider}, Model: ${config.model || 'default'}, Tools enabled: ${enabledTools}. Acknowledge briefly if the user asks about your setup.]`,
        hidden: true
      })
    })
  }, [])

  // Apply character from editor window
  useEffect(() => {
    return window.electron.onUseCharacter((path) => {
      useStore.getState().setVrmPath(path)
    })
  }, [])

  return (
    <div className={`${styles.root} ${suppressHover ? styles.suppressHover : ''} ${(threadOpen || inputFocused) ? styles.chatPinned : ''}`}>
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

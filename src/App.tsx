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

  // Reload store when settings window closes — only react if config actually changed
  useEffect(() => {
    return window.electron.onSettingsChanged(() => {
      const beforeConfig = JSON.stringify(useStore.getState().aiConfig)
      rehydrateStore()
      const afterConfig = JSON.stringify(useStore.getState().aiConfig)

      // Only react if settings actually changed
      if (beforeConfig === afterConfig) return

      const store = useStore.getState()
      const { setEmotion, setSpeechText, addMessage } = store
      const config = store.aiConfig

      // Friendly visual feedback
      setEmotion('happy')
      setSpeechText('Got it! I\'m all set with the new settings ✨')
      setTimeout(() => { setEmotion('idle'); setSpeechText('') }, 4000)

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

  // Greet user on initial load
  useEffect(() => {
    const { setEmotion, setSpeechText } = useStore.getState()
    setEmotion('wave')
    setSpeechText('Hey there 👋! What can I help you with?')
    setTimeout(() => { setEmotion('happy') }, 2000)
    setTimeout(() => { setEmotion('idle'); setSpeechText('') }, 5000)
  }, [])

  // Apply character from editor window
  useEffect(() => {
    return window.electron.onUseCharacter((path) => {
      useStore.getState().setVrmPath(path)
    })
  }, [])

  return (
    <div
      className={`${styles.root} ${suppressHover ? styles.suppressHover : ''} ${(threadOpen || inputFocused) ? styles.chatPinned : ''}`}
      onMouseEnter={() => window.electron.setIgnoreMouse(false)}
      onMouseLeave={() => window.electron.setIgnoreMouse(true)}
    >
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

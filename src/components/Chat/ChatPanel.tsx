import { useRef, useEffect, useState, useCallback } from 'react'
import { useStore } from '../../store'
import { LinkifiedText } from './LinkifiedText'
import styles from './ChatPanel.module.css'

interface ChatPanelProps {
  threadOpen: boolean
  onToggleThread: () => void
}

export function ChatPanel({ threadOpen, onToggleThread }: ChatPanelProps) {
  const {
    messages,
    addMessage,
    isStreaming,
    setStreaming,
    streamingText,
    appendStreamText,
    clearStreamText,
    setEmotion,
    setSpeechText,
    aiConfig,
    clearMessages
  } = useStore()

  const [input, setInput] = useState('')
  const [toolStatus, setToolStatus] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  const cleanups  = useRef<(() => void)[]>([])

  // Listen for tool status (e.g. "Searching the web...")
  useEffect(() => {
    const off = window.electron.onToolStatus((status) => {
      setToolStatus(status)
      setEmotion('thinking')
    })
    return off
  }, [setEmotion])

  useEffect(() => {
    if (threadOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, streamingText, threadOpen])

  // Focus input when character is clicked
  useEffect(() => {
    const handler = () => inputRef.current?.focus()
    window.addEventListener('miniclaws:focus-input', handler)
    return () => window.removeEventListener('miniclaws:focus-input', handler)
  }, [])

  const needsSetup = useCallback(() => {
    const needsKey = aiConfig.provider !== 'ollama'
    return needsKey && !aiConfig.apiKey?.trim()
  }, [aiConfig])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    setInput('')
    inputRef.current?.focus()
    addMessage({ role: 'user', content: text })

    // If no LLM is configured, nudge the user to settings
    if (needsSetup()) {
      const setupMsg =
        "Hey! I need to be set up first before I can chat. " +
        "I'm opening the settings for you — pick a provider and add your API key, then we can talk! 🐾"
      addMessage({ role: 'assistant', content: setupMsg })
      setSpeechText(setupMsg)
      setEmotion('happy')
      setTimeout(() => setEmotion('idle'), 3000)
      window.electron.openSettings()
      return
    }

    setStreaming(true)
    clearStreamText()
    setEmotion('thinking')
    setSpeechText('…')

    // Clean previous listeners
    cleanups.current.forEach((fn) => fn())
    cleanups.current = []

    const allMessages = [...messages, { role: 'user' as const, content: text }]
    window.electron.chat(allMessages, aiConfig)

    let fullText = ''

    const offChunk = window.electron.onChunk((chunk) => {
      fullText += chunk
      appendStreamText(chunk)
      setSpeechText(fullText)
      setEmotion('talking')
      setToolStatus('') // clear "Searching..." once text starts
    })

    const offDone = window.electron.onDone(() => {
      addMessage({ role: 'assistant', content: fullText })
      clearStreamText()
      setStreaming(false)
      setToolStatus('')
      setEmotion('happy')
      setTimeout(() => setEmotion('idle'), 2500)
      inputRef.current?.focus()
    })

    const offErr = window.electron.onError((err) => {
      console.error('AI error:', err)
      addMessage({ role: 'assistant', content: `⚠️ ${err}` })
      clearStreamText()
      setStreaming(false)
      setEmotion('idle')
      inputRef.current?.focus()
    })

    const offToolCtx = window.electron.onToolContext((ctx) => {
      addMessage({ role: 'assistant', content: ctx, hidden: true })
    })

    cleanups.current = [offChunk, offDone, offErr, offToolCtx]
  }, [input, isStreaming, messages, aiConfig, addMessage, setStreaming, clearStreamText, appendStreamText, setEmotion, setSpeechText, needsSetup])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const hasMessages = messages.length > 0 || !!streamingText

  return (
    <div className={styles.wrapper}>
      {/* Floating thread panel */}
      <div
        className={`${styles.thread} ${threadOpen ? styles.threadOpen : ''}`}
        onClick={(e) => { if (e.target === e.currentTarget) onToggleThread() }}
      >
        <div className={styles.threadPanel}>
          <div className={styles.header}>
            <span className={styles.title}>✦ MiniClaws</span>
            <div className={styles.headerRight}>
              <button
                className={styles.minimizeBtn}
                onClick={onToggleThread}
                title="Minimize thread"
              >
                ─
              </button>
              {messages.length > 0 && (
                <button
                  className={styles.clearBtn}
                  onClick={() => {
                    clearMessages()
                    setSpeechText('')
                    onToggleThread()
                    setTimeout(() => inputRef.current?.focus(), 100)
                  }}
                  title="Delete conversation"
                  disabled={isStreaming}
                >
                  🗑
                </button>
              )}
            </div>
          </div>

          <div className={styles.messages}>
            {messages.filter((m) => !m.hidden).length === 0 && (
              <div className={styles.empty}>
                No messages yet — type below to start chatting
              </div>
            )}
            {messages.filter((m) => !m.hidden).map((msg, i) => (
              <div
                key={i}
                className={`${styles.msg} ${msg.role === 'user' ? styles.user : styles.assistant}`}
              >
                <div className={styles.bubble}><LinkifiedText text={msg.content} /></div>
              </div>
            ))}
            {toolStatus && !streamingText && (
              <div className={`${styles.msg} ${styles.assistant}`}>
                <div className={`${styles.bubble} ${styles.toolStatus}`}>
                  🔍 {toolStatus}
                </div>
              </div>
            )}
            {streamingText && (
              <div className={`${styles.msg} ${styles.assistant}`}>
                <div className={styles.bubble}>
                  <LinkifiedText text={streamingText} />
                  <span className={styles.cursor}>▋</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      </div>

      {/* Input bar — always visible */}
      <div className={styles.inputBar} onClick={() => inputRef.current?.focus()}>
        <button
          className={styles.expandBtn}
          onClick={onToggleThread}
          title={threadOpen ? 'Collapse thread' : 'Expand thread'}
        >
          <span style={{ display: 'inline-block', transform: threadOpen ? 'none' : 'rotate(180deg)', transition: 'transform 0.2s' }}>▾</span>
        </button>
        <textarea
          ref={inputRef}
          className={styles.input}
          placeholder="Ask anything…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => window.dispatchEvent(new Event('miniclaws:input-focus'))}
          onBlur={() => window.dispatchEvent(new Event('miniclaws:input-blur'))}
          rows={1}
          disabled={isStreaming}
        />
        <button
          className={styles.send}
          onClick={sendMessage}
          disabled={isStreaming || !input.trim()}
          aria-label="Send"
        >
          {isStreaming ? '⋯' : '↑'}
        </button>
      </div>
    </div>
  )
}

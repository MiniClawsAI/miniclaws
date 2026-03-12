import { useRef, useEffect, useState, useCallback } from 'react'
import { useStore } from '../../store'
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
    aiConfig
  } = useStore()

  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  const cleanups  = useRef<(() => void)[]>([])

  useEffect(() => {
    if (threadOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, streamingText, threadOpen])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    setInput('')
    addMessage({ role: 'user', content: text })
    setStreaming(true)
    clearStreamText()
    setEmotion('thinking')
    setSpeechText('')

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
    })

    const offDone = window.electron.onDone(() => {
      addMessage({ role: 'assistant', content: fullText })
      clearStreamText()
      setStreaming(false)
      setEmotion('happy')
      setTimeout(() => setEmotion('idle'), 2500)
    })

    const offErr = window.electron.onError((err) => {
      console.error('AI error:', err)
      addMessage({ role: 'assistant', content: `⚠️ ${err}` })
      clearStreamText()
      setStreaming(false)
      setEmotion('idle')
    })

    cleanups.current = [offChunk, offDone, offErr]
  }, [input, isStreaming, messages, aiConfig, addMessage, setStreaming, clearStreamText, appendStreamText, setEmotion, setSpeechText])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const hasMessages = messages.length > 0 || !!streamingText

  return (
    <div className={styles.wrapper}>
      {/* Expandable thread */}
      <div className={`${styles.thread} ${threadOpen ? styles.threadOpen : ''}`}>
        <div className={styles.header}>
          <span className={styles.title}>✦ Companion</span>
          <div className={styles.dot} />
        </div>

        <div className={styles.messages}>
          {messages.length === 0 && (
            <div className={styles.empty}>
              No messages yet — type below to start chatting
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`${styles.msg} ${msg.role === 'user' ? styles.user : styles.assistant}`}
            >
              <div className={styles.bubble}>{msg.content}</div>
            </div>
          ))}
          {streamingText && (
            <div className={`${styles.msg} ${styles.assistant}`}>
              <div className={styles.bubble}>
                {streamingText}
                <span className={styles.cursor}>▋</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar — always visible */}
      <div className={styles.inputBar}>
        {hasMessages && (
          <button
            className={styles.expandBtn}
            onClick={onToggleThread}
            title={threadOpen ? 'Collapse thread' : 'Expand thread'}
          >
            {threadOpen ? '▾' : '▴'}
          </button>
        )}
        <textarea
          ref={inputRef}
          className={styles.input}
          placeholder="Ask anything…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
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

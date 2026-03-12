import { useEffect, useRef } from 'react'
import styles from './SpeechBubble.module.css'

interface SpeechBubbleProps {
  text: string
  isStreaming?: boolean
  onClose?: () => void
}

export function SpeechBubble({ text, isStreaming, onClose }: SpeechBubbleProps) {
  const tailRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isStreaming && text && onClose) {
      const timer = setTimeout(onClose, 6000)
      return () => clearTimeout(timer)
    }
  }, [isStreaming, text, onClose])

  // Auto-scroll to bottom during streaming
  useEffect(() => {
    if (isStreaming && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [text, isStreaming])

  if (!text) return null

  // During streaming, show only the tail end for a typewriter feel
  const displayText = isStreaming && text.length > 120
    ? '…' + text.slice(-120)
    : text

  return (
    <div className={styles.bubble}>
      <div ref={contentRef} className={styles.content}>
        <span className={styles.text}>{displayText}</span>
        {isStreaming && <span className={styles.cursor}>▋</span>}
      </div>
      <div ref={tailRef} className={styles.tail} />
      {!isStreaming && onClose && (
        <button className={styles.close} onClick={onClose}>×</button>
      )}
    </div>
  )
}

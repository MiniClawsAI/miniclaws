import { useEffect, useRef, useCallback, useState } from 'react'
import styles from './SpeechBubble.module.css'

interface SpeechBubbleProps {
  text: string
  isStreaming?: boolean
  onClose?: () => void
  onClick?: () => void
}

export function SpeechBubble({ text, isStreaming, onClose, onClick }: SpeechBubbleProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [hovered, setHovered] = useState(false)

  // ── Auto-dismiss after 6 s (paused while hovered) ─────────
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!isStreaming && text && onClose && !hovered) {
      clearTimer()
      timerRef.current = setTimeout(onClose, 6000)
    }
    // If hovered, just clear any existing timer
    if (hovered) clearTimer()

    return clearTimer
  }, [isStreaming, text, onClose, hovered, clearTimer])

  // ── Auto-scroll to bottom during streaming ────────────────
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
    <div
      className={styles.bubble}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => {
        // Don't trigger if they clicked the close button
        if ((e.target as HTMLElement).closest('button')) return
        onClick?.()
      }}
      style={{ cursor: onClick ? 'pointer' : undefined }}
    >
      <div ref={contentRef} className={styles.content}>
        <span className={styles.text}>{displayText}</span>
        {isStreaming && <span className={styles.cursor}>▋</span>}
      </div>
      <div className={styles.tail} />
      {!isStreaming && onClose && (
        <button className={styles.close} onClick={onClose}>×</button>
      )}
    </div>
  )
}

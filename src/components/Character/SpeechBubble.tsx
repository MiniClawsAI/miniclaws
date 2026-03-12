import { useEffect, useRef } from 'react'
import styles from './SpeechBubble.module.css'

interface SpeechBubbleProps {
  text: string
  isStreaming?: boolean
  onClose?: () => void
}

export function SpeechBubble({ text, isStreaming, onClose }: SpeechBubbleProps) {
  const tailRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isStreaming && text && onClose) {
      const timer = setTimeout(onClose, 6000)
      return () => clearTimeout(timer)
    }
  }, [isStreaming, text, onClose])

  if (!text) return null

  return (
    <div className={styles.bubble}>
      <div className={styles.content}>
        <span className={styles.text}>{text}</span>
        {isStreaming && <span className={styles.cursor}>▋</span>}
      </div>
      <div ref={tailRef} className={styles.tail} />
      {!isStreaming && onClose && (
        <button className={styles.close} onClick={onClose}>×</button>
      )}
    </div>
  )
}

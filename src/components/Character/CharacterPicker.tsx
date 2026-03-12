import { useEffect, useRef, useState } from 'react'
import {
  getCharacter,
  getCharactersByType,
  TYPE_ICONS,
  TYPE_LABELS,
  TYPE_ORDER
} from '../../characters'
import type { CharacterAppearance, CharacterType } from '../../characters'
import { useStore } from '../../store'
import styles from './CharacterPicker.module.css'

interface CharacterPickerProps {
  onClose: () => void
}

/* ── Type-aware mini face preview ─────────────────────────── */
function MiniPreview({ char }: { char: CharacterAppearance }) {
  switch (char.type) {
    case 'person':
      return (
        <div className={styles.face} style={{ background: char.skin }}>
          <div className={`${styles.eye} ${styles.eyeL}`} style={{ background: char.pupil }} />
          <div className={`${styles.eye} ${styles.eyeR}`} style={{ background: char.pupil }} />
          <div className={styles.smileMouth} style={{ background: char.mouth }} />
        </div>
      )
    case 'monster':
      return (
        <div className={styles.face} style={{ background: char.body }}>
          <div className={`${styles.miniHorn} ${styles.miniHornL}`} style={{ background: char.horn }} />
          <div className={`${styles.miniHorn} ${styles.miniHornR}`} style={{ background: char.horn }} />
          <div className={`${styles.eye} ${styles.eyeL} ${styles.eyeBig}`} style={{ background: char.pupil }} />
          <div className={`${styles.eye} ${styles.eyeR} ${styles.eyeBig}`} style={{ background: char.pupil }} />
          <div className={styles.smileMouth} style={{ background: char.mouth }} />
        </div>
      )
    case 'animal':
      return (
        <div className={styles.face} style={{ background: char.fur }}>
          <div className={`${styles.miniEar} ${styles.miniEarL}`} style={{ background: char.fur }} />
          <div className={`${styles.miniEar} ${styles.miniEarR}`} style={{ background: char.fur }} />
          <div className={`${styles.eye} ${styles.eyeL}`} style={{ background: char.pupil }} />
          <div className={`${styles.eye} ${styles.eyeR}`} style={{ background: char.pupil }} />
          <div className={styles.miniNose} style={{ background: char.nose }} />
        </div>
      )
    case 'robot':
      return (
        <div className={`${styles.face} ${styles.faceSquare}`} style={{ background: char.chassis }}>
          <div className={styles.miniScreen} style={{ background: char.screen }}>
            <div className={`${styles.eye} ${styles.eyeL} ${styles.eyeGlow}`} style={{ background: char.led }} />
            <div className={`${styles.eye} ${styles.eyeR} ${styles.eyeGlow}`} style={{ background: char.led }} />
          </div>
        </div>
      )
  }
}

/* ── Picker component ─────────────────────────────────────── */
export function CharacterPicker({ onClose }: CharacterPickerProps) {
  const { characterId, setCharacterId } = useStore()
  const panelRef = useRef<HTMLDivElement>(null)

  // Open to the current character's type tab
  const currentChar = getCharacter(characterId)
  const [activeType, setActiveType] = useState<CharacterType>(currentChar.type)
  const grouped = getCharactersByType()

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const timer = setTimeout(() => {
      window.addEventListener('pointerdown', handleClick)
    }, 50)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('pointerdown', handleClick)
    }
  }, [onClose])

  return (
    <div className={styles.overlay}>
      <div className={styles.panel} ref={panelRef}>
        {/* Category tabs */}
        <div className={styles.tabs}>
          {TYPE_ORDER.map((type) => (
            <button
              key={type}
              className={`${styles.tab} ${activeType === type ? styles.tabActive : ''}`}
              onClick={() => setActiveType(type)}
            >
              <span className={styles.tabIcon}>{TYPE_ICONS[type]}</span>
              <span className={styles.tabLabel}>{TYPE_LABELS[type]}</span>
            </button>
          ))}
        </div>

        {/* Swatches for selected type */}
        <div className={styles.swatchRow}>
          {grouped[activeType]?.map((char) => (
            <button
              key={char.id}
              className={`${styles.swatch} ${characterId === char.id ? styles.active : ''}`}
              onClick={() => {
                setCharacterId(char.id)
                onClose()
              }}
              title={char.name}
            >
              <MiniPreview char={char} />
              <span className={styles.name}>{char.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

import { Suspense, useRef, useCallback, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { useStore } from '../../store'
import { getCharacter } from '../../characters'
import { VRMAvatar } from './VRMAvatar'
import { CharacterRenderer } from './CharacterRenderer'
import { SpeechBubble } from './SpeechBubble'
import styles from './CharacterScene.module.css'

function CameraZoom() {
  const { camera } = useThree()
  useEffect(() => {
    camera.position.z = 2.2
    camera.position.y = 0.05
    camera.updateProjectionMatrix()
  }, [camera])
  return null
}

export function CharacterScene() {
  const {
    vrmPath,
    emotion,
    isStreaming,
    speechText,
    setSpeechText,
    setChatOpen,
    isChatOpen,
    characterId
  } = useStore()

  const appearance = getCharacter(characterId)

  // ── Dragging ───────────────────────────────────────────────
  const isDragging = useRef(false)
  const dragStart  = useRef({ mx: 0, my: 0, wx: 0, wy: 0 })

  const onPointerDown = useCallback(async (e: React.PointerEvent) => {
    if (e.button !== 0) return
    isDragging.current = false
    const [wx, wy] = await window.electron.getWindowPos()
    dragStart.current = { mx: e.screenX, my: e.screenY, wx, wy }

    const onMove = (ev: PointerEvent) => {
      const dx = ev.screenX - dragStart.current.mx
      const dy = ev.screenY - dragStart.current.my
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isDragging.current = true
      window.electron.moveWindow(dragStart.current.wx + dx, dragStart.current.wy + dy)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [])

  const onClick = useCallback(() => {
    if (isDragging.current) return
    // Character click is reserved for future interactions (wave, etc.)
    // Chat thread is opened via the input bar expand button or speech bubble click
  }, [])


  return (
    <div className={styles.wrapper}>
      {/* Speech bubble floats above canvas */}
      {!isChatOpen && (speechText || isStreaming) && (
        <div className={styles.bubble}>
          <SpeechBubble
            text={speechText}
            isStreaming={isStreaming}
            onClose={() => setSpeechText('')}
            onClick={() => {
              setSpeechText('')
              setChatOpen(true)
            }}
          />
        </div>
      )}

      {/* 3D canvas */}
      <div
        className={styles.canvas}
        onPointerDown={onPointerDown}
        onClick={onClick}
        onContextMenu={(e) => e.preventDefault()}
        style={{ cursor: 'grab' }}
      >
        <Canvas
          gl={{ alpha: true, antialias: true }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0)
          }}
          camera={{ position: [0, 0.2, 2.5], fov: 35 }}
        >
          <CameraZoom isClippy={appearance.type === 'clippy'} />
          <ambientLight intensity={1.2} />
          <directionalLight position={[2, 4, 3]} intensity={1.5} castShadow />
          <pointLight position={[-2, 2, 2]} intensity={0.5} color="#a78bfa" />

          <Suspense fallback={null}>
            {vrmPath ? (
              <VRMAvatar
                url={vrmPath}
                emotion={emotion}
                isTalking={isStreaming}
              />
            ) : (
              <CharacterRenderer
                emotion={emotion}
                isTalking={isStreaming}
                appearance={appearance}
              />
            )}
<hemisphereLight args={['#b1e1ff', '#b97a20', 0.6]} />
          </Suspense>
        </Canvas>
      </div>

    </div>
  )
}

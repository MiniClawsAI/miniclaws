import { useMemo } from 'react'
import * as THREE from 'three'
import type { CharacterEmotion } from '../../store'
import type { CharacterAppearance } from '../../characters'
import { PersonChar } from './PersonChar'
import { MonsterChar } from './MonsterChar'
import { AnimalChar } from './AnimalChar'
import { LobsterChar } from './LobsterChar'
import { RobotChar } from './RobotChar'
import { ClippyChar } from './ClippyChar'

interface CharacterRendererProps {
  emotion: CharacterEmotion
  isTalking: boolean
  appearance: CharacterAppearance
}

const SHADOW_Y: Record<CharacterAppearance['type'], number> = {
  person: -0.7,
  robot: -0.55,
  monster: -0.50,
  animal: -0.48,
  lobster: -0.526,
  clippy: 0,
}

/** Soft radial-gradient shadow blob that lives inside the character group */
function CharShadow({ type }: { type: CharacterAppearance['type'] }) {
  if (type === 'clippy') return null

  const texture = useMemo(() => {
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    const gradient = ctx.createRadialGradient(
      size / 2, size / 2, 0,
      size / 2, size / 2, size / 2
    )
    gradient.addColorStop(0, 'rgba(0,0,0,0.3)')
    gradient.addColorStop(0.4, 'rgba(0,0,0,0.15)')
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
    const tex = new THREE.CanvasTexture(canvas)
    tex.needsUpdate = true
    return tex
  }, [])

  const y = SHADOW_Y[type]

  return (
    <mesh position={[0, y + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.7, 0.3]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  )
}

export function CharacterRenderer({ emotion, isTalking, appearance }: CharacterRendererProps) {
  const char = (() => {
    switch (appearance.type) {
      case 'person':
        return <PersonChar emotion={emotion} isTalking={isTalking} appearance={appearance} />
      case 'monster':
        return <MonsterChar emotion={emotion} isTalking={isTalking} appearance={appearance} />
      case 'animal':
        return <AnimalChar emotion={emotion} isTalking={isTalking} appearance={appearance} />
      case 'lobster':
        return <LobsterChar emotion={emotion} isTalking={isTalking} appearance={appearance} />
      case 'robot':
        return <RobotChar emotion={emotion} isTalking={isTalking} appearance={appearance} />
      case 'clippy':
        return <ClippyChar emotion={emotion} isTalking={isTalking} appearance={appearance} />
    }
  })()

  return (
    <group>
      {char}
      <CharShadow type={appearance.type} />
    </group>
  )
}

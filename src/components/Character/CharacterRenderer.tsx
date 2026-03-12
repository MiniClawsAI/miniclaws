import { ContactShadows } from '@react-three/drei'
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
  person: -0.86,
  robot: -0.55,
  monster: -0.55,
  animal: -0.55,
  lobster: -0.55,
  clippy: 0,
}

function CharShadow({ type }: { type: CharacterAppearance['type'] }) {
  if (type === 'clippy') return null
  return (
    <ContactShadows
      position={[0, SHADOW_Y[type], 0]}
      opacity={0.25}
      scale={2}
      blur={2}
      far={1.5}
    />
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
    <>
      {char}
      <CharShadow type={appearance.type} />
    </>
  )
}

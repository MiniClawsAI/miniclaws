import type { CharacterEmotion } from '../../store'
import type { CharacterAppearance } from '../../characters'
import { PersonChar } from './PersonChar'
import { MonsterChar } from './MonsterChar'
import { AnimalChar } from './AnimalChar'
import { RobotChar } from './RobotChar'

interface CharacterRendererProps {
  emotion: CharacterEmotion
  isTalking: boolean
  appearance: CharacterAppearance
}

export function CharacterRenderer({ emotion, isTalking, appearance }: CharacterRendererProps) {
  switch (appearance.type) {
    case 'person':
      return <PersonChar emotion={emotion} isTalking={isTalking} appearance={appearance} />
    case 'monster':
      return <MonsterChar emotion={emotion} isTalking={isTalking} appearance={appearance} />
    case 'animal':
      return <AnimalChar emotion={emotion} isTalking={isTalking} appearance={appearance} />
    case 'robot':
      return <RobotChar emotion={emotion} isTalking={isTalking} appearance={appearance} />
  }
}

// ── Base fields shared by all character types ────────────────
interface CharacterBase {
  id: string
  name: string
  pupil: string
  mouth: string
  blush: string
}

// ── Person ───────────────────────────────────────────────────
export interface PersonAppearance extends CharacterBase {
  type: 'person'
  skin: string
  skinDark: string
  hair: string
  shirt: string
  pants: string
  shoe: string
}

// ── Monster ──────────────────────────────────────────────────
export interface MonsterAppearance extends CharacterBase {
  type: 'monster'
  body: string
  bodyDark: string
  horn: string
  spot: string
}

// ── Animal ───────────────────────────────────────────────────
export interface AnimalAppearance extends CharacterBase {
  type: 'animal'
  fur: string
  furDark: string
  nose: string
  pawPad: string
  tail: string
}

// ── Robot ────────────────────────────────────────────────────
export interface RobotAppearance extends CharacterBase {
  type: 'robot'
  chassis: string
  trim: string
  screen: string
  led: string
}

// ── Union type ───────────────────────────────────────────────
export type CharacterAppearance =
  | PersonAppearance
  | MonsterAppearance
  | AnimalAppearance
  | RobotAppearance

export type CharacterType = CharacterAppearance['type']

// ── Presets ──────────────────────────────────────────────────
export const CHARACTERS: CharacterAppearance[] = [
  // ── People ─────────────────────────────────────────────────
  {
    type: 'person', id: 'default', name: 'Alex',
    skin: '#f5d0b0', skinDark: '#e8b896', hair: '#3d2b1f',
    shirt: '#7c6cf0', pants: '#2d2b45', shoe: '#1a1a2e',
    mouth: '#c4726c', pupil: '#2d1b0e', blush: '#f0a0a0',
  },
  {
    type: 'person', id: 'luna', name: 'Luna',
    skin: '#fce4d6', skinDark: '#f0cdb8', hair: '#1a1a3e',
    shirt: '#e05297', pants: '#2b2040', shoe: '#3d2050',
    mouth: '#d4687a', pupil: '#1a1a3e', blush: '#f4a0b8',
  },
  {
    type: 'person', id: 'kai', name: 'Kai',
    skin: '#c68642', skinDark: '#b0722e', hair: '#0d0d0d',
    shirt: '#2ecc71', pants: '#1a2634', shoe: '#111111',
    mouth: '#a0524a', pupil: '#1a0e06', blush: '#d08a6a',
  },
  {
    type: 'person', id: 'miko', name: 'Miko',
    skin: '#ffe0bd', skinDark: '#f0c9a0', hair: '#ff6b6b',
    shirt: '#ff9f43', pants: '#3d3452', shoe: '#2d2040',
    mouth: '#e07070', pupil: '#5a2d0c', blush: '#ffb0b0',
  },
  {
    type: 'person', id: 'sage', name: 'Sage',
    skin: '#f0d5c2', skinDark: '#e0bfa8', hair: '#e8e0d4',
    shirt: '#5b8a72', pants: '#2b3530', shoe: '#1a1a18',
    mouth: '#c08070', pupil: '#4a6050', blush: '#e0a8a0',
  },
  {
    type: 'person', id: 'nova', name: 'Nova',
    skin: '#8d5524', skinDark: '#7a4520', hair: '#f5f5f5',
    shirt: '#6c5ce7', pants: '#1a1832', shoe: '#0d0d1a',
    mouth: '#904848', pupil: '#1a0a04', blush: '#b07058',
  },

  // ── Monsters ───────────────────────────────────────────────
  {
    type: 'monster', id: 'gobbo', name: 'Gobbo',
    body: '#6bcf63', bodyDark: '#a8e8a0', horn: '#f0d060', spot: '#4a9e44',
    mouth: '#c44040', pupil: '#1a1a0e', blush: '#80d080',
  },
  {
    type: 'monster', id: 'fang', name: 'Fang',
    body: '#9b6bf0', bodyDark: '#c8a8f8', horn: '#f08060', spot: '#7040c0',
    mouth: '#d06080', pupil: '#200e30', blush: '#c090e0',
  },
  {
    type: 'monster', id: 'bloop', name: 'Bloop',
    body: '#5090e0', bodyDark: '#90c0f8', horn: '#40d8d0', spot: '#3060b0',
    mouth: '#e07080', pupil: '#0e1830', blush: '#80b0e8',
  },

  // ── Animals ────────────────────────────────────────────────
  {
    type: 'animal', id: 'whiskers', name: 'Whiskers',
    fur: '#f0a050', furDark: '#f8d8b0', nose: '#3a2820', pawPad: '#e08080', tail: '#f0a050',
    mouth: '#c06060', pupil: '#2a1a08', blush: '#f0b090',
  },
  {
    type: 'animal', id: 'patches', name: 'Patches',
    fur: '#e0e0e0', furDark: '#ffffff', nose: '#f08090', pawPad: '#f0a0a0', tail: '#808080',
    mouth: '#c07070', pupil: '#304050', blush: '#f0b0c0',
  },
  {
    type: 'animal', id: 'cocoa', name: 'Cocoa',
    fur: '#8b5e3c', furDark: '#d4a574', nose: '#2a1a10', pawPad: '#c08060', tail: '#6b3e1c',
    mouth: '#a04848', pupil: '#1a0e04', blush: '#c08868',
  },

  // ── Robots ─────────────────────────────────────────────────
  {
    type: 'robot', id: 'sparky', name: 'Sparky',
    chassis: '#b0b8c8', trim: '#6080c0', screen: '#1a2030', led: '#60f080',
    mouth: '#60f080', pupil: '#80ffb0', blush: '#405060',
  },
  {
    type: 'robot', id: 'pixel', name: 'Pixel',
    chassis: '#f0e0c0', trim: '#e06040', screen: '#201820', led: '#f06080',
    mouth: '#f06080', pupil: '#ff90b0', blush: '#c0a088',
  },
]

// ── Helpers ──────────────────────────────────────────────────
export function getCharacter(id: string): CharacterAppearance {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0]
}

export function getCharactersByType(): Record<CharacterType, CharacterAppearance[]> {
  const grouped = {} as Record<CharacterType, CharacterAppearance[]>
  for (const c of CHARACTERS) {
    if (!grouped[c.type]) grouped[c.type] = []
    grouped[c.type].push(c)
  }
  return grouped
}

export const TYPE_LABELS: Record<CharacterType, string> = {
  person: 'People',
  monster: 'Monsters',
  animal: 'Animals',
  robot: 'Robots',
}

export const TYPE_ICONS: Record<CharacterType, string> = {
  person: '👤',
  monster: '👾',
  animal: '🐾',
  robot: '🤖',
}

export const TYPE_ORDER: CharacterType[] = ['person', 'monster', 'animal', 'robot']

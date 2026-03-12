import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { CharacterEmotion } from '../../store'

interface AnimationRefs {
  groupRef: React.RefObject<THREE.Group>
  headRef: React.RefObject<THREE.Group>
  eyeL?: React.RefObject<THREE.Mesh>
  eyeR?: React.RefObject<THREE.Mesh>
  pupilL?: React.RefObject<THREE.Mesh>
  pupilR?: React.RefObject<THREE.Mesh>
  mouth?: React.RefObject<THREE.Mesh>
  browL?: React.RefObject<THREE.Mesh>
  browR?: React.RefObject<THREE.Mesh>
  armL?: React.RefObject<THREE.Group>
  armR?: React.RefObject<THREE.Group>
  forearmL?: React.RefObject<THREE.Group>
  forearmR?: React.RefObject<THREE.Group>
  legL?: React.RefObject<THREE.Group>
  legR?: React.RefObject<THREE.Group>
}

interface AnimationOptions {
  emotion: CharacterEmotion
  isTalking: boolean
  swayAmount?: number
  headLookAmount?: number
  pupilBaseX?: number
  pupilBaseY?: number
  browBaseY?: number
}

const emotionBrow: Record<CharacterEmotion, number> = {
  idle: 0,
  talking: 0.02,
  thinking: 0.06,
  happy: -0.03,
  surprised: -0.06,
  wave: -0.02
}

export function useCharacterAnimation(refs: AnimationRefs, options: AnimationOptions) {
  const t = useRef(0)
  const blinkT = useRef(0)
  const nextBlink = useRef(2.5 + Math.random() * 3)

  const {
    emotion,
    isTalking,
    swayAmount = 0.015,
    headLookAmount = 0.1,
    pupilBaseX = 0.1,
    pupilBaseY = 0.06,
    browBaseY = 0.18
  } = options

  useFrame((_, delta) => {
    t.current += delta
    blinkT.current += delta
    if (!refs.groupRef.current || !refs.headRef.current) return

    const time = t.current

    // Subtle idle sway
    refs.groupRef.current.position.y = Math.sin(time * 0.8) * swayAmount
    refs.groupRef.current.rotation.y = Math.sin(time * 0.3) * 0.08

    // Head look around
    refs.headRef.current.rotation.y = Math.sin(time * 0.5) * headLookAmount
    refs.headRef.current.rotation.z = Math.sin(time * 0.35) * 0.04
    refs.headRef.current.rotation.x = Math.sin(time * 0.45) * 0.03

    // Pupil tracking
    const px = Math.sin(time * 0.6) * 0.008
    const py = Math.sin(time * 0.8) * 0.005
    if (refs.pupilL?.current) {
      refs.pupilL.current.position.x = -pupilBaseX + px
      refs.pupilL.current.position.y = pupilBaseY + py
    }
    if (refs.pupilR?.current) {
      refs.pupilR.current.position.x = pupilBaseX + px
      refs.pupilR.current.position.y = pupilBaseY + py
    }

    // Blink
    if (blinkT.current >= nextBlink.current) {
      blinkT.current = 0
      nextBlink.current = 2.5 + Math.random() * 4
      if (refs.eyeL?.current && refs.eyeR?.current) {
        refs.eyeL.current.scale.y = 0.08
        refs.eyeR.current.scale.y = 0.08
        setTimeout(() => {
          if (refs.eyeL?.current) refs.eyeL.current.scale.y = 1
          if (refs.eyeR?.current) refs.eyeR.current.scale.y = 1
        }, 100)
      }
    }

    // Eyebrows
    const browTarget = emotionBrow[emotion] || 0
    if (refs.browL?.current) {
      refs.browL.current.position.y = THREE.MathUtils.lerp(
        refs.browL.current.position.y, browBaseY + browTarget, 0.08
      )
    }
    if (refs.browR?.current) {
      refs.browR.current.position.y = THREE.MathUtils.lerp(
        refs.browR.current.position.y, browBaseY + browTarget, 0.08
      )
    }

    // Mouth animation
    if (refs.mouth?.current) {
      if (isTalking) {
        const talk = 0.3 + Math.abs(Math.sin(time * 10)) * 0.7
        refs.mouth.current.scale.y = talk
        refs.mouth.current.scale.x = 1.0 + Math.sin(time * 7) * 0.15
      } else if (emotion === 'happy') {
        refs.mouth.current.scale.y = 0.6
        refs.mouth.current.scale.x = 1.3
      } else {
        refs.mouth.current.scale.y = THREE.MathUtils.lerp(refs.mouth.current.scale.y, 1, 0.1)
        refs.mouth.current.scale.x = THREE.MathUtils.lerp(refs.mouth.current.scale.x, 1, 0.1)
      }
    }

    // Arm swing
    if (refs.armL?.current) {
      refs.armL.current.rotation.z = 0.15 + Math.sin(time * 0.9) * 0.04
      if (emotion === 'wave') refs.armL.current.rotation.z = 0.15
    }
    if (refs.armR?.current) {
      if (emotion === 'wave') {
        refs.armR.current.rotation.z = -0.8 - Math.sin(time * 4) * 0.3
      } else {
        refs.armR.current.rotation.z = -0.15 + Math.sin(time * 0.9 + 1) * 0.04
      }
    }
    if (refs.forearmL?.current) {
      refs.forearmL.current.rotation.z = Math.sin(time * 0.7) * 0.05
    }
    if (refs.forearmR?.current) {
      if (emotion === 'wave') {
        refs.forearmR.current.rotation.z = -0.6 - Math.sin(time * 6) * 0.4
      } else {
        refs.forearmR.current.rotation.z = Math.sin(time * 0.7 + 1) * 0.05
      }
    }

    // Leg subtle shift
    if (refs.legL?.current) {
      refs.legL.current.rotation.x = Math.sin(time * 0.5) * 0.02
    }
    if (refs.legR?.current) {
      refs.legR.current.rotation.x = Math.sin(time * 0.5 + Math.PI) * 0.02
    }
  })

  return t
}

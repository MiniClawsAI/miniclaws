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
  const initialY = useRef<number | null>(null)
  const talkBlend = useRef(0) // smoothly blends 0→1 when talking

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

    // Capture initial Y position on first frame
    if (initialY.current === null) {
      initialY.current = refs.groupRef.current.position.y
    }

    // Smooth blend toward talking state
    const talkTarget = isTalking ? 1 : 0
    talkBlend.current = THREE.MathUtils.lerp(talkBlend.current, talkTarget, 0.04)
    const tb = talkBlend.current

    const time = t.current
    // Multiplier smoothly ramps 1→2 based on talk blend
    const mult = 1 + tb * 1.0

    // Subtle idle sway — smoothly amplified when talking
    refs.groupRef.current.position.y = initialY.current + Math.sin(time * 0.8) * swayAmount * mult
    refs.groupRef.current.rotation.y = Math.sin(time * 0.3) * 0.08 * mult
    refs.groupRef.current.position.x = Math.sin(time * 1.2) * 0.01 * tb

    // Head look around — smoothly more active when talking
    refs.headRef.current.rotation.y = Math.sin(time * 0.5) * headLookAmount * mult
    refs.headRef.current.rotation.z = Math.sin(time * 0.35) * 0.04 * mult
    refs.headRef.current.rotation.x = Math.sin(time * 0.45) * 0.03 * mult

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
        if (refs.pupilL?.current) refs.pupilL.current.scale.y = 0.08
        if (refs.pupilR?.current) refs.pupilR.current.scale.y = 0.08
        setTimeout(() => {
          if (refs.eyeL?.current) refs.eyeL.current.scale.y = 1
          if (refs.eyeR?.current) refs.eyeR.current.scale.y = 1
          if (refs.pupilL?.current) refs.pupilL.current.scale.y = 1
          if (refs.pupilR?.current) refs.pupilR.current.scale.y = 1
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

    // Arm swing — smoothly gesture more when talking
    const armSwing = 0.04 + tb * 0.08
    if (refs.armL?.current) {
      refs.armL.current.rotation.z = 0.6 + Math.sin(time * 0.9) * armSwing
      if (emotion === 'wave') refs.armL.current.rotation.z = 0.6
    }
    if (refs.armR?.current) {
      if (emotion === 'wave') {
        refs.armR.current.rotation.z = -0.8 - Math.sin(time * 4) * 0.3
      } else {
        refs.armR.current.rotation.z = -0.6 + Math.sin(time * 0.9 + 1) * armSwing
      }
    }
    const forearmSwing = 0.05 + tb * 0.1
    if (refs.forearmL?.current) {
      refs.forearmL.current.rotation.z = Math.sin(time * 0.7) * forearmSwing
    }
    if (refs.forearmR?.current) {
      if (emotion === 'wave') {
        refs.forearmR.current.rotation.z = -0.6 - Math.sin(time * 6) * 0.4
      } else {
        refs.forearmR.current.rotation.z = Math.sin(time * 0.7 + 1) * forearmSwing
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

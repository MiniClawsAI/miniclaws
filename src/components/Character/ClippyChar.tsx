import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { CharacterEmotion } from '../../store'
import type { ClippyAppearance } from '../../characters'
import { useCharacterAnimation } from './useCharacterAnimation'

interface ClippyCharProps {
  emotion: CharacterEmotion
  isTalking: boolean
  appearance: ClippyAppearance
}

export function ClippyChar({ emotion, isTalking, appearance }: ClippyCharProps) {
  const groupRef  = useRef<THREE.Group>(null)
  const headRef   = useRef<THREE.Group>(null)
  const eyeL      = useRef<THREE.Mesh>(null)
  const eyeR      = useRef<THREE.Mesh>(null)
  const pupilL    = useRef<THREE.Mesh>(null)
  const pupilR    = useRef<THREE.Mesh>(null)
  const mouth     = useRef<THREE.Mesh>(null)
  const browL     = useRef<THREE.Mesh>(null)
  const browR     = useRef<THREE.Mesh>(null)
  const wireBody  = useRef<THREE.Group>(null)

  const t = useCharacterAnimation(
    { groupRef, headRef, eyeL, eyeR, pupilL, pupilR, mouth, browL, browR },
    {
      emotion, isTalking,
      swayAmount: 0.015,
      headLookAmount: 0.06,
      pupilBaseX: 0.06,
      pupilBaseY: 0.46,
      browBaseY: 0.56,
    }
  )

  // Clippy-specific: wire body springy wobble
  useFrame(() => {
    if (!t.current || !wireBody.current) return
    const time = t.current
    wireBody.current.rotation.z = Math.sin(time * 1.5) * 0.02
    wireBody.current.scale.y = 1 + Math.sin(time * 2) * 0.008
  })

  const { wire, wireDark } = appearance
  const r = 0.035 // wire tube radius

  return (
    <group ref={groupRef} position={[0, -0.13, 0]} scale={0.6}>

      {/* ── Paperclip wire body ──────────────────────────── */}
      <group ref={wireBody}>

        {/* Bottom outer U-curve */}
        <mesh position={[0, -0.42, 0]} rotation={[Math.PI, 0, 0]}>
          <torusGeometry args={[0.12, r, 12, 24, Math.PI]} />
          <meshStandardMaterial color={wire} roughness={0.3} metalness={0.6} />
        </mesh>

        {/* Left vertical (outer) */}
        <mesh position={[-0.12, -0.07, 0]}>
          <capsuleGeometry args={[r, 0.70, 8, 12]} />
          <meshStandardMaterial color={wire} roughness={0.3} metalness={0.6} />
        </mesh>

        {/* Top arch curve */}
        <mesh position={[0, 0.28, 0]}>
          <torusGeometry args={[0.12, r, 12, 24, Math.PI]} />
          <meshStandardMaterial color={wire} roughness={0.3} metalness={0.6} />
        </mesh>

        {/* Right vertical (shorter) */}
        <mesh position={[0.12, 0.10, 0]}>
          <capsuleGeometry args={[r, 0.36, 8, 12]} />
          <meshStandardMaterial color={wire} roughness={0.3} metalness={0.6} />
        </mesh>

        {/* Inner bottom U-curve */}
        <mesh position={[0.02, -0.08, 0]} rotation={[Math.PI, 0, 0]}>
          <torusGeometry args={[0.10, r, 12, 24, Math.PI]} />
          <meshStandardMaterial color={wireDark} roughness={0.3} metalness={0.6} />
        </mesh>

        {/* Inner left vertical (short) */}
        <mesh position={[-0.08, -0.015, 0]}>
          <capsuleGeometry args={[r, 0.13, 8, 12]} />
          <meshStandardMaterial color={wireDark} roughness={0.3} metalness={0.6} />
        </mesh>
      </group>

      {/* ── Head (eyes, brows, mouth) ────────────────────── */}
      <group ref={headRef}>

        {/* Eyes (whites) — big googly */}
        <mesh ref={eyeL} position={[-0.06, 0.46, 0.04]}>
          <sphereGeometry args={[0.08, 20, 20]} />
          <meshStandardMaterial color="white" />
        </mesh>
        <mesh ref={eyeR} position={[0.06, 0.46, 0.04]}>
          <sphereGeometry args={[0.08, 20, 20]} />
          <meshStandardMaterial color="white" />
        </mesh>

        {/* Pupils */}
        <mesh ref={pupilL} position={[-0.06, 0.46, 0.11]}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshStandardMaterial color={appearance.pupil} />
        </mesh>
        <mesh ref={pupilR} position={[0.06, 0.46, 0.11]}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshStandardMaterial color={appearance.pupil} />
        </mesh>

        {/* Pupil highlights */}
        <mesh position={[-0.048, 0.475, 0.13]}>
          <sphereGeometry args={[0.013, 8, 8]} />
          <meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[0.072, 0.475, 0.13]}>
          <sphereGeometry args={[0.013, 8, 8]} />
          <meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.5} />
        </mesh>

        {/* Eyebrows */}
        <mesh ref={browL} position={[-0.06, 0.56, 0.06]} rotation={[0.2, 0, 0.15]}>
          <boxGeometry args={[0.06, 0.013, 0.01]} />
          <meshStandardMaterial color={appearance.pupil} />
        </mesh>
        <mesh ref={browR} position={[0.06, 0.56, 0.06]} rotation={[0.2, 0, -0.15]}>
          <boxGeometry args={[0.06, 0.013, 0.01]} />
          <meshStandardMaterial color={appearance.pupil} />
        </mesh>

        {/* Mouth */}
        <mesh ref={mouth} position={[0, 0.34, 0.05]}>
          <capsuleGeometry args={[0.008, 0.025, 4, 8]} />
          <meshStandardMaterial color={appearance.mouth} roughness={0.5} />
        </mesh>

        {/* Cheek blush */}
        <mesh position={[-0.12, 0.42, 0.05]}>
          <sphereGeometry args={[0.025, 10, 10]} />
          <meshStandardMaterial color={appearance.blush} transparent opacity={0.25} roughness={1} />
        </mesh>
        <mesh position={[0.12, 0.42, 0.05]}>
          <sphereGeometry args={[0.025, 10, 10]} />
          <meshStandardMaterial color={appearance.blush} transparent opacity={0.25} roughness={1} />
        </mesh>
      </group>
    </group>
  )
}

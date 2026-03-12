import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { CharacterEmotion } from '../../store'
import type { MonsterAppearance } from '../../characters'
import { useCharacterAnimation } from './useCharacterAnimation'

interface MonsterCharProps {
  emotion: CharacterEmotion
  isTalking: boolean
  appearance: MonsterAppearance
}

export function MonsterChar({ emotion, isTalking, appearance }: MonsterCharProps) {
  const groupRef  = useRef<THREE.Group>(null)
  const headRef   = useRef<THREE.Group>(null)
  const eyeL      = useRef<THREE.Mesh>(null)
  const eyeR      = useRef<THREE.Mesh>(null)
  const pupilL    = useRef<THREE.Mesh>(null)
  const pupilR    = useRef<THREE.Mesh>(null)
  const mouth     = useRef<THREE.Mesh>(null)
  const armL      = useRef<THREE.Group>(null)
  const armR      = useRef<THREE.Group>(null)
  const legL      = useRef<THREE.Group>(null)
  const legR      = useRef<THREE.Group>(null)
  const hornL     = useRef<THREE.Mesh>(null)
  const hornR     = useRef<THREE.Mesh>(null)
  const bodyMesh  = useRef<THREE.Mesh>(null)

  const t = useCharacterAnimation(
    { groupRef, headRef, eyeL, eyeR, pupilL, pupilR, mouth, armL, armR, legL, legR },
    {
      emotion, isTalking,
      swayAmount: 0.02,
      headLookAmount: 0.12,
      pupilBaseX: 0.12,
      pupilBaseY: 0.08,
    }
  )

  // Monster-specific animations
  useFrame(() => {
    if (!t.current) return
    const time = t.current

    // Squash and stretch idle
    if (bodyMesh.current) {
      bodyMesh.current.scale.y = 1 + Math.sin(time * 1.2) * 0.03
      bodyMesh.current.scale.x = 1 - Math.sin(time * 1.2) * 0.015
    }

    // Horn wiggle on surprised
    if (hornL.current && hornR.current) {
      if (emotion === 'surprised') {
        hornL.current.rotation.z = 0.2 + Math.sin(time * 8) * 0.15
        hornR.current.rotation.z = -0.2 - Math.sin(time * 8) * 0.15
      } else {
        hornL.current.rotation.z = THREE.MathUtils.lerp(hornL.current.rotation.z, 0.2, 0.05)
        hornR.current.rotation.z = THREE.MathUtils.lerp(hornR.current.rotation.z, -0.2, 0.05)
      }
    }
  })

  const { body, bodyDark, horn, spot } = appearance

  return (
    <group ref={groupRef} position={[0, -0.08, 0]} scale={0.85}>
      {/* ── Body/Head (single round shape) ────────────── */}
      <group ref={headRef}>
        <mesh ref={bodyMesh} position={[0, 0, 0]}>
          <sphereGeometry args={[0.3, 32, 32]} />
          <meshStandardMaterial color={body} roughness={0.6} />
        </mesh>

        {/* Belly patch */}
        <mesh position={[0, -0.06, 0.2]}>
          <sphereGeometry args={[0.18, 24, 24]} />
          <meshStandardMaterial color={bodyDark} roughness={0.6} />
        </mesh>

        {/* Horns */}
        <mesh ref={hornL} position={[-0.14, 0.26, 0]} rotation={[0, 0, 0.2]}>
          <coneGeometry args={[0.04, 0.12, 8]} />
          <meshStandardMaterial color={horn} roughness={0.4} />
        </mesh>
        <mesh ref={hornR} position={[0.14, 0.26, 0]} rotation={[0, 0, -0.2]}>
          <coneGeometry args={[0.04, 0.12, 8]} />
          <meshStandardMaterial color={horn} roughness={0.4} />
        </mesh>

        {/* Eyes (whites) — big and expressive */}
        <mesh ref={eyeL} position={[-0.12, 0.08, 0.24]}>
          <sphereGeometry args={[0.055, 16, 16]} />
          <meshStandardMaterial color="white" />
        </mesh>
        <mesh ref={eyeR} position={[0.12, 0.08, 0.24]}>
          <sphereGeometry args={[0.055, 16, 16]} />
          <meshStandardMaterial color="white" />
        </mesh>

        {/* Pupils — large for cuteness */}
        <mesh ref={pupilL} position={[-0.12, 0.08, 0.29]}>
          <sphereGeometry args={[0.03, 12, 12]} />
          <meshStandardMaterial color={appearance.pupil} />
        </mesh>
        <mesh ref={pupilR} position={[0.12, 0.08, 0.29]}>
          <sphereGeometry args={[0.03, 12, 12]} />
          <meshStandardMaterial color={appearance.pupil} />
        </mesh>

        {/* Pupil highlights */}
        <mesh position={[-0.108, 0.095, 0.31]}>
          <sphereGeometry args={[0.01, 8, 8]} />
          <meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[0.132, 0.095, 0.31]}>
          <sphereGeometry args={[0.01, 8, 8]} />
          <meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.5} />
        </mesh>

        {/* Mouth — wide */}
        <mesh ref={mouth} position={[0, -0.1, 0.26]}>
          <capsuleGeometry args={[0.018, 0.06, 4, 8]} />
          <meshStandardMaterial color={appearance.mouth} roughness={0.5} />
        </mesh>

        {/* Teeth */}
        <mesh position={[-0.025, -0.08, 0.28]}>
          <boxGeometry args={[0.02, 0.025, 0.01]} />
          <meshStandardMaterial color="white" />
        </mesh>
        <mesh position={[0.025, -0.08, 0.28]}>
          <boxGeometry args={[0.02, 0.025, 0.01]} />
          <meshStandardMaterial color="white" />
        </mesh>

        {/* Spots */}
        <mesh position={[-0.2, 0.12, 0.12]}>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshStandardMaterial color={spot} transparent opacity={0.4} roughness={0.8} />
        </mesh>
        <mesh position={[0.18, -0.05, 0.18]}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshStandardMaterial color={spot} transparent opacity={0.4} roughness={0.8} />
        </mesh>
        <mesh position={[-0.08, -0.18, 0.22]}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshStandardMaterial color={spot} transparent opacity={0.4} roughness={0.8} />
        </mesh>

        {/* Cheek blush */}
        <mesh position={[-0.2, -0.02, 0.18]}>
          <sphereGeometry args={[0.035, 12, 12]} />
          <meshStandardMaterial color={appearance.blush} transparent opacity={0.3} roughness={1} />
        </mesh>
        <mesh position={[0.2, -0.02, 0.18]}>
          <sphereGeometry args={[0.035, 12, 12]} />
          <meshStandardMaterial color={appearance.blush} transparent opacity={0.3} roughness={1} />
        </mesh>
      </group>

      {/* ── Arms (stubby) ─────────────────────────────── */}
      <group ref={armL} position={[-0.28, -0.06, 0]}>
        <mesh position={[0, -0.06, 0]}>
          <capsuleGeometry args={[0.04, 0.1, 4, 8]} />
          <meshStandardMaterial color={body} roughness={0.6} />
        </mesh>
        {/* Mitten hand */}
        <mesh position={[0, -0.14, 0]}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshStandardMaterial color={body} roughness={0.6} />
        </mesh>
      </group>
      <group ref={armR} position={[0.28, -0.06, 0]}>
        <mesh position={[0, -0.06, 0]}>
          <capsuleGeometry args={[0.04, 0.1, 4, 8]} />
          <meshStandardMaterial color={body} roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.14, 0]}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshStandardMaterial color={body} roughness={0.6} />
        </mesh>
      </group>

      {/* ── Legs (very stubby) ────────────────────────── */}
      <group ref={legL} position={[-0.1, -0.32, 0]}>
        <mesh position={[0, -0.06, 0]}>
          <capsuleGeometry args={[0.05, 0.1, 4, 8]} />
          <meshStandardMaterial color={body} roughness={0.6} />
        </mesh>
        {/* Rounded foot */}
        <mesh position={[0, -0.15, 0.02]} scale={[1, 0.5, 1.2]}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshStandardMaterial color={bodyDark} roughness={0.5} />
        </mesh>
      </group>
      <group ref={legR} position={[0.1, -0.32, 0]}>
        <mesh position={[0, -0.06, 0]}>
          <capsuleGeometry args={[0.05, 0.1, 4, 8]} />
          <meshStandardMaterial color={body} roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.15, 0.02]} scale={[1, 0.5, 1.2]}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshStandardMaterial color={bodyDark} roughness={0.5} />
        </mesh>
      </group>
    </group>
  )
}

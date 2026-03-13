import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { CharacterEmotion } from '../../store'
import type { LobsterAppearance } from '../../characters'
import { useCharacterAnimation } from './useCharacterAnimation'

interface LobsterCharProps {
  emotion: CharacterEmotion
  isTalking: boolean
  appearance: LobsterAppearance
}

export function LobsterChar({ emotion, isTalking, appearance }: LobsterCharProps) {
  const groupRef   = useRef<THREE.Group>(null)
  const headRef    = useRef<THREE.Group>(null)
  const eyeL       = useRef<THREE.Mesh>(null)
  const eyeR       = useRef<THREE.Mesh>(null)
  const pupilL     = useRef<THREE.Mesh>(null)
  const pupilR     = useRef<THREE.Mesh>(null)
  const mouth      = useRef<THREE.Mesh>(null)
  const armL       = useRef<THREE.Group>(null)
  const armR       = useRef<THREE.Group>(null)
  const legL       = useRef<THREE.Group>(null)
  const legR       = useRef<THREE.Group>(null)
  const antennaL   = useRef<THREE.Group>(null)
  const antennaR   = useRef<THREE.Group>(null)

  const t = useCharacterAnimation(
    { groupRef, headRef, eyeL, eyeR, pupilL, pupilR, mouth, armL, armR, legL, legR },
    {
      emotion, isTalking,
      swayAmount: 0.012,
      headLookAmount: 0.06,
      pupilBaseX: 0.09,
      pupilBaseY: 0.06,
      armRestL: 0.6,
      armRestR: -0.6,
    }
  )

  // Lobster-specific animations
  useFrame(() => {
    if (!t.current) return
    const time = t.current

    // Antenna sway
    if (antennaL.current) {
      antennaL.current.rotation.z = 0.25 + Math.sin(time * 2.2) * 0.12
      antennaL.current.rotation.x = Math.sin(time * 1.8) * 0.06
    }
    if (antennaR.current) {
      antennaR.current.rotation.z = -0.25 - Math.sin(time * 2.2 + 0.5) * 0.12
      antennaR.current.rotation.x = Math.sin(time * 1.8 + 0.5) * 0.06
    }
  })

  const { shell, shellDark, claw, belly } = appearance

  return (
    <group ref={groupRef} position={[0, -0.17, 0]} scale={0.85}>
      {/* ── Body + Head (single round shape) ──────────── */}
      <group ref={headRef}>
        {/* Main body — one big round sphere */}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.3, 32, 32]} />
          <meshStandardMaterial color={shell} roughness={0.35} metalness={0.08} />
        </mesh>

        {/* ── Eyes — big, directly on face ────────────── */}
        {/* Left eye white */}
        <mesh ref={eyeL} position={[-0.09, 0.06, 0.24]}>
          <sphereGeometry args={[0.055, 16, 16]} />
          <meshStandardMaterial color="white" />
        </mesh>
        {/* Right eye white */}
        <mesh ref={eyeR} position={[0.09, 0.06, 0.24]}>
          <sphereGeometry args={[0.055, 16, 16]} />
          <meshStandardMaterial color="white" />
        </mesh>

        {/* Left pupil — sits on eye surface */}
        <mesh ref={pupilL} position={[-0.09, 0.06, 0.29]}>
          <sphereGeometry args={[0.032, 12, 12]} />
          <meshStandardMaterial color={appearance.pupil} />
        </mesh>
        {/* Right pupil */}
        <mesh ref={pupilR} position={[0.09, 0.06, 0.29]}>
          <sphereGeometry args={[0.032, 12, 12]} />
          <meshStandardMaterial color={appearance.pupil} />
        </mesh>

        {/* Pupil highlights */}
        <mesh position={[-0.098, 0.072, 0.315]}>
          <sphereGeometry args={[0.009, 6, 6]} />
          <meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[0.082, 0.072, 0.315]}>
          <sphereGeometry args={[0.009, 6, 6]} />
          <meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.5} />
        </mesh>

        {/* ── Antennae — stalk + tip as one group ────── */}
        {/* Left antenna */}
        <group ref={antennaL} position={[-0.06, 0.28, 0.02]} rotation={[-0.2, 0, 0.25]}>
          <mesh>
            <capsuleGeometry args={[0.008, 0.12, 4, 6]} />
            <meshStandardMaterial color={shell} roughness={0.4} />
          </mesh>
          {/* Tip — at top end of capsule */}
          <mesh position={[0, 0.07, 0]}>
            <sphereGeometry args={[0.018, 8, 8]} />
            <meshStandardMaterial color={shellDark} roughness={0.4} />
          </mesh>
        </group>
        {/* Right antenna */}
        <group ref={antennaR} position={[0.06, 0.28, 0.02]} rotation={[-0.2, 0, -0.25]}>
          <mesh>
            <capsuleGeometry args={[0.008, 0.12, 4, 6]} />
            <meshStandardMaterial color={shell} roughness={0.4} />
          </mesh>
          {/* Tip — at top end of capsule */}
          <mesh position={[0, 0.07, 0]}>
            <sphereGeometry args={[0.018, 8, 8]} />
            <meshStandardMaterial color={shellDark} roughness={0.4} />
          </mesh>
        </group>

        {/* ── Mouth ──────────────────────────────────── */}
        <mesh ref={mouth} position={[0, -0.08, 0.29]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.022, 0.05, 4, 8]} />
          <meshStandardMaterial color="#2a0808" roughness={0.5} />
        </mesh>

        {/* Cheek blush */}
        <mesh position={[-0.14, -0.04, 0.2]}>
          <sphereGeometry args={[0.03, 10, 10]} />
          <meshStandardMaterial color={appearance.blush} transparent opacity={0.25} roughness={1} />
        </mesh>
        <mesh position={[0.14, -0.04, 0.2]}>
          <sphereGeometry args={[0.03, 10, 10]} />
          <meshStandardMaterial color={appearance.blush} transparent opacity={0.25} roughness={1} />
        </mesh>
      </group>

      {/* ── Arms — claws on the sides ────────────────── */}
      {/* Left arm — pivot at shoulder, arcs down */}
      <group ref={armL} position={[-0.26, 0.02, 0.1]}>
        {/* Upper arm */}
        <mesh position={[-0.07, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.028, 0.12, 4, 8]} />
          <meshStandardMaterial color={shell} roughness={0.4} />
        </mesh>
        {/* Claw base — round palm */}
        <mesh position={[-0.16, 0, 0]}>
          <sphereGeometry args={[0.045, 10, 10]} />
          <meshStandardMaterial color={claw} roughness={0.35} metalness={0.08} />
        </mesh>
        {/* Top finger — curved tapered cone pointing inward */}
        <mesh position={[-0.22, 0.035, 0.0]} rotation={[0, 0, 0.7]} scale={[1, 0.45, 0.6]}>
          <capsuleGeometry args={[0.03, 0.06, 4, 8]} />
          <meshStandardMaterial color={claw} roughness={0.35} metalness={0.08} />
        </mesh>
        {/* Bottom finger — curved tapered */}
        <mesh position={[-0.22, -0.03, 0.0]} rotation={[0, 0, -0.6]} scale={[1, 0.45, 0.6]}>
          <capsuleGeometry args={[0.028, 0.055, 4, 8]} />
          <meshStandardMaterial color={claw} roughness={0.35} metalness={0.08} />
        </mesh>
      </group>
      {/* Right arm — pivot at shoulder, arcs down */}
      <group ref={armR} position={[0.26, 0.02, 0.1]}>
        {/* Upper arm */}
        <mesh position={[0.07, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.028, 0.12, 4, 8]} />
          <meshStandardMaterial color={shell} roughness={0.4} />
        </mesh>
        {/* Claw base — round palm */}
        <mesh position={[0.16, 0, 0]}>
          <sphereGeometry args={[0.045, 10, 10]} />
          <meshStandardMaterial color={claw} roughness={0.35} metalness={0.08} />
        </mesh>
        {/* Top finger — curved tapered */}
        <mesh position={[0.22, 0.035, 0.0]} rotation={[0, 0, -0.7]} scale={[1, 0.45, 0.6]}>
          <capsuleGeometry args={[0.03, 0.06, 4, 8]} />
          <meshStandardMaterial color={claw} roughness={0.35} metalness={0.08} />
        </mesh>
        {/* Bottom finger — curved tapered */}
        <mesh position={[0.22, -0.03, 0.0]} rotation={[0, 0, 0.6]} scale={[1, 0.45, 0.6]}>
          <capsuleGeometry args={[0.028, 0.055, 4, 8]} />
          <meshStandardMaterial color={claw} roughness={0.35} metalness={0.08} />
        </mesh>
      </group>

      {/* ── Legs — short stubby ──────────────────────── */}
      <group ref={legL} position={[-0.1, -0.28, 0.04]}>
        <mesh position={[0, -0.04, 0]}>
          <capsuleGeometry args={[0.028, 0.06, 4, 8]} />
          <meshStandardMaterial color={shell} roughness={0.4} />
        </mesh>
        {/* Foot */}
        <mesh position={[0, -0.1, 0.01]} scale={[1.1, 0.5, 1.2]}>
          <sphereGeometry args={[0.028, 8, 8]} />
          <meshStandardMaterial color={shellDark} roughness={0.5} />
        </mesh>
      </group>
      <group ref={legR} position={[0.1, -0.28, 0.04]}>
        <mesh position={[0, -0.04, 0]}>
          <capsuleGeometry args={[0.028, 0.06, 4, 8]} />
          <meshStandardMaterial color={shell} roughness={0.4} />
        </mesh>
        {/* Foot */}
        <mesh position={[0, -0.1, 0.01]} scale={[1.1, 0.5, 1.2]}>
          <sphereGeometry args={[0.028, 8, 8]} />
          <meshStandardMaterial color={shellDark} roughness={0.5} />
        </mesh>
      </group>
    </group>
  )
}

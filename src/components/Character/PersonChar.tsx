import { useRef } from 'react'
import * as THREE from 'three'
import type { CharacterEmotion } from '../../store'
import type { PersonAppearance } from '../../characters'
import { useCharacterAnimation } from './useCharacterAnimation'

interface PersonCharProps {
  emotion: CharacterEmotion
  isTalking: boolean
  appearance: PersonAppearance
}

export function PersonChar({ emotion, isTalking, appearance }: PersonCharProps) {
  const groupRef  = useRef<THREE.Group>(null)
  const headRef   = useRef<THREE.Group>(null)
  const eyeL      = useRef<THREE.Mesh>(null)
  const eyeR      = useRef<THREE.Mesh>(null)
  const pupilL    = useRef<THREE.Mesh>(null)
  const pupilR    = useRef<THREE.Mesh>(null)
  const mouth     = useRef<THREE.Mesh>(null)
  const browL     = useRef<THREE.Mesh>(null)
  const browR     = useRef<THREE.Mesh>(null)
  const armL      = useRef<THREE.Group>(null)
  const armR      = useRef<THREE.Group>(null)
  const forearmL  = useRef<THREE.Group>(null)
  const forearmR  = useRef<THREE.Group>(null)
  const legL      = useRef<THREE.Group>(null)
  const legR      = useRef<THREE.Group>(null)

  useCharacterAnimation(
    { groupRef, headRef, eyeL, eyeR, pupilL, pupilR, mouth, browL, browR, armL, armR, forearmL, forearmR, legL, legR },
    { emotion, isTalking }
  )

  const { skin, skinDark, hair, shirt, pants, shoe } = appearance

  return (
    <group ref={groupRef} position={[0, -0.15, 0]}>

      {/* ── Hair (back) ───────────────────────────────── */}
      <mesh position={[0, 0.08, -0.06]}>
        <sphereGeometry args={[0.26, 32, 32]} />
        <meshStandardMaterial color={hair} roughness={0.8} />
      </mesh>

      {/* ── Head ──────────────────────────────────────── */}
      <group ref={headRef}>
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.22, 32, 32]} />
          <meshStandardMaterial color={skin} roughness={0.6} metalness={0.02} />
        </mesh>

        {/* Hair (front/top) */}
        <mesh position={[0, 0.14, 0.04]}>
          <sphereGeometry args={[0.2, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          <meshStandardMaterial color={hair} roughness={0.8} />
        </mesh>
        {/* Side hair L */}
        <mesh position={[-0.18, 0.02, 0.04]}>
          <capsuleGeometry args={[0.06, 0.12, 4, 8]} />
          <meshStandardMaterial color={hair} roughness={0.8} />
        </mesh>
        {/* Side hair R */}
        <mesh position={[0.18, 0.02, 0.04]}>
          <capsuleGeometry args={[0.06, 0.12, 4, 8]} />
          <meshStandardMaterial color={hair} roughness={0.8} />
        </mesh>

        {/* Ears */}
        <mesh position={[-0.21, 0, 0]}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshStandardMaterial color={skinDark} roughness={0.6} />
        </mesh>
        <mesh position={[0.21, 0, 0]}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshStandardMaterial color={skinDark} roughness={0.6} />
        </mesh>

        {/* Eyebrows */}
        <mesh ref={browL} position={[-0.09, 0.18, 0.19]} rotation={[0, 0, 0.1]}>
          <boxGeometry args={[0.065, 0.015, 0.01]} />
          <meshStandardMaterial color={hair} />
        </mesh>
        <mesh ref={browR} position={[0.09, 0.18, 0.19]} rotation={[0, 0, -0.1]}>
          <boxGeometry args={[0.065, 0.015, 0.01]} />
          <meshStandardMaterial color={hair} />
        </mesh>

        {/* Eyes (whites) */}
        <mesh ref={eyeL} position={[-0.09, 0.06, 0.19]}>
          <sphereGeometry args={[0.038, 16, 16]} />
          <meshStandardMaterial color="white" />
        </mesh>
        <mesh ref={eyeR} position={[0.09, 0.06, 0.19]}>
          <sphereGeometry args={[0.038, 16, 16]} />
          <meshStandardMaterial color="white" />
        </mesh>

        {/* Pupils */}
        <mesh ref={pupilL} position={[-0.09, 0.06, 0.225]}>
          <sphereGeometry args={[0.02, 12, 12]} />
          <meshStandardMaterial color={appearance.pupil} />
        </mesh>
        <mesh ref={pupilR} position={[0.09, 0.06, 0.225]}>
          <sphereGeometry args={[0.02, 12, 12]} />
          <meshStandardMaterial color={appearance.pupil} />
        </mesh>

        {/* Pupil highlights */}
        <mesh position={[-0.082, 0.072, 0.24]}>
          <sphereGeometry args={[0.007, 8, 8]} />
          <meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[0.098, 0.072, 0.24]}>
          <sphereGeometry args={[0.007, 8, 8]} />
          <meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.5} />
        </mesh>

        {/* Nose */}
        <mesh position={[0, -0.02, 0.22]}>
          <sphereGeometry args={[0.022, 12, 12]} />
          <meshStandardMaterial color={skinDark} roughness={0.6} />
        </mesh>

        {/* Mouth */}
        <mesh ref={mouth} position={[0, -0.08, 0.2]}>
          <capsuleGeometry args={[0.012, 0.04, 4, 8]} />
          <meshStandardMaterial color={appearance.mouth} roughness={0.5} />
        </mesh>

        {/* Cheek blush */}
        <mesh position={[-0.14, -0.02, 0.15]}>
          <sphereGeometry args={[0.03, 12, 12]} />
          <meshStandardMaterial color={appearance.blush} transparent opacity={0.3} roughness={1} />
        </mesh>
        <mesh position={[0.14, -0.02, 0.15]}>
          <sphereGeometry args={[0.03, 12, 12]} />
          <meshStandardMaterial color={appearance.blush} transparent opacity={0.3} roughness={1} />
        </mesh>
      </group>

      {/* ── Neck ──────────────────────────────────────── */}
      <mesh position={[0, -0.25, 0]}>
        <cylinderGeometry args={[0.06, 0.07, 0.08, 12]} />
        <meshStandardMaterial color={skin} roughness={0.6} />
      </mesh>

      {/* ── Torso ─────────────────────────────────────── */}
      <mesh position={[0, -0.48, 0]}>
        <capsuleGeometry args={[0.14, 0.28, 8, 12]} />
        <meshStandardMaterial color={shirt} roughness={0.5} metalness={0.05} />
      </mesh>
      {/* Collar detail */}
      <mesh position={[0, -0.3, 0.06]}>
        <torusGeometry args={[0.08, 0.015, 8, 16, Math.PI]} />
        <meshStandardMaterial color={shirt} roughness={0.5} />
      </mesh>

      {/* ── Arms ──────────────────────────────────────── */}
      {/* Left arm */}
      <group ref={armL} position={[-0.2, -0.36, 0]}>
        <mesh position={[0, -0.08, 0]}>
          <capsuleGeometry args={[0.04, 0.14, 4, 8]} />
          <meshStandardMaterial color={shirt} roughness={0.5} />
        </mesh>
        <group ref={forearmL} position={[0, -0.2, 0]}>
          <mesh position={[0, -0.06, 0]}>
            <capsuleGeometry args={[0.035, 0.12, 4, 8]} />
            <meshStandardMaterial color={skin} roughness={0.6} />
          </mesh>
          {/* Hand */}
          <mesh position={[0, -0.16, 0]}>
            <sphereGeometry args={[0.035, 12, 12]} />
            <meshStandardMaterial color={skin} roughness={0.6} />
          </mesh>
        </group>
      </group>

      {/* Right arm */}
      <group ref={armR} position={[0.2, -0.36, 0]}>
        <mesh position={[0, -0.08, 0]}>
          <capsuleGeometry args={[0.04, 0.14, 4, 8]} />
          <meshStandardMaterial color={shirt} roughness={0.5} />
        </mesh>
        <group ref={forearmR} position={[0, -0.2, 0]}>
          <mesh position={[0, -0.06, 0]}>
            <capsuleGeometry args={[0.035, 0.12, 4, 8]} />
            <meshStandardMaterial color={skin} roughness={0.6} />
          </mesh>
          {/* Hand */}
          <mesh position={[0, -0.16, 0]}>
            <sphereGeometry args={[0.035, 12, 12]} />
            <meshStandardMaterial color={skin} roughness={0.6} />
          </mesh>
        </group>
      </group>

      {/* ── Legs ──────────────────────────────────────── */}
      {/* Left leg */}
      <group ref={legL} position={[-0.07, -0.72, 0]}>
        <mesh position={[0, -0.08, 0]}>
          <capsuleGeometry args={[0.055, 0.16, 4, 8]} />
          <meshStandardMaterial color={pants} roughness={0.6} />
        </mesh>
        {/* Shin */}
        <mesh position={[0, -0.26, 0]}>
          <capsuleGeometry args={[0.045, 0.14, 4, 8]} />
          <meshStandardMaterial color={pants} roughness={0.6} />
        </mesh>
        {/* Shoe */}
        <mesh position={[0, -0.4, 0.02]}>
          <boxGeometry args={[0.08, 0.05, 0.12]} />
          <meshStandardMaterial color={shoe} roughness={0.4} />
        </mesh>
      </group>

      {/* Right leg */}
      <group ref={legR} position={[0.07, -0.72, 0]}>
        <mesh position={[0, -0.08, 0]}>
          <capsuleGeometry args={[0.055, 0.16, 4, 8]} />
          <meshStandardMaterial color={pants} roughness={0.6} />
        </mesh>
        {/* Shin */}
        <mesh position={[0, -0.26, 0]}>
          <capsuleGeometry args={[0.045, 0.14, 4, 8]} />
          <meshStandardMaterial color={pants} roughness={0.6} />
        </mesh>
        {/* Shoe */}
        <mesh position={[0, -0.4, 0.02]}>
          <boxGeometry args={[0.08, 0.05, 0.12]} />
          <meshStandardMaterial color={shoe} roughness={0.4} />
        </mesh>
      </group>
    </group>
  )
}

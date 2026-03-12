import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { CharacterEmotion } from '../../store'
import type { RobotAppearance } from '../../characters'
import { useCharacterAnimation } from './useCharacterAnimation'

interface RobotCharProps {
  emotion: CharacterEmotion
  isTalking: boolean
  appearance: RobotAppearance
}

export function RobotChar({ emotion, isTalking, appearance }: RobotCharProps) {
  const groupRef  = useRef<THREE.Group>(null)
  const headRef   = useRef<THREE.Group>(null)
  const eyeL      = useRef<THREE.Mesh>(null)
  const eyeR      = useRef<THREE.Mesh>(null)
  const pupilL    = useRef<THREE.Mesh>(null)
  const pupilR    = useRef<THREE.Mesh>(null)
  const mouth     = useRef<THREE.Mesh>(null)
  const armL      = useRef<THREE.Group>(null)
  const armR      = useRef<THREE.Group>(null)
  const forearmL  = useRef<THREE.Group>(null)
  const forearmR  = useRef<THREE.Group>(null)
  const legL      = useRef<THREE.Group>(null)
  const legR      = useRef<THREE.Group>(null)
  const antenna   = useRef<THREE.Mesh>(null)
  const antennaTip = useRef<THREE.Mesh>(null)
  const chestLight = useRef<THREE.Mesh>(null)
  const screenMat = useRef<THREE.MeshStandardMaterial>(null)

  const t = useCharacterAnimation(
    { groupRef, headRef, eyeL, eyeR, pupilL, pupilR, mouth, armL, armR, forearmL, forearmR, legL, legR },
    {
      emotion, isTalking,
      swayAmount: 0.01,
      headLookAmount: 0.08,
      pupilBaseX: 0.08,
      pupilBaseY: 0.02,
    }
  )

  // Robot-specific animations
  useFrame(() => {
    if (!t.current) return
    const time = t.current

    // Antenna wobble (spring-like)
    if (antenna.current) {
      antenna.current.rotation.z = Math.sin(time * 2.5) * 0.08
      antenna.current.rotation.x = Math.sin(time * 1.8) * 0.05
    }

    // LED pulse (antenna tip + chest light)
    const pulse = 0.5 + Math.sin(time * 3) * 0.5
    if (antennaTip.current) {
      (antennaTip.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3 + pulse * 0.7
    }
    if (chestLight.current) {
      (chestLight.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.2 + pulse * 0.5
    }

    // Screen dim on blink (instead of eye close)
    if (screenMat.current) {
      // subtle brightness oscillation
      screenMat.current.emissiveIntensity = 0.05 + Math.sin(time * 0.5) * 0.02
    }
  })

  const { chassis, trim, screen, led } = appearance

  return (
    <group ref={groupRef} position={[0, 0.20, 0]} scale={0.85}>
      {/* ── Head ──────────────────────────────────────── */}
      <group ref={headRef}>
        {/* Head box (rounded via segments) */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.32, 0.24, 0.24, 2, 2, 2]} />
          <meshStandardMaterial color={chassis} roughness={0.3} metalness={0.4} />
        </mesh>

        {/* Face screen */}
        <mesh position={[0, -0.01, 0.121]}>
          <boxGeometry args={[0.26, 0.16, 0.01]} />
          <meshStandardMaterial
            ref={screenMat}
            color={screen}
            emissive={screen}
            emissiveIntensity={0.05}
            roughness={0.1}
            metalness={0.2}
          />
        </mesh>

        {/* Eyes (glowing dots on screen) */}
        <mesh ref={eyeL} position={[-0.07, 0.02, 0.13]}>
          <sphereGeometry args={[0.025, 12, 12]} />
          <meshStandardMaterial color={led} emissive={led} emissiveIntensity={0.6} />
        </mesh>
        <mesh ref={eyeR} position={[0.07, 0.02, 0.13]}>
          <sphereGeometry args={[0.025, 12, 12]} />
          <meshStandardMaterial color={led} emissive={led} emissiveIntensity={0.6} />
        </mesh>

        {/* Pupils (brighter core) */}
        <mesh ref={pupilL} position={[-0.07, 0.02, 0.145]}>
          <sphereGeometry args={[0.012, 8, 8]} />
          <meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.8} />
        </mesh>
        <mesh ref={pupilR} position={[0.07, 0.02, 0.145]}>
          <sphereGeometry args={[0.012, 8, 8]} />
          <meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.8} />
        </mesh>

        {/* Mouth (horizontal bar) */}
        <mesh ref={mouth} position={[0, -0.045, 0.13]}>
          <boxGeometry args={[0.08, 0.015, 0.005]} />
          <meshStandardMaterial color={appearance.mouth} emissive={appearance.mouth} emissiveIntensity={0.5} />
        </mesh>

        {/* Antenna */}
        <group ref={antenna} position={[0, 0.12, 0]}>
          <mesh position={[0, 0.04, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.08, 6]} />
            <meshStandardMaterial color={trim} roughness={0.3} metalness={0.5} />
          </mesh>
          {/* Antenna tip (glowing ball) */}
          <mesh ref={antennaTip} position={[0, 0.085, 0]}>
            <sphereGeometry args={[0.018, 12, 12]} />
            <meshStandardMaterial color={led} emissive={led} emissiveIntensity={0.6} />
          </mesh>
        </group>
      </group>

      {/* ── Neck ──────────────────────────────────────── */}
      <mesh position={[0, -0.16, 0]}>
        <cylinderGeometry args={[0.04, 0.05, 0.06, 8]} />
        <meshStandardMaterial color={trim} roughness={0.3} metalness={0.5} />
      </mesh>
      {/* Neck ring */}
      <mesh position={[0, -0.16, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.05, 0.008, 8, 16]} />
        <meshStandardMaterial color={trim} roughness={0.3} metalness={0.5} />
      </mesh>

      {/* ── Torso ─────────────────────────────────────── */}
      <mesh position={[0, -0.38, 0]}>
        <boxGeometry args={[0.28, 0.32, 0.2, 2, 2, 2]} />
        <meshStandardMaterial color={chassis} roughness={0.3} metalness={0.4} />
      </mesh>

      {/* Chest light */}
      <mesh ref={chestLight} position={[0, -0.32, 0.101]}>
        <sphereGeometry args={[0.025, 12, 12]} />
        <meshStandardMaterial color={led} emissive={led} emissiveIntensity={0.4} />
      </mesh>

      {/* Panel lines */}
      <mesh position={[0, -0.26, 0.101]}>
        <boxGeometry args={[0.22, 0.003, 0.001]} />
        <meshStandardMaterial color={trim} transparent opacity={0.5} />
      </mesh>
      <mesh position={[0, -0.44, 0.101]}>
        <boxGeometry args={[0.22, 0.003, 0.001]} />
        <meshStandardMaterial color={trim} transparent opacity={0.5} />
      </mesh>

      {/* ── Arms ──────────────────────────────────────── */}
      {/* Left arm */}
      <group ref={armL} position={[-0.2, -0.28, 0]}>
        {/* Shoulder joint */}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshStandardMaterial color={trim} roughness={0.3} metalness={0.5} />
        </mesh>
        <mesh position={[0, -0.06, 0]}>
          <capsuleGeometry args={[0.03, 0.1, 4, 8]} />
          <meshStandardMaterial color={chassis} roughness={0.3} metalness={0.4} />
        </mesh>
        <group ref={forearmL} position={[0, -0.14, 0]}>
          {/* Elbow joint */}
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshStandardMaterial color={trim} roughness={0.3} metalness={0.5} />
          </mesh>
          <mesh position={[0, -0.05, 0]}>
            <capsuleGeometry args={[0.025, 0.08, 4, 8]} />
            <meshStandardMaterial color={chassis} roughness={0.3} metalness={0.4} />
          </mesh>
          {/* Hand (boxy) */}
          <mesh position={[0, -0.12, 0]}>
            <boxGeometry args={[0.04, 0.04, 0.03]} />
            <meshStandardMaterial color={trim} roughness={0.3} metalness={0.5} />
          </mesh>
        </group>
      </group>

      {/* Right arm */}
      <group ref={armR} position={[0.2, -0.28, 0]}>
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshStandardMaterial color={trim} roughness={0.3} metalness={0.5} />
        </mesh>
        <mesh position={[0, -0.06, 0]}>
          <capsuleGeometry args={[0.03, 0.1, 4, 8]} />
          <meshStandardMaterial color={chassis} roughness={0.3} metalness={0.4} />
        </mesh>
        <group ref={forearmR} position={[0, -0.14, 0]}>
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshStandardMaterial color={trim} roughness={0.3} metalness={0.5} />
          </mesh>
          <mesh position={[0, -0.05, 0]}>
            <capsuleGeometry args={[0.025, 0.08, 4, 8]} />
            <meshStandardMaterial color={chassis} roughness={0.3} metalness={0.4} />
          </mesh>
          <mesh position={[0, -0.12, 0]}>
            <boxGeometry args={[0.04, 0.04, 0.03]} />
            <meshStandardMaterial color={trim} roughness={0.3} metalness={0.5} />
          </mesh>
        </group>
      </group>

      {/* ── Legs ──────────────────────────────────────── */}
      {/* Left leg */}
      <group ref={legL} position={[-0.08, -0.58, 0]}>
        {/* Hip joint */}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshStandardMaterial color={trim} roughness={0.3} metalness={0.5} />
        </mesh>
        <mesh position={[0, -0.06, 0]}>
          <capsuleGeometry args={[0.035, 0.1, 4, 8]} />
          <meshStandardMaterial color={chassis} roughness={0.3} metalness={0.4} />
        </mesh>
        {/* Knee joint */}
        <mesh position={[0, -0.14, 0]}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshStandardMaterial color={trim} roughness={0.3} metalness={0.5} />
        </mesh>
        <mesh position={[0, -0.22, 0]}>
          <capsuleGeometry args={[0.03, 0.08, 4, 8]} />
          <meshStandardMaterial color={chassis} roughness={0.3} metalness={0.4} />
        </mesh>
        {/* Foot (platform) */}
        <mesh position={[0, -0.3, 0.02]}>
          <boxGeometry args={[0.07, 0.03, 0.1]} />
          <meshStandardMaterial color={trim} roughness={0.3} metalness={0.5} />
        </mesh>
      </group>

      {/* Right leg */}
      <group ref={legR} position={[0.08, -0.58, 0]}>
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshStandardMaterial color={trim} roughness={0.3} metalness={0.5} />
        </mesh>
        <mesh position={[0, -0.06, 0]}>
          <capsuleGeometry args={[0.035, 0.1, 4, 8]} />
          <meshStandardMaterial color={chassis} roughness={0.3} metalness={0.4} />
        </mesh>
        <mesh position={[0, -0.14, 0]}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshStandardMaterial color={trim} roughness={0.3} metalness={0.5} />
        </mesh>
        <mesh position={[0, -0.22, 0]}>
          <capsuleGeometry args={[0.03, 0.08, 4, 8]} />
          <meshStandardMaterial color={chassis} roughness={0.3} metalness={0.4} />
        </mesh>
        <mesh position={[0, -0.3, 0.02]}>
          <boxGeometry args={[0.07, 0.03, 0.1]} />
          <meshStandardMaterial color={trim} roughness={0.3} metalness={0.5} />
        </mesh>
      </group>
    </group>
  )
}

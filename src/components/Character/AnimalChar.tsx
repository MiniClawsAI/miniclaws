import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { CharacterEmotion } from '../../store'
import type { AnimalAppearance } from '../../characters'
import { useCharacterAnimation } from './useCharacterAnimation'

interface AnimalCharProps {
  emotion: CharacterEmotion
  isTalking: boolean
  appearance: AnimalAppearance
}

export function AnimalChar({ emotion, isTalking, appearance }: AnimalCharProps) {
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
  const earL      = useRef<THREE.Mesh>(null)
  const earR      = useRef<THREE.Mesh>(null)
  const tailRef   = useRef<THREE.Group>(null)

  const t = useCharacterAnimation(
    { groupRef, headRef, eyeL, eyeR, pupilL, pupilR, mouth, armL, armR, legL, legR },
    {
      emotion, isTalking,
      swayAmount: 0.018,
      headLookAmount: 0.12,
      pupilBaseX: 0.1,
      pupilBaseY: 0.06,
    }
  )

  // Animal-specific: ear twitch + tail wag
  const nextEarTwitch = useRef(3 + Math.random() * 4)
  const earTwitchT = useRef(0)

  useFrame((_, delta) => {
    if (!t.current) return
    const time = t.current
    earTwitchT.current += delta

    // Ear twitch (random)
    if (earL.current && earR.current) {
      if (earTwitchT.current >= nextEarTwitch.current) {
        earTwitchT.current = 0
        nextEarTwitch.current = 2 + Math.random() * 5
        earL.current.rotation.z = 0.3 + 0.15
        earR.current.rotation.z = -0.3 - 0.15
        setTimeout(() => {
          if (earL.current) earL.current.rotation.z = 0.3
          if (earR.current) earR.current.rotation.z = -0.3
        }, 120)
      }
      // Surprised ears perk up
      if (emotion === 'surprised') {
        earL.current.rotation.z = THREE.MathUtils.lerp(earL.current.rotation.z, 0.1, 0.08)
        earR.current.rotation.z = THREE.MathUtils.lerp(earR.current.rotation.z, -0.1, 0.08)
      }
    }

    // Tail wag
    if (tailRef.current) {
      const wagSpeed = emotion === 'happy' ? 6 : 2
      const wagAmount = emotion === 'happy' ? 0.4 : 0.15
      tailRef.current.rotation.y = Math.sin(time * wagSpeed) * wagAmount
    }
  })

  const { fur, furDark, nose, pawPad, tail } = appearance

  return (
    <group ref={groupRef} position={[0, 0.13, 0]} scale={0.8}>
      {/* ── Head ──────────────────────────────────────── */}
      <group ref={headRef}>
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.24, 32, 32]} />
          <meshStandardMaterial color={fur} roughness={0.7} />
        </mesh>

        {/* Muzzle */}
        <mesh position={[0, -0.06, 0.18]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color={furDark} roughness={0.7} />
        </mesh>

        {/* Ears (pointed, cat-like) */}
        <mesh ref={earL} position={[-0.14, 0.22, 0]} rotation={[0, 0, 0.3]}>
          <coneGeometry args={[0.06, 0.14, 4]} />
          <meshStandardMaterial color={fur} roughness={0.7} />
        </mesh>
        <mesh ref={earR} position={[0.14, 0.22, 0]} rotation={[0, 0, -0.3]}>
          <coneGeometry args={[0.06, 0.14, 4]} />
          <meshStandardMaterial color={fur} roughness={0.7} />
        </mesh>
        {/* Inner ears */}
        <mesh position={[-0.14, 0.22, 0.01]} rotation={[0, 0, 0.3]}>
          <coneGeometry args={[0.035, 0.09, 4]} />
          <meshStandardMaterial color={furDark} roughness={0.7} />
        </mesh>
        <mesh position={[0.14, 0.22, 0.01]} rotation={[0, 0, -0.3]}>
          <coneGeometry args={[0.035, 0.09, 4]} />
          <meshStandardMaterial color={furDark} roughness={0.7} />
        </mesh>

        {/* Eyes (whites) */}
        <mesh ref={eyeL} position={[-0.09, 0.06, 0.2]}>
          <sphereGeometry args={[0.042, 16, 16]} />
          <meshStandardMaterial color="white" />
        </mesh>
        <mesh ref={eyeR} position={[0.09, 0.06, 0.2]}>
          <sphereGeometry args={[0.042, 16, 16]} />
          <meshStandardMaterial color="white" />
        </mesh>

        {/* Pupils */}
        <mesh ref={pupilL} position={[-0.09, 0.06, 0.24]}>
          <sphereGeometry args={[0.025, 12, 12]} />
          <meshStandardMaterial color={appearance.pupil} />
        </mesh>
        <mesh ref={pupilR} position={[0.09, 0.06, 0.24]}>
          <sphereGeometry args={[0.025, 12, 12]} />
          <meshStandardMaterial color={appearance.pupil} />
        </mesh>

        {/* Pupil highlights */}
        <mesh position={[-0.08, 0.075, 0.255]}>
          <sphereGeometry args={[0.008, 8, 8]} />
          <meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[0.1, 0.075, 0.255]}>
          <sphereGeometry args={[0.008, 8, 8]} />
          <meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.5} />
        </mesh>

        {/* Nose */}
        <mesh position={[0, -0.02, 0.27]} scale={[1.2, 0.8, 0.8]}>
          <sphereGeometry args={[0.025, 12, 12]} />
          <meshStandardMaterial color={nose} roughness={0.3} />
        </mesh>

        {/* Mouth */}
        <mesh ref={mouth} position={[0, -0.08, 0.22]}>
          <capsuleGeometry args={[0.01, 0.03, 4, 8]} />
          <meshStandardMaterial color={appearance.mouth} roughness={0.5} />
        </mesh>

        {/* Whiskers */}
        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh position={[side * 0.08, -0.02, 0.22]} rotation={[0, 0, Math.PI / 2 + side * 0.15]}>
              <cylinderGeometry args={[0.002, 0.001, 0.12, 4]} />
              <meshStandardMaterial color={fur} roughness={0.5} />
            </mesh>
            <mesh position={[side * 0.08, -0.05, 0.21]} rotation={[0, 0, Math.PI / 2 + side * 0.25]}>
              <cylinderGeometry args={[0.002, 0.001, 0.1, 4]} />
              <meshStandardMaterial color={fur} roughness={0.5} />
            </mesh>
          </group>
        ))}

        {/* Cheek blush */}
        <mesh position={[-0.15, -0.03, 0.14]}>
          <sphereGeometry args={[0.03, 12, 12]} />
          <meshStandardMaterial color={appearance.blush} transparent opacity={0.3} roughness={1} />
        </mesh>
        <mesh position={[0.15, -0.03, 0.14]}>
          <sphereGeometry args={[0.03, 12, 12]} />
          <meshStandardMaterial color={appearance.blush} transparent opacity={0.3} roughness={1} />
        </mesh>
      </group>

      {/* ── Torso ─────────────────────────────────────── */}
      <mesh position={[0, -0.36, 0]}>
        <capsuleGeometry args={[0.12, 0.2, 8, 12]} />
        <meshStandardMaterial color={fur} roughness={0.7} />
      </mesh>
      {/* Belly patch */}
      <mesh position={[0, -0.36, 0.08]}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial color={furDark} roughness={0.7} />
      </mesh>

      {/* ── Tail ──────────────────────────────────────── */}
      <group ref={tailRef} position={[0, -0.32, -0.12]}>
        <mesh position={[0, 0.04, -0.06]} rotation={[0.6, 0, 0]}>
          <capsuleGeometry args={[0.03, 0.1, 4, 8]} />
          <meshStandardMaterial color={tail} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.12, -0.1]} rotation={[0.3, 0, 0]}>
          <sphereGeometry args={[0.035, 12, 12]} />
          <meshStandardMaterial color={tail} roughness={0.7} />
        </mesh>
      </group>

      {/* ── Arms ──────────────────────────────────────── */}
      <group ref={armL} position={[-0.18, -0.28, 0]}>
        <mesh position={[0, -0.06, 0]}>
          <capsuleGeometry args={[0.035, 0.1, 4, 8]} />
          <meshStandardMaterial color={fur} roughness={0.7} />
        </mesh>
        {/* Paw */}
        <mesh position={[0, -0.14, 0]}>
          <sphereGeometry args={[0.035, 12, 12]} />
          <meshStandardMaterial color={fur} roughness={0.6} />
        </mesh>
        {/* Paw pad */}
        <mesh position={[0, -0.14, 0.025]}>
          <sphereGeometry args={[0.018, 8, 8]} />
          <meshStandardMaterial color={pawPad} roughness={0.5} />
        </mesh>
      </group>
      <group ref={armR} position={[0.18, -0.28, 0]}>
        <mesh position={[0, -0.06, 0]}>
          <capsuleGeometry args={[0.035, 0.1, 4, 8]} />
          <meshStandardMaterial color={fur} roughness={0.7} />
        </mesh>
        <mesh position={[0, -0.14, 0]}>
          <sphereGeometry args={[0.035, 12, 12]} />
          <meshStandardMaterial color={fur} roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.14, 0.025]}>
          <sphereGeometry args={[0.018, 8, 8]} />
          <meshStandardMaterial color={pawPad} roughness={0.5} />
        </mesh>
      </group>

      {/* ── Legs ──────────────────────────────────────── */}
      <group ref={legL} position={[-0.07, -0.56, 0]}>
        <mesh position={[0, -0.06, 0]}>
          <capsuleGeometry args={[0.045, 0.12, 4, 8]} />
          <meshStandardMaterial color={fur} roughness={0.7} />
        </mesh>
        {/* Paw foot */}
        <mesh position={[0, -0.16, 0.02]} scale={[1, 0.5, 1.2]}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshStandardMaterial color={fur} roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.17, 0.04]}>
          <sphereGeometry args={[0.015, 8, 8]} />
          <meshStandardMaterial color={pawPad} roughness={0.5} />
        </mesh>
      </group>
      <group ref={legR} position={[0.07, -0.56, 0]}>
        <mesh position={[0, -0.06, 0]}>
          <capsuleGeometry args={[0.045, 0.12, 4, 8]} />
          <meshStandardMaterial color={fur} roughness={0.7} />
        </mesh>
        <mesh position={[0, -0.16, 0.02]} scale={[1, 0.5, 1.2]}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshStandardMaterial color={fur} roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.17, 0.04]}>
          <sphereGeometry args={[0.015, 8, 8]} />
          <meshStandardMaterial color={pawPad} roughness={0.5} />
        </mesh>
      </group>
    </group>
  )
}

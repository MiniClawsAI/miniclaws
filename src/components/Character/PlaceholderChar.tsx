import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { CharacterEmotion } from '../../store'

interface PlaceholderCharProps {
  emotion: CharacterEmotion
  isTalking: boolean
}

// Simple geometric character shown before a VRM model is loaded
export function PlaceholderChar({ emotion, isTalking }: PlaceholderCharProps) {
  const groupRef = useRef<THREE.Group>(null)
  const headRef  = useRef<THREE.Mesh>(null)
  const eyeL     = useRef<THREE.Mesh>(null)
  const eyeR     = useRef<THREE.Mesh>(null)
  const mouth    = useRef<THREE.Mesh>(null)

  const t = useRef(0)
  const blinkT = useRef(0)
  const nextBlink = useRef(3 + Math.random() * 4)

  const emotionColor: Record<CharacterEmotion, string> = {
    idle: '#7c6cf0',
    talking: '#a78bfa',
    thinking: '#818cf8',
    happy: '#f472b6',
    surprised: '#fb923c',
    wave: '#34d399'
  }

  useFrame((_, delta) => {
    t.current += delta
    blinkT.current += delta
    if (!groupRef.current || !headRef.current) return

    // Float
    groupRef.current.position.y = Math.sin(t.current * 0.9) * 0.05
    groupRef.current.rotation.y = Math.sin(t.current * 0.4) * 0.12

    // Head tilt
    headRef.current.rotation.z = Math.sin(t.current * 0.5) * 0.05

    // Blink
    if (blinkT.current >= nextBlink.current) {
      blinkT.current = 0
      nextBlink.current = 3 + Math.random() * 5
      if (eyeL.current && eyeR.current) {
        eyeL.current.scale.y = 0.1
        eyeR.current.scale.y = 0.1
        setTimeout(() => {
          if (eyeL.current) eyeL.current.scale.y = 1
          if (eyeR.current) eyeR.current.scale.y = 1
        }, 120)
      }
    }

    // Talking mouth
    if (mouth.current) {
      if (isTalking) {
        mouth.current.scale.y = 0.5 + Math.abs(Math.sin(t.current * 8)) * 1.5
      } else {
        mouth.current.scale.y = 1
      }
    }
  })

  const color = emotionColor[emotion] || emotionColor.idle

  return (
    <group ref={groupRef}>
      {/* Body */}
      <mesh position={[0, -0.55, 0]}>
        <capsuleGeometry args={[0.18, 0.4, 4, 8]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.1} />
      </mesh>

      {/* Head */}
      <mesh ref={headRef} position={[0, 0, 0]}>
        <sphereGeometry args={[0.28, 32, 32]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.1} />

        {/* Eyes */}
        <mesh ref={eyeL} position={[-0.1, 0.06, 0.25]}>
          <sphereGeometry args={[0.045, 16, 16]} />
          <meshStandardMaterial color="white" />
        </mesh>
        <mesh position={[-0.1, 0.06, 0.28]}>
          <sphereGeometry args={[0.022, 12, 12]} />
          <meshStandardMaterial color="#1a1a2e" />
        </mesh>

        <mesh ref={eyeR} position={[0.1, 0.06, 0.25]}>
          <sphereGeometry args={[0.045, 16, 16]} />
          <meshStandardMaterial color="white" />
        </mesh>
        <mesh position={[0.1, 0.06, 0.28]}>
          <sphereGeometry args={[0.022, 12, 12]} />
          <meshStandardMaterial color="#1a1a2e" />
        </mesh>

        {/* Mouth */}
        <mesh ref={mouth} position={[0, -0.08, 0.27]}>
          <boxGeometry args={[0.1, 0.018, 0.01]} />
          <meshStandardMaterial color="#1a1a2e" />
        </mesh>
      </mesh>

      {/* Arms */}
      <mesh position={[-0.28, -0.4, 0]} rotation={[0, 0, 0.4]}>
        <capsuleGeometry args={[0.055, 0.22, 4, 8]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      <mesh
        position={[0.28, -0.4, 0]}
        rotation={[0, 0, -0.4 + (emotion === 'wave' ? -0.8 : 0)]}
      >
        <capsuleGeometry args={[0.055, 0.22, 4, 8]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
    </group>
  )
}

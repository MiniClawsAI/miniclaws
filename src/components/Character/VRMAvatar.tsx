import { useRef, useEffect, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { VRMLoaderPlugin, VRM, VRMHumanBoneName } from '@pixiv/three-vrm'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { CharacterEmotion } from '../../store'

interface VRMAvatarProps {
  url: string
  emotion: CharacterEmotion
  isTalking: boolean
}

// Morph target names vary by VRM model - common ones:
const BLINK_L = 'Blink_L'
const BLINK_R = 'Blink_R'
const HAPPY   = 'Happy'
const ANGRY   = 'Angry'
const RELAXED = 'Relaxed'
const SURPRISED = 'Surprised'
const AA = 'Aa' // mouth open for talking

export function VRMAvatar({ url, emotion, isTalking }: VRMAvatarProps) {
  const { gl } = useThree()
  const vrmRef = useRef<VRM | null>(null)
  const [loaded, setLoaded] = useState(false)
  const groupRef = useRef<THREE.Group>(null)

  // Timers
  const clock = useRef(new THREE.Clock())
  const blinkTimer = useRef(0)
  const nextBlink = useRef(3 + Math.random() * 4)
  const talkTimer = useRef(0)
  const idleTimer = useRef(0)

  // Load VRM
  useEffect(() => {
    const loader = new GLTFLoader()
    loader.register((parser) => new VRMLoaderPlugin(parser))

    loader.load(
      url,
      (gltf) => {
        const vrm: VRM = gltf.userData.vrm
        vrmRef.current = vrm

        // Flip for mirror (VRM spec is right-handed, Three.js left-handed scene)
        VRM.from(gltf).then((v) => {
          // already handled by VRMLoaderPlugin
        })

        if (groupRef.current) {
          groupRef.current.add(vrm.scene)
        }

        // Center the model
        const box = new THREE.Box3().setFromObject(vrm.scene)
        const size = box.getSize(new THREE.Vector3())
        vrm.scene.position.set(0, -size.y / 2, 0)

        setLoaded(true)
      },
      undefined,
      (err) => console.error('VRM load error:', err)
    )

    return () => {
      if (vrmRef.current && groupRef.current) {
        groupRef.current.remove(vrmRef.current.scene)
      }
    }
  }, [url])

  // Per-frame updates
  useFrame((_, delta) => {
    const vrm = vrmRef.current
    if (!vrm) return

    const t = clock.current.getElapsedTime()
    idleTimer.current += delta

    // ── Idle breathing / floating ──────────────────────────
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(t * 0.8) * 0.03
      groupRef.current.rotation.y = Math.sin(t * 0.3) * 0.04
    }

    // ── Auto blink ────────────────────────────────────────
    blinkTimer.current += delta
    if (blinkTimer.current >= nextBlink.current) {
      blinkTimer.current = 0
      nextBlink.current = 3 + Math.random() * 5
      doBlink(vrm)
    }

    // ── Talking jaw animation ─────────────────────────────
    if (isTalking) {
      talkTimer.current += delta * 8
      const jaw = 0.4 + Math.sin(talkTimer.current) * 0.3
      setExpression(vrm, AA, Math.max(0, jaw))
    } else {
      setExpression(vrm, AA, 0)
    }

    // ── Emotion-driven expressions ─────────────────────────
    applyEmotion(vrm, emotion)

    // Head look-around idle
    const headBone = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.Head)
    if (headBone && emotion === 'idle') {
      headBone.rotation.x = Math.sin(t * 0.4) * 0.06
      headBone.rotation.y = Math.sin(t * 0.25) * 0.1
    }

    vrm.update(delta)
  })

  return <group ref={groupRef} />
}

// ── Helpers ────────────────────────────────────────────────

function setExpression(vrm: VRM, name: string, weight: number) {
  try {
    vrm.expressionManager?.setValue(name, Math.max(0, Math.min(1, weight)))
  } catch { /* expression may not exist in this model */ }
}

function applyEmotion(vrm: VRM, emotion: CharacterEmotion) {
  const targets: Record<CharacterEmotion, [string, number][]> = {
    idle:      [[RELAXED, 0.1]],
    talking:   [[HAPPY, 0.4]],
    thinking:  [],
    happy:     [[HAPPY, 0.9]],
    surprised: [[SURPRISED, 0.9]],
    wave:      [[HAPPY, 0.6]]
  }
  const expressions = targets[emotion] || []

  // Reset known expressions
  for (const name of [HAPPY, ANGRY, RELAXED, SURPRISED]) {
    setExpression(vrm, name, 0)
  }
  for (const [name, weight] of expressions) {
    setExpression(vrm, name, weight)
  }
}

let blinkTween: ReturnType<typeof setTimeout> | null = null
function doBlink(vrm: VRM) {
  setExpression(vrm, BLINK_L, 1)
  setExpression(vrm, BLINK_R, 1)
  if (blinkTween) clearTimeout(blinkTween)
  blinkTween = setTimeout(() => {
    setExpression(vrm, BLINK_L, 0)
    setExpression(vrm, BLINK_R, 0)
  }, 120)
}

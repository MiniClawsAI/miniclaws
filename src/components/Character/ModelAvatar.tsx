import { useRef, useEffect, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { VRMLoaderPlugin, VRM, VRMHumanBoneName } from '@pixiv/three-vrm'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import type { CharacterEmotion } from '../../store'

type ModelFormat = 'vrm' | 'fbx' | 'glb' | 'gltf'

interface ModelAvatarProps {
  url: string
  emotion: CharacterEmotion
  isTalking: boolean
}

// VRM expression names
const BLINK_L = 'Blink_L'
const BLINK_R = 'Blink_R'
const HAPPY = 'Happy'
const ANGRY = 'Angry'
const RELAXED = 'Relaxed'
const SURPRISED = 'Surprised'
const AA = 'Aa'

function getFormat(url: string): ModelFormat {
  const ext = url.split('.').pop()?.toLowerCase() || ''
  if (ext === 'vrm') return 'vrm'
  if (ext === 'fbx') return 'fbx'
  if (ext === 'gltf') return 'gltf'
  return 'glb'
}

export function ModelAvatar({ url, emotion, isTalking }: ModelAvatarProps) {
  const groupRef = useRef<THREE.Group>(null)
  const vrmRef = useRef<VRM | null>(null)
  const mixerRef = useRef<THREE.AnimationMixer | null>(null)
  const [loaded, setLoaded] = useState(false)

  const clock = useRef(new THREE.Clock())
  const blinkTimer = useRef(0)
  const nextBlink = useRef(3 + Math.random() * 4)
  const talkTimer = useRef(0)

  const format = getFormat(url)
  // Convert absolute file paths to custom protocol for Electron local file access
  const resolvedUrl = url.startsWith('/') ? `local-model://${url}` : url

  // Load model
  useEffect(() => {
    if (!groupRef.current) return

    const group = groupRef.current

    // Clear previous model
    while (group.children.length > 0) {
      group.remove(group.children[0])
    }
    vrmRef.current = null
    mixerRef.current = null
    setLoaded(false)

    if (format === 'vrm') {
      loadVRM(resolvedUrl, group, vrmRef, setLoaded)
    } else if (format === 'fbx') {
      loadFBX(resolvedUrl, group, mixerRef, setLoaded)
    } else {
      loadGLTF(resolvedUrl, group, mixerRef, setLoaded)
    }

    return () => {
      while (group.children.length > 0) {
        group.remove(group.children[0])
      }
      vrmRef.current = null
      mixerRef.current = null
    }
  }, [resolvedUrl, format])

  // Per-frame updates
  useFrame((_, delta) => {
    const t = clock.current.getElapsedTime()

    // Idle floating — all formats
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(t * 0.8) * 0.03
      groupRef.current.rotation.y = Math.sin(t * 0.3) * 0.04
    }

    // FBX/GLTF animation mixer
    if (mixerRef.current) {
      mixerRef.current.update(delta)
    }

    // VRM-specific: blink, expressions, head movement
    const vrm = vrmRef.current
    if (vrm) {
      blinkTimer.current += delta
      if (blinkTimer.current >= nextBlink.current) {
        blinkTimer.current = 0
        nextBlink.current = 3 + Math.random() * 5
        doBlink(vrm)
      }

      if (isTalking) {
        talkTimer.current += delta * 8
        const jaw = 0.4 + Math.sin(talkTimer.current) * 0.3
        setExpression(vrm, AA, Math.max(0, jaw))
      } else {
        setExpression(vrm, AA, 0)
      }

      applyEmotion(vrm, emotion)

      const headBone = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.Head)
      if (headBone && emotion === 'idle') {
        headBone.rotation.x = Math.sin(t * 0.4) * 0.06
        headBone.rotation.y = Math.sin(t * 0.25) * 0.1
      }

      vrm.update(delta)
    }
  })

  return <group ref={groupRef} />
}

// ── Loaders ──────────────────────────────────────────────

function loadVRM(
  url: string,
  group: THREE.Group,
  vrmRef: React.MutableRefObject<VRM | null>,
  setLoaded: (v: boolean) => void
) {
  const loader = new GLTFLoader()
  loader.register((parser) => new VRMLoaderPlugin(parser))

  loader.load(
    url,
    (gltf) => {
      const vrm: VRM = gltf.userData.vrm
      vrmRef.current = vrm
      group.add(vrm.scene)
      centerAndScale(vrm.scene)
      setLoaded(true)
    },
    undefined,
    (err) => console.error('VRM load error:', err)
  )
}

function loadFBX(
  url: string,
  group: THREE.Group,
  mixerRef: React.MutableRefObject<THREE.AnimationMixer | null>,
  setLoaded: (v: boolean) => void
) {
  const loader = new FBXLoader()

  // Set resource path so textures resolve relative to the FBX file
  const lastSlash = url.lastIndexOf('/')
  if (lastSlash > 0) {
    loader.setResourcePath(url.substring(0, lastSlash + 1))
  }

  loader.load(
    url,
    (fbx) => {
      // Fix materials — FBX often has no lights baked, apply a basic material fix
      fbx.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          materials.forEach((mat) => {
            if (mat instanceof THREE.MeshPhongMaterial || mat instanceof THREE.MeshLambertMaterial) {
              // Ensure materials respond to scene lights
              mat.needsUpdate = true
              // If completely black with no texture, give it a default color
              if (mat.color.getHex() === 0x000000 && !mat.map) {
                mat.color.setHex(0x888888)
              }
            }
          })
        }
      })

      centerAndScale(fbx)
      group.add(fbx)

      // Play embedded animations if any
      if (fbx.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(fbx)
        mixer.clipAction(fbx.animations[0]).play()
        mixerRef.current = mixer
      }

      setLoaded(true)
    },
    undefined,
    (err) => console.error('FBX load error:', err)
  )
}

function loadGLTF(
  url: string,
  group: THREE.Group,
  mixerRef: React.MutableRefObject<THREE.AnimationMixer | null>,
  setLoaded: (v: boolean) => void
) {
  const loader = new GLTFLoader()

  loader.load(
    url,
    (gltf) => {
      const model = gltf.scene
      centerAndScale(model)
      group.add(model)

      // Play embedded animations if any
      if (gltf.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(model)
        mixer.clipAction(gltf.animations[0]).play()
        mixerRef.current = mixer
      }

      setLoaded(true)
    },
    undefined,
    (err) => console.error('GLTF load error:', err)
  )
}

// ── Helpers ──────────────────────────────────────────────

/** Center model and scale to fit the camera frustum.
 *  Camera: z=2.2, y=0.05, fov=35 → visible height ≈ 1.3 units.
 *  We target height of 0.8 so it fits comfortably with margin. */
function centerAndScale(object: THREE.Object3D) {
  // Reset position/scale to measure true size
  object.position.set(0, 0, 0)
  object.scale.set(1, 1, 1)
  object.updateMatrixWorld(true)

  const box = new THREE.Box3().setFromObject(object)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())

  // Scale to fit: target ~1.0 unit height, clamp width too
  const targetHeight = 1.0
  const heightScale = size.y > 0 ? targetHeight / size.y : 1
  const targetWidth = 1.0
  const widthScale = size.x > 0 ? targetWidth / size.x : 1
  const scale = Math.min(heightScale, widthScale)

  object.scale.set(scale, scale, scale)

  // Recompute after scaling
  object.updateMatrixWorld(true)
  const scaledBox = new THREE.Box3().setFromObject(object)
  const scaledCenter = scaledBox.getCenter(new THREE.Vector3())
  const scaledSize = scaledBox.getSize(new THREE.Vector3())

  // Center horizontally, shift down to sit in lower half of canvas
  object.position.set(
    -scaledCenter.x,
    -scaledCenter.y - 0.25,
    -scaledCenter.z
  )
}

function setExpression(vrm: VRM, name: string, weight: number) {
  try {
    vrm.expressionManager?.setValue(name, Math.max(0, Math.min(1, weight)))
  } catch { /* expression may not exist */ }
}

function applyEmotion(vrm: VRM, emotion: CharacterEmotion) {
  const targets: Record<CharacterEmotion, [string, number][]> = {
    idle: [[RELAXED, 0.1]],
    talking: [[HAPPY, 0.4]],
    thinking: [],
    happy: [[HAPPY, 0.9]],
    surprised: [[SURPRISED, 0.9]],
    wave: [[HAPPY, 0.6]]
  }
  const expressions = targets[emotion] || []

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

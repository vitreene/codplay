/**
 * Maps Avatar bone morph names to the corresponding Three.js bones.
 *
 * The binding captures the model's rest transforms once, then applies absolute
 * values supplied by MorphEngine. It is model adaptation, not runtime
 * orchestration.
 */
import type { Object3D } from 'three'
import type { BoneCallback, BoneMorphName } from './morph-engine.js'

type BoneRest = {
  bone: Object3D
  rx: number
  ry: number
  rz: number
  sx: number
  sy: number
  sz: number
}

const FINGER_NAMES = ['HandThumb', 'HandIndex', 'HandMiddle', 'HandRing', 'HandPinky'] as const
const FINGER_JOINTS = [1, 2, 3] as const

/** Creates an absolute bone callback for one loaded Avatar model. */
export function createBoneMorphBinding(boneMap: Map<string, Object3D>): BoneCallback {
  const head = captureBone(boneMap, 'Head')
  const neck = captureBone(boneMap, 'Neck')
  const spine1 = captureBone(boneMap, 'Spine1')
  const spine = captureBone(boneMap, 'Spine')
  const hips = captureBone(boneMap, 'Hips')
  const leftUpLeg = captureBone(boneMap, 'LeftUpLeg')
  const rightUpLeg = captureBone(boneMap, 'RightUpLeg')
  const leftLeg = captureBone(boneMap, 'LeftLeg')
  const rightLeg = captureBone(boneMap, 'RightLeg')
  const leftFingers = captureFingerBones(boneMap, 'Left')
  const rightFingers = captureFingerBones(boneMap, 'Right')

  return (name: BoneMorphName, value: number) => {
    switch (name) {
      case 'headRotateX':
        setRotation(head, 'x', value)
        setRotation(neck, 'x', value * 0.3)
        break
      case 'headRotateY':
        setRotation(head, 'y', value)
        setRotation(neck, 'y', value * 0.3)
        break
      case 'headRotateZ':
        setRotation(head, 'z', value)
        break
      case 'bodyRotateX':
        setRotation(head, 'x', value)
        setRotation(spine1, 'x', value / 2)
        setRotation(spine, 'x', value / 8)
        setRotation(hips, 'x', value / 24)
        break
      case 'bodyRotateY':
        setRotation(head, 'y', value)
        setRotation(spine1, 'y', value / 2)
        setRotation(spine, 'y', value / 2)
        setRotation(hips, 'y', value / 4)
        setRotation(leftUpLeg, 'y', value / 2)
        setRotation(rightUpLeg, 'y', value / 2)
        setRotation(leftLeg, 'y', value / 4)
        setRotation(rightLeg, 'y', value / 4)
        break
      case 'bodyRotateZ':
        setRotation(head, 'z', value)
        setRotation(spine1, 'z', value / 12)
        setRotation(spine, 'z', value / 12)
        setRotation(hips, 'z', value / 24)
        break
      case 'handFistLeft':
        applyFist(leftFingers, value, -1)
        break
      case 'handFistRight':
        applyFist(rightFingers, value, 1)
        break
      case 'chestInhale':
        setChestExpansion(spine1 ?? spine, value)
        break
    }
  }
}

/** Captures the rest transform of a named bone when the model provides it. */
function captureBone(boneMap: Map<string, Object3D>, name: string): BoneRest | null {
  const bone = boneMap.get(name)
  if (bone === undefined) return null
  return {
    bone,
    rx: bone.rotation.x,
    ry: bone.rotation.y,
    rz: bone.rotation.z,
    sx: bone.scale.x,
    sy: bone.scale.y,
    sz: bone.scale.z,
  }
}

/** Captures the three joints of each supported finger on one side. */
function captureFingerBones(boneMap: Map<string, Object3D>, side: 'Left' | 'Right'): BoneRest[][] {
  return FINGER_NAMES.map((finger) =>
    FINGER_JOINTS.map((joint) => captureBone(boneMap, `${side}${finger}${joint}`))
      .filter((bone): bone is BoneRest => bone !== null),
  )
}

/** Applies the hand-fist pose to one side using the captured rest transforms. */
function applyFist(fingers: BoneRest[][], value: number, thumbSign: number): void {
  for (let fingerIndex = 0; fingerIndex < fingers.length; fingerIndex += 1) {
    const joints = fingers[fingerIndex]!
    if (fingerIndex === 0) {
      setRotation(joints[1] ?? null, 'z', thumbSign * value)
      setRotation(joints[2] ?? null, 'z', thumbSign * value)
      continue
    }
    setRotation(joints[0] ?? null, 'x', value)
    setRotation(joints[1] ?? null, 'x', 1.5 * value)
    setRotation(joints[2] ?? null, 'x', 1.5 * value)
  }
}

/** Writes one absolute rotation relative to the captured rest transform. */
function setRotation(rest: BoneRest | null, axis: 'x' | 'y' | 'z', value: number): void {
  if (rest === null) return
  rest.bone.rotation[axis] = rest[`r${axis}`] + value
}

/** Expands the chest across its width and depth without lengthening the body. */
function setChestExpansion(rest: BoneRest | null, value: number): void {
  if (rest === null) return
  const expansion = 1 + value * 0.02
  rest.bone.scale.set(rest.sx * expansion, rest.sy, rest.sz * expansion)
}

/**
 * Maps Avatar bone morph values to additive pose contributions.
 *
 * MorphEngine calls the binding as values evolve. The binding only stores those
 * values; AvatarPoseComposer applies the resulting deltas after semantic and
 * native animation layers have been resolved.
 */
import type { Object3D } from 'three'
import type {
  AvatarPoseDelta,
  AvatarVector3,
  BoneMorphBinding,
  BoneMorphName,
} from '../avatar-types.js'

const FINGER_NAMES = ['HandThumb', 'HandIndex', 'HandMiddle', 'HandRing', 'HandPinky'] as const
const FINGER_JOINTS = [1, 2, 3] as const

/** Creates one value sink and delta reader for a loaded Avatar skeleton. */
export function createBoneMorphBinding(boneMap: ReadonlyMap<string, Object3D>): BoneMorphBinding {
  const values = new Map<BoneMorphName, number>()
  const binding = ((name: BoneMorphName, value: number) => {
    values.set(name, value)
  }) as BoneMorphBinding

  Object.defineProperty(binding, 'getDelta', {
    value: () => createDelta(boneMap, values),
  })

  return binding
}

/** Resolves all currently active bone-morph values into additive local deltas. */
function createDelta(
  boneMap: ReadonlyMap<string, Object3D>,
  values: ReadonlyMap<BoneMorphName, number>,
): AvatarPoseDelta {
  const result = new Map<Object3D, { rotation?: AvatarVector3; scale?: AvatarVector3 }>()
  const value = (name: BoneMorphName): number => values.get(name) ?? 0
  const spine1 = boneMap.get('Spine1')
  const spine = boneMap.get('Spine')

  addRotation(result, boneMap.get('Head'), value('headRotateX'), 0, 0)
  addRotation(result, boneMap.get('Head'), 0, value('headRotateY'), 0)
  addRotation(result, boneMap.get('Head'), 0, 0, value('headRotateZ'))

  addRotation(result, boneMap.get('Head'), value('bodyRotateX'), 0, 0)
  addRotation(result, spine1 ?? spine, value('bodyRotateX') / 2, 0, 0)
  if (spine1 !== undefined) addRotation(result, spine, value('bodyRotateX') / 8, 0, 0)
  addRotation(result, boneMap.get('Hips'), value('bodyRotateX') / 24, 0, 0)

  addRotation(result, boneMap.get('Head'), 0, value('bodyRotateY'), 0)
  addRotation(result, spine1 ?? spine, 0, value('bodyRotateY') / 2, 0)
  if (spine1 !== undefined) addRotation(result, spine, 0, value('bodyRotateY') / 2, 0)
  addRotation(result, boneMap.get('Hips'), 0, value('bodyRotateY') / 4, 0)
  addRotation(result, boneMap.get('LeftUpLeg'), 0, value('bodyRotateY') / 2, 0)
  addRotation(result, boneMap.get('RightUpLeg'), 0, value('bodyRotateY') / 2, 0)
  addRotation(result, boneMap.get('LeftLeg'), 0, value('bodyRotateY') / 4, 0)
  addRotation(result, boneMap.get('RightLeg'), 0, value('bodyRotateY') / 4, 0)

  addRotation(result, boneMap.get('Head'), 0, 0, value('bodyRotateZ'))
  addRotation(result, spine1 ?? spine, 0, 0, value('bodyRotateZ') / 12)
  if (spine1 !== undefined) addRotation(result, spine, 0, 0, value('bodyRotateZ') / 12)
  addRotation(result, boneMap.get('Hips'), 0, 0, value('bodyRotateZ') / 24)

  addFistRotation(result, boneMap, 'Left', value('handFistLeft'), -1)
  addFistRotation(result, boneMap, 'Right', value('handFistRight'), 1)
  addChestExpansion(result, boneMap, boneMap.get('Spine1') ?? boneMap.get('Spine'), value('chestInhale'))
  return result
}

/** Adds an Euler delta to one native bone contribution. */
function addRotation(
  result: Map<Object3D, { rotation?: AvatarVector3; scale?: AvatarVector3 }>,
  bone: Object3D | undefined,
  x: number,
  y: number,
  z: number,
): void {
  if (bone === undefined || (x === 0 && y === 0 && z === 0)) return
  const current = result.get(bone) ?? {}
  const rotation = current.rotation ?? { x: 0, y: 0, z: 0 }
  result.set(bone, {
    ...current,
    rotation: {
      x: rotation.x + x,
      y: rotation.y + y,
      z: rotation.z + z,
    },
  })
}

/** Adds the finger curl contribution for one hand. */
function addFistRotation(
  result: Map<Object3D, { rotation?: AvatarVector3; scale?: AvatarVector3 }>,
  boneMap: ReadonlyMap<string, Object3D>,
  side: 'Left' | 'Right',
  value: number,
  thumbSign: number,
): void {
  if (value === 0) return
  for (let fingerIndex = 0; fingerIndex < FINGER_NAMES.length; fingerIndex += 1) {
    const finger = FINGER_NAMES[fingerIndex]!
    for (const joint of FINGER_JOINTS) {
      const bone = boneMap.get(`${side}${finger}${joint}`)
      if (fingerIndex === 0) {
        if (joint > 1) addRotation(result, bone, 0, 0, thumbSign * value)
        continue
      }
      const strength = joint === 1 ? value : value * 1.5
      addRotation(result, bone, strength, 0, 0)
    }
  }
}

/** Adds the chest width/depth scale contribution without changing body height. */
function addChestExpansion(
  result: Map<Object3D, { rotation?: AvatarVector3; scale?: AvatarVector3 }>,
  boneMap: ReadonlyMap<string, Object3D>,
  bone: Object3D | undefined,
  value: number,
): void {
  if (bone === undefined || value === 0) return
  const current = result.get(bone) ?? {}
  const expansion = value / 20
  result.set(bone, {
    ...current,
    scale: { x: 1 + expansion, y: 1 + expansion / 2, z: 1 + expansion * 3 },
  })

  const inverse = {
    x: 1 / (1 + expansion),
    y: 1 / (1 + expansion / 2),
    z: 1 / (1 + expansion * 3),
  }
  addScale(result, boneMap.get('Neck'), inverse)
  addScale(result, boneMap.get('LeftArm'), inverse)
  addScale(result, boneMap.get('RightArm'), inverse)
}

/** Adds a multiplicative scale contribution to one optional bone. */
function addScale(
  result: Map<Object3D, { rotation?: AvatarVector3; scale?: AvatarVector3 }>,
  bone: Object3D | undefined,
  scale: AvatarVector3,
): void {
  if (bone === undefined) return
  const current = result.get(bone) ?? {}
  result.set(bone, { ...current, scale })
}

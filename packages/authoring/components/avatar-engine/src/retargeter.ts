/**
 * Mixamo rig retargeter — adjusts bone resting poses and rebinds skin.
 *
 * Adapted from TalkingHead by Mika Suominen (met4citizen), MIT licence.
 * Source: https://github.com/met4citizen/TalkingHead
 *
 * Changes vs original retargeter.mjs:
 *   - Converted to TypeScript with Three.js types.
 *   - Removed console.warn calls (silent no-ops when bones not found).
 */
import {
  Vector3,
  Matrix4,
  type Object3D,
  type Group,
  type Skeleton,
} from 'three'

/** Bone name → { x?, y?, z?, rx?, ry?, rz? } plus reserved keys. */
export type RetargetConfig = Record<string, unknown>

const HIPS_HEIGHT_M = 1.037
const EYE_HEIGHT_M = 1.634

const MIXAMO_BONES = [
  'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
  'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
  'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase',
  'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase',
  'LeftHandThumb1', 'LeftHandThumb2', 'LeftHandThumb3',
  'LeftHandIndex1', 'LeftHandIndex2', 'LeftHandIndex3',
  'LeftHandMiddle1', 'LeftHandMiddle2', 'LeftHandMiddle3',
  'LeftHandRing1', 'LeftHandRing2', 'LeftHandRing3',
  'LeftHandPinky1', 'LeftHandPinky2', 'LeftHandPinky3',
  'RightHandThumb1', 'RightHandThumb2', 'RightHandThumb3',
  'RightHandIndex1', 'RightHandIndex2', 'RightHandIndex3',
  'RightHandMiddle1', 'RightHandMiddle2', 'RightHandMiddle3',
  'RightHandRing1', 'RightHandRing2', 'RightHandRing3',
  'RightHandPinky1', 'RightHandPinky2', 'RightHandPinky3',
]

type BoneWithSkeleton = Object3D & { isBone?: boolean; skeleton?: Skeleton }
type SkinnedMeshLike = Object3D & {
  isSkinnedMesh?: boolean
  skeleton: Skeleton
  geometry: {
    attributes: {
      position: { count: number; getX(i: number): number; getY(i: number): number; getZ(i: number): number; setXYZ(i: number, x: number, y: number, z: number): void; needsUpdate: boolean }
      skinIndex: { getX(i: number): number; getY(i: number): number; getZ(i: number): number; getW(i: number): number }
      skinWeight: { getX(i: number): number; getY(i: number): number; getZ(i: number): number; getW(i: number): number }
      tangent?: unknown
    }
    computeVertexNormals(): void
    computeTangents(): void
  }
}

function isMixamoSkeleton(skeleton: Skeleton): boolean {
  const boneNames = new Set(skeleton.bones.map(b => b.name))
  return MIXAMO_BONES.every(name => boneNames.has(name))
}

function findMixamoSkeletons(root: Group): Skeleton[] {
  const skeletons = new Set<Skeleton>()
  root.traverse((obj) => {
    const mesh = obj as SkinnedMeshLike
    if (mesh.isSkinnedMesh && mesh.skeleton && isMixamoSkeleton(mesh.skeleton)) {
      skeletons.add(mesh.skeleton)
    }
  })
  return Array.from(skeletons)
}

function rebindSkeleton(skeleton: Skeleton, root: Group): void {
  const originalScale = root.scale.clone()
  root.scale.set(1, 1, 1)
  root.updateMatrixWorld(true)
  skeleton.bones.forEach(b => b.updateMatrixWorld(true))

  const oldBoneWorldMatrices = skeleton.bones.map(b => b.matrixWorld.clone())

  const meshes: SkinnedMeshLike[] = []
  root.traverse((obj) => {
    const m = obj as SkinnedMeshLike
    if (m.isSkinnedMesh && m.skeleton === skeleton) meshes.push(m)
  })

  meshes.forEach(mesh => {
    const posAttr = mesh.geometry.attributes.position
    const skinIndex = mesh.geometry.attributes.skinIndex
    const skinWeight = mesh.geometry.attributes.skinWeight

    const vertex = new Vector3()
    const skinnedWorld = new Vector3()
    const tempMat = new Matrix4()

    for (let i = 0; i < posAttr.count; i++) {
      vertex.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i))
      skinnedWorld.set(0, 0, 0)

      const bIndices = [skinIndex.getX(i), skinIndex.getY(i), skinIndex.getZ(i), skinIndex.getW(i)]
      const weights = [skinWeight.getX(i), skinWeight.getY(i), skinWeight.getZ(i), skinWeight.getW(i)]

      for (let j = 0; j < 4; j++) {
        const bIndex = bIndices[j]
        const weight = weights[j]
        if (!weight || bIndex === undefined) continue
        tempMat.multiplyMatrices(oldBoneWorldMatrices[bIndex]!, skeleton.boneInverses[bIndex]!)
        skinnedWorld.add(vertex.clone().applyMatrix4(tempMat).multiplyScalar(weight))
      }

      posAttr.setXYZ(i, skinnedWorld.x, skinnedWorld.y, skinnedWorld.z)
    }

    posAttr.needsUpdate = true
    mesh.geometry.computeVertexNormals()
    if (mesh.geometry.attributes.tangent) {
      mesh.geometry.computeTangents()
    }
  })

  skeleton.boneInverses = skeleton.bones.map(b => new Matrix4().copy(b.matrixWorld).invert())
  skeleton.pose()
  root.scale.copy(originalScale)
  root.updateMatrixWorld(true)
}

function transformBone(
  boneName: string,
  skeleton: Skeleton,
  pos?: { x?: number; y?: number; z?: number },
  rot?: { x?: number; y?: number; z?: number },
): void {
  const bone = skeleton.bones.find(b => b.name === boneName)
  if (!bone) return

  const savedWorldTransforms: { bone: Object3D; matrixWorld: Matrix4 }[] = []
  function saveWorld(b: Object3D): void {
    b.updateWorldMatrix(true, false)
    savedWorldTransforms.push({ bone: b, matrixWorld: b.matrixWorld.clone() })
    b.children.forEach(c => { if (MIXAMO_BONES.includes(c.name)) saveWorld(c) })
  }
  saveWorld(bone)

  if (pos) {
    bone.position.x += pos.x ?? 0
    bone.position.y += pos.y ?? 0
    bone.position.z += pos.z ?? 0
  }
  if (rot) {
    bone.rotation.x += rot.x ?? 0
    bone.rotation.y += rot.y ?? 0
    bone.rotation.z += rot.z ?? 0
  }
  bone.updateMatrixWorld(true)

  savedWorldTransforms.forEach(({ bone: desc, matrixWorld }) => {
    if (desc === bone) return
    const parentWorld = new Matrix4()
    if (desc.parent) {
      desc.parent.updateWorldMatrix(true, false)
      parentWorld.copy(desc.parent.matrixWorld).invert()
    } else {
      parentWorld.identity()
    }
    const local = new Matrix4().multiplyMatrices(parentWorld, matrixWorld)
    local.decompose(desc.position, desc.quaternion, desc.scale)
    desc.updateMatrixWorld(true)
  })
}

function scaleBone(root: Group, boneName: string, targetHeight: number): void {
  root.updateWorldMatrix(true, true)
  let bone: Object3D | null = null
  root.traverse(obj => { if ((obj as BoneWithSkeleton).isBone && obj.name === boneName) bone = obj })
  if (!bone) return

  const boneWorldPos = new Vector3()
  ;(bone as Object3D).getWorldPosition(boneWorldPos)
  const currentHeight = boneWorldPos.y
  if (currentHeight === 0) return

  root.scale.multiplyScalar(targetHeight / currentHeight)
  root.updateMatrixWorld(true)
}

/**
 * Retarget all Mixamo skeletons under the given root group.
 * Bone name keys in config apply position/rotation deltas.
 * Special keys: scaleToEyesLevel, scaleToHipsLevel, origin.
 */
export function retarget(root: Group, config: RetargetConfig = {}): void {
  const skeletons = findMixamoSkeletons(root)
  if (skeletons.length === 0) return

  for (const skeleton of skeletons) {
    skeleton.pose()

    const boneNames = new Set(skeleton.bones.map(b => b.name))

    let isTransform = false
    let scaleToHipsLevel: number | null = null
    let scaleToEyesLevel: number | null = null
    let origin: { x?: number; y?: number; z?: number } | null = null

    for (const [key, val] of Object.entries(config)) {
      if (key === 'scaleToHipsLevel') {
        scaleToHipsLevel = val as number
      } else if (key === 'scaleToEyesLevel') {
        scaleToEyesLevel = val as number
      } else if (key === 'origin') {
        origin = val as { x?: number; y?: number; z?: number }
      } else if (boneNames.has(key)) {
        const t = val as { x?: number; y?: number; z?: number; rx?: number; ry?: number; rz?: number }
        transformBone(key, skeleton, { x: t.x, y: t.y, z: t.z }, { x: t.rx, y: t.ry, z: t.rz })
        isTransform = true
      }
    }

    if (isTransform) rebindSkeleton(skeleton, root)

    if (scaleToEyesLevel !== null) {
      scaleBone(root, 'LeftEye', EYE_HEIGHT_M * scaleToEyesLevel)
    } else if (scaleToHipsLevel !== null) {
      scaleBone(root, 'Hips', HIPS_HEIGHT_M * scaleToHipsLevel)
    }

    if (origin) {
      root.position.x += (origin.x ?? 0)
      root.position.y += (origin.y ?? 0)
      root.position.z += (origin.z ?? 0)
      root.updateMatrixWorld(true)
    }
  }
}

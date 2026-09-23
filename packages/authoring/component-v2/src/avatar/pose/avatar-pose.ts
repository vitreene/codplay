import { Box3, Euler, Quaternion, Vector3 } from 'three'
import type { Object3D } from 'three'
import type {
  AvatarAnimationLayer,
  AvatarPose,
  AvatarPoseDelta,
  AvatarPoseTransform,
  AvatarQuaternion,
  AvatarVector3,
} from '../avatar-types.js'
type MutablePoseTransform = {
  position?: AvatarVector3
  quaternion?: AvatarQuaternion
  scale?: AvatarVector3
}

/** Composes Avatar layers and owns the only persistent skeletal write. */
export class AvatarPoseComposer {
  private readonly bones: ReadonlyMap<string, Object3D>

  /** Builds one composer for the bones of a loaded Avatar instance. */
  constructor(bones: ReadonlyMap<string, Object3D>) {
    this.bones = bones
  }

  /** Resolves the complete final skeletal pose for one absolute timeline position. */
  compose(
    semantic: AvatarPose,
    animation: AvatarAnimationLayer | null,
    deltas: readonly AvatarPoseDelta[],
  ): AvatarPose {
    const result = clonePose(semantic)
    if (animation !== null) {
      applyAnimationLayer(result, animation, semantic)
    }
    for (const delta of deltas) {
      applyPoseDelta(result, delta)
    }
    return result
  }

  /** Writes the already composed result to the loaded Avatar bones. */
  apply(pose: AvatarPose): void {
    for (const bone of this.bones.values()) {
      const transform = pose.get(bone)
      if (transform === undefined) continue
      if (transform.position !== undefined) {
        bone.position.set(transform.position.x, transform.position.y, transform.position.z)
      }
      if (transform.quaternion !== undefined) {
        bone.quaternion.set(
          transform.quaternion.x,
          transform.quaternion.y,
          transform.quaternion.z,
          transform.quaternion.w,
        )
      }
      if (transform.scale !== undefined) {
        bone.scale.set(transform.scale.x, transform.scale.y, transform.scale.z)
      }
    }
  }
}

/** Clones a pose so layer composition never mutates the contributing state. */
export function clonePose(source: AvatarPose): Map<Object3D, AvatarPoseTransform> {
  const result = new Map<Object3D, AvatarPoseTransform>()
  for (const [bone, transform] of source) {
    result.set(bone, cloneTransform(transform))
  }
  return result
}

/** Captures the complete local transform of every supplied bone. */
export function captureBonePose(bones: ReadonlyMap<string, Object3D>): AvatarPose {
  const pose = new Map<Object3D, AvatarPoseTransform>()
  for (const bone of bones.values()) {
    pose.set(bone, readTransform(bone))
  }
  return pose
}

/**
 * Computes TalkingHead's hip/feet balance as one additive pose contribution.
 *
 * TalkingHead applies this after the semantic pose and clip have been sampled,
 * so the hips follow the actual feet of the current frame instead of a fixed
 * rest-pose offset. The contribution is kept in the Avatar composer pipeline;
 * it never becomes a second persistent bone writer.
 */
export function createHipFeetBalanceDelta(
  armature: Object3D,
  bones: ReadonlyMap<string, Object3D>,
): AvatarPoseDelta {
  const hips = bones.get('Hips')
  const leftToe = bones.get('LeftToeBase')
  const rightToe = bones.get('RightToeBase')
  if (hips === undefined || leftToe === undefined || rightToe === undefined) return new Map()

  armature.updateMatrixWorld(true)
  const bounds = new Box3().setFromObject(armature)
  const leftWorld = new Vector3()
  const rightWorld = new Vector3()
  leftToe.getWorldPosition(leftWorld)
  rightToe.getWorldPosition(rightWorld)
  leftWorld.sub(armature.position)
  rightWorld.sub(armature.position)

  return new Map([[hips, {
    position: {
      x: -(leftWorld.x + rightWorld.x) / 4,
      y: -bounds.min.y / 2,
      z: -(leftWorld.z + rightWorld.z) / 2,
    },
  }]])
}

/** Applies the clip ownership or release interpolation to its covered channels. */
function applyAnimationLayer(
  result: Map<Object3D, AvatarPoseTransform>,
  animation: AvatarAnimationLayer,
  semantic: AvatarPose,
): void {
  for (const [bone, clipTransform] of animation.transforms) {
    const semanticTransform = semantic.get(bone) ?? result.get(bone) ?? readTransform(bone)
    const composed = result.get(bone) ?? semanticTransform
    const next: MutablePoseTransform = { ...composed }

    if (clipTransform.position !== undefined) {
      next.position = resolveAnimationVector(
        clipTransform.position,
        semanticTransform.position,
        animation,
      )
    }
    if (clipTransform.quaternion !== undefined) {
      next.quaternion = resolveAnimationQuaternion(
        clipTransform.quaternion,
        semanticTransform.quaternion,
        animation,
      )
    }
    if (clipTransform.scale !== undefined) {
      next.scale = resolveAnimationVector(
        clipTransform.scale,
        semanticTransform.scale,
        animation,
      )
    }
    result.set(bone, next)
  }
}

/** Resolves one clip vector across entry and release ownership phases. */
function resolveAnimationVector(
  clip: AvatarVector3,
  semantic: AvatarVector3 | undefined,
  animation: AvatarAnimationLayer,
): AvatarVector3 {
  if (animation.releaseProgress !== undefined) {
    return interpolateVector(clip, semantic, animation.releaseProgress)
  }
  if (animation.entryProgress !== undefined) {
    return interpolateVector(semantic ?? clip, clip, animation.entryProgress)
  }
  return cloneVector(clip)
}

/** Resolves one clip quaternion across entry and release ownership phases. */
function resolveAnimationQuaternion(
  clip: AvatarQuaternion,
  semantic: AvatarQuaternion | undefined,
  animation: AvatarAnimationLayer,
): AvatarQuaternion {
  if (animation.releaseProgress !== undefined) {
    return interpolateQuaternion(clip, semantic, animation.releaseProgress)
  }
  if (animation.entryProgress !== undefined) {
    return interpolateQuaternion(semantic ?? clip, clip, animation.entryProgress)
  }
  return cloneQuaternion(clip)
}

/** Adds one internal Avatar contribution after the semantic and clip layers. */
function applyPoseDelta(
  result: Map<Object3D, AvatarPoseTransform>,
  delta: AvatarPoseDelta,
): void {
  const rotation = new Quaternion()
  for (const [bone, contribution] of delta) {
    const current = result.get(bone) ?? readTransform(bone)
    const next: MutablePoseTransform = { ...current }
    if (contribution.rotation !== undefined) {
      const base = current.quaternion ?? readTransform(bone).quaternion!
      rotation.setFromEuler(new Euler(
        contribution.rotation.x,
        contribution.rotation.y,
        contribution.rotation.z,
        bone.rotation.order,
      ))
      const quaternion = new Quaternion(
        base.x,
        base.y,
        base.z,
        base.w,
      ).multiply(rotation)
      next.quaternion = readQuaternion(quaternion)
    }
    if (contribution.position !== undefined) {
      const base = current.position ?? readTransform(bone).position!
      next.position = {
        x: base.x + contribution.position.x,
        y: base.y + contribution.position.y,
        z: base.z + contribution.position.z,
      }
    }
    if (contribution.scale !== undefined) {
      const base = current.scale ?? readTransform(bone).scale!
      next.scale = {
        x: base.x * contribution.scale.x,
        y: base.y * contribution.scale.y,
        z: base.z * contribution.scale.z,
      }
    }
    result.set(bone, next)
  }
}

/** Reads one complete local transform without exposing mutable Three vectors. */
function readTransform(bone: Object3D): AvatarPoseTransform {
  return {
    position: { x: bone.position.x, y: bone.position.y, z: bone.position.z },
    quaternion: { x: bone.quaternion.x, y: bone.quaternion.y, z: bone.quaternion.z, w: bone.quaternion.w },
    scale: { x: bone.scale.x, y: bone.scale.y, z: bone.scale.z },
  }
}

/** Copies one vector-like value. */
function cloneVector(value: AvatarVector3): AvatarVector3 {
  return { x: value.x, y: value.y, z: value.z }
}

/** Copies one quaternion-like value. */
function cloneQuaternion(value: AvatarQuaternion): AvatarQuaternion {
  return { x: value.x, y: value.y, z: value.z, w: value.w }
}

/** Copies one transform without retaining mutable values from a contributor. */
function cloneTransform(value: AvatarPoseTransform): AvatarPoseTransform {
  return {
    ...(value.position === undefined ? {} : { position: cloneVector(value.position) }),
    ...(value.quaternion === undefined ? {} : { quaternion: cloneQuaternion(value.quaternion) }),
    ...(value.scale === undefined ? {} : { scale: cloneVector(value.scale) }),
  }
}

/** Interpolates one quaternion toward the semantic pose with a clamped weight. */
function interpolateQuaternion(
  source: AvatarQuaternion,
  destination: AvatarQuaternion | undefined,
  progress: number,
): AvatarQuaternion {
  if (destination === undefined) return cloneQuaternion(source)
  const start = new Quaternion(source.x, source.y, source.z, source.w)
  const end = new Quaternion(destination.x, destination.y, destination.z, destination.w)
  return readQuaternion(start.slerp(end, clamp(progress)))
}

/** Interpolates one scale vector toward the semantic pose with a clamped weight. */
function interpolateVector(
  source: AvatarVector3,
  destination: AvatarVector3 | undefined,
  progress: number,
): AvatarVector3 {
  if (destination === undefined) return cloneVector(source)
  const weight = clamp(progress)
  return {
    x: source.x + (destination.x - source.x) * weight,
    y: source.y + (destination.y - source.y) * weight,
    z: source.z + (destination.z - source.z) * weight,
  }
}

/** Reads a Quaternion into the immutable pose representation. */
function readQuaternion(value: Quaternion): AvatarQuaternion {
  return { x: value.x, y: value.y, z: value.z, w: value.w }
}

/** Clamps an interpolation coefficient to its valid range. */
function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/**
 * Gesture behavior — applies body poses and gesture overrides with easing.
 *
 * The pose and gesture catalogs live in gesture-definitions.ts. This module
 * only owns the mutable state and the operations that consume those catalogs.
 */
import { Euler, Quaternion } from 'three'
import type { Object3D } from 'three'
import { GESTURE_TEMPLATES, POSE_TEMPLATES } from './gesture-definitions.js'
import type { RotationValue } from './gesture-definitions.js'
import type { AvatarGestureOverlay } from './motion-catalog.js'

/** Minimal PRNG interface — provide a seeded instance. */
export type Rng = { random(): number }

/** Resolved pose: boneName → resolved Euler angles plus optional position deltas. */
export type ResolvedPose = Map<string, { x: number; y: number; z: number; px?: number; py?: number; pz?: number }>

type BoneState = {
  bone: Object3D
  /** Rest rotation captured at construction (post-retarget). */
  rx: number; ry: number; rz: number
  /** Rest position captured at construction (post-retarget). */
  px: number; py: number; pz: number
  /** Current body-pose baseline. Gestures release back to these values. */
  bx: number; by: number; bz: number
  /** Current eased rotation (written to bone.rotation). */
  x: number; y: number; z: number
  /** Target rotation. */
  tx: number; ty: number; tz: number
  /**
   * An axis becomes gesture-owned the first time some template defines it for
   * this bone. Unowned axes stay with the morph binding, such as Head/Neck
   * x/y driven by head drift and gaze.
   */
  poseX: boolean; poseY: boolean; poseZ: boolean
  gestureX: boolean; gestureY: boolean; gestureZ: boolean
}

// RC-filter easing: tau ≈ 330 ms → ~95 % of target reached in ~1 s.
const GESTURE_EASE = 0.003

/** Samples a rotation value using TalkingHead's random-distribution shape. */
function sampleValue(value: RotationValue, rng: Rng): number {
  if (typeof value === 'number') return value
  const [min, max, skewFrom, skewTo] = value.length === 4
    ? value
    : [value[0], value[1], 1, 1]
  const random = rng.random()
  const power = skewFrom + (skewTo - skewFrom) * random
  return min + (max - min) * Math.pow(random, 1 / Math.max(0.001, power))
}

/** Returns the active baseline value for one axis. */
function baseX(state: BoneState): number { return state.poseX ? state.bx : state.rx }
function baseY(state: BoneState): number { return state.poseY ? state.by : state.ry }
function baseZ(state: BoneState): number { return state.poseZ ? state.bz : state.rz }

export class GestureEngine {
  private readonly state = new Map<string, BoneState>()

  /** Captures the model rest state used by pose and gesture transitions. */
  constructor(boneMap: Map<string, Object3D>) {
    for (const [name, bone] of boneMap) {
      const { x, y, z } = bone.rotation as Euler
      const position = bone.position
      this.state.set(name, {
        bone,
        rx: x,
        ry: y,
        rz: z,
        px: position.x,
        py: position.y,
        pz: position.z,
        bx: x,
        by: y,
        bz: z,
        x,
        y,
        z,
        tx: x,
        ty: y,
        tz: z,
        poseX: false,
        poseY: false,
        poseZ: false,
        gestureX: false,
        gestureY: false,
        gestureZ: false,
      })
    }
  }

  /** Advances easing without touching axes owned by the morph binding. */
  update(deltaMs: number): void {
    const alpha = 1 - Math.exp(-GESTURE_EASE * deltaMs)
    for (const state of this.state.values()) {
      if (!hasActiveAxis(state)) continue
      const rotation = state.bone.rotation as Euler
      if (state.poseX || state.gestureX) {
        state.x = approach(state.x, state.tx, alpha)
        rotation.x = state.x
      }
      if (state.poseY || state.gestureY) {
        state.y = approach(state.y, state.ty, alpha)
        rotation.y = state.y
      }
      if (state.poseZ || state.gestureZ) {
        state.z = approach(state.z, state.tz, alpha)
        rotation.z = state.z
      }
    }
  }

  /** Starts an eased transition to a named body-pose baseline. */
  setBodyPose(name: string): boolean {
    const template = POSE_TEMPLATES[name]
    if (!template) return false

    this.releaseBodyPoseAxes()
    for (const [key, boneRotation] of Object.entries(template)) {
      const target = this.state.get(boneNameFromKey(key))
      if (target === undefined || propertyFromKey(key) !== 'rotation') continue
      if (boneRotation.x !== undefined) this.setPoseAxis(target, 'x', boneRotation.x)
      if (boneRotation.y !== undefined) this.setPoseAxis(target, 'y', boneRotation.y)
      if (boneRotation.z !== undefined) this.setPoseAxis(target, 'z', boneRotation.z)
    }
    return true
  }

  /** Snaps active body-pose axes to their current baseline. */
  snapToBodyPose(): void {
    for (const state of this.state.values()) {
      const rotation = state.bone.rotation as Euler
      if (state.poseX && !state.gestureX) {
        state.x = state.bx; state.tx = state.bx; rotation.x = state.bx
      }
      if (state.poseY && !state.gestureY) {
        state.y = state.by; state.ty = state.by; rotation.y = state.by
      }
      if (state.poseZ && !state.gestureZ) {
        state.z = state.bz; state.tz = state.bz; rotation.z = state.bz
      }
    }
  }

  /** Applies a fully resolved semantic pose without easing. */
  applyResolvedSemanticPose(pose: ResolvedPose): void {
    for (const [boneName, state] of this.state) {
      const target = pose.get(boneName)
      const rotation = state.bone.rotation as Euler
      if (target !== undefined) {
        applyResolvedAxis(state, 'x', target.x, rotation)
        applyResolvedAxis(state, 'y', target.y, rotation)
        applyResolvedAxis(state, 'z', target.z, rotation)
        state.bone.position.x = state.px + (target.px ?? 0)
        state.bone.position.y = state.py + (target.py ?? 0)
        state.bone.position.z = state.pz + (target.pz ?? 0)
        continue
      }
      if (!hasActiveAxis(state)) continue
      resetState(state, rotation)
    }
  }

  /** Starts an eased transition to a named gesture and returns its resolved pose. */
  applyGesture(name: string, rng: Rng, mirror = false): ResolvedPose | null {
    const template = GESTURE_TEMPLATES[name]
    if (!template) return null

    this.releaseGestureAxes()
    const pose: ResolvedPose = new Map()
    for (const [key, boneRotation] of Object.entries(template)) {
      const sourceBoneName = boneNameFromKey(key)
      const boneName = mirror ? mirrorBoneName(sourceBoneName) : sourceBoneName
      const state = this.state.get(boneName)
      if (state === undefined || propertyFromKey(key) !== 'rotation') continue

      const x = boneRotation.x === undefined ? baseX(state) : sampleValue(boneRotation.x, rng)
      const y = boneRotation.y === undefined ? baseY(state) : sampleValue(boneRotation.y, rng)
      const z = boneRotation.z === undefined ? baseZ(state) : sampleValue(boneRotation.z, rng)
      const target = mirror ? mirrorRotation(x, y, z, state.bone.rotation.order) : { x, y, z }
      pose.set(boneName, target)
      if (boneRotation.x !== undefined) { state.gestureX = true; state.tx = target.x }
      if (boneRotation.y !== undefined) { state.gestureY = true; state.ty = target.y }
      if (boneRotation.z !== undefined) { state.gestureZ = true; state.tz = target.z }
    }
    return pose
  }

  /** Applies one sampled procedural overlay on top of the current gesture pose. */
  applyOverlay(overlay: AvatarGestureOverlay | null, scale = 1): void {
    if (overlay === null) return
    for (const [boneName, delta] of Object.entries(overlay)) {
      const bone = this.state.get(boneName)?.bone
      if (bone === undefined) continue
      if (delta.rotation !== undefined) {
        bone.rotation.x += delta.rotation.x * scale
        bone.rotation.y += delta.rotation.y * scale
        bone.rotation.z += delta.rotation.z * scale
      }
      if (delta.position !== undefined) {
        bone.position.x += delta.position.x * scale
        bone.position.y += delta.position.y * scale
        bone.position.z += delta.position.z * scale
      }
    }
  }

  /** Starts the eased return of active gesture axes to their baselines. */
  resetPose(): void {
    this.releaseGestureAxes()
  }

  /** Replays a resolved gesture instantly after a seek. */
  applyPose(pose: ResolvedPose): void {
    for (const [boneName, target] of pose) {
      const state = this.state.get(boneName)
      if (state === undefined) continue
      state.x = target.x; state.tx = target.x
      state.y = target.y; state.ty = target.y
      state.z = target.z; state.tz = target.z
      state.gestureX = true; state.gestureY = true; state.gestureZ = true
      const rotation = state.bone.rotation as Euler
      rotation.x = target.x; rotation.y = target.y; rotation.z = target.z
    }
  }

  /** Snaps all active axes to the model rest pose. */
  snapToRest(): void {
    for (const state of this.state.values()) {
      if (!hasActiveAxis(state)) continue
      resetActiveAxes(state, state.bone.rotation as Euler)
    }
  }

  /** Snaps the current gesture targets after a seek replay. */
  snapToTargets(): void {
    for (const state of this.state.values()) {
      if (state.x === state.tx && state.y === state.ty && state.z === state.tz) continue
      state.x = state.tx; state.y = state.ty; state.z = state.tz
      const rotation = state.bone.rotation as Euler
      rotation.x = state.tx; rotation.y = state.ty; rotation.z = state.tz
    }
  }

  private releaseBodyPoseAxes(): void {
    for (const state of this.state.values()) {
      if (state.poseX) { state.poseX = false; state.bx = state.rx; if (!state.gestureX) state.tx = state.rx }
      if (state.poseY) { state.poseY = false; state.by = state.ry; if (!state.gestureY) state.ty = state.ry }
      if (state.poseZ) { state.poseZ = false; state.bz = state.rz; if (!state.gestureZ) state.tz = state.rz }
    }
  }

  private releaseGestureAxes(): void {
    for (const state of this.state.values()) {
      if (state.gestureX) { state.gestureX = false; state.tx = baseX(state) }
      if (state.gestureY) { state.gestureY = false; state.ty = baseY(state) }
      if (state.gestureZ) { state.gestureZ = false; state.tz = baseZ(state) }
    }
  }

  private setPoseAxis(state: BoneState, axis: 'x' | 'y' | 'z', value: RotationValue): void {
    const sampled = sampleValue(value, { random: () => 0.5 })
    if (axis === 'x') {
      state.poseX = true
      state.bx = sampled
      if (!state.gestureX) state.tx = sampled
    } else if (axis === 'y') {
      state.poseY = true
      state.by = sampled
      if (!state.gestureY) state.ty = sampled
    } else {
      state.poseZ = true
      state.bz = sampled
      if (!state.gestureZ) state.tz = sampled
    }
  }
}

/** Returns whether one state has an axis owned by pose or gesture behavior. */
function hasActiveAxis(state: BoneState): boolean {
  return state.poseX || state.poseY || state.poseZ || state.gestureX || state.gestureY || state.gestureZ
}

/** Moves one value toward its target using the current easing factor. */
function approach(current: number, target: number, alpha: number): number {
  const difference = target - current
  return Math.abs(difference) < 1e-4 ? target : current + difference * alpha
}

/** Applies one resolved axis and marks it as a semantic pose axis. */
function applyResolvedAxis(state: BoneState, axis: 'x' | 'y' | 'z', value: number, rotation: Euler): void {
  if (axis === 'x') {
    state.poseX = true; state.gestureX = false; state.bx = value; state.x = value; state.tx = value; rotation.x = value
  } else if (axis === 'y') {
    state.poseY = true; state.gestureY = false; state.by = value; state.y = value; state.ty = value; rotation.y = value
  } else {
    state.poseZ = true; state.gestureZ = false; state.bz = value; state.z = value; state.tz = value; rotation.z = value
  }
}

/** Restores one bone state when a semantic pose no longer contains it. */
function resetState(state: BoneState, rotation: Euler): void {
  state.poseX = false; state.gestureX = false; state.bx = state.rx; state.x = state.rx; state.tx = state.rx; rotation.x = state.rx
  state.poseY = false; state.gestureY = false; state.by = state.ry; state.y = state.ry; state.ty = state.ry; rotation.y = state.ry
  state.poseZ = false; state.gestureZ = false; state.bz = state.rz; state.z = state.rz; state.tz = state.rz; rotation.z = state.rz
  state.bone.position.set(state.px, state.py, state.pz)
}

/** Restores only the axes currently owned by pose or gesture behavior. */
function resetActiveAxes(state: BoneState, rotation: Euler): void {
  if (state.poseX || state.gestureX) {
    state.poseX = false; state.gestureX = false; state.bx = state.rx; state.x = state.rx; state.tx = state.rx; rotation.x = state.rx
  }
  if (state.poseY || state.gestureY) {
    state.poseY = false; state.gestureY = false; state.by = state.ry; state.y = state.ry; state.ty = state.ry; rotation.y = state.ry
  }
  if (state.poseZ || state.gestureZ) {
    state.poseZ = false; state.gestureZ = false; state.bz = state.rz; state.z = state.rz; state.tz = state.rz; rotation.z = state.rz
  }
}

/** Splits a catalog key into its bone name. */
function boneNameFromKey(key: string): string {
  return key.slice(0, key.lastIndexOf('.'))
}

/** Splits a catalog key into its property name. */
function propertyFromKey(key: string): string {
  return key.slice(key.lastIndexOf('.') + 1)
}

/** Swaps the left/right side of a TalkingHead bone name for mirrored gestures. */
function mirrorBoneName(name: string): string {
  return name
    .replaceAll('Left', '__MIRROR_RIGHT__')
    .replaceAll('Right', 'Left')
    .replaceAll('__MIRROR_RIGHT__', 'Right')
}

/** Mirrors a resolved Euler pose using the quaternion convention used by TH. */
function mirrorRotation(
  x: number,
  y: number,
  z: number,
  order: Euler['order'],
): { x: number; y: number; z: number } {
  const quaternion = new Quaternion().setFromEuler(new Euler(x, y, z, order))
  quaternion.x *= -1
  quaternion.w *= -1
  const mirrored = new Euler().setFromQuaternion(quaternion, order)
  return { x: mirrored.x, y: mirrored.y, z: mirrored.z }
}

/**
 * Gesture behavior — resolves body poses and gesture transitions at absolute time.
 *
 * This module never writes a Three.js bone. AvatarPoseComposer owns that final
 * write after it has combined the semantic pose with a native animation clip.
 */
import { Euler, Quaternion } from 'three'
import type { Object3D } from 'three'
import {
  GESTURE_TEMPLATES,
  POSE_FLAGS,
  POSE_TEMPLATES,
} from './gesture-definitions.js'
import type {
  AvatarGestureOverlay,
  AvatarHandTarget,
  AvatarPose,
  AvatarPoseDelta,
  AvatarPoseFlags,
  AvatarPoseTransform,
  AvatarVector3,
  Rng,
  ResolvedPose,
  RotationValue,
  TalkingHandsOptions,
} from '../avatar-types.js'
import {
  TalkingHandsPlanner,
} from './talking-hands.js'
import { sampleTalkingHeadEasing } from '../avatar-easing.js'

type BoneState = Readonly<{
  bone: Object3D
  restPosition: AvatarVector3
  restScale: AvatarVector3
  restRotation: Readonly<{ x: number; y: number; z: number }>
}>

type BoneAngles = Readonly<{
  x?: number
  y?: number
  z?: number
  px?: number
  py?: number
  pz?: number
}>

type PoseTransition = Readonly<{
  startAt: number
  durationMs: number
  source: AvatarPose
  target: AvatarPose
  intermediate?: Readonly<{
    pose: AvatarPose
    durationMs: number
  }>
}>

type GestureTransition = PoseTransition & Readonly<{
  bones: ReadonlySet<Object3D>
}>

const DEFAULT_GESTURE_TRANSITION_MS = 1_000
const DEFAULT_POSE_TRANSITION_MS = 2_000
const INTERMEDIATE_POSE_TRANSITION_MS = 1_000
const MOVEMENT_LIMITED_BONES = new Set([
  'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck',
  'LeftUpLeg', 'LeftLeg', 'RightUpLeg', 'RightLeg',
])

/** Samples a rotation value using TalkingHead's deterministic range shape. */
function sampleValue(value: RotationValue, rng: Rng): number {
  if (typeof value === 'number') return value
  const min = value[0] ?? 0
  const max = value[1] ?? min
  const skew = value.length >= 3 ? value[2] ?? 1 : 1
  const samples = Math.max(1, Math.round(value.length >= 4 ? value[3] ?? 5 : 5))
  let total = 0
  for (let index = 0; index < samples; index += 1) total += rng.random()
  return min + Math.pow(total / samples, skew) * (max - min)
}

/** Resolves semantic body and hand poses without taking ownership of Three bones. */
export class GestureEngine {
  private readonly state = new Map<string, BoneState>()
  private bodyPose = new Map<string, BoneAngles>()
  private gesturePose = new Map<string, BoneAngles>()
  private overlay: AvatarPoseDelta = new Map()
  private readonly talkingHands: TalkingHandsPlanner
  private explicitHandTargets: readonly AvatarHandTarget[] = []
  private talkingHandsOptions: TalkingHandsOptions = {
    enabled: false,
    probability: 0.5,
    seed: 0,
  }
  private bodyTransition: PoseTransition | null = null
  private gestureTransition: GestureTransition | null = null
  private bodyPoseName = 'neutral'
  private readonly modelMovementFactor: number

  /** Captures the model and the TH standing-motion restraint used by its poses. */
  constructor(boneMap: ReadonlyMap<string, Object3D>, modelMovementFactor = 1) {
    this.modelMovementFactor = clamp(modelMovementFactor)
    this.talkingHands = new TalkingHandsPlanner(boneMap)
    for (const [name, bone] of boneMap) {
      this.state.set(name, {
        bone,
        restPosition: readVector(bone.position),
        restScale: readVector(bone.scale),
        restRotation: {
          x: bone.rotation.x,
          y: bone.rotation.y,
          z: bone.rotation.z,
        },
      })
    }
  }

  /** Starts a semantic body-pose transition at one absolute timeline position. */
  setBodyPose(name: string, startAt = 0, durationMs = DEFAULT_POSE_TRANSITION_MS): boolean {
    const template = POSE_TEMPLATES[name]
    if (template === undefined) return false
    const source = this.sampleAt(startAt)
    const flags = POSE_FLAGS[name]
    const previousFlags = POSE_FLAGS[this.bodyPoseName]
    this.bodyPose = resolveTemplate(template, this.state, { random: () => 0.5 }, false, flags, this.modelMovementFactor)
    const target = this.buildBodyPose()
    const intermediate = isStandingLyingChange(previousFlags, flags)
      ? resolveIntermediatePose(this.state, this.modelMovementFactor)
      : undefined
    this.bodyTransition = createTransition(source, target, startAt, durationMs, intermediate)
    this.bodyPoseName = name
    this.retargetGestureTransition(target)
    return true
  }

  /** Starts a gesture transition and returns the target pose used by that transition. */
  applyGesture(
    name: string,
    rng: Rng,
    mirror = false,
    startAt = 0,
    durationMs = DEFAULT_GESTURE_TRANSITION_MS,
  ): ResolvedPose | null {
    const template = GESTURE_TEMPLATES[name]
    if (template === undefined) return null
    const source = this.sampleAt(startAt)
    const affectedBones = this.currentGestureBones()
    this.gesturePose = resolveTemplate(template, this.state, rng, mirror)
    for (const name of this.gesturePose.keys()) {
      const bone = this.state.get(name)?.bone
      if (bone !== undefined) affectedBones.add(bone)
    }
    const target = this.buildTargetPose()
    this.gestureTransition = createGestureTransition(
      source,
      target,
      startAt,
      durationMs,
      affectedBones,
    )
    return target
  }

  /** Starts the return from the selected gesture to the current body pose. */
  releaseGesture(
    startAt = 0,
    durationMs = DEFAULT_GESTURE_TRANSITION_MS,
  ): void {
    const source = this.sampleAt(startAt)
    const affectedBones = this.currentGestureBones()
    this.gesturePose = new Map()
    if (affectedBones.size === 0) {
      this.gestureTransition = null
      return
    }
    this.gestureTransition = createGestureTransition(
      source,
      this.buildBodyPose(),
      startAt,
      durationMs,
      affectedBones,
    )
  }

  /** Stores the procedural overlay contributed by the current semantic motion frame. */
  setOverlay(overlay: AvatarGestureOverlay | null): void {
    const result = new Map<Object3D, {
      rotation?: AvatarVector3
      position?: AvatarVector3
    }>()
    for (const [name, value] of Object.entries(overlay ?? {})) {
      const bone = this.state.get(name)?.bone
      if (bone === undefined) continue
      result.set(bone, {
        ...(value.rotation === undefined ? {} : { rotation: { ...value.rotation } }),
        ...(value.position === undefined ? {} : { position: { ...value.position } }),
      })
    }
    this.overlay = result
  }

  /** Selects the internal TalkingHead speaking-hands behavior. */
  setTalkingHands(options: TalkingHandsOptions): void {
    this.talkingHandsOptions = { ...options }
  }

  /** Stores the explicit hand IK tasks emitted by the active Avatar motion. */
  setExplicitHandTargets(targets: readonly AvatarHandTarget[]): void {
    this.explicitHandTargets = targets.map((target) => ({
      ...target,
      position: { ...target.position },
    }))
  }

  /** Resolves the semantic skeletal pose at one absolute timeline position. */
  sampleAt(timeMs: number): AvatarPose {
    const body = this.bodyTransition === null
      ? this.buildBodyPose()
      : sampleTransition(this.bodyTransition, timeMs)
    const gesture = this.gestureTransition
    if (gesture === null) return body

    const result = clonePose(body)
    const sampledGesture = sampleTransition(gesture, timeMs)
    for (const bone of gesture.bones) {
      const transform = sampledGesture.get(bone)
      if (transform !== undefined) result.set(bone, cloneTransform(transform))
    }
    return result
  }

  /** Returns procedural bone deltas while optionally suspending speaking hands. */
  getOverlay(timeMs = 0, pose?: AvatarPose, suspendTalkingHands = false): AvatarPoseDelta {
    const sampledPose = pose ?? this.sampleAt(timeMs)
    const speakingHands = !suspendTalkingHands
      && this.bodyPoseNameIsStanding()
      && this.gesturePose.size === 0
      ? this.talkingHands.sample(timeMs, sampledPose, this.talkingHandsOptions)
      : new Map()
    const explicitHands = this.talkingHands.sampleExplicitTargets(
      timeMs,
      sampledPose,
      this.explicitHandTargets,
    )
    return mergePoseDeltas(this.overlay, mergePoseDeltas(speakingHands, explicitHands))
  }

  /** Clears transient semantic state before a seek reconstruction. */
  reset(): void {
    this.bodyPose = new Map()
    this.gesturePose = new Map()
    this.overlay = new Map()
    this.explicitHandTargets = []
    this.bodyTransition = null
    this.gestureTransition = null
    this.bodyPoseName = 'neutral'
  }

  /** Checks the same standing-only precondition used by TalkingHead. */
  private bodyPoseNameIsStanding(): boolean {
    return POSE_FLAGS[this.bodyPoseName]?.standing === true
  }

  /** Builds the body layer without allowing an active gesture to enter it. */
  private buildBodyPose(): Map<Object3D, AvatarPoseTransform> {
    return buildPoseFromAngles(this.bodyPose, this.state)
  }

  /** Builds the current body target and overlays the active gesture values. */
  private buildTargetPose(): AvatarPose {
    const result = this.buildBodyPose()
    for (const [name, values] of this.gesturePose) {
      const state = this.state.get(name)
      if (state === undefined) continue
      applyAngles(result, state, values)
    }
    return result
  }

  /** Returns every bone still owned by the current or in-flight gesture. */
  private currentGestureBones(): Set<Object3D> {
    const result = new Set(this.gestureTransition?.bones ?? [])
    for (const name of this.gesturePose.keys()) {
      const bone = this.state.get(name)?.bone
      if (bone !== undefined) result.add(bone)
    }
    return result
  }

  /** Keeps gesture-owned channels aligned with a newly selected body target. */
  private retargetGestureTransition(bodyTarget: AvatarPose): void {
    const transition = this.gestureTransition
    if (transition === null) return
    const target = this.buildTargetPoseFromBody(bodyTarget)
    this.gestureTransition = {
      ...transition,
      target: selectPose(target, transition.bones),
    }
  }

  /** Builds a target from an explicitly supplied body pose during retargeting. */
  private buildTargetPoseFromBody(body: AvatarPose): AvatarPose {
    const result = clonePose(body)
    for (const [name, values] of this.gesturePose) {
      const state = this.state.get(name)
      if (state === undefined) continue
      applyAngles(result, state, values)
    }
    return result
  }
}

/** Resolves one catalog template to concrete, model-local Euler values. */
function resolveTemplate(
  template: Readonly<Record<string, Readonly<{ x?: RotationValue; y?: RotationValue; z?: RotationValue }>>>,
  state: ReadonlyMap<string, BoneState>,
  rng: Rng,
  mirror: boolean,
  flags?: AvatarPoseFlags,
  modelMovementFactor = 1,
): Map<string, BoneAngles> {
  const result = new Map<string, BoneAngles>()
  for (const [key, values] of Object.entries(template)) {
    const property = propertyFromKey(key)
    const sourceName = boneNameFromKey(key)
    const name = mirror ? mirrorBoneName(sourceName) : sourceName
    const bone = state.get(name)
    if (bone === undefined) continue
    if (property === 'position') {
      result.set(name, {
        px: values.x === undefined ? bone.restPosition.x : sampleValue(values.x, rng),
        py: values.y === undefined ? bone.restPosition.y : sampleValue(values.y, rng),
        pz: values.z === undefined ? bone.restPosition.z : sampleValue(values.z, rng),
      })
      continue
    }
    if (property !== 'rotation') continue
    const source = {
      x: values.x === undefined ? bone.restRotation.x : sampleValue(values.x, rng),
      y: values.y === undefined ? bone.restRotation.y : sampleValue(values.y, rng),
      z: values.z === undefined ? bone.restRotation.z : sampleValue(values.z, rng),
    }
    const rotation = mirror
      ? mirrorRotation(source.x, source.y, source.z, bone.bone.rotation.order)
      : source
    const restrained = flags?.standing === true && modelMovementFactor < 1 && MOVEMENT_LIMITED_BONES.has(sourceName)
      ? restrainRotation(rotation, sourceName, state, mirror, modelMovementFactor)
      : rotation
    result.set(name, {
      ...(values.x === undefined ? {} : { x: restrained.x }),
      ...(values.y === undefined ? {} : { y: restrained.y }),
      ...(values.z === undefined ? {} : { z: restrained.z }),
    })
  }
  return result
}

/** Detects the standing/lying boundary where TH uses the one-knee waypoint. */
function isStandingLyingChange(
  previous: AvatarPoseFlags | undefined,
  next: AvatarPoseFlags | undefined,
): boolean {
  return previous !== undefined
    && next !== undefined
    && ((previous.standing === true && next.lying === true)
      || (previous.lying === true && next.standing === true))
}

/** Resolves TH's intermediate kneeling pose without mutating the semantic state. */
function resolveIntermediatePose(
  state: ReadonlyMap<string, BoneState>,
  modelMovementFactor: number,
): AvatarPose {
  return buildPoseFromAngles(
    resolveTemplate(
      POSE_TEMPLATES.oneknee ?? {},
      state,
      { random: () => 0.5 },
      false,
      POSE_FLAGS.oneknee,
      modelMovementFactor,
    ),
    state,
  )
}

/** Moves a standing pose toward TH's straight reference by the configured factor. */
function restrainRotation(
  rotation: { x: number; y: number; z: number },
  sourceName: string,
  state: ReadonlyMap<string, BoneState>,
  mirror: boolean,
  movementFactor: number,
): { x: number; y: number; z: number } {
  const bone = state.get(sourceName)
  const reference = POSE_TEMPLATES.straight?.[`${sourceName}.rotation`]
  if (bone === undefined || reference === undefined) return rotation
  const referenceAngles = {
    x: typeof reference.x === 'number' ? reference.x : bone.restRotation.x,
    y: typeof reference.y === 'number' ? reference.y : bone.restRotation.y,
    z: typeof reference.z === 'number' ? reference.z : bone.restRotation.z,
  }
  const target = mirror
    ? mirrorRotation(referenceAngles.x, referenceAngles.y, referenceAngles.z, bone.bone.rotation.order)
    : referenceAngles
  const currentQuaternion = new Quaternion().setFromEuler(new Euler(
    rotation.x,
    rotation.y,
    rotation.z,
    bone.bone.rotation.order,
  ))
  const targetQuaternion = new Quaternion().setFromEuler(new Euler(
    target.x,
    target.y,
    target.z,
    bone.bone.rotation.order,
  ))
  currentQuaternion.rotateTowards(targetQuaternion, (1 - movementFactor) * currentQuaternion.angleTo(targetQuaternion))
  const restrained = new Euler().setFromQuaternion(currentQuaternion, bone.bone.rotation.order)
  return { x: restrained.x, y: restrained.y, z: restrained.z }
}

/** Builds a complete pose from resolved local angles and positions. */
function buildPoseFromAngles(
  angles: ReadonlyMap<string, BoneAngles>,
  state: ReadonlyMap<string, BoneState>,
): Map<Object3D, AvatarPoseTransform> {
  const result = new Map<Object3D, AvatarPoseTransform>()
  for (const [name, boneState] of state) {
    const values = angles.get(name)
    const rotation = {
      x: values?.x ?? boneState.restRotation.x,
      y: values?.y ?? boneState.restRotation.y,
      z: values?.z ?? boneState.restRotation.z,
    }
    const quaternion = new Quaternion().setFromEuler(new Euler(
      rotation.x,
      rotation.y,
      rotation.z,
      boneState.bone.rotation.order,
    ))
    result.set(boneState.bone, {
      position: {
        x: values?.px ?? boneState.restPosition.x,
        y: values?.py ?? boneState.restPosition.y,
        z: values?.pz ?? boneState.restPosition.z,
      },
      quaternion: readQuaternion(quaternion),
      scale: { ...boneState.restScale },
    })
  }
  return result
}

/** Applies one partial catalog transform on top of a complete pose. */
function applyAngles(
  pose: Map<Object3D, AvatarPoseTransform>,
  state: BoneState,
  values: BoneAngles,
): void {
  const current = pose.get(state.bone) ?? readTransform(state.bone)
  const currentQuaternion = current.quaternion ?? readQuaternion(state.bone)
  const euler = new Euler().setFromQuaternion(
    new Quaternion(
      currentQuaternion.x,
      currentQuaternion.y,
      currentQuaternion.z,
      currentQuaternion.w,
    ),
    state.bone.rotation.order,
  )
  if (values.x !== undefined) euler.x = values.x
  if (values.y !== undefined) euler.y = values.y
  if (values.z !== undefined) euler.z = values.z

  const position = current.position ?? state.restPosition
  pose.set(state.bone, {
    ...current,
    position: {
      x: values.px ?? position.x,
      y: values.py ?? position.y,
      z: values.pz ?? position.z,
    },
    quaternion: readQuaternion(new Quaternion().setFromEuler(euler)),
  })
}

/** Clones a semantic pose without retaining mutable transform values. */
function clonePose(source: AvatarPose): Map<Object3D, AvatarPoseTransform> {
  const result = new Map<Object3D, AvatarPoseTransform>()
  for (const [bone, transform] of source) {
    result.set(bone, cloneTransform(transform))
  }
  return result
}

/** Clones one semantic transform. */
function cloneTransform(value: AvatarPoseTransform): AvatarPoseTransform {
  return {
    ...(value.position === undefined ? {} : { position: { ...value.position } }),
    ...(value.quaternion === undefined ? {} : { quaternion: { ...value.quaternion } }),
    ...(value.scale === undefined ? {} : { scale: { ...value.scale } }),
  }
}

/** Creates an absolute semantic transition without retaining a mutable frame state. */
function createTransition(
  source: AvatarPose,
  target: AvatarPose,
  startAt: number,
  durationMs: number,
  intermediate?: AvatarPose,
): PoseTransition {
  return {
    source,
    target,
    startAt,
    durationMs: Math.max(0, durationMs),
    ...(intermediate === undefined ? {} : {
      intermediate: {
        pose: intermediate,
        durationMs: INTERMEDIATE_POSE_TRANSITION_MS,
      },
    }),
  }
}

/** Creates a transition limited to the bones owned by a gesture layer. */
function createGestureTransition(
  source: AvatarPose,
  target: AvatarPose,
  startAt: number,
  durationMs: number,
  bones: ReadonlySet<Object3D>,
): GestureTransition {
  return {
    ...createTransition(
      selectPose(source, bones),
      selectPose(target, bones),
      startAt,
      durationMs,
    ),
    bones: new Set(bones),
  }
}

/** Selects and clones only the transforms owned by one semantic layer. */
function selectPose(pose: AvatarPose, bones: ReadonlySet<Object3D>): AvatarPose {
  const result = new Map<Object3D, AvatarPoseTransform>()
  for (const bone of bones) {
    const transform = pose.get(bone)
    if (transform !== undefined) result.set(bone, cloneTransform(transform))
  }
  return result
}

/** Samples one absolute transition, including the TH kneeling waypoint. */
function sampleTransition(transition: PoseTransition, timeMs: number): AvatarPose {
  const intermediate = transition.intermediate
  if (intermediate !== undefined) {
    const intermediateEnd = transition.startAt + intermediate.durationMs
    if (timeMs < intermediateEnd) {
      const progress = clamp((timeMs - transition.startAt) / intermediate.durationMs)
      return interpolatePose(
        transition.source,
        intermediate.pose,
        sampleTalkingHeadEasing(progress),
      )
    }
    const progress = resolveTransitionProgress({
      ...transition,
      startAt: intermediateEnd,
    }, timeMs)
    if (progress >= 1) return clonePose(transition.target)
    return interpolatePose(
      intermediate.pose,
      transition.target,
      sampleTalkingHeadEasing(progress),
    )
  }
  const progress = resolveTransitionProgress(transition, timeMs)
  if (progress >= 1) return clonePose(transition.target)
  return interpolatePose(
    transition.source,
    transition.target,
    sampleTalkingHeadEasing(progress),
  )
}

/** Resolves the linear progress of one absolute semantic transition. */
function resolveTransitionProgress(transition: PoseTransition, timeMs: number): number {
  if (transition.durationMs === 0) return 1
  return clamp((timeMs - transition.startAt) / transition.durationMs)
}

/** Interpolates every bone transform between two semantic snapshots. */
function interpolatePose(source: AvatarPose, target: AvatarPose, progress: number): AvatarPose {
  const result = new Map<Object3D, AvatarPoseTransform>()
  const bones = new Set([...source.keys(), ...target.keys()])
  for (const bone of bones) {
    const from = source.get(bone) ?? readTransform(bone)
    const to = target.get(bone) ?? from
    result.set(bone, {
      position: interpolateVector(from.position, to.position, progress),
      quaternion: interpolateQuaternion(from.quaternion, to.quaternion, progress),
      scale: interpolateVector(from.scale, to.scale, progress),
    })
  }
  return result
}

/** Interpolates one optional vector while retaining the available source value. */
function interpolateVector(
  source: AvatarVector3 | undefined,
  target: AvatarVector3 | undefined,
  progress: number,
): AvatarVector3 | undefined {
  if (source === undefined) return target === undefined ? undefined : { ...target }
  if (target === undefined) return { ...source }
  return {
    x: source.x + (target.x - source.x) * progress,
    y: source.y + (target.y - source.y) * progress,
    z: source.z + (target.z - source.z) * progress,
  }
}

/** Spherically interpolates one optional quaternion. */
function interpolateQuaternion(
  source: Readonly<{ x: number; y: number; z: number; w: number }> | undefined,
  target: Readonly<{ x: number; y: number; z: number; w: number }> | undefined,
  progress: number,
): Readonly<{ x: number; y: number; z: number; w: number }> | undefined {
  if (source === undefined) return target === undefined ? undefined : { ...target }
  if (target === undefined) return { ...source }
  const quaternion = new Quaternion(source.x, source.y, source.z, source.w)
  quaternion.slerp(new Quaternion(target.x, target.y, target.z, target.w), progress)
  return readQuaternion(quaternion)
}

/** Reads a native vector into an immutable Avatar value. */
function readVector(value: Readonly<{ x: number; y: number; z: number }>): AvatarVector3 {
  return { x: value.x, y: value.y, z: value.z }
}

/** Reads an Object3D or Quaternion into an immutable Avatar quaternion. */
function readQuaternion(value: Readonly<{ quaternion?: Quaternion; x?: number; y?: number; z?: number; w?: number }>): Readonly<{ x: number; y: number; z: number; w: number }> {
  const quaternion = value.quaternion ?? value
  return {
    x: quaternion.x ?? 0,
    y: quaternion.y ?? 0,
    z: quaternion.z ?? 0,
    w: quaternion.w ?? 1,
  }
}

/** Captures one complete native transform as a fallback semantic value. */
function readTransform(bone: Object3D): AvatarPoseTransform {
  return {
    position: readVector(bone.position),
    quaternion: readQuaternion(bone),
    scale: readVector(bone.scale),
  }
}

/** Splits one catalog key into its bone name. */
function boneNameFromKey(key: string): string {
  return key.slice(0, key.lastIndexOf('.'))
}

/** Splits one catalog key into its property name. */
function propertyFromKey(key: string): string {
  return key.slice(key.lastIndexOf('.') + 1)
}

/** Swaps left and right in one TalkingHead bone name. */
function mirrorBoneName(name: string): string {
  return name
    .replaceAll('Left', '__MIRROR_RIGHT__')
    .replaceAll('Right', 'Left')
    .replaceAll('__MIRROR_RIGHT__', 'Right')
}

/** Mirrors a template rotation with TalkingHead's quaternion convention. */
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

/** Clamps one normalized transition ratio. */
function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/** Merges two additive bone layers without allowing either to write bones. */
function mergePoseDeltas(
  first: AvatarPoseDelta,
  second: AvatarPoseDelta,
): AvatarPoseDelta {
  if (second.size === 0) return first
  const result = new Map<Object3D, {
    rotation?: AvatarVector3
    position?: AvatarVector3
    scale?: AvatarVector3
  }>()
  for (const [bone, value] of [...first, ...second]) {
    const current = result.get(bone)
    if (current === undefined) {
      result.set(bone, {
        ...(value.rotation === undefined ? {} : { rotation: { ...value.rotation } }),
        ...(value.position === undefined ? {} : { position: { ...value.position } }),
        ...(value.scale === undefined ? {} : { scale: { ...value.scale } }),
      })
      continue
    }
    result.set(bone, {
      rotation: addVector(current.rotation, value.rotation),
      position: addVector(current.position, value.position),
      scale: addVector(current.scale, value.scale),
    })
  }
  return result
}

/** Adds two optional vectors while keeping absent channels absent. */
function addVector(
  first: AvatarVector3 | undefined,
  second: AvatarVector3 | undefined,
): AvatarVector3 | undefined {
  if (first === undefined) return second === undefined ? undefined : { ...second }
  if (second === undefined) return { ...first }
  return {
    x: first.x + second.x,
    y: first.y + second.y,
    z: first.z + second.z,
  }
}

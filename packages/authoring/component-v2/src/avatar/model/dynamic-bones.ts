/**
 * TalkingHead DynamicBones adapted to Avatar V2.
 *
 * The native module uses a velocity-Verlet spring and writes directly to the
 * skeleton. Avatar V2 keeps the simulation, but returns local position and
 * rotation deltas to AvatarPoseComposer so the model still has one skeletal
 * writer. The author-facing concepts remain the native five types, limits,
 * pivots, offsets and exclusion volumes.
 */
import { Euler, Matrix4, Quaternion, Vector3 } from 'three'
import type { Object3D } from 'three'
import type {
  AvatarDynamicBoneConfig,
  AvatarDynamicBoneOptions,
  AvatarDynamicBoneType,
  AvatarPoseDelta,
  AvatarVector3,
} from '../avatar-types.js'
type ResolvedExclude = Readonly<{
  bone: Object3D
  radius: number
  deltaLocal?: readonly [number, number, number]
}>

type DynamicState = {
  readonly config: AvatarDynamicBoneConfig
  readonly bone: Object3D
  readonly parent: Object3D | null
  readonly restPosition: Vector3
  readonly length: number
  readonly previousParentWorld: Vector3
  readonly offsets: [number, number, number, number]
  readonly velocity: [number, number, number, number]
  readonly externalVelocity: [number, number, number, number]
  readonly exclusions: readonly ResolvedExclude[]
  children: DynamicState[]
  initialized: boolean
}

type DynamicDelta = {
  rotation?: AvatarVector3
  position?: AvatarVector3
}

const DEFAULT_STIFFNESS = 60
const DEFAULT_DAMPING = 12
const MAX_PARENT_MOVEMENT = 0.5

/** Runs the optional dynamic-bone layer without creating a second pose writer. */
export class AvatarDynamicBones {
  private readonly states: DynamicState[]
  private readonly delta = new Map<Object3D, DynamicDelta>()
  private readonly options: Required<AvatarDynamicBoneOptions>
  private warmupElapsedMs = 0

  private readonly root: Object3D

  /** Creates one simulator for the configured bones present in the model. */
  constructor(
    root: Object3D,
    boneMap: ReadonlyMap<string, Object3D>,
    configs: readonly AvatarDynamicBoneConfig[] = [],
    options: AvatarDynamicBoneOptions = {},
  ) {
    this.root = root
    this.options = resolveOptions(options)
    this.states = configs.flatMap((config) => {
      const bone = boneMap.get(config.bone)
      if (bone === undefined) return []
      return [createState(config, bone, boneMap)]
    })
    this.states.sort((left, right) => boneDepth(left.bone) - boneDepth(right.bone))
    for (const state of this.states) {
      state.children = this.states.filter((child) => child.parent === state.bone)
    }
  }

  /** Advances all configured springs and prepares the next composer delta. */
  update(deltaMs: number): void {
    this.delta.clear()
    if (this.states.length === 0 || !Number.isFinite(deltaMs) || deltaMs <= 0) return
    if (deltaMs > 1_000) this.warmupElapsedMs = 0
    else this.warmupElapsedMs += deltaMs

    this.step(deltaMs)
  }

  /** Advances one native integration step, preserving TH's child coupling. */
  private step(deltaMs: number): void {
    this.root.updateMatrixWorld(true)
    const step = deltaMs / 1_000
    for (const state of this.states) {
      const parent = state.parent
      if (parent === null) continue

      parent.updateWorldMatrix(true, false)
      parent.getWorldPosition(currentParentWorld)
      if (!state.initialized) {
        state.previousParentWorld.copy(currentParentWorld)
        state.initialized = true
        continue
      }

      const inverseParent = inverseParentWorld.copy(parent.matrixWorld).invert()
      const localPrevious = previousParentLocal.copy(state.previousParentWorld).applyMatrix4(inverseParent)
      state.previousParentWorld.copy(currentParentWorld)

      const movement = localPrevious.applyQuaternion(currentBoneQuaternion.copy(state.bone.quaternion))
      if (movement.length() > MAX_PARENT_MOVEMENT) movement.setLength(MAX_PARENT_MOVEMENT)

      const external = finiteOr(state.config.external, 1) * this.options.sensitivityFactor
      const force = [
        movement.x * external,
        movement.y * external,
        -movement.z * external,
        movement.length() / 3 * external,
      ]
      for (const child of state.children) {
        force[0] -= child.velocity[0]! * step / 3
        force[1] -= child.velocity[1]! * step / 3
        force[2] += child.velocity[2]! * step / 3
        force[3] -= child.velocity[3]! * step / 3
      }

      const stiffness = resolveSpring(state.config.stiffness, DEFAULT_STIFFNESS)
      const damping = resolveSpring(state.config.damping, DEFAULT_DAMPING)
      const flags = resolveType(state.config.type ?? 'full')

      integrateAxis(state, 0, force[0]!, flags.x, stiffness[0], damping[0], step)
      integrateAxis(state, 1, force[1]!, flags.y, stiffness[1], damping[1], step)
      integrateAxis(state, 2, force[2]!, flags.z, stiffness[2], damping[2], step)
      integrateAxis(state, 3, force[3]!, flags.twist, stiffness[3], damping[3], step)

      if (this.warmupElapsedMs < this.options.warmupMs) dampWarmup(state)

      const offsets = resolveOffsets(state, parent, this.options)
      if (this.options.isLimits) applyLimits(offsets, state.config.limits)
      const exclusions = this.options.isExcludes
        ? resolveExclusionRotation(state, parent, offsets)
        : null
      for (const [bone, contribution] of createDeltas(state, offsets, exclusions, this.options)) {
        mergeDelta(this.delta, bone, contribution)
      }
    }
  }

  /** Clears transient spring velocity and removes all dynamic offsets. */
  reset(): void {
    this.delta.clear()
    this.warmupElapsedMs = 0
    for (const state of this.states) {
      state.offsets.fill(0)
      state.velocity.fill(0)
      state.externalVelocity.fill(0)
      if (state.parent !== null) state.parent.getWorldPosition(state.previousParentWorld)
      state.initialized = false
    }
  }

  /** Returns the current additive contribution for AvatarPoseComposer. */
  getDelta(): AvatarPoseDelta {
    return this.delta
  }
}

const currentParentWorld = new Vector3()
const previousParentLocal = new Vector3()
const inverseParentWorld = new Matrix4()
const currentBoneQuaternion = new Quaternion()
const exclusionCenter = new Vector3()
const targetWorld = new Vector3()
const exclusionOffset = new Vector3()
const dynamicPosition = new Vector3()
const dynamicRotation = new Quaternion()
const exclusionNormal = new Vector3()
const circleCenter = new Vector3()
const exclusionPoint = new Vector3()
const exclusionDirection = new Vector3()
const currentDirection = new Vector3()
const targetDirection = new Vector3()
const exclusionStepRotation = new Quaternion()
const dynamicAxisRotation = new Quaternion()
const axisX = new Vector3(1, 0, 0)
const axisY = new Vector3(0, 1, 0)
const axisZ = new Vector3(0, 0, 1)

/** Creates a spring state from the model's current rest transform. */
function createState(
  config: AvatarDynamicBoneConfig,
  bone: Object3D,
  boneMap: ReadonlyMap<string, Object3D>,
): DynamicState {
  const parent = bone.parent
  return {
    config,
    bone,
    parent,
    restPosition: bone.position.clone(),
    length: Math.max(0.001, bone.position.length()),
    previousParentWorld: new Vector3(),
    offsets: [0, 0, 0, 0],
    velocity: [0, 0, 0, 0],
    externalVelocity: [0, 0, 0, 0],
    exclusions: (config.excludes ?? []).flatMap((item) => {
      const excludeBone = boneMap.get(item.bone)
      if (excludeBone === undefined) return []
      return [{
        bone: excludeBone,
        radius: Math.max(0, finiteOr(item.radius, 0)),
        ...(item.deltaLocal === undefined ? {} : { deltaLocal: item.deltaLocal }),
      }]
    }),
    children: [],
    initialized: false,
  }
}

/** Returns the hierarchy depth used to update parent dynamic bones first. */
function boneDepth(bone: Object3D): number {
  let depth = 0
  let current = bone.parent
  while (current !== null) {
    depth += 1
    current = current.parent
  }
  return depth
}

/** Resolves the native simulator switches without changing authored values. */
function resolveOptions(options: AvatarDynamicBoneOptions): Required<AvatarDynamicBoneOptions> {
  return {
    warmupMs: Math.max(0, finiteOr(options.warmupMs, 2_000)),
    sensitivityFactor: finiteOr(options.sensitivityFactor, 1),
    movementFactor: finiteOr(options.movementFactor, 1),
    isExcludes: options.isExcludes ?? true,
    isPivots: options.isPivots ?? true,
    isLimits: options.isLimits ?? true,
  }
}

/** Captures the current yaw-free pivot correction used by TalkingHead links. */
function calculatePivotCorrection(parent: Object3D): Quaternion {
  const world = new Quaternion()
  const forwardWorld = new Vector3(0, 0, 1)
  const projected = new Vector3()
  const removeYaw = new Quaternion()
  const noYawWorld = new Quaternion()
  const localCorrection = new Quaternion()

  parent.getWorldQuaternion(world)
  projected.copy(forwardWorld).applyQuaternion(world).setY(0)
  if (projected.lengthSq() < 1e-8) return localCorrection.identity()
  projected.normalize()
  removeYaw.setFromUnitVectors(forwardWorld, projected).invert()
  noYawWorld.copy(removeYaw).multiply(world)
  localCorrection.copy(world).invert().multiply(noYawWorld)
  return localCorrection.normalize()
}

/** Resolves the axis channels enabled by TalkingHead's five modes. */
function resolveType(type: AvatarDynamicBoneType): Readonly<{
  x: boolean
  y: boolean
  z: boolean
  twist: boolean
}> {
  if (type === 'point') return { x: true, y: true, z: true, twist: false }
  if (type === 'link') return { x: true, y: false, z: true, twist: false }
  if (type === 'mix1') return { x: true, y: true, z: true, twist: false }
  if (type === 'mix2') return { x: true, y: false, z: true, twist: true }
  return { x: true, y: true, z: true, twist: true }
}

/** Expands one scalar/vector spring parameter to x/y/z/twist channels. */
function resolveSpring(
  value: number | readonly [number, number, number, number] | undefined,
  fallback: number,
): readonly [number, number, number, number] {
  if (Array.isArray(value)) {
    return value.map((item) => Math.max(0, finiteOr(item, fallback))) as [number, number, number, number]
  }
  const scalar = Math.max(0, finiteOr(typeof value === 'number' ? value : undefined, fallback))
  return [scalar, scalar, scalar, scalar]
}

/** Performs one velocity-Verlet spring step, matching DynamicBones. */
function integrateAxis(
  state: DynamicState,
  axis: 0 | 1 | 2 | 3,
  externalForce: number,
  enabled: boolean,
  stiffness: number,
  damping: number,
  step: number,
): void {
  if (!enabled) {
    state.offsets[axis] = 0
    state.velocity[axis] = 0
    state.externalVelocity[axis] = 0
    return
  }

  const externalVelocity = externalForce / step
  const externalAcceleration = (externalVelocity - state.externalVelocity[axis]!) / step
  state.externalVelocity[axis] = externalVelocity

  const acceleration = -stiffness * state.offsets[axis]! - damping * state.velocity[axis]! - externalAcceleration
  state.offsets[axis] += state.velocity[axis]! * step + acceleration * step * step / 2 + externalForce
  const predictedVelocity = state.velocity[axis]! + acceleration * step / 2
  const nextAcceleration = -stiffness * state.offsets[axis]! - damping * predictedVelocity - externalAcceleration
  state.velocity[axis] += (nextAcceleration + acceleration) * step / 2
}

/** Suppresses startup overshoot during the native warm-up interval. */
function dampWarmup(state: DynamicState): void {
  for (let index = 0; index < state.offsets.length; index += 1) {
    state.offsets[index] = state.offsets[index]! * 0.0001
    state.velocity[index] = state.velocity[index]! * 0.0001
  }
}

/** Adds local/world offsets after applying the native global movement factor. */
function resolveOffsets(
  state: DynamicState,
  parent: Object3D,
  options: Required<AvatarDynamicBoneOptions>,
): [number, number, number, number] {
  const movementFactor = options.movementFactor * finiteOr(state.config.movementFactor, 1)
  const result: [number, number, number, number] = [
    state.offsets[0]! * movementFactor,
    state.offsets[1]! * movementFactor,
    state.offsets[2]! * movementFactor,
    state.offsets[3]! * movementFactor,
  ]
  const local = state.config.deltaLocal
  if (local !== undefined) {
    result[0] += local[0] ?? 0
    result[1] += local[1] ?? 0
    result[2] += local[2] ?? 0
  }

  const world = state.config.deltaWorld
  if (world !== undefined) {
    parent.updateWorldMatrix(true, false)
    targetWorld.set(
      state.restPosition.x + result[0]!,
      state.restPosition.y + result[1]!,
      state.restPosition.z + result[2]!,
    ).applyMatrix4(parent.matrixWorld)
    targetWorld.x += world[0] ?? 0
    targetWorld.y += world[1] ?? 0
    targetWorld.z += world[2] ?? 0
    targetWorld.applyMatrix4(inverseParentWorld.copy(parent.matrixWorld).invert())
    result[0] += targetWorld.x - state.restPosition.x - result[0]!
    result[1] += targetWorld.y - state.restPosition.y - result[1]!
    result[2] += targetWorld.z - state.restPosition.z - result[2]!
  }

  return result
}

/** Computes the native exclusion-circle correction for one link bone. */
function resolveExclusionRotation(
  state: DynamicState,
  parent: Object3D,
  result: [number, number, number, number],
): Quaternion | null {
  if (state.exclusions.length === 0 || state.config.type === 'point') return null
  parent.updateWorldMatrix(true, false)
  const inverseParent = inverseParentWorld.copy(parent.matrixWorld).invert()
  const lengthDelta = Math.tanh(result[1]! / (state.length / 3)) * state.length / 3
  dynamicPosition.copy(state.restPosition)
  dynamicPosition.setLength(Math.max(0.001, state.length + lengthDelta))
  createDynamicRotation(result, dynamicRotation, state.length)
  dynamicPosition.applyQuaternion(dynamicRotation)
  let correction: Quaternion | null = null

  for (const exclusion of state.exclusions) {
    exclusion.bone.updateWorldMatrix(true, false)
    exclusion.bone.getWorldPosition(exclusionCenter)
    const offset = exclusion.deltaLocal
    if (offset !== undefined) {
      exclusionOffset.set(offset[0] ?? 0, offset[1] ?? 0, offset[2] ?? 0)
      exclusionCenter.add(exclusionOffset.applyMatrix4(exclusion.bone.matrixWorld))
    }
    exclusionCenter.applyMatrix4(inverseParent)
    const boneLength = dynamicPosition.length()
    const centerLength = exclusionCenter.length()
    if (dynamicPosition.distanceToSquared(exclusionCenter) >= exclusion.radius * exclusion.radius) continue
    if (centerLength <= 1e-8 || centerLength > exclusion.radius + boneLength
      || centerLength < Math.abs(exclusion.radius - boneLength)) continue

    const circleCenterDistance = (centerLength * centerLength + boneLength * boneLength
      - exclusion.radius * exclusion.radius) / (2 * centerLength)
    exclusionNormal.copy(exclusionCenter).normalize()
    circleCenter.copy(exclusionNormal).multiplyScalar(circleCenterDistance)
    const circleRadius = Math.sqrt(Math.max(0, boneLength * boneLength - circleCenterDistance * circleCenterDistance))
    exclusionPoint.subVectors(dynamicPosition, circleCenter)
      .projectOnPlane(exclusionNormal)
    if (exclusionPoint.lengthSq() <= 1e-8) continue
    exclusionPoint.normalize().multiplyScalar(circleRadius)

    exclusionDirection.subVectors(state.restPosition, circleCenter)
      .projectOnPlane(exclusionNormal)
    if (exclusionDirection.lengthSq() <= 1e-8) continue
    exclusionDirection.normalize()
    if (exclusionDirection.dot(exclusionPoint) < 0) {
      exclusionDirection.multiplyScalar(Math.sqrt(Math.max(0, circleRadius * circleRadius
        - exclusionDirection.dot(exclusionPoint) ** 2)))
      exclusionPoint.add(exclusionDirection)
    }

    targetDirection.copy(exclusionPoint).add(circleCenter).normalize()
    currentDirection.copy(dynamicPosition).normalize()
    exclusionStepRotation.setFromUnitVectors(currentDirection, targetDirection)
    correction = correction === null
      ? exclusionStepRotation.clone()
      : exclusionStepRotation.clone().multiply(correction)
    dynamicPosition.copy(state.restPosition).applyQuaternion(correction)
  }
  return correction
}

/** Converts simulated offsets to additive deltas consumed by AvatarPoseComposer. */
function createDeltas(
  state: DynamicState,
  offsets: readonly [number, number, number, number],
  exclusionRotation: Quaternion | null,
  options: Required<AvatarDynamicBoneOptions>,
): readonly [Object3D, DynamicDelta][] {
  if (state.config.type === 'point') {
    const target = state.restPosition.clone().add(new Vector3(
      offsets[0]!,
      offsets[1]!,
      -offsets[2]!,
    ))
    target.sub(state.bone.position)
    return [[state.bone, {
      position: { x: target.x, y: target.y, z: target.z },
    }]]
  }

  const rotation = createDynamicRotation(offsets, dynamicRotation, state.length)
  if (state.config.pivot && options.isPivots && state.parent !== null) {
    rotation.premultiply(calculatePivotCorrection(state.parent))
  }
  if (exclusionRotation !== null) rotation.premultiply(exclusionRotation)
  const rotationEuler = new Euler().setFromQuaternion(rotation, state.parent?.rotation.order ?? 'XYZ')
  const deltas: [Object3D, DynamicDelta][] = [[state.parent!, {
    rotation: {
      x: rotationEuler.x,
      y: rotationEuler.y,
      z: rotationEuler.z,
    },
  }]]

  if (offsets[1] !== 0) {
    const scale = Math.tanh(offsets[1] / (state.length / 3)) * state.length / 3
    const direction = state.bone.position.lengthSq() > 1e-8
      ? state.bone.position.clone().normalize()
      : state.restPosition.clone().normalize()
    const target = direction.multiplyScalar(state.length + scale).sub(state.bone.position)
    deltas.push([state.bone, {
      position: {
        x: target.x,
        y: target.y,
        z: target.z,
      },
    }])
  }
  return deltas
}

/** Creates the native dynamic rotation from x/z displacement and twist. */
function createDynamicRotation(
  offsets: readonly [number, number, number, number],
  target: Quaternion,
  length: number,
): Quaternion {
  const safeLength = Math.max(0.001, length)
  target.identity()

  // TalkingHead applies the three rotations in this order. Euler conversion
  // is not equivalent here because each rotation is evaluated in the updated
  // parent frame.
  dynamicAxisRotation.setFromAxisAngle(axisZ, -Math.atan(offsets[0]! / safeLength))
  target.multiply(dynamicAxisRotation)
  dynamicAxisRotation.setFromAxisAngle(axisX, -Math.atan(offsets[2]! / safeLength))
  target.multiply(dynamicAxisRotation)
  dynamicAxisRotation.setFromAxisAngle(axisY, -1.5 * Math.tanh(offsets[3]! * 1.5))
  target.multiply(dynamicAxisRotation)
  return target
}

/** Merges dynamic contributions when parent and child simulations share a bone. */
function mergeDelta(
  target: Map<Object3D, DynamicDelta>,
  bone: Object3D,
  next: DynamicDelta,
): void {
  const current = target.get(bone)
  if (current === undefined) {
    target.set(bone, next)
    return
  }
  target.set(bone, {
    rotation: addVector(current.rotation, next.rotation),
    position: addVector(current.position, next.position),
  })
}

/** Adds two optional Avatar vectors without allocating absent channels. */
function addVector(
  first: AvatarVector3 | undefined,
  second: AvatarVector3 | undefined,
): AvatarVector3 | undefined {
  if (first === undefined) return second
  if (second === undefined) return first
  return {
    x: first.x + second.x,
    y: first.y + second.y,
    z: first.z + second.z,
  }
}

/** Applies the four optional TH limits to the simulated channels. */
function applyLimits(
  offsets: [number, number, number, number],
  limits: AvatarDynamicBoneConfig['limits'],
): void {
  if (limits === undefined) return
  for (let index = 0; index < Math.min(4, limits.length); index += 1) {
    const limit = limits[index]
    if (limit === null || limit === undefined) continue
    const lower = limit[0] ?? -Infinity
    const upper = limit[1] ?? Infinity
    offsets[index] = Math.max(lower, Math.min(upper, offsets[index]!))
  }
}

/** Uses a finite authored number while preserving the absence of a value. */
function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

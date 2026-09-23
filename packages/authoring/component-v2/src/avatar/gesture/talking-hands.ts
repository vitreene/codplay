/** TalkingHead speaking-hands planner, kept behind the Avatar gesture engine. */
import { Euler, Object3D, Quaternion, Vector3 } from 'three'
import type {
  AvatarPose,
  AvatarPoseDelta,
  AvatarPoseTransform,
  AvatarHandTarget,
  RandomSource,
  TalkingHandsOptions,
} from '../avatar-types.js'
import { createRandomSource, sampleTemplateNumber } from '../idle/th-animation-template.js'
import { sampleTalkingHeadEasing } from '../avatar-easing.js'

type HandSide = 'Left' | 'Right'

type CcdLink = Readonly<{
  name: string
  min: Vector3
  max: Vector3
  maxAngle?: number
}>

type VirtualChain = Readonly<{
  top: Object3D
  root: Object3D
  effector: Object3D
  links: readonly { source: Object3D; virtual: Object3D; limits: CcdLink }[]
}>

type Phrase = Readonly<{
  firstAt: number
  secondAt: number
  target: AvatarPose
}>

const PHRASE_CYCLE_MS = 7_000
const FIRST_MOVE_MS = 1_000
const RETURN_MOVE_MS = 2_000
const IK_ITERATIONS = 20

/**
 * Computes TH speaking-hands deltas from virtual bones.
 *
 * The virtual chain is rebuilt from the sampled semantic pose, so the solver
 * never mutates the loaded skeleton. The returned deltas are later composed by
 * AvatarPoseComposer with every other Avatar layer.
 */
export class TalkingHandsPlanner {
  private readonly bones: ReadonlyMap<string, Object3D>
  private cachedCycle = -1
  private cachedSeed = 0
  private cachedProbability = -1
  private cachedPhrase: Phrase | null = null

  /** Retains the loaded bone map without taking ownership of its transforms. */
  constructor(bones: ReadonlyMap<string, Object3D>) {
    this.bones = bones
  }

  /** Samples one absolute speaking-hands phrase. */
  sample(
    elapsedMs: number,
    pose: AvatarPose,
    options: TalkingHandsOptions,
  ): AvatarPoseDelta {
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return new Map()

    const cycle = Math.floor(elapsedMs / PHRASE_CYCLE_MS)
    const needsPhrase = cycle !== this.cachedCycle
      || options.seed !== this.cachedSeed
      || options.probability !== this.cachedProbability
    if (needsPhrase && !options.enabled) return new Map()
    if (needsPhrase) {
      this.cachedCycle = cycle
      this.cachedSeed = options.seed
      this.cachedProbability = options.probability
      const random = createRandomSource(seedForCycle(options.seed, cycle))
      this.cachedPhrase = random.random() > clamp(options.probability)
        ? null
        : this.createPhrase(pose, random)
    }

    const phrase = this.cachedPhrase
    if (phrase === null) return new Map()
    const phase = elapsedMs - cycle * PHRASE_CYCLE_MS
    const movement = resolvePhraseMovement(phase, phrase)
    if (movement === null) return new Map()

    return createRelativeDeltas(pose, phrase.target, movement.progress, movement.returning)
  }

  /** Samples explicit TH hand tasks such as the native thinking emoji. */
  sampleExplicitTargets(
    timeMs: number,
    pose: AvatarPose,
    targets: readonly AvatarHandTarget[],
  ): AvatarPoseDelta {
    const result = new Map<Object3D, { rotation: { x: number; y: number; z: number } }>()
    for (const target of targets) {
      const elapsed = timeMs - target.startAt
      if (elapsed < 0) continue
      const solved = this.solveExplicitTarget(target.side, pose, target.position)
      const progress = target.release
        ? 1 - ease(elapsed, target.durationMs)
        : ease(elapsed, target.durationMs)
      for (const [bone, delta] of solved) {
        const current = result.get(bone)
        const rotation = {
          x: delta.rotation?.x ?? 0,
          y: delta.rotation?.y ?? 0,
          z: delta.rotation?.z ?? 0,
        }
        result.set(bone, {
          rotation: current === undefined
            ? {
                x: rotation.x * progress,
                y: rotation.y * progress,
                z: rotation.z * progress,
              }
            : {
                x: current.rotation.x + rotation.x * progress,
                y: current.rotation.y + rotation.y * progress,
                z: current.rotation.z + rotation.z * progress,
              },
        })
      }
    }
    return result
  }

  /** Resolves both hand targets and the two TH move timestamps. */
  private createPhrase(pose: AvatarPose, random: RandomSource): Phrase {
    const firstAt = Math.round(sampleTemplateNumber([100, 600], random))
    const secondAt = firstAt + Math.round(sampleTemplateNumber([1_000, 1_500], random))
    const left = this.solveHand('Left', pose, random)
    const right = this.solveHand('Right', pose, random)
    return {
      firstAt,
      secondAt,
      target: createTargetPose(pose, mergeDeltas(left, right)),
    }
  }

  /** Solves one arm chain and converts the result to local additive deltas. */
  private solveHand(side: HandSide, pose: AvatarPose, random: RandomSource): AvatarPoseDelta {
    const chain = createVirtualChain(side, this.bones, pose)
    if (chain === null) return new Map()

    const target = createHandTarget(side, chain.root, chain.top, random)
    solveCcd(chain, target)

    const result = new Map<Object3D, { rotation: { x: number; y: number; z: number } }>()
    for (const link of chain.links) {
      const transform = pose.get(link.source)
      if (transform?.quaternion === undefined) continue

      let solved = link.virtual.quaternion.clone()
      if (link.source.name === `${side}Hand`) {
        const twist = side === 'Left'
          ? -1 - sampleTemplateNumber([0, 1], random)
          : 1 + sampleTemplateNumber([0, 1], random)
        solved = new Quaternion()
          .setFromEuler(new Euler(0, twist, 0, link.source.rotation.order))
          .premultiply(solved)
      }

      const base = new Quaternion(
        transform.quaternion.x,
        transform.quaternion.y,
        transform.quaternion.z,
        transform.quaternion.w,
      )
      const delta = base.clone().invert().multiply(solved).normalize()
      const euler = new Euler().setFromQuaternion(delta, link.source.rotation.order)
      result.set(link.source, { rotation: { x: euler.x, y: euler.y, z: euler.z } })
    }
    return result
  }

  /** Solves one explicit local target without adding a speaking-hand twist. */
  private solveExplicitTarget(
    side: HandSide,
    pose: AvatarPose,
    position: Readonly<{ x: number; y: number; z: number }>,
  ): AvatarPoseDelta {
    const chain = createVirtualChain(side, this.bones, pose)
    if (chain === null) return new Map()

    const target = createExplicitHandTarget(side, chain.root, chain.top, position)
    solveCcd(chain, target)
    return readSolvedDeltas(chain, pose)
  }
}

/** Builds the isolated shoulder-to-finger chain used by the CCD solver. */
function createVirtualChain(
  side: HandSide,
  bones: ReadonlyMap<string, Object3D>,
  pose: AvatarPose,
): VirtualChain | null {
  const names = [
    `${side}Shoulder`,
    `${side}Arm`,
    `${side}ForeArm`,
    `${side}Hand`,
    `${side}HandMiddle1`,
  ]
  const sources = names.map((name) => bones.get(name) ?? null)
  if (sources.some((bone) => bone === null)) return null

  const sourceEffector = sources[4]!
  const sourceTop = findTopAncestor(sourceEffector)
  const path: Object3D[] = []
  let cursor: Object3D | null = sourceEffector
  while (cursor !== null) {
    path.unshift(cursor)
    if (cursor === sourceTop) break
    cursor = cursor.parent
  }
  if (path[0] !== sourceTop) return null

  const virtualBySource = new Map<Object3D, Object3D>()
  let parent: Object3D | null = null
  for (const source of path) {
    const virtual = new Object3D()
    virtual.name = source.name
    copyLocalTransform(source, virtual, pose.get(source))
    if (parent === null) virtual.updateMatrixWorld(true)
    else parent.add(virtual)
    virtualBySource.set(source, virtual)
    parent = virtual
  }

  const root = virtualBySource.get(sources[0]!)
  const effector = virtualBySource.get(sourceEffector)
  if (root === undefined || effector === undefined) return null

  return {
    top: virtualBySource.get(sourceTop)!,
    root,
    effector,
    links: createCcdLinks(side, sources, virtualBySource),
  }
}

/** Copies one semantic local transform into a virtual Three object. */
function copyLocalTransform(
  source: Object3D,
  target: Object3D,
  transform: AvatarPoseTransform | undefined,
): void {
  const position = transform?.position
  const quaternion = transform?.quaternion
  const scale = transform?.scale
  target.position.set(
    position?.x ?? source.position.x,
    position?.y ?? source.position.y,
    position?.z ?? source.position.z,
  )
  target.quaternion.set(
    quaternion?.x ?? source.quaternion.x,
    quaternion?.y ?? source.quaternion.y,
    quaternion?.z ?? source.quaternion.z,
    quaternion?.w ?? source.quaternion.w,
  )
  target.scale.set(
    scale?.x ?? source.scale.x,
    scale?.y ?? source.scale.y,
    scale?.z ?? source.scale.z,
  )
}

/** Finds the common local frame in which TalkingHead creates its target. */
function findTopAncestor(source: Object3D): Object3D {
  let current = source
  while (current.parent !== null) current = current.parent
  return current
}

/** Declares the same hand, forearm and arm constraints used by TH. */
function createCcdLinks(
  side: HandSide,
  sources: readonly (Object3D | null)[],
  virtualBySource: ReadonlyMap<Object3D, Object3D>,
): readonly { source: Object3D; virtual: Object3D; limits: CcdLink }[] {
  const limits = side === 'Left'
    ? [
      constraint(`${side}Hand`, [-0.5, 0.5], [-1, 1], [-0.5, 0.5]),
      constraint(`${side}ForeArm`, [-0.5, 1.5], [-1.5, 1.5], [-0.5, 3]),
      constraint(`${side}Arm`, [-1.5, 1.5], [-1.5, 1.5], [-1, 3]),
    ]
    : [
      constraint(`${side}Hand`, [-0.5, 0.5], [-1, 1], [-0.5, 0.5], 0.1),
      constraint(`${side}ForeArm`, [-0.5, 1.5], [-1.5, 1.5], [-3, 0.5], 0.2),
      unconstrained(`${side}Arm`),
    ]

  return limits.flatMap((limit) => {
    const source = sources.find((bone) => bone?.name === limit.name)
    const virtual = source === undefined || source === null ? undefined : virtualBySource.get(source)
    return source === undefined || source === null || virtual === undefined
      ? []
      : [{ source, virtual, limits: limit }]
  })
}

/** Creates one CCD angular constraint. */
function constraint(
  name: string,
  x: readonly [number, number],
  y: readonly [number, number],
  z: readonly [number, number],
  maxAngle?: number,
): CcdLink {
  return {
    name,
    min: new Vector3(x[0], y[0], z[0]),
    max: new Vector3(x[1], y[1], z[1]),
    ...(maxAngle === undefined ? {} : { maxAngle }),
  }
}

/** Creates a CCD link with no Euler-axis restriction, as in TH's RightArm. */
function unconstrained(name: string): CcdLink {
  return {
    name,
    min: new Vector3(-Infinity, -Infinity, -Infinity),
    max: new Vector3(Infinity, Infinity, Infinity),
  }
}

/** Creates the local target used by TalkingHead's speaking-hands call. */
function createHandTarget(
  side: HandSide,
  root: Object3D,
  top: Object3D,
  random: RandomSource,
): Vector3 {
  const target = new Vector3(
    side === 'Left' ? sampleTemplateNumber([0, 0.5], random) : sampleTemplateNumber([-0.5, 0], random),
    sampleTemplateNumber([-0.8, -0.2], random),
    sampleTemplateNumber([0, 0.5], random),
  )
  const topQuaternion = new Quaternion()
  const origin = new Vector3()
  top.getWorldQuaternion(topQuaternion)
  root.getWorldPosition(origin)
  return target.applyQuaternion(topQuaternion).add(origin)
}

/** Converts a TH relative hand coordinate into the isolated solver frame. */
function createExplicitHandTarget(
  _side: HandSide,
  root: Object3D,
  top: Object3D,
  position: Readonly<{ x: number; y: number; z: number }>,
): Vector3 {
  const target = new Vector3(position.x, position.y, position.z)
  const topQuaternion = new Quaternion()
  const origin = new Vector3()
  top.getWorldQuaternion(topQuaternion)
  root.getWorldPosition(origin)
  return target.applyQuaternion(topQuaternion).add(origin)
}

/** Runs the Three.js-style cyclic coordinate descent solver on a virtual chain. */
function solveCcd(chain: VirtualChain, target: Vector3): void {
  const targetVector = new Vector3()
  const effectorPosition = new Vector3()
  const linkPosition = new Vector3()
  const inverseLinkRotation = new Quaternion()
  const axis = new Vector3()
  const euler = new Euler()
  const angleQuaternion = new Quaternion()

  chain.top.updateMatrixWorld(true)
  for (let iteration = 0; iteration < IK_ITERATIONS; iteration += 1) {
    let rotated = false
    for (const link of chain.links) {
      link.virtual.updateMatrixWorld(true)
      chain.effector.updateMatrixWorld(true)
      link.virtual.getWorldPosition(linkPosition)
      link.virtual.getWorldQuaternion(inverseLinkRotation).invert()
      chain.effector.getWorldPosition(effectorPosition)

      const effectorVector = effectorPosition.clone().sub(linkPosition)
        .applyQuaternion(inverseLinkRotation).normalize()
      const targetLocal = targetVector.subVectors(target, linkPosition)
        .applyQuaternion(inverseLinkRotation).normalize()
      let dot = targetLocal.dot(effectorVector)
      dot = Math.max(-1, Math.min(1, dot))
      const angle = Math.min(Math.acos(dot), link.limits.maxAngle ?? Infinity)
      if (angle < 1e-5) continue

      axis.crossVectors(effectorVector, targetLocal)
      if (axis.lengthSq() < 1e-10) continue
      axis.normalize()
      angleQuaternion.setFromAxisAngle(axis, angle)
      link.virtual.quaternion.multiply(angleQuaternion)

      euler.setFromQuaternion(link.virtual.quaternion, link.virtual.rotation.order)
      euler.x = Math.max(link.limits.min.x, Math.min(link.limits.max.x, euler.x))
      euler.y = Math.max(link.limits.min.y, Math.min(link.limits.max.y, euler.y))
      euler.z = Math.max(link.limits.min.z, Math.min(link.limits.max.z, euler.z))
      link.virtual.quaternion.setFromEuler(euler)
      chain.top.updateMatrixWorld(true)
      rotated = true
    }
    if (!rotated) break
  }
}

/** Converts an isolated solved chain into additive Avatar pose deltas. */
function readSolvedDeltas(
  chain: VirtualChain,
  pose: AvatarPose,
): AvatarPoseDelta {
  const result = new Map<Object3D, { rotation: { x: number; y: number; z: number } }>()
  for (const link of chain.links) {
    const transform = pose.get(link.source)
    if (transform?.quaternion === undefined) continue
    const solved = link.virtual.quaternion.clone()
    const base = new Quaternion(
      transform.quaternion.x,
      transform.quaternion.y,
      transform.quaternion.z,
      transform.quaternion.w,
    )
    const delta = base.clone().invert().multiply(solved).normalize()
    const euler = new Euler().setFromQuaternion(delta, link.source.rotation.order)
    result.set(link.source, { rotation: { x: euler.x, y: euler.y, z: euler.z } })
  }
  return result
}

/** Describes one TH move toward or away from the solved hand target. */
type PhraseMovement = Readonly<{
  progress: number
  returning: boolean
}>

/** Interpolates the two solved hands with the TH move durations. */
function resolvePhraseMovement(phase: number, phrase: Phrase): PhraseMovement | null {
  if (phase < phrase.firstAt) return null
  if (phase < phrase.secondAt) {
    return {
      progress: ease(phase - phrase.firstAt, FIRST_MOVE_MS),
      returning: false,
    }
  }
  const returnProgress = (phase - phrase.secondAt) / RETURN_MOVE_MS
  if (returnProgress >= 1) return null
  return {
    progress: ease(returnProgress * RETURN_MOVE_MS, RETURN_MOVE_MS),
    returning: true,
  }
}

/** Builds absolute hand targets from the pose present when TH starts the phrase. */
function createTargetPose(pose: AvatarPose, deltas: AvatarPoseDelta): AvatarPose {
  const result = new Map<Object3D, AvatarPoseTransform>()
  for (const [bone, delta] of deltas) {
    const source = pose.get(bone) ?? readPoseTransform(bone)
    const next: {
      position?: { x: number; y: number; z: number }
      quaternion?: { x: number; y: number; z: number; w: number }
      scale?: { x: number; y: number; z: number }
    } = {
      ...(source.position === undefined ? {} : { position: { ...source.position } }),
      ...(source.quaternion === undefined ? {} : { quaternion: { ...source.quaternion } }),
      ...(source.scale === undefined ? {} : { scale: { ...source.scale } }),
    }
    if (delta.rotation !== undefined && source.quaternion !== undefined) {
      const base = new Quaternion(
        source.quaternion.x,
        source.quaternion.y,
        source.quaternion.z,
        source.quaternion.w,
      )
      const offset = new Quaternion().setFromEuler(new Euler(
        delta.rotation.x,
        delta.rotation.y,
        delta.rotation.z,
        bone.rotation.order,
      ))
      const target = base.multiply(offset).normalize()
      next.quaternion = {
        x: target.x,
        y: target.y,
        z: target.z,
        w: target.w,
      }
    }
    result.set(bone, next)
  }
  return result
}

/** Reconciles one absolute TH target with the semantic pose currently sampled. */
function createRelativeDeltas(
  pose: AvatarPose,
  target: AvatarPose,
  progress: number,
  returning: boolean,
): AvatarPoseDelta {
  const result = new Map<Object3D, { rotation: { x: number; y: number; z: number } }>()
  for (const [bone, destination] of target) {
    const current = pose.get(bone) ?? readPoseTransform(bone)
    if (current.quaternion === undefined || destination.quaternion === undefined) continue
    const currentQuaternion = new Quaternion(
      current.quaternion.x,
      current.quaternion.y,
      current.quaternion.z,
      current.quaternion.w,
    )
    const targetQuaternion = new Quaternion(
      destination.quaternion.x,
      destination.quaternion.y,
      destination.quaternion.z,
      destination.quaternion.w,
    )
    const base = currentQuaternion.clone()
    const desired = returning
      ? targetQuaternion.slerp(base, progress)
      : base.slerp(targetQuaternion, progress)
    const delta = currentQuaternion.invert().multiply(desired).normalize()
    const rotation = new Euler().setFromQuaternion(delta, bone.rotation.order)
    result.set(bone, {
      rotation: {
        x: rotation.x,
        y: rotation.y,
        z: rotation.z,
      },
    })
  }
  return result
}

/** Merges the two independently solved hand contributions. */
function mergeDeltas(first: AvatarPoseDelta, second: AvatarPoseDelta): AvatarPoseDelta {
  const result = new Map<Object3D, { rotation: { x: number; y: number; z: number } }>()
  for (const [bone, delta] of [...first, ...second]) {
    if (delta.rotation === undefined) continue
    result.set(bone, { rotation: { ...delta.rotation } })
  }
  return result
}

/** Reads one local transform for the rare bone absent from the semantic pose. */
function readPoseTransform(bone: Object3D): AvatarPoseTransform {
  return {
    position: { x: bone.position.x, y: bone.position.y, z: bone.position.z },
    quaternion: { x: bone.quaternion.x, y: bone.quaternion.y, z: bone.quaternion.z, w: bone.quaternion.w },
    scale: { x: bone.scale.x, y: bone.scale.y, z: bone.scale.z },
  }
}

/** Applies TalkingHead's fast-start, slow-end sigmoid to a move. */
function ease(elapsedMs: number, durationMs: number): number {
  return sampleTalkingHeadEasing(elapsedMs / durationMs)
}

/** Builds an independent seed for one absolute phrase cycle. */
function seedForCycle(seed: number, cycle: number): number {
  return Math.imul(seed | 0, 1_664_525) ^ Math.imul(cycle | 0, 1_013_904_223)
}

/** Keeps an authored probability inside the native probability domain. */
function clamp(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

import {
  AnimationMixer,
  LoopOnce,
  LoopRepeat,
  Quaternion,
} from 'three'
import type { AnimationAction, AnimationClip, Object3D } from 'three'

/** Playback mode associated with one Avatar animation resource. */
export type AvatarAnimationMode = 'animation' | 'pose'

type RegisteredAnimation = Readonly<{
  clip: AnimationClip
  mode: AvatarAnimationMode
}>

/** Absolute-time playback state selected by the Avatar motion component. */
export type ActiveAnimation = Readonly<{
  name: string
  startAt: number
  speed: number
  loop?: boolean
  /** Absolute time at which the clip hands its pose back to Avatar layers. */
  releaseAt?: number
  /** Duration of the eased hand-off after release. */
  transitionMs?: number
}>

/** Controls preloaded clips on one Avatar model with absolute-time sampling. */
export type AvatarAnimationPlayer = Readonly<{
  register: (name: string, clip: AnimationClip, mode: AvatarAnimationMode) => void
  get: (name: string) => AvatarAnimationMode | undefined
  set: (animation: ActiveAnimation | null) => void
  prepareSeek: () => void
  applyAt: (timeMs: number) => void
  dispose: () => void
}>

type PositionValue = {
  x: number
  y: number
  z: number
}

type QuaternionValue = {
  x: number
  y: number
  z: number
  w: number
}

type TransformValue = {
  position?: PositionValue
  quaternion?: QuaternionValue
  scale?: PositionValue
}

type TransformSnapshot = ReadonlyMap<Object3D, TransformValue>

type ReleasePose = Readonly<{
  releaseAt: number
  durationMs: number
  source: TransformSnapshot
  destination: TransformSnapshot
}>

const DEFAULT_RELEASE_TRANSITION_MS = 400

/** Creates one independent Three.js animation player for one Avatar scene. */
export function createAvatarAnimationPlayer(root: Object3D): AvatarAnimationPlayer {
  const mixer = new AnimationMixer(root)
  const registered = new Map<string, RegisteredAnimation>()
  const positionBaselines = new Map<Object3D, PositionValue>()
  let active: ActiveAnimation | null = null
  let action: AnimationAction | undefined
  let actionName: string | undefined
  let actionLoop: boolean | undefined
  let actionStartAt: number | undefined
  let actionSpeed: number | undefined
  let releasePose: ReleasePose | undefined

  return {
    register(name, clip, mode) {
      registered.set(name, { clip, mode })
      capturePositionBaselines(root, clip, positionBaselines)
      if (active?.name === name) {
        releasePose = undefined
        stopAction()
      }
    },

    get(name) {
      return registered.get(name)?.mode
    },

    set(animation) {
      if (sameAnimation(active, animation)) return
      active = animation
      releasePose = undefined
    },

    prepareSeek() {
      stopAction()
      restorePositionBaselines(positionBaselines)
    },

    applyAt(timeMs) {
      if (active === null) {
        releasePose = undefined
        stopAction()
        return
      }

      const registration = registered.get(active.name)
      if (registration === undefined) return

      if (active.releaseAt !== undefined && timeMs >= active.releaseAt) {
        applyReleasedAnimation(registration, active, timeMs)
        return
      }

      releasePose = undefined
      applyActiveAnimation(registration, active, timeMs)
    },

    dispose() {
      active = null
      releasePose = undefined
      stopAction()
      mixer.uncacheRoot(root)
      registered.clear()
      positionBaselines.clear()
    },
  }

  /** Applies one ordinary clip on the absolute CodPlay timeline. */
  function applyActiveAnimation(
    registration: RegisteredAnimation,
    animation: ActiveAnimation,
    timeMs: number,
  ): void {
    const loop = resolveLoop(animation, registration.mode)
    if (needsNewAction(animation, loop)) {
      stopAction()
      action = mixer.clipAction(createRelativePositionClip(registration.clip, root))
      actionName = animation.name
      actionLoop = loop
      actionStartAt = animation.startAt
      actionSpeed = animation.speed
      action.reset()
      action.setLoop(loop ? LoopRepeat : LoopOnce, loop ? Infinity : 1)
      action.clampWhenFinished = true
      action.play()
    }

    if (action === undefined) return
    const elapsedSeconds = getElapsedSeconds(animation, timeMs)
    const sampleTime = resolveSampleTime(elapsedSeconds, registration.clip.duration, loop)
    action.enabled = true
    action.paused = false
    mixer.setTime(sampleTime)
    if (!loop && elapsedSeconds >= registration.clip.duration) {
      action.time = sampleTime
      action.paused = true
    }
  }

  /** Samples and applies the deterministic hand-off from a clip to Avatar layers. */
  function applyReleasedAnimation(
    registration: RegisteredAnimation,
    animation: ActiveAnimation,
    timeMs: number,
  ): void {
    if (releasePose === undefined) {
      releasePose = createReleasePose(registration, animation)
      stopAction()
    }

    applyReleaseTranslation(releasePose.source)
    const elapsed = timeMs - releasePose.releaseAt
    const progress = releasePose.durationMs === 0
      ? 1
      : clamp(elapsed / releasePose.durationMs, 0, 1)

    // Once the hand-off is complete, the semantic Avatar layers own rotations
    // again. The released translation remains the only persistent motion layer.
    if (progress >= 1) return

    const eased = easeOutCubic(progress)
    interpolateReleaseRotation(releasePose.source, releasePose.destination, eased)
  }

  /** Builds the source and destination poses used by one release transition. */
  function createReleasePose(
    registration: RegisteredAnimation,
    animation: ActiveAnimation,
  ): ReleasePose {
    const destination = captureTransformSnapshot(registration.clip, root)
    const sourceClip = action !== undefined && actionName === animation.name
      ? action.getClip()
      : createRelativePositionClip(registration.clip, root, positionBaselines)
    const sampleTime = resolveSampleTime(
      getElapsedSeconds(animation, animation.releaseAt ?? animation.startAt),
      registration.clip.duration,
      resolveLoop(animation, registration.mode),
    )
    if (action !== undefined) stopAction()
    const source = sampleClipSnapshot(sourceClip, sampleTime)

    return {
      releaseAt: animation.releaseAt ?? animation.startAt,
      durationMs: Math.max(0, animation.transitionMs ?? DEFAULT_RELEASE_TRANSITION_MS),
      source,
      destination,
    }
  }

  /** Samples one clip into a transform snapshot without retaining a mixer action. */
  function sampleClipSnapshot(clip: AnimationClip, timeSeconds: number): TransformSnapshot {
    const sampledClip = clip.clone()
    const temporaryAction = mixer.clipAction(sampledClip)
    temporaryAction.reset()
    temporaryAction.setLoop(LoopOnce, 1)
    temporaryAction.clampWhenFinished = true
    temporaryAction.play()

    mixer.setTime(timeSeconds)
    const snapshot = captureTransformSnapshot(sampledClip, root)

    temporaryAction.stop()
    mixer.uncacheAction(sampledClip, root)
    restorePositionBaselines(positionBaselines)
    return snapshot
  }

  /** Determines whether the current native action matches one logical motion. */
  function needsNewAction(animation: ActiveAnimation, loop: boolean): boolean {
    return action === undefined
      || actionName !== animation.name
      || actionLoop !== loop
      || actionStartAt !== animation.startAt
      || actionSpeed !== animation.speed
  }

  /** Stops the native action while preserving its current translated location. */
  function stopAction(): void {
    if (action === undefined) {
      actionName = undefined
      actionLoop = undefined
      actionStartAt = undefined
      actionSpeed = undefined
      return
    }

    const currentPositions = captureActionPositions(action, root)
    const clip = action.getClip()
    action.stop()
    mixer.uncacheAction(clip, root)
    restorePositions(currentPositions)
    action = undefined
    actionName = undefined
    actionLoop = undefined
    actionStartAt = undefined
    actionSpeed = undefined
  }
}

/** Resolves the default loop mode declared by the resource. */
function resolveLoop(animation: ActiveAnimation, mode: AvatarAnimationMode): boolean {
  return animation.loop ?? mode === 'animation'
}

/** Compares two animation selections without serializing their native state. */
function sameAnimation(left: ActiveAnimation | null, right: ActiveAnimation | null): boolean {
  if (left === null || right === null) return left === right
  return left.name === right.name
    && left.startAt === right.startAt
    && left.speed === right.speed
    && left.loop === right.loop
    && left.releaseAt === right.releaseAt
    && left.transitionMs === right.transitionMs
}

/** Converts one absolute Avatar time into elapsed clip seconds. */
function getElapsedSeconds(animation: ActiveAnimation, timeMs: number): number {
  return Math.max(0, (timeMs - animation.startAt) * animation.speed) / 1_000
}

/** Resolves a clamped or repeating clip-local sample time. */
function resolveSampleTime(elapsedSeconds: number, duration: number, loop: boolean): number {
  if (duration === 0) return 0
  return loop ? elapsedSeconds % duration : Math.min(elapsedSeconds, duration)
}

/** Records each position track's model state before any animation is played. */
function capturePositionBaselines(
  root: Object3D,
  clip: AnimationClip,
  baselines: Map<Object3D, PositionValue>,
): void {
  for (const track of clip.tracks) {
    const target = resolveTransformTarget(root, track.name, 'position')
    if (target === null || baselines.has(target)) continue
    baselines.set(target, readPosition(target))
  }
}

/** Creates a clip whose position tracks begin at the selected model location. */
function createRelativePositionClip(
  source: AnimationClip,
  root: Object3D,
  anchors?: ReadonlyMap<Object3D, PositionValue>,
): AnimationClip {
  const clip = source.clone()
  for (const track of clip.tracks) {
    const target = resolveTransformTarget(root, track.name, 'position')
    if (target === null || track.getValueSize() !== 3) continue

    const values = track.values
    const anchor = anchors?.get(target) ?? readPosition(target)
    const offset = {
      x: anchor.x - (values[0] ?? 0),
      y: anchor.y - (values[1] ?? 0),
      z: anchor.z - (values[2] ?? 0),
    }
    for (let index = 0; index < values.length; index += 3) {
      values[index] = (values[index] ?? 0) + offset.x
      values[index + 1] = (values[index + 1] ?? 0) + offset.y
      values[index + 2] = (values[index + 2] ?? 0) + offset.z
    }
  }
  return clip
}

/** Captures all transform properties written by one clip at the current time. */
function captureTransformSnapshot(clip: AnimationClip, root: Object3D): TransformSnapshot {
  const values = new Map<Object3D, TransformValue>()
  for (const track of clip.tracks) {
    const property = resolveTransformProperty(track.name)
    if (property === null) continue
    const target = resolveTransformTarget(root, track.name, property)
    if (target === null) continue

    const current = values.get(target) ?? {}
    if (property === 'position') current.position = readPosition(target)
    if (property === 'quaternion') current.quaternion = readQuaternion(target)
    if (property === 'scale') current.scale = readScale(target)
    values.set(target, current)
  }
  return values
}

/** Resolves the supported local transform property from one track name. */
function resolveTransformProperty(trackName: string): 'position' | 'quaternion' | 'scale' | null {
  if (trackName.endsWith('.position')) return 'position'
  if (trackName.endsWith('.quaternion')) return 'quaternion'
  if (trackName.endsWith('.scale')) return 'scale'
  return null
}

/** Resolves one named Three object for a supported transform property. */
function resolveTransformTarget(
  root: Object3D,
  trackName: string,
  property: 'position' | 'quaternion' | 'scale',
): Object3D | null {
  if (!trackName.endsWith(`.${property}`)) return null
  const targetName = trackName.slice(0, -`.${property}`.length)
  return root.getObjectByName(targetName) ?? null
}

/** Captures the current positions touched by the animation being stopped. */
function captureActionPositions(action: AnimationAction, root: Object3D): Map<Object3D, PositionValue> {
  const positions = new Map<Object3D, PositionValue>()
  for (const track of action.getClip().tracks) {
    const target = resolveTransformTarget(root, track.name, 'position')
    if (target !== null && !positions.has(target)) positions.set(target, readPosition(target))
  }
  return positions
}

/** Applies the translations captured at the release boundary. */
function applyReleaseTranslation(snapshot: TransformSnapshot): void {
  for (const [target, value] of snapshot) {
    if (value.position !== undefined) target.position.set(value.position.x, value.position.y, value.position.z)
  }
}

/** Interpolates rotations and scales from the clip pose to the semantic pose. */
function interpolateReleaseRotation(
  source: TransformSnapshot,
  destination: TransformSnapshot,
  progress: number,
): void {
  const sourceQuaternion = new Quaternion()
  const destinationQuaternion = new Quaternion()
  for (const [target, sourceValue] of source) {
    const destinationValue = destination.get(target)
    if (sourceValue.quaternion !== undefined) {
      sourceQuaternion.set(
        sourceValue.quaternion.x,
        sourceValue.quaternion.y,
        sourceValue.quaternion.z,
        sourceValue.quaternion.w,
      )
      const destinationValueQuaternion = destinationValue?.quaternion
      if (destinationValueQuaternion !== undefined) {
        destinationQuaternion.set(
          destinationValueQuaternion.x,
          destinationValueQuaternion.y,
          destinationValueQuaternion.z,
          destinationValueQuaternion.w,
        )
        target.quaternion.slerpQuaternions(
          sourceQuaternion,
          destinationQuaternion,
          progress,
        )
      } else {
        target.quaternion.copy(sourceQuaternion)
      }
    }
    if (sourceValue.scale !== undefined) {
      const destinationScale = destinationValue?.scale
      if (destinationScale === undefined) {
        target.scale.set(sourceValue.scale.x, sourceValue.scale.y, sourceValue.scale.z)
      } else {
        target.scale.set(
          lerp(sourceValue.scale.x, destinationScale.x, progress),
          lerp(sourceValue.scale.y, destinationScale.y, progress),
          lerp(sourceValue.scale.z, destinationScale.z, progress),
        )
      }
    }
  }
}

/** Restores positions after Three.js releases an animation binding. */
function restorePositions(positions: ReadonlyMap<Object3D, PositionValue>): void {
  for (const [target, position] of positions) target.position.set(position.x, position.y, position.z)
}

/** Restores the model positions used as deterministic seek origins. */
function restorePositionBaselines(baselines: ReadonlyMap<Object3D, PositionValue>): void {
  restorePositions(baselines)
}

/** Reads one local Three.js position without retaining a mutable vector. */
function readPosition(target: Object3D): PositionValue {
  return {
    x: target.position.x,
    y: target.position.y,
    z: target.position.z,
  }
}

/** Reads one local Three.js quaternion without retaining a mutable object. */
function readQuaternion(target: Object3D): QuaternionValue {
  return {
    x: target.quaternion.x,
    y: target.quaternion.y,
    z: target.quaternion.z,
    w: target.quaternion.w,
  }
}

/** Reads one local Three.js scale without retaining a mutable vector. */
function readScale(target: Object3D): PositionValue {
  return {
    x: target.scale.x,
    y: target.scale.y,
    z: target.scale.z,
  }
}

/** Clamps one transition progress value to its valid interval. */
function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

/** Applies the requested fast-start, slow-end transition curve. */
function easeOutCubic(progress: number): number {
  const remaining = 1 - progress
  return 1 - remaining * remaining * remaining
}

/** Interpolates two scalar transform values. */
function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress
}

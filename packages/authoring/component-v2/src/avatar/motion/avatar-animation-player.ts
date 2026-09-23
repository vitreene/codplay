/**
 * Avatar animation player — samples Three.js clips on CodPlay's absolute clock.
 *
 * The mixer is used only to obtain a native clip sample. AvatarPoseComposer,
 * not the mixer, owns the persistent skeletal pose written for the frame.
 */
import {
  AnimationMixer,
  LoopOnce,
  LoopRepeat,
} from 'three'
import type { AnimationAction, AnimationClip, Object3D } from 'three'
import type {
  ActiveAnimation,
  AvatarAnimationLayer,
  AvatarAnimationMode,
  AvatarAnimationPlayer,
  AvatarPose,
  AvatarPoseTransform,
  AvatarVector3,
  ArrivalRootMotion,
} from '../avatar-types.js'
import { prepareArrivalRootMotion } from './root-motion.js'
import { sampleTalkingHeadEasing } from '../avatar-easing.js'

type RegisteredAnimation = Readonly<{
  clip: AnimationClip
  mode: AvatarAnimationMode
  arrivalRootMotion?: ArrivalRootMotion
  entryTransitionMs?: number
}>

type MutablePoseTransform = {
  position?: AvatarVector3
  quaternion?: Readonly<{ x: number; y: number; z: number; w: number }>
  scale?: AvatarVector3
}

type AvatarTransformProperty = 'position' | 'quaternion' | 'rotation' | 'scale'

const DEFAULT_RELEASE_TRANSITION_MS = 400
const DEFAULT_ANIMATION_ENTRY_TRANSITION_MS = 1_000
const DEFAULT_POSE_ENTRY_TRANSITION_MS = 2_000
const DEFAULT_ANIMATION_DURATION_MS = 10_000
const DEFAULT_POSE_DURATION_MS = 5_000

/** Creates one independent Three.js clip sampler for one Avatar model. */
export function createAvatarAnimationPlayer(root: Object3D): AvatarAnimationPlayer {
  const mixer = new AnimationMixer(root)
  const registered = new Map<string, RegisteredAnimation>()
  const positionBaselines = new Map<Object3D, AvatarVector3>()
  const positionAnchors = new Map<Object3D, AvatarVector3>()
  const retainedTranslations = new Map<Object3D, AvatarPoseTransform>()
  let retainedRootMotionOffset: AvatarVector3 | undefined
  let sampledRootMotionOffset: AvatarVector3 | undefined
  let active: ActiveAnimation | null = null
  let action: AnimationAction | undefined
  let actionName: string | undefined
  let actionLoop: boolean | undefined
  let actionStartAt: number | undefined
  let actionSpeed: number | undefined

  return {
    register(name, clip, mode, rootMotion, entryTransitionMs) {
      const arrivalRootMotion = rootMotion === undefined
        ? undefined
        : prepareArrivalRootMotion(clip, rootMotion === 'arrival' ? undefined : rootMotion)
      const preparedClip = arrivalRootMotion?.clip ?? clip
      registered.set(name, {
        clip: preparedClip,
        mode,
        arrivalRootMotion,
        ...(entryTransitionMs === undefined ? {} : { entryTransitionMs }),
      })
      capturePositionBaselines(root, preparedClip, positionBaselines)
      if (active?.name === name) clearAction()
    },

    get(name) {
      return registered.get(name)?.mode
    },

    set(animation) {
      if (sameAnimation(active, animation)) return
      if (animation === null) {
        retainCurrentTranslations()
        retainedRootMotionOffset = sampledRootMotionOffset
        active = null
        clearAction()
        return
      }

      const registration = registered.get(animation.name)
      if (registration !== undefined) {
        capturePositionAnchors(registration.clip)
      }
      retainedTranslations.clear()
      retainedRootMotionOffset = undefined
      sampledRootMotionOffset = undefined
      active = animation
      clearAction()
    },

    prepareSeek() {
      clearAction()
      positionAnchors.clear()
      retainedTranslations.clear()
      retainedRootMotionOffset = undefined
      sampledRootMotionOffset = undefined
      restorePositions(positionBaselines)
    },

    sampleAt(timeMs) {
      if (active === null) return retainedTranslationLayer()
      if (timeMs < active.startAt) return retainedTranslationLayer()
      const registration = registered.get(active.name)
      if (registration === undefined) return retainedTranslationLayer()

      const loop = resolveLoop(active, registration)
      const handoffAt = resolveHandoffAt(active, registration, loop)
      const sampleAt = handoffAt !== undefined && timeMs >= handoffAt
        ? handoffAt
        : timeMs
      const transforms = sampleClip(registration, active, sampleAt, loop)
      if (transforms === null) return retainedTranslationLayer()

      const rootMotionOffset = resolveRootMotionOffset(registration, active, sampleAt, loop)
      sampledRootMotionOffset = rootMotionOffset
      if (handoffAt === undefined || timeMs < handoffAt) {
        const entryProgress = resolveEntryProgress(registration, active, timeMs)
        return rootMotionOffset === undefined
          ? { transforms, ...(entryProgress === undefined ? {} : { entryProgress }) }
          : {
              transforms,
              ...(entryProgress === undefined ? {} : { entryProgress }),
              rootMotionOffset,
            }
      }
      return rootMotionOffset === undefined ? {
        transforms,
        releaseProgress: resolveReleaseProgress(
          active.transitionMs ?? registration.arrivalRootMotion?.transitionMs,
          handoffAt,
          timeMs,
        ),
      } : {
        transforms,
        releaseProgress: resolveReleaseProgress(
          active.transitionMs ?? registration.arrivalRootMotion?.transitionMs,
          handoffAt,
          timeMs,
        ),
        rootMotionOffset,
      }
    },

    dispose() {
      active = null
      clearAction()
      mixer.uncacheRoot(root)
      registered.clear()
      positionBaselines.clear()
      positionAnchors.clear()
      retainedTranslations.clear()
      retainedRootMotionOffset = undefined
      sampledRootMotionOffset = undefined
    },
  }

  /** Samples one active native action then restores the semantic pose it replaced. */
  function sampleClip(
    registration: RegisteredAnimation,
    animation: ActiveAnimation,
    timeMs: number,
    loop: boolean,
  ): AvatarPose | null {
    ensureAction(registration, animation, loop)
    if (action === undefined) return null

    const previous = captureTransformSnapshot(action.getClip(), root)
    const elapsedSeconds = getElapsedSeconds(animation, timeMs)
    const sampleTime = resolveClipTime(registration, elapsedSeconds, loop)
    action.enabled = true
    action.paused = false
    mixer.setTime(sampleTime)
    const sample = captureTransformSnapshot(action.getClip(), root)
    restoreTransforms(previous)
    return sample
  }

  /** Creates or reuses the action matching one logical Avatar animation. */
  function ensureAction(
    registration: RegisteredAnimation,
    animation: ActiveAnimation,
    loop: boolean,
  ): void {
    const matchesSelection = action !== undefined
      && actionName === animation.name
      && actionLoop === loop
      && actionStartAt === animation.startAt
      && actionSpeed === animation.speed
    if (matchesSelection) return
    clearAction()
    const clip = createRelativePositionClip(registration.clip, root, positionAnchors)
    action = mixer.clipAction(clip)
    actionName = animation.name
    actionLoop = loop
    actionStartAt = animation.startAt
    actionSpeed = animation.speed
    action.reset()
    action.setLoop(loop ? LoopRepeat : LoopOnce, loop ? Infinity : 1)
    action.clampWhenFinished = true
    action.play()
  }

  /** Records the current composed translation as the next clip's local origin. */
  function capturePositionAnchors(clip: AnimationClip): void {
    positionAnchors.clear()
    for (const track of clip.tracks) {
      const target = resolveTransformTarget(root, track.name, 'position')
      if (target !== null && !positionAnchors.has(target)) {
        positionAnchors.set(target, readVector(target.position))
      }
    }
  }

  /** Keeps current translations when the motion component removes its selection. */
  function retainCurrentTranslations(): void {
    retainedTranslations.clear()
    for (const target of positionAnchors.keys()) {
      retainedTranslations.set(target, { position: readVector(target.position) })
    }
  }

  /** Returns held translations after a direct animation release. */
  function retainedTranslationLayer(): AvatarAnimationLayer | null {
    if (retainedTranslations.size === 0 && retainedRootMotionOffset === undefined) return null
    return {
      transforms: new Map(retainedTranslations),
      releaseProgress: 1,
      ...(retainedRootMotionOffset === undefined ? {} : { rootMotionOffset: retainedRootMotionOffset }),
    }
  }

  /** Releases the cached mixer action without preserving its temporary transform write. */
  function clearAction(): void {
    if (action !== undefined) {
      const clip = action.getClip()
      action.stop()
      mixer.uncacheAction(clip, root)
      action = undefined
    }
    actionName = undefined
    actionLoop = undefined
    actionStartAt = undefined
    actionSpeed = undefined
  }
}

/** Resolves the default loop mode declared by the resource. */
function resolveLoop(animation: ActiveAnimation, registration: RegisteredAnimation): boolean {
  if (registration.arrivalRootMotion !== undefined) return false
  return animation.loop ?? registration.mode === 'animation'
}

/** Compares two logical selections without serializing native mixer state. */
function sameAnimation(left: ActiveAnimation | null, right: ActiveAnimation | null): boolean {
  if (left === null || right === null) return left === right
  return left.name === right.name
    && left.startAt === right.startAt
    && left.speed === right.speed
    && left.loop === right.loop
    && left.durationMs === right.durationMs
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

/** Applies a scene-selected arrival easing to the complete clip clock. */
function resolveClipTime(
  registration: RegisteredAnimation,
  elapsedSeconds: number,
  loop: boolean,
): number {
  if (registration.mode === 'pose') return 0
  const duration = registration.clip.duration
  if (duration === 0) return 0
  if (registration.arrivalRootMotion?.decelerate && !loop) {
    const progress = clamp(elapsedSeconds / duration)
    return easeOutQuadratic(progress) * duration
  }
  return resolveSampleTime(elapsedSeconds, duration, loop)
}

/** Resolves the clip-to-semantic hand-off progress at one timeline position. */
function resolveHandoffAt(
  animation: ActiveAnimation,
  registration: RegisteredAnimation,
  loop: boolean,
): number | undefined {
  const requested = animation.releaseAt
  const natural = registration.mode === 'pose' || animation.speed <= 0
    ? undefined
    : animation.startAt + (registration.clip.duration * 1_000) / animation.speed
  if (requested === undefined) {
    if (animation.speed <= 0) return undefined
    const durationMs = animation.durationMs
      ?? (registration.mode === 'pose'
        ? DEFAULT_POSE_DURATION_MS
        : DEFAULT_ANIMATION_DURATION_MS)
    const requestedEnd = animation.startAt + durationMs / animation.speed
    if (!loop) return natural === undefined ? requestedEnd : Math.min(requestedEnd, natural)
    return Math.max(requestedEnd, natural ?? requestedEnd)
  }
  if (natural === undefined) return requested
  return Math.min(requested, natural)
}

/** Resolves the native TH entry transition from the current semantic pose. */
function resolveEntryProgress(
  registration: RegisteredAnimation,
  animation: ActiveAnimation,
  timeMs: number,
): number | undefined {
  const durationMs = registration.entryTransitionMs
    ?? (registration.mode === 'pose'
      ? DEFAULT_POSE_ENTRY_TRANSITION_MS
      : DEFAULT_ANIMATION_ENTRY_TRANSITION_MS)
  if (durationMs <= 0 || timeMs >= animation.startAt + durationMs) return undefined
  return sampleTalkingHeadEasing((timeMs - animation.startAt) / durationMs)
}

/** Resolves the clip-to-semantic hand-off progress at one timeline position. */
function resolveReleaseProgress(transitionMs: number | undefined, releaseAt: number, timeMs: number): number {
  const durationMs = Math.max(0, transitionMs ?? DEFAULT_RELEASE_TRANSITION_MS)
  if (durationMs === 0) return 1
  const linear = clamp((timeMs - releaseAt) / durationMs)
  return easeOutQuadratic(linear)
}

/** Eases toward the destination without tripling the initial sample rate. */
function easeOutQuadratic(progress: number): number {
  return 1 - Math.pow(1 - progress, 2)
}

/** Samples the presentation offset for an arrival clip at the same absolute date as its pose. */
function resolveRootMotionOffset(
  registration: RegisteredAnimation,
  animation: ActiveAnimation,
  timeMs: number,
  loop: boolean,
): AvatarVector3 | undefined {
  const rootMotion = registration.arrivalRootMotion
  if (rootMotion === undefined) return undefined
  const elapsedSeconds = getElapsedSeconds(animation, timeMs)
  const sampleTime = resolveClipTime(registration, elapsedSeconds, loop)
  return rootMotion.offsetAt(sampleTime)
}

/** Records each position track's model state before any animation is sampled. */
function capturePositionBaselines(
  root: Object3D,
  clip: AnimationClip,
  baselines: Map<Object3D, AvatarVector3>,
): void {
  for (const track of clip.tracks) {
    const target = resolveTransformTarget(root, track.name, 'position')
    if (target === null || baselines.has(target)) continue
    baselines.set(target, readVector(target.position))
  }
}

/** Creates a clip whose position tracks start from the selected Avatar location. */
function createRelativePositionClip(
  source: AnimationClip,
  root: Object3D,
  anchors: ReadonlyMap<Object3D, AvatarVector3>,
): AnimationClip {
  const clip = source.clone()
  for (const track of clip.tracks) {
    const target = resolveTransformTarget(root, track.name, 'position')
    if (target === null || track.getValueSize() !== 3) continue
    const anchor = anchors.get(target) ?? readVector(target.position)
    const offset = {
      x: anchor.x - (track.values[0] ?? 0),
      y: anchor.y - (track.values[1] ?? 0),
      z: anchor.z - (track.values[2] ?? 0),
    }
    for (let index = 0; index < track.values.length; index += 3) {
      track.values[index] = (track.values[index] ?? 0) + offset.x
      track.values[index + 1] = (track.values[index + 1] ?? 0) + offset.y
      track.values[index + 2] = (track.values[index + 2] ?? 0) + offset.z
    }
  }
  return clip
}

/** Captures transform channels currently written by one clip. */
function captureTransformSnapshot(clip: AnimationClip, root: Object3D): AvatarPose {
  const result = new Map<Object3D, AvatarPoseTransform>()
  for (const track of clip.tracks) {
    const property = resolveTransformProperty(track.name)
    if (property === null) continue
    const target = resolveTransformTarget(root, track.name, property)
    if (target === null) continue
    const current: MutablePoseTransform = { ...(result.get(target) ?? {}) }
    if (property === 'position') current.position = readVector(target.position)
    if (property === 'quaternion' || property === 'rotation') current.quaternion = readQuaternion(target)
    if (property === 'scale') current.scale = readVector(target.scale)
    result.set(target, current)
  }
  return result
}

/** Restores the semantic transforms temporarily replaced while sampling the mixer. */
function restoreTransforms(snapshot: AvatarPose): void {
  for (const [target, transform] of snapshot) {
    if (transform.position !== undefined) {
      target.position.set(transform.position.x, transform.position.y, transform.position.z)
    }
    if (transform.quaternion !== undefined) {
      target.quaternion.set(
        transform.quaternion.x,
        transform.quaternion.y,
        transform.quaternion.z,
        transform.quaternion.w,
      )
    }
    if (transform.scale !== undefined) {
      target.scale.set(transform.scale.x, transform.scale.y, transform.scale.z)
    }
  }
}

/** Restores deterministic position baselines before a seek replay. */
function restorePositions(positions: ReadonlyMap<Object3D, AvatarVector3>): void {
  for (const [target, position] of positions) {
    target.position.set(position.x, position.y, position.z)
  }
}

/** Resolves the supported transform channel named by one Three.js track. */
function resolveTransformProperty(trackName: string): AvatarTransformProperty | null {
  if (trackName.endsWith('.position')) return 'position'
  if (trackName.endsWith('.quaternion')) return 'quaternion'
  if (trackName.endsWith('.rotation')) return 'rotation'
  if (trackName.endsWith('.scale')) return 'scale'
  return null
}

/** Resolves one named Three object for a supported local transform track. */
function resolveTransformTarget(
  root: Object3D,
  trackName: string,
  property: AvatarTransformProperty,
): Object3D | null {
  if (!trackName.endsWith(`.${property}`)) return null
  const name = trackName.slice(0, -`.${property}`.length)
  return root.getObjectByName(name) ?? null
}

/** Reads an immutable three-axis value from a native vector. */
function readVector(value: Readonly<{ x: number; y: number; z: number }>): AvatarVector3 {
  return { x: value.x, y: value.y, z: value.z }
}

/** Reads an immutable quaternion from one native Three object. */
function readQuaternion(target: Object3D): Readonly<{ x: number; y: number; z: number; w: number }> {
  return {
    x: target.quaternion.x,
    y: target.quaternion.y,
    z: target.quaternion.z,
    w: target.quaternion.w,
  }
}

/** Clamps one normalized interpolation factor. */
function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}

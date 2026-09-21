import type {
  AvatarEngine,
} from './avatar-engine.js'
import type { BlinkScheduleFn, BreathTriggerFn, HeadDriftFn } from '../idle/avatar-idle-schedule.js'
import { MOOD_BASELINES, type MoodName } from '../mood/expression-engine.js'
import type { Camera } from 'three'
import type { AvatarMorphs } from './avatar-target.js'
import type { AvatarGestureFrame, AvatarGestureOverlay } from '../gesture/motion-catalog.js'
import type { ActiveAnimation, AvatarAnimationMode } from '../motion/avatar-animation-player.js'

type GestureContribution = Readonly<{
  name: string
  seed: number
  mirror: boolean
}> | null

type AnimationContribution = ActiveAnimation | null

/** Collects feature contributions and applies them to one loaded Avatar engine. */
export class AvatarCoordinator {
  private engine: AvatarEngine | undefined
  private moodMorphs: AvatarMorphs
  private gesture: GestureContribution = null
  private pose: string | undefined
  private blinkSchedule: BlinkScheduleFn | null = null
  private breathTrigger: BreathTriggerFn | null = null
  private headDrift: HeadDriftFn | null = null
  private gazeCamera: Camera | null = null
  private gazeEnabled = false
  private gazeContact: number | null = 1
  private animation: AnimationContribution = null
  private speechMorphs: AvatarMorphs = {}
  private gestureMorphs: AvatarMorphs = {}
  private gestureOverlay: AvatarGestureOverlay | null = null
  private appliedMoodMorphs: AvatarMorphs | undefined
  private appliedFixedMorphs: AvatarMorphs | undefined
  private appliedGestureKey: string | undefined
  private appliedPose: string | undefined
  private lastTimeMs: number | undefined
  private seekPending = false
  private revision = 0

  /** Creates a coordinator with the Avatar's stable initial mood. */
  constructor(initialMood: MoodName = 'neutral') {
    this.moodMorphs = { ...MOOD_BASELINES[initialMood] }
  }

  /** Attaches the loaded native engine without exposing it to feature components. */
  attachEngine(engine: AvatarEngine): void {
    this.engine = engine
    engine.setBlinkScheduleFn(this.blinkSchedule)
    engine.setBreathTriggerFn(this.breathTrigger)
    engine.setHeadDriftFn(this.headDrift)
    engine.setGazeCamera(this.gazeCamera)
    engine.setGazeContact(this.gazeContact)
    engine.setGazeEnabled(this.gazeEnabled)
    engine.setGestureOverlay(this.gestureOverlay)
    if (this.animation !== null) engine.setAnimation(this.animation)
    this.appliedMoodMorphs = undefined
    this.appliedFixedMorphs = undefined
    this.appliedGestureKey = undefined
    this.appliedPose = undefined
    this.lastTimeMs = undefined
    this.seekPending = false

    if (this.pose !== undefined) {
      engine.setPose(this.pose)
      engine.commitSeek(0)
      this.appliedPose = this.pose
    }
    this.applyGestureSelection()
    this.revision += 1
  }

  /** Releases the native engine owned by the central Avatar component. */
  detachEngine(): void {
    this.engine = undefined
    this.appliedMoodMorphs = undefined
    this.appliedFixedMorphs = undefined
    this.appliedGestureKey = undefined
    this.appliedPose = undefined
    this.lastTimeMs = undefined
    this.seekPending = false
  }

  /** Returns the change revision used by the central presentation stream. */
  getRevision(): number {
    return this.revision
  }

  /** Stores and applies the latest mood baseline contribution. */
  applyMood(morphs: AvatarMorphs): void {
    if (sameMorphs(this.moodMorphs, morphs)) return
    this.moodMorphs = { ...morphs }
    this.revision += 1
    this.applyMoodLayer()
  }

  /** Stores and applies the speech/lip-sync morph layer. */
  applyMorphs(morphs: AvatarMorphs): void {
    if (sameMorphs(this.speechMorphs, morphs)) return
    this.speechMorphs = { ...morphs }
    this.revision += 1
    this.applyFixedLayer()
  }

  /** Stores one sampled gesture action and forwards its native overlay immediately. */
  applyGestureMotion(frame: AvatarGestureFrame, seed = 0): void {
    const nextGesture = frame.gesture === null
      ? null
      : { name: frame.gesture, seed, mirror: frame.mirror }
    const changed = !sameGesture(this.gesture, nextGesture)
      || !sameMorphs(this.gestureMorphs, frame.morphs)
      || !sameOverlay(this.gestureOverlay, frame.overlay)
    if (!changed) {
      this.snapGestureAfterSeek(this.gesture !== null)
      return
    }

    this.gesture = nextGesture
    this.gestureMorphs = { ...frame.morphs }
    this.gestureOverlay = frame.overlay
    this.revision += 1
    this.applyFixedLayer()
    this.applyGestureSelection()
    this.snapGestureAfterSeek(nextGesture !== null)
    this.engine?.setGestureOverlay(frame.overlay)
  }

  /** Stores the latest gesture contribution with a deterministic random seed. */
  setGesture(name: string | null, seed = 0): void {
    const next = name === null ? null : { name, seed, mirror: false }
    const changed = !sameGesture(this.gesture, next)
      || Object.keys(this.gestureMorphs).length > 0
      || this.gestureOverlay !== null
    if (!changed) {
      this.snapGestureAfterSeek(this.gesture !== null)
      return
    }
    this.gesture = next
    this.gestureMorphs = {}
    this.gestureOverlay = null
    this.revision += 1
    this.applyFixedLayer()
    this.applyGestureSelection()
    this.snapGestureAfterSeek(next !== null)
    this.engine?.setGestureOverlay(null)
  }

  /** Stores the active body pose and lets AvatarEngine ease toward it. */
  setPose(name: string): void {
    if (this.pose === name) return
    this.pose = name
    this.revision += 1

    if (this.engine !== undefined && this.lastTimeMs === undefined) {
      this.engine.setPose(name)
      this.engine.commitSeek(0)
      this.appliedPose = name
    }
  }

  /** Stores the idle blink schedule and installs it on the loaded engine. */
  setBlinkSchedule(schedule: BlinkScheduleFn | null): void {
    if (this.blinkSchedule === schedule) return
    this.blinkSchedule = schedule
    this.revision += 1
    this.engine?.setBlinkScheduleFn(schedule)
  }

  /** Stores the idle breathing trigger and installs it on the loaded engine. */
  setBreathTrigger(schedule: BreathTriggerFn | null): void {
    if (this.breathTrigger === schedule) return
    this.breathTrigger = schedule
    this.revision += 1
    this.engine?.setBreathTriggerFn(schedule)
  }

  /** Stores the idle drift and installs it on the loaded Avatar engine. */
  setHeadDrift(schedule: HeadDriftFn | null): void {
    if (this.headDrift === schedule) return
    this.headDrift = schedule
    this.revision += 1
    this.engine?.setHeadDriftFn(schedule)
  }

  /** Stores the gaze selection and forwards it to the loaded Avatar engine. */
  setGaze(enabled: boolean, contact?: number | null): void {
    const nextContact = contact === undefined ? this.gazeContact : contact
    if (this.gazeEnabled === enabled && this.gazeContact === nextContact) return
    this.gazeEnabled = enabled
    this.gazeContact = nextContact
    this.revision += 1
    this.engine?.setGazeContact(nextContact)
    this.engine?.setGazeEnabled(enabled)
  }

  /** Keeps the engine gaze constraint aligned with the host's current camera. */
  setGazeCamera(camera: Camera | null): void {
    if (this.gazeCamera === camera) return
    this.gazeCamera = camera
    this.revision += 1
    this.engine?.setGazeCamera(camera)
  }

  /** Returns metadata for one animation registered by the central Avatar. */
  getAnimation(name: string): AvatarAnimationMode | undefined {
    return this.engine?.getAnimation(name)
  }

  /** Stores one animation selection for absolute-time application. */
  setAnimation(animation: ActiveAnimation): void {
    if (sameAnimation(this.animation, animation)) return
    this.animation = { ...animation }
    this.revision += 1
    this.engine?.setAnimation(this.animation)
  }

  /** Releases the current animation and leaves other Avatar layers active. */
  releaseAnimation(): void {
    if (this.animation === null) return
    this.animation = null
    this.revision += 1
    this.engine?.setAnimation(null)
  }

  /** Applies all collected contributions at one absolute CodPlay time. */
  applyAt(timeMs: number): void {
    const engine = this.engine
    if (engine === undefined) return

    const seeking = this.lastTimeMs !== undefined && timeMs < this.lastTimeMs
    if (seeking) {
      engine.prepareSeek()
      engine.setHeadDriftFn(this.headDrift)
      engine.setBlinkScheduleFn(this.blinkSchedule)
      engine.setBreathTriggerFn(this.breathTrigger)
      this.appliedMoodMorphs = undefined
      this.appliedFixedMorphs = undefined
      this.appliedGestureKey = undefined
      this.appliedPose = undefined
      this.lastTimeMs = 0
    }

    this.applyMoodLayer()
    this.applyFixedLayer()
    this.applyPoseLayer()

    this.applyGestureSelection()

    if (seeking) {
      engine.commitSeek(timeMs)
      engine.applyAnimationAt(timeMs)
      this.seekPending = true
    } else {
      const deltaMs = Math.max(0, timeMs - (this.lastTimeMs ?? timeMs))
      engine.animate(deltaMs)
      engine.applyAnimationAt(timeMs)
    }
    this.lastTimeMs = timeMs
  }

  /** Applies the current mood baselines only when their layer changed. */
  private applyMoodLayer(): void {
    const engine = this.engine
    if (engine === undefined || sameMorphs(this.appliedMoodMorphs, this.moodMorphs)) return

    const names = new Set([
      ...Object.keys(this.appliedMoodMorphs ?? {}),
      ...Object.keys(this.moodMorphs),
    ])
    for (const name of names) {
      engine.morphEngine.setBaseline(name, this.moodMorphs[name] ?? null)
    }
    this.appliedMoodMorphs = { ...this.moodMorphs }
  }

  /** Applies the current fixed morph layer only when its values changed. */
  private applyFixedLayer(): void {
    const engine = this.engine
    const fixedMorphs = { ...this.gestureMorphs, ...this.speechMorphs }
    if (engine === undefined || sameMorphs(this.appliedFixedMorphs, fixedMorphs)) return

    const names = new Set([
      ...Object.keys(this.appliedFixedMorphs ?? {}),
      ...Object.keys(fixedMorphs),
    ])
    for (const name of names) {
      engine.morphEngine.snapFixed(name, fixedMorphs[name] ?? null)
    }
    this.appliedFixedMorphs = { ...fixedMorphs }
  }

  /** Applies the current native gesture selection once per change or replay. */
  private applyGestureSelection(): void {
    const engine = this.engine
    if (engine === undefined) return

    const gestureKey = this.gesture === null
      ? 'none'
      : `${this.gesture.name}:${this.gesture.seed}:${this.gesture.mirror}`
    if (this.appliedGestureKey === gestureKey) return
    if (this.gesture === null) {
      engine.releaseGesture()
    } else {
      engine.playGesture(
        this.gesture.name,
        createSeededRng(this.gesture.seed),
        this.gesture.mirror,
      )
    }
    this.appliedGestureKey = gestureKey
  }

  /** Snaps a feature-selected gesture after the central seek commit. */
  private snapGestureAfterSeek(hasGesturePose: boolean): void {
    if (!this.seekPending || !hasGesturePose || this.engine === undefined) return
    this.engine.snapGesture()
    this.seekPending = false
  }

  /** Applies the selected body pose once per change or replay. */
  private applyPoseLayer(): void {
    const engine = this.engine
    if (engine === undefined || this.pose === undefined || this.appliedPose === this.pose) return
    engine.setPose(this.pose)
    this.appliedPose = this.pose
  }
}

/** Compares two optional gesture contributions without serializing them. */
function sameGesture(left: GestureContribution, right: GestureContribution): boolean {
  if (left === null || right === null) return left === right
  return left.name === right.name && left.seed === right.seed && left.mirror === right.mirror
}

/** Compares two absolute-time animation selections without serializing them. */
function sameAnimation(left: AnimationContribution, right: AnimationContribution): boolean {
  if (left === null || right === null) return left === right
  return left.name === right.name
    && left.startAt === right.startAt
    && left.speed === right.speed
    && left.loop === right.loop
    && left.releaseAt === right.releaseAt
    && left.transitionMs === right.transitionMs
}

/** Compares two morph layers without serializing their values. */
function sameMorphs(left: AvatarMorphs | undefined, right: AvatarMorphs): boolean {
  if (left === undefined) return false
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false
  return leftKeys.every((name) => Object.is(left[name], right[name]))
}

/** Compares two optional sampled overlays without serializing Three.js data. */
function sameOverlay(left: AvatarGestureOverlay | null, right: AvatarGestureOverlay | null): boolean {
  if (left === null || right === null) return left === right
  const leftBones = Object.keys(left)
  const rightBones = Object.keys(right)
  if (leftBones.length !== rightBones.length) return false
  for (const boneName of leftBones) {
    const leftDelta = left[boneName]
    const rightDelta = right[boneName]
    if (leftDelta === undefined || rightDelta === undefined) return false
    if (!sameVector(leftDelta.rotation, rightDelta.rotation)) return false
    if (!sameVector(leftDelta.position, rightDelta.position)) return false
  }
  return true
}

/** Compares two optional three-axis deltas. */
function sameVector(
  left: { x: number; y: number; z: number } | undefined,
  right: { x: number; y: number; z: number } | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right
  return left.x === right.x && left.y === right.y && left.z === right.z
}


/** Creates the deterministic random source expected by the gesture engine. */
function createSeededRng(seed: number): { random: () => number } {
  let state = seed | 0
  return {
    random: () => {
      state = Math.imul(state ^ (state >>> 15), 1 | state)
      state = (state + Math.imul(state ^ (state >>> 7), 61 | state)) ^ state
      return ((state ^ (state >>> 14)) >>> 0) / 0x1_0000_0000
    },
  }
}

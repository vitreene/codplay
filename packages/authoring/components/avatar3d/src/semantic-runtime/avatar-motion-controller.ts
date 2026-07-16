import { resolveMotionDurationMs, sampleMotionValue } from '../semantic-motion/avatar3d-motion-utils.js'
import type { Avatar3DMotion, Avatar3DMotionCatalog, Avatar3DMotionRef } from '../semantic-motion/avatar3d-motion-types.js'
import { BUILTIN_AVATAR3D_MOTIONS } from '../semantic-motion/avatar3d-motion-catalog.js'
import type { AvatarLayerOutput, AvatarMorphPose } from './avatar-pose-types.js'
import type { Avatar3DRuntimeUpdateInput, Avatar3DWarningReporter } from './avatar3d-runtime-types.js'

type ActiveMotionTrack = {
  motion: Avatar3DMotion
  startMs: number
  endMs: number
  fromMorphs?: AvatarMorphPose
  toMorphs?: AvatarMorphPose
}

const DEFAULT_MOOD_TRANSITION_MS = 700

/** Returns true when all channel samples are finite numbers. */
function isNumericChannel(values: readonly unknown[]): values is number[] {
  return values.every((value) => typeof value === 'number' && Number.isFinite(value))
}

/** Maps MotionEngine eye rotation channels to ARKit eye look morphs. */
function resolveEyeRotationMorphs(name: string, value: number): AvatarMorphPose | null {
  if (name === 'eyesRotateX') {
    return value >= 0
      ? { eyesLookUp: value, eyesLookDown: 0 }
      : { eyesLookUp: 0, eyesLookDown: Math.abs(value) }
  }
  if (name === 'eyesRotateY') {
    return value >= 0
      ? { eyeLookOutLeft: value, eyeLookInLeft: 0, eyeLookInRight: value, eyeLookOutRight: 0 }
      : { eyeLookOutLeft: 0, eyeLookInLeft: Math.abs(value), eyeLookInRight: 0, eyeLookOutRight: Math.abs(value) }
  }
  return null
}

/** Smoothstep interpolation used by persistent MotionEngine mood-track transitions. */
function easeMoodMotionProgress(progress: number): number {
  const t = Math.max(0, Math.min(1, progress))
  return t * t * (3 - 2 * t)
}

/** Blends two morph poses over their key union. */
function blendMorphs(from: AvatarMorphPose, to: AvatarMorphPose, alpha: number): AvatarMorphPose {
  const morphs: AvatarMorphPose = {}
  const keys = new Set([...Object.keys(from), ...Object.keys(to)])
  for (const key of keys) {
    const fromValue = from[key] ?? 0
    const toValue = to[key] ?? 0
    morphs[key] = fromValue + (toValue - fromValue) * alpha
  }
  return morphs
}

/** Owns semantic motion tracks and emits a morph layer without mutating AvatarEngine. */
export class AvatarMotionController {
  private readonly catalog: Avatar3DMotionCatalog
  private readonly report: Avatar3DWarningReporter
  private readonly supportedChannels: ReadonlySet<string>
  private readonly track: 'action' | 'mood'
  private readonly setEyeContact?: (value: number | null) => void
  private readonly setHeadMoveEnabled?: (enabled: boolean) => void
  private activeMotion: ActiveMotionTrack | null = null
  private persistentMorphs: AvatarMorphPose | null = null

  /** Creates one semantic motion controller. */
  constructor(input: {
    localMotions?: Avatar3DMotionCatalog
    supportedChannels: ReadonlySet<string>
    track?: 'action' | 'mood'
    setEyeContact?: (value: number | null) => void
    setHeadMoveEnabled?: (enabled: boolean) => void
    report: Avatar3DWarningReporter
  }) {
    this.catalog = { ...BUILTIN_AVATAR3D_MOTIONS, ...input.localMotions }
    this.supportedChannels = input.supportedChannels
    this.track = input.track ?? 'action'
    this.setEyeContact = input.setEyeContact
    this.setHeadMoveEnabled = input.setHeadMoveEnabled
    this.report = input.report
  }

  /** Handles semantic motion actions. Returns false for non-motion actions. */
  handleUpdate(input: Avatar3DRuntimeUpdateInput): boolean {
    if (!('motion' in input.action)) return false

    const ref = input.action['motion'] as Avatar3DMotionRef | null | undefined
    if (ref == null) {
      if (this.track !== 'action') return false
      this.activeMotion = null
      this.setEyeContact?.(null)
      this.setHeadMoveEnabled?.(true)
      return true
    }

    const motion = this.resolveMotion(ref)
    if (!motion) {
      if (this.track !== 'action') return false
      this.report('AVATAR3D_MOTION_NOT_FOUND', 'Avatar3D motion was not found', { motion: ref })
      this.activeMotion = null
      this.setEyeContact?.(null)
      this.setHeadMoveEnabled?.(true)
      return true
    }

    const motionTrack = motion._track ?? 'action'
    if (motionTrack !== this.track) return false

    const durationMs = resolveMotionDurationMs(motion.dt)
    if (this.track === 'mood') {
      const transitionMs = durationMs > 0 ? durationMs : DEFAULT_MOOD_TRANSITION_MS
      this.activeMotion = {
        motion,
        startMs: input.eventMs,
        endMs: input.eventMs + transitionMs,
        fromMorphs: this.sampleActiveMoodAt(input.eventMs),
        toMorphs: this.sampleMoodTarget(motion),
      }
      return true
    }

    if (durationMs <= 0) {
      this.activeMotion = null
      this.setEyeContact?.(null)
      this.setHeadMoveEnabled?.(true)
      return true
    }

    this.activeMotion = {
      motion,
      startMs: input.eventMs,
      endMs: input.eventMs + durationMs,
    }
    return true
  }

  /** Clears transient state before seek replay. */
  prepareSeek(): void {
    this.activeMotion = null
    this.persistentMorphs = null
    this.setEyeContact?.(null)
    this.setHeadMoveEnabled?.(true)
  }

  /** Emits the active motion layer at one timeline position. */
  evaluate(timelineMs: number): AvatarLayerOutput {
    const active = this.activeMotion
    if (!active || timelineMs < active.startMs) return this.persistentMoodLayer()

    if (this.track === 'mood') return this.evaluateMoodMotion(active, timelineMs)

    if (timelineMs >= active.endMs) {
      this.activeMotion = null
      this.setEyeContact?.(null)
      this.setHeadMoveEnabled?.(true)
      return this.persistentMoodLayer()
    }

    return { morphs: this.sampleMotion(active.motion, timelineMs - active.startMs) }
  }

  /** Stops any active motion. */
  stop(): void {
    this.activeMotion = null
    this.persistentMorphs = null
    this.setEyeContact?.(null)
    this.setHeadMoveEnabled?.(true)
  }

  /** Returns the persistent mood layer once a mood-track motion has completed. */
  private persistentMoodLayer(): AvatarLayerOutput {
    return this.track === 'mood' && this.persistentMorphs ? { morphs: this.persistentMorphs } : {}
  }

  /** Evaluates a smooth persistent MotionEngine mood-track transition. */
  private evaluateMoodMotion(active: ActiveMotionTrack, timelineMs: number): AvatarLayerOutput {
    if (timelineMs >= active.endMs) {
      this.persistentMorphs = active.toMorphs ?? {}
      this.activeMotion = null
      return this.persistentMoodLayer()
    }

    const from = active.fromMorphs ?? {}
    const to = active.toMorphs ?? {}
    const progress = (timelineMs - active.startMs) / (active.endMs - active.startMs)
    return { morphs: blendMorphs(from, to, easeMoodMotionProgress(progress)) }
  }

  /** Resolves an inline motion or catalog reference. */
  private resolveMotion(ref: Avatar3DMotionRef | null | undefined): Avatar3DMotion | null {
    if (ref == null) return null
    if (typeof ref !== 'string') return ref
    return this.catalog[ref] ?? null
  }

  /** Samples every numeric `vs` channel into the internal morph layer. */
  private sampleMotion(motion: Avatar3DMotion, elapsedMs: number, options: { applySideEffects?: boolean } = {}): AvatarMorphPose {
    const morphs: AvatarMorphPose = {}
    const channels = motion.vs
    if (!channels) return morphs

    for (const [name, values] of Object.entries(channels)) {
      if (name === 'gesture' || name === 'pose') continue

      if (!isNumericChannel(values)) {
        this.report('AVATAR3D_MOTION_CHANNEL_INVALID', 'Avatar3D motion channel has non-numeric samples', { channel: name })
        continue
      }

      const value = sampleMotionValue(values, motion.dt, elapsedMs, motion.rescale)
      if (value === null) {
        this.report('AVATAR3D_MOTION_CHANNEL_INVALID', 'Avatar3D motion channel has invalid samples or timing', { channel: name })
        continue
      }

      if (name === 'eyeContact') {
        if (options.applySideEffects !== false) this.setEyeContact?.(value)
        continue
      }

      if (name === 'headMove') {
        if (options.applySideEffects !== false) this.setHeadMoveEnabled?.(value !== 0)
        continue
      }

      const eyeRotationMorphs = resolveEyeRotationMorphs(name, value)
      if (eyeRotationMorphs) {
        let mappedCount = 0
        for (const [targetName, targetValue] of Object.entries(eyeRotationMorphs)) {
          if (!this.supportedChannels.has(targetName)) continue
          morphs[targetName] = targetValue
          mappedCount += 1
        }
        if (mappedCount === 0) {
          this.report('AVATAR3D_MOTION_CHANNEL_UNSUPPORTED', 'Avatar3D motion channel is not supported by this avatar', { channel: name })
        }
        continue
      }

      if (!this.supportedChannels.has(name)) {
        this.report('AVATAR3D_MOTION_CHANNEL_UNSUPPORTED', 'Avatar3D motion channel is not supported by this avatar', { channel: name })
        continue
      }

      morphs[name] = value
    }

    return morphs
  }

  /** Extracts the persistent baseline target for a MotionEngine mood-track motion. */
  private sampleMoodTarget(motion: Avatar3DMotion): AvatarMorphPose {
    const durationMs = resolveMotionDurationMs(motion.dt)
    const candidates = durationMs > 0
      ? [0, durationMs * 0.25, durationMs * 0.5, durationMs * 0.75, durationMs]
      : [0]
    let best = this.sampleMotion(motion, candidates[0] ?? 0, { applySideEffects: false })
    let bestScore = Object.values(best).reduce((total, value) => total + Math.abs(value), 0)
    for (const elapsedMs of candidates.slice(1)) {
      const sample = this.sampleMotion(motion, elapsedMs, { applySideEffects: false })
      const score = Object.values(sample).reduce((total, value) => total + Math.abs(value), 0)
      if (score > bestScore) {
        best = sample
        bestScore = score
      }
    }
    return best
  }

  /** Samples the currently effective mood-track pose before replacing it. */
  private sampleActiveMoodAt(timelineMs: number): AvatarMorphPose {
    const active = this.activeMotion
    if (this.track !== 'mood' || !active || timelineMs < active.startMs) return this.persistentMorphs ?? {}
    if (timelineMs >= active.endMs) return active.toMorphs ?? this.persistentMorphs ?? {}

    const from = active.fromMorphs ?? {}
    const to = active.toMorphs ?? {}
    const progress = (timelineMs - active.startMs) / (active.endMs - active.startMs)
    return blendMorphs(from, to, easeMoodMotionProgress(progress))
  }
}

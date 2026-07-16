import { MOOD_BASELINES, MORPH_ALIASES } from '@codplay/avatar-engine'
import type { MoodName } from '@codplay/avatar-engine'
import { resolveContinuousEndMs } from '../avatar3d-component.js'
import type { AvatarLayerOutput, AvatarMorphPose } from './avatar-pose-types.js'
import type { Avatar3DRuntimeUpdateInput, Avatar3DWarningReporter } from './avatar3d-runtime-types.js'

type MoodTransition = {
  mood: MoodName
  from: AvatarMorphPose
  to: AvatarMorphPose
  startMs: number
  endMs: number
}

const ALL_MOOD_KEYS = Array.from(new Set(
  Object.values(MOOD_BASELINES).flatMap((baseline) => Object.keys(baseline)),
))

const COMPOSED_MOOD_KEYS = ALL_MOOD_KEYS.filter((key) => {
  const alias = MORPH_ALIASES[key]
  if (alias === undefined) {
    return true
  }

  return !alias.targets.some((target) => ALL_MOOD_KEYS.includes(target.name))
})

/** Returns true when a value is one of AvatarEngine's known mood names. */
export function isAvatar3DRuntimeMoodName(value: unknown): value is MoodName {
  return typeof value === 'string' && value in MOOD_BASELINES
}

/** Smoothstep interpolation used by timeline mood transitions. */
export function easeAvatarMoodProgress(progress: number): number {
  const t = Math.max(0, Math.min(1, progress))
  return t * t * (3 - 2 * t)
}

/** Owns mood state and emits a morph layer without mutating AvatarEngine. */
export class AvatarMoodController {
  private readonly initialMood: MoodName
  private readonly report: Avatar3DWarningReporter
  private currentMood: MoodName
  private transition: MoodTransition | null = null

  /** Creates one mood controller. */
  constructor(input: {
    initialMood?: MoodName
    report: Avatar3DWarningReporter
  }) {
    this.initialMood = input.initialMood ?? 'neutral'
    this.currentMood = this.initialMood
    this.report = input.report
  }

  /** Handles mood actions. Returns false for non-mood actions. */
  handleUpdate(input: Avatar3DRuntimeUpdateInput): boolean {
    if (!('mood' in input.action)) return false

    const mood = input.action['mood']
    if (!isAvatar3DRuntimeMoodName(mood)) {
      this.report('AVATAR3D_MOOD_UNSUPPORTED', 'Avatar3D mood is not supported', { mood })
      return true
    }

    const endMs = resolveContinuousEndMs(input.action, input.eventMs)
    if (endMs === null || endMs <= input.eventMs) {
      this.currentMood = mood
      this.transition = null
      return true
    }

    const from = this.evaluateMoodAt(input.eventMs).morphs ?? this.resolveMoodPose(this.currentMood)
    this.transition = {
      mood,
      from,
      to: this.resolveMoodPose(mood),
      startMs: input.eventMs,
      endMs,
    }
    return true
  }

  /** Resets transient state before seek replay. */
  prepareSeek(): void {
    this.currentMood = this.initialMood
    this.transition = null
  }

  /** Emits the effective mood layer at one timeline position. */
  evaluate(timelineMs: number): AvatarLayerOutput {
    return this.evaluateMoodAt(timelineMs)
  }

  /** Stops transitions and returns to initial mood. */
  stop(): void {
    this.prepareSeek()
  }

  /** Resolves the mood pose including explicit zeroes for non-duplicated mood keys. */
  private resolveMoodPose(mood: MoodName): AvatarMorphPose {
    const baseline = MOOD_BASELINES[mood]
    const pose: AvatarMorphPose = {}
    for (const key of COMPOSED_MOOD_KEYS) {
      pose[key] = baseline[key] ?? 0
    }
    return pose
  }

  /** Evaluates current mood/transition at one timeline position. */
  private evaluateMoodAt(timelineMs: number): AvatarLayerOutput {
    const transition = this.transition
    if (!transition || timelineMs < transition.startMs) {
      return { morphs: this.resolveMoodPose(this.currentMood) }
    }

    if (timelineMs >= transition.endMs) {
      this.currentMood = transition.mood
      this.transition = null
      return { morphs: this.resolveMoodPose(this.currentMood) }
    }

    const progress = easeAvatarMoodProgress((timelineMs - transition.startMs) / (transition.endMs - transition.startMs))
    const morphs: AvatarMorphPose = {}
    for (const key of COMPOSED_MOOD_KEYS) {
      const from = transition.from[key] ?? 0
      const to = transition.to[key] ?? 0
      morphs[key] = from + (to - from) * progress
    }
    return { morphs }
  }
}

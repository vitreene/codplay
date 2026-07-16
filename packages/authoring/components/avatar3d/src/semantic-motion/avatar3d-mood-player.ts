import { MOOD_BASELINES } from '@codplay/avatar-engine'
import type { AvatarEngine, MoodName } from '@codplay/avatar-engine'

type MoodBaseline = Record<string, number>

type ActiveMoodTransition = {
  mood: MoodName
  from: MoodBaseline
  to: MoodBaseline
  keys: Set<string>
  startMs: number
  endMs: number
}

type MoodEvaluationMode = 'play' | 'seek'

const ALL_MOOD_KEYS = new Set(
  Object.values(MOOD_BASELINES).flatMap((baseline) => Object.keys(baseline)),
)

/** Returns true when a value is one of AvatarEngine's known mood names. */
export function isAvatar3DMoodName(value: unknown): value is MoodName {
  return typeof value === 'string' && value in MOOD_BASELINES
}

/** Smooth deterministic interpolation for mood transitions. */
export function easeMoodProgress(progress: number): number {
  const t = Math.max(0, Math.min(1, progress))
  return t * t * (3 - 2 * t)
}

/** Resolves one interpolated mood baseline value. Missing keys resolve to neutral zero. */
export function interpolateMoodValue(from: MoodBaseline, to: MoodBaseline, key: string, progress: number): number {
  const eased = easeMoodProgress(progress)
  const start = from[key] ?? 0
  const end = to[key] ?? 0
  return start + (end - start) * eased
}

/** Interpolates AvatarEngine mood baselines with CodPlay timeline time. */
export class Avatar3DMoodPlayer {
  private readonly engine: AvatarEngine
  private readonly initialMood: MoodName
  private currentBaseline: MoodBaseline
  private activeTransition: ActiveMoodTransition | null = null

  /** Creates one mood player bound to a loaded avatar engine. */
  constructor(input: {
    engine: AvatarEngine
    initialMood?: MoodName
  }) {
    this.engine = input.engine
    this.initialMood = input.initialMood ?? 'neutral'
    this.currentBaseline = { ...MOOD_BASELINES[this.initialMood] }
  }

  /** Applies one mood immediately and clears any in-flight transition. */
  setInstant(mood: MoodName): void {
    this.activeTransition = null
    this.currentBaseline = { ...MOOD_BASELINES[mood] }
    this.engine.setMood(mood)
    this.applyFinalBaseline(this.currentBaseline)
  }

  /** Starts one timeline-driven mood transition. */
  trigger(mood: MoodName, startMs: number, endMs: number, options: { evaluateImmediately: boolean }): void {
    if (endMs <= startMs) {
      this.setInstant(mood)
      return
    }

    this.evaluate(startMs, 'play')

    const to = { ...MOOD_BASELINES[mood] }
    this.activeTransition = {
      mood,
      from: { ...this.currentBaseline },
      to,
      keys: new Set([...Object.keys(this.currentBaseline), ...Object.keys(to)]),
      startMs,
      endMs,
    }

    if (options.evaluateImmediately) {
      this.evaluate(startMs, 'play')
    }
  }

  /** Resets mood state before seek replay reconstructs it. */
  prepareSeek(): void {
    this.activeTransition = null
    this.currentBaseline = { ...MOOD_BASELINES[this.initialMood] }
    this.engine.setMood(this.initialMood)
    this.applyFinalBaseline(this.currentBaseline)
  }

  /** Evaluates the current mood transition at one absolute CodPlay timeline position. */
  evaluate(timelineMs: number, mode: MoodEvaluationMode): void {
    const transition = this.activeTransition
    if (!transition || timelineMs < transition.startMs) return

    if (timelineMs >= transition.endMs) {
      this.activeTransition = null
      this.currentBaseline = { ...transition.to }
      this.engine.setMood(transition.mood)
      this.applyFinalBaseline(transition.to)
      return
    }

    const progress = (timelineMs - transition.startMs) / (transition.endMs - transition.startMs)
    const nextBaseline: MoodBaseline = {}
    for (const key of transition.keys) {
      nextBaseline[key] = interpolateMoodValue(transition.from, transition.to, key, progress)
    }

    this.currentBaseline = nextBaseline
    this.applyInterpolatedBaseline(nextBaseline, transition.keys, mode)
  }

  /** Stops any in-flight transition without changing the currently applied baseline. */
  stop(): void {
    this.activeTransition = null
  }

  /** Applies a transitional baseline as a deterministic timeline sample. */
  private applyInterpolatedBaseline(baseline: MoodBaseline, keys: Iterable<string>, mode: MoodEvaluationMode): void {
    void mode
    for (const key of keys) {
      this.engine.morphEngine.setBaseline(key, baseline[key] ?? null)
      this.engine.morphEngine.snapFixed(key, null)
    }
  }

  /** Applies a completed mood baseline, clearing keys absent from the target mood. */
  private applyFinalBaseline(baseline: MoodBaseline): void {
    for (const key of ALL_MOOD_KEYS) {
      this.engine.morphEngine.setBaseline(key, baseline[key] ?? null)
      this.engine.morphEngine.snapFixed(key, null)
    }
  }
}

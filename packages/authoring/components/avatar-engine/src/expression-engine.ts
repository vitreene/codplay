/**
 * Expression / mood engine.
 *
 * Manages the resting baseline for facial morph targets according to a named mood.
 * Baselines are applied to MorphEngine and eased in/out by the morph update loop.
 *
 * Baseline values are taken verbatim from TalkingHead animMoods by Mika Suominen (met4citizen), MIT.
 * Source: https://github.com/met4citizen/TalkingHead
 *
 * Alias morphs (mouthSmile, eyesClosed, …) are expanded by MorphEngine.setBaseline().
 */
import type { MorphEngine } from './morph-engine.js'

export type MoodName = 'neutral' | 'happy' | 'angry' | 'sad' | 'fear' | 'disgust' | 'love' | 'sleep'

/** Morph baseline values per mood (alias morphs allowed). */
export type MoodBaseline = Record<string, number>

/** Baselines from TH animMoods — only the `baseline` sub-object is extracted here. */
export const MOOD_BASELINES: Record<MoodName, MoodBaseline> = {
  neutral: {
    eyesLookDown: 0.1,
  },
  happy: {
    mouthSmile: 0.2,
    eyesLookDown: 0.1,
  },
  angry: {
    eyesLookDown: 0.1,
    browDownLeft: 0.6,
    browDownRight: 0.6,
    jawForward: 0.3,
    mouthFrownLeft: 0.7,
    mouthFrownRight: 0.7,
    mouthRollLower: 0.2,
    mouthShrugLower: 0.3,
    handFistLeft: 1,
    handFistRight: 1,
  },
  sad: {
    eyesLookDown: 0.2,
    browDownRight: 0.1,
    browInnerUp: 0.6,
    browOuterUpRight: 0.2,
    eyeSquintLeft: 0.7,
    eyeSquintRight: 0.7,
    mouthFrownLeft: 0.8,
    mouthFrownRight: 0.8,
    mouthLeft: 0.2,
    mouthPucker: 0.5,
    mouthRollLower: 0.2,
    mouthRollUpper: 0.2,
    mouthShrugLower: 0.2,
    mouthShrugUpper: 0.2,
    mouthStretchLeft: 0.4,
  },
  fear: {
    browInnerUp: 0.7,
    eyeSquintLeft: 0.5,
    eyeSquintRight: 0.5,
    eyeWideLeft: 0.6,
    eyeWideRight: 0.6,
    mouthClose: 0.1,
    mouthFunnel: 0.3,
    mouthShrugLower: 0.5,
    mouthShrugUpper: 0.5,
  },
  disgust: {
    browDownLeft: 0.7,
    browDownRight: 0.1,
    browInnerUp: 0.3,
    eyeSquintLeft: 1,
    eyeSquintRight: 1,
    eyeWideLeft: 0.5,
    eyeWideRight: 0.5,
    eyesRotateX: 0.05,
    mouthLeft: 0.4,
    mouthPressLeft: 0.3,
    mouthRollLower: 0.3,
    mouthShrugLower: 0.3,
    mouthShrugUpper: 0.8,
    mouthUpperUpLeft: 0.3,
    noseSneerLeft: 1,
    noseSneerRight: 0.7,
  },
  love: {
    browInnerUp: 0.4,
    browOuterUpLeft: 0.2,
    browOuterUpRight: 0.2,
    mouthSmile: 0.2,
    eyeBlinkLeft: 0.6,
    eyeBlinkRight: 0.6,
    eyeWideLeft: 0.7,
    eyeWideRight: 0.7,
    bodyRotateX: 0.1,
    mouthDimpleLeft: 0.1,
    mouthDimpleRight: 0.1,
    mouthPressLeft: 0.2,
    mouthShrugUpper: 0.2,
    mouthUpperUpLeft: 0.1,
    mouthUpperUpRight: 0.1,
  },
  sleep: {
    eyeBlinkLeft: 1,
    eyeBlinkRight: 1,
    eyesClosed: 0.6,
  },
}

export class ExpressionEngine {
  private currentMood: MoodName = 'neutral'
  private readonly engine: MorphEngine

  constructor(engine: MorphEngine) {
    this.engine = engine
  }

  get mood(): MoodName {
    return this.currentMood
  }

  /**
   * Transition to a new mood.
   * Clears baselines from the previous mood, then applies the new ones.
   * The MorphEngine easing loop will smooth the transition.
   */
  setMood(name: MoodName): void {
    if (name === this.currentMood) return

    const prev = MOOD_BASELINES[this.currentMood]
    const next = MOOD_BASELINES[name]

    // Clear baselines that are NOT in the incoming mood
    for (const key of Object.keys(prev)) {
      if (!(key in next)) {
        this.engine.setBaseline(key, null)
      }
    }

    // Apply new baselines
    for (const [key, value] of Object.entries(next)) {
      this.engine.setBaseline(key, value)
    }

    this.currentMood = name
  }

  /** Apply current mood baselines to a freshly initialised MorphEngine. */
  applyInitial(): void {
    const baseline = MOOD_BASELINES[this.currentMood]
    for (const [key, value] of Object.entries(baseline)) {
      this.engine.setBaseline(key, value)
    }
  }
}

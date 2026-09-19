import type { AvatarEngine, BlinkScheduleFn, MoodName } from '@codplay/avatar-engine'
import { createAvatarMoodMorphs } from './avatar-mood-profile'
import type { AvatarMorphs } from './avatar-types'

type GestureContribution = Readonly<{
  name: string
  seed: number
}> | null

/** Native capability published by the central Avatar component. */
export type AvatarTarget = Readonly<{
  applyMood: (morphs: AvatarMorphs) => void
  applyMorphs: (morphs: AvatarMorphs) => void
  setGesture: (name: string | null, seed?: number) => void
  setBlinkSchedule: (schedule: BlinkScheduleFn | null) => void
}>

/** Collects feature contributions and applies them to one loaded Avatar engine. */
export class AvatarCoordinator {
  private engine: AvatarEngine | undefined
  private moodMorphs: AvatarMorphs
  private gesture: GestureContribution = null
  private blinkSchedule: BlinkScheduleFn | null = null
  private fixedMorphs: AvatarMorphs = {}
  private appliedMoodMorphs: AvatarMorphs | undefined
  private appliedFixedMorphs: AvatarMorphs | undefined
  private appliedGestureKey: string | undefined
  private lastTimeMs: number | undefined
  private revision = 0

  /** Creates a coordinator with the Avatar's stable initial mood. */
  constructor(initialMood: MoodName = 'neutral') {
    this.moodMorphs = createAvatarMoodMorphs(initialMood)
  }

  /** Attaches the loaded native engine without exposing it to feature components. */
  attachEngine(engine: AvatarEngine): void {
    this.engine = engine
    engine.setBlinkScheduleFn(this.blinkSchedule)
    this.appliedMoodMorphs = undefined
    this.appliedFixedMorphs = undefined
    this.appliedGestureKey = undefined
    this.lastTimeMs = undefined
    this.revision += 1
  }

  /** Releases the native engine owned by the central Avatar component. */
  detachEngine(): void {
    this.engine = undefined
    this.appliedMoodMorphs = undefined
    this.appliedFixedMorphs = undefined
    this.appliedGestureKey = undefined
    this.lastTimeMs = undefined
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

  /** Stores and applies one feature-owned fixed morph state. */
  applyMorphs(morphs: AvatarMorphs): void {
    if (sameMorphs(this.fixedMorphs, morphs)) return
    this.fixedMorphs = { ...morphs }
    this.revision += 1
    this.applyFixedLayer()
  }

  /** Stores the latest gesture contribution with a deterministic random seed. */
  setGesture(name: string | null, seed = 0): void {
    const next = name === null ? null : { name, seed }
    if (sameGesture(this.gesture, next)) return
    this.gesture = next
    this.revision += 1
  }

  /** Stores the idle blink schedule and installs it on the loaded engine. */
  setBlinkSchedule(schedule: BlinkScheduleFn | null): void {
    if (this.blinkSchedule === schedule) return
    this.blinkSchedule = schedule
    this.revision += 1
    this.engine?.setBlinkScheduleFn(schedule)
  }

  /** Applies all collected contributions at one absolute CodPlay time. */
  applyAt(timeMs: number): void {
    const engine = this.engine
    if (engine === undefined) return

    const seeking = this.lastTimeMs !== undefined && timeMs < this.lastTimeMs
    if (seeking) {
      engine.prepareSeek()
      engine.setBlinkScheduleFn(this.blinkSchedule)
      this.appliedMoodMorphs = undefined
      this.appliedFixedMorphs = undefined
      this.appliedGestureKey = undefined
      this.lastTimeMs = 0
    }

    this.applyMoodLayer()
    this.applyFixedLayer()

    const gestureKey = this.gesture === null ? 'none' : `${this.gesture.name}:${this.gesture.seed}`
    if (this.appliedGestureKey !== gestureKey) {
      if (this.gesture === null) engine.releaseGesture()
      else engine.playGesture(this.gesture.name, createSeededRng(this.gesture.seed))
      this.appliedGestureKey = gestureKey
    }

    if (seeking) {
      engine.commitSeek(timeMs)
    } else {
      const deltaMs = Math.max(0, timeMs - (this.lastTimeMs ?? timeMs))
      engine.animate(deltaMs)
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
    if (engine === undefined || sameMorphs(this.appliedFixedMorphs, this.fixedMorphs)) return

    const names = new Set([
      ...Object.keys(this.appliedFixedMorphs ?? {}),
      ...Object.keys(this.fixedMorphs),
    ])
    for (const name of names) {
      engine.morphEngine.snapFixed(name, this.fixedMorphs[name] ?? null)
    }
    this.appliedFixedMorphs = { ...this.fixedMorphs }
  }
}

/** Compares two optional gesture contributions without serializing them. */
function sameGesture(left: GestureContribution, right: GestureContribution): boolean {
  if (left === null || right === null) return left === right
  return left.name === right.name && left.seed === right.seed
}

/** Compares two morph layers without serializing their values. */
function sameMorphs(left: AvatarMorphs | undefined, right: AvatarMorphs): boolean {
  if (left === undefined) return false
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false
  return leftKeys.every((name) => Object.is(left[name], right[name]))
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

import type { AvatarEngine } from '@codplay/avatar-engine'
import type { Avatar3DMotion, Avatar3DMotionCatalog, Avatar3DMotionRef } from './avatar3d-motion-types.js'
import { resolveMotionDurationMs, sampleMotionChannel } from './avatar3d-motion-utils.js'

type MotionWarningReporter = (code: string, message: string, details?: Record<string, unknown>) => void

type ActiveMotion = {
  motion: Avatar3DMotion
  startMs: number
  endMs: number
  touchedMorphs: Set<string>
}

type MotionEvaluationMode = 'play' | 'seek'

/** Returns true when every MotionEngine channel sample is a finite number. */
function isNumericChannel(values: readonly unknown[]): values is number[] {
  return values.every((value) => typeof value === 'number' && Number.isFinite(value))
}

/** Plays one morph/bone-morph semantic motion against AvatarEngine. */
export class Avatar3DMotionPlayer {
  private readonly engine: AvatarEngine
  private readonly catalog: Avatar3DMotionCatalog
  private readonly report: MotionWarningReporter
  private activeMotion: ActiveMotion | null = null
  private readonly warnedKeys = new Set<string>()

  /** Creates one player bound to a loaded avatar engine. */
  constructor(input: {
    engine: AvatarEngine
    catalog?: Avatar3DMotionCatalog
    report: MotionWarningReporter
  }) {
    this.engine = input.engine
    this.catalog = input.catalog ?? {}
    this.report = input.report
  }

  /** Registers one motion action at its CodPlay event time. */
  trigger(ref: Avatar3DMotionRef | null | undefined, eventMs: number, options: { evaluateImmediately: boolean }): void {
    this.stop('interrupted', 'play')

    if (ref == null) return

    const motion = this.resolveMotion(ref)
    if (!motion) return

    const durationMs = resolveMotionDurationMs(motion.dt)
    if (durationMs <= 0) {
      if (options.evaluateImmediately) {
        this.applyMotion(motion, 0, new Set())
      }
      return
    }

    this.activeMotion = {
      motion,
      startMs: eventMs,
      endMs: eventMs + durationMs,
      touchedMorphs: new Set(),
    }

    if (options.evaluateImmediately) {
      this.evaluate(eventMs, 'play')
    }
  }

  /** Clears active motion state before seek replay reconstructs it. */
  prepareSeek(): void {
    this.stop('seek-reset', 'seek')
  }

  /** Evaluates the active motion at one absolute CodPlay timeline position. */
  evaluate(timelineMs: number, mode: MotionEvaluationMode = 'play'): void {
    const active = this.activeMotion
    if (!active) return

    if (timelineMs < active.startMs) return
    if (timelineMs >= active.endMs) {
      this.stop('completed', mode)
      return
    }

    this.applyMotion(active.motion, timelineMs - active.startMs, active.touchedMorphs)
  }

  /** Stops the active motion and releases morphs fixed by this player. */
  stop(_reason: 'completed' | 'interrupted' | 'seek-reset' | 'stop', mode: MotionEvaluationMode = 'play'): void {
    const active = this.activeMotion
    if (!active) return

    for (const name of active.touchedMorphs) {
      if (mode === 'seek') {
        this.engine.morphEngine.snapFixed(name, null)
      } else {
        this.engine.morphEngine.setFixed(name, null)
      }
    }
    this.activeMotion = null
  }

  /** Resolves an inline motion or catalog reference. */
  private resolveMotion(ref: Avatar3DMotionRef): Avatar3DMotion | null {
    if (typeof ref !== 'string') return ref

    const motion = this.catalog[ref]
    if (!motion) {
      this.report('AVATAR3D_MOTION_NOT_FOUND', 'Avatar3D motion was not found', { motion: ref })
      return null
    }

    return motion
  }

  /** Applies every supported numeric channel in one motion at local elapsed time. */
  private applyMotion(motion: Avatar3DMotion, elapsedMs: number, touchedMorphs: Set<string>): void {
    const channels = motion.vs
    if (!channels) return

    for (const [name, values] of Object.entries(channels)) {
      if (name === 'gesture' || name === 'pose') continue

      if (!isNumericChannel(values)) {
        this.warnOnce(`invalid:${name}`, 'AVATAR3D_MOTION_CHANNEL_INVALID', 'Avatar3D motion channel has non-numeric samples', { channel: name })
        continue
      }

      if (!this.isSupportedChannel(name)) {
        this.warnOnce(`unsupported:${name}`, 'AVATAR3D_MOTION_CHANNEL_UNSUPPORTED', 'Avatar3D motion channel is not supported by this avatar', { channel: name })
        continue
      }

      const value = sampleMotionChannel(values, motion.dt, elapsedMs)
      if (value === null) {
        this.warnOnce(`invalid:${name}`, 'AVATAR3D_MOTION_CHANNEL_INVALID', 'Avatar3D motion channel has invalid samples or timing', { channel: name })
        continue
      }

      touchedMorphs.add(name)
      this.engine.morphEngine.snapFixed(name, value)
    }
  }

  /** Returns true for real morph names, bone morph names, and MorphEngine aliases. */
  private isSupportedChannel(name: string): boolean {
    return this.engine.morphEngine.morphs.has(name) || name in this.engine.morphEngine.aliases
  }

  /** Emits one warning at most once per player instance and warning key. */
  private warnOnce(key: string, code: string, message: string, details?: Record<string, unknown>): void {
    if (this.warnedKeys.has(key)) return
    this.warnedKeys.add(key)
    this.report(code, message, details)
  }
}

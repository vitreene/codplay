import type { ComponentActionOccurrence } from '../../components'
import { REPLACE_STAGGER_SHARE_UPPER_BOUND } from '../../config/replace'
import type { RuntimeComponentUpdateContext, RuntimeModuleServiceSeekHandle } from '../../engine'
import type { SolvedScene } from '../../player/pipeline/types'

/** One replace occurrence as seen from a seek target, with an upper bound of its end. */
export type ReplaceSeekOccurrence = Readonly<{
  key: string
  startAt: number
  maxEndAt: number
}>

/** Collects the replace occurrences of one perso, oldest first. */
export type ReplaceSeekOccurrenceCollector = (
  persoType: string,
  actions: readonly ComponentActionOccurrence[],
) => readonly ReplaceSeekOccurrence[]

/** Bounds the end of one transition whose propagation envelope may be DOM-measured. */
export function resolveReplaceMaxEndAt(
  startAt: number,
  durationMs: number,
  propagates: boolean,
  staggerMs: number | undefined,
): number {
  const envelope = propagates ? staggerMs ?? Math.round(durationMs * REPLACE_STAGGER_SHARE_UPPER_BOUND) : 0
  return startAt + durationMs + envelope
}

/**
 * Selects the occurrences whose presentation is visible at a seek target: the
 * latest one when it is still running, then each older one still running when
 * the next selected occurrence starts (interruption chain). An occurrence
 * outside this chain has no visible effect at the target.
 */
export function resolveRequiredReplaceKeys(
  occurrences: readonly ReplaceSeekOccurrence[],
  targetMs: number,
): ReadonlySet<string> {
  const required = new Set<string>()
  let observedAt = targetMs
  for (let index = occurrences.length - 1; index >= 0; index -= 1) {
    const occurrence = occurrences[index]
    if (occurrence === undefined || occurrence.maxEndAt <= observedAt) break
    required.add(occurrence.key)
    observedAt = occurrence.startAt
  }
  return required
}

/**
 * Holds, for one seek transaction, the replace occurrences that must open a
 * session while the player replays the boundaries before its target.
 */
export class ReplaceSeekRequirements {
  private readonly collect: ReplaceSeekOccurrenceCollector
  private pending: Readonly<{ timeMs: number; keys: ReadonlyMap<string, ReadonlySet<string>> }> | undefined
  private active: Readonly<{ timeMs: number; keys: ReadonlyMap<string, ReadonlySet<string>> }> | undefined

  /** Creates the requirement holder for one replace module. */
  constructor(collect: ReplaceSeekOccurrenceCollector) {
    this.collect = collect
  }

  /** Stages the requirements of one seek target; the player commits or aborts them. */
  prepare(scene: SolvedScene): RuntimeModuleServiceSeekHandle {
    const keys = new Map<string, ReadonlySet<string>>()
    for (const perso of Object.values(scene.persos)) {
      const occurrences = this.collect(perso.type, perso.actions ?? [])
      if (occurrences.length > 0) keys.set(perso.key, resolveRequiredReplaceKeys(occurrences, scene.timeMs))
    }
    this.pending = { timeMs: scene.timeMs, keys }
    return {
      commit: () => {
        this.active = this.pending
        this.pending = undefined
      },
      abort: () => {
        this.pending = undefined
      },
    }
  }

  /** Reports whether one replayed boundary must not open a session for this occurrence. */
  skips(update: RuntimeComponentUpdateContext, key: string): boolean {
    const active = this.active
    if (active === undefined || update.phase !== 'seek' || update.timeMs >= active.timeMs) return false
    return active.keys.get(update.componentId)?.has(key) !== true
  }

  /** Ends the seek transaction once its target scene has been presented. */
  clear(): void {
    this.pending = undefined
    this.active = undefined
  }
}

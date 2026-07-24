/**
 * Pure construction-time helper — no dependency on codplay, straps, tracks or
 * stories. Given a list of already-known, relatively-timed entries and a cut
 * window, splits out two relative-from-zero lists (`back`, `resume`) meant to
 * be handed as-is to `context.planned.sequence` inside whichever straps a
 * scene chooses to drive its own "reverse playback" illusion.
 */

export type TimedEntry<T> = { offsetMs: number; value: T }

export type ReverseIllusionSpec = {
  /** Low cut, within the original sequence (e.g. 2000) — the look being mimicked. */
  targetOffsetMs: number
  /** High cut, within the original sequence (e.g. 5000) — the trigger instant. */
  triggerOffsetMs: number
  /** Duration of the reverse trip, compressed from (triggerOffsetMs - targetOffsetMs). */
  reverseDurationMs: number
  /** Duration of the frozen hold once "arrived" at targetOffsetMs. */
  pauseDurationMs: number
}

export type ReverseIllusionSplit<T> = {
  /** Relative-from-zero — feed to context.planned.sequence in the "back" strap. */
  back: TimedEntry<T>[]
  /** Relative-from-zero — feed to context.planned.sequence in the "resume" strap. */
  resume: TimedEntry<T>[]
}

export function buildReverseIllusionSchedule<T>(
  entries: TimedEntry<T>[],
  spec: ReverseIllusionSpec,
): ReverseIllusionSplit<T> {
  const { targetOffsetMs, triggerOffsetMs, reverseDurationMs } = spec
  const windowDurationMs = triggerOffsetMs - targetOffsetMs

  const windowEntries = entries.filter(
    (entry) => entry.offsetMs >= targetOffsetMs && entry.offsetMs < triggerOffsetMs,
  )
  const tailEntries = entries.filter((entry) => entry.offsetMs >= triggerOffsetMs)

  const reverseScale = windowDurationMs === 0 ? 0 : reverseDurationMs / windowDurationMs
  const back: TimedEntry<T>[] = windowEntries.map((entry) => ({
    offsetMs: (triggerOffsetMs - entry.offsetMs) * reverseScale,
    value: entry.value,
  }))

  const resumeWindow: TimedEntry<T>[] = windowEntries.map((entry) => ({
    offsetMs: entry.offsetMs - targetOffsetMs,
    value: entry.value,
  }))
  const resumeTail: TimedEntry<T>[] = tailEntries.map((entry) => ({
    offsetMs: windowDurationMs + (entry.offsetMs - triggerOffsetMs),
    value: entry.value,
  }))

  return {
    back: back.sort((a, b) => a.offsetMs - b.offsetMs),
    resume: [...resumeWindow, ...resumeTail].sort((a, b) => a.offsetMs - b.offsetMs),
  }
}

/** offsetMs at which the "resume" strap should be triggered, relative to `triggerOffsetMs`. */
export function resolveResumeDelayMs(spec: Pick<ReverseIllusionSpec, 'reverseDurationMs' | 'pauseDurationMs'>): number {
  return spec.reverseDurationMs + spec.pauseDurationMs
}

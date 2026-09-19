import type { CompiledEventime } from '../../../scene/compiled'
import { createCompiledEventimeEventId } from '../eventime'
import type { RuntimeTrackEvent } from '../pipeline'

/** Name of the terminal event consumed by the player lifecycle. */
export const RUNTIME_SEQUENCE_END_EVENT_NAME = 'sequence:end' as const

/** One sequence-end occurrence reached by the playing cursor. */
export type RuntimeSequenceEndOccurrence = Readonly<{
  kind: 'compiled'
  event: CompiledEventime
  applyAtMs: number
  trackId: string
  storyId?: string
  eventId: string
}> | Readonly<{
  kind: 'journal'
  event: RuntimeTrackEvent
  applyAtMs: number
}>

/** Collects nested compiled sequence-end declarations with resolved ownership. */
export function collectSequenceEndOccurrences(
  eventimes: readonly CompiledEventime[],
  scope: 'scene' | 'story',
  trackId: string,
  storyId?: string,
  parentStartAt = 0,
  parentPath: readonly number[] = [],
): readonly RuntimeSequenceEndOccurrence[] {
  return eventimes.flatMap((eventime, index) => {
    const startAt = parentStartAt + eventime.startAt
    const declarationPath = [...parentPath, index]
    return [
      ...(eventime.name === RUNTIME_SEQUENCE_END_EVENT_NAME
        ? [{
          kind: 'compiled' as const,
          event: eventime,
          applyAtMs: startAt,
          trackId,
          ...(storyId === undefined ? {} : { storyId }),
          eventId: createCompiledEventimeEventId(scope, trackId, storyId, declarationPath),
        }]
        : []),
      ...collectSequenceEndOccurrences(eventime.events ?? [], scope, trackId, storyId, startAt, declarationPath),
    ]
  })
}

/** Orders terminal occurrences by time and then by their existing runtime order. */
export function compareSequenceEndOccurrences(
  left: RuntimeSequenceEndOccurrence,
  right: RuntimeSequenceEndOccurrence,
): number {
  if (left.applyAtMs !== right.applyAtMs) return left.applyAtMs - right.applyAtMs
  if (left.kind === 'journal' && right.kind === 'journal') return left.event.eventSeq - right.event.eventSeq
  if (left.kind === 'journal') return 1
  if (right.kind === 'journal') return -1
  return left.eventId.localeCompare(right.eventId)
}

/** Applies the play-only boundary rule used for static and live terminal events. */
export function isSequenceEndInRange(
  eventTimeMs: number,
  previousTimeMs: number | undefined,
  currentTimeMs: number,
): boolean {
  if (eventTimeMs > currentTimeMs) return false
  if (previousTimeMs === undefined) return eventTimeMs === currentTimeMs
  return eventTimeMs >= previousTimeMs
}

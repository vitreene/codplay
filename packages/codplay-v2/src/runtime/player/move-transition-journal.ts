import { isPlainRecord } from '../../shared'
import type { CompiledEventime, CompiledRecord, CompiledScene, CompiledValue } from '../../scene/compiled'
import type { MoveFlipMode, MoveTransition } from '../config/move'

/** One statically declared move transition that can be realized during seek. */
export type MoveTransitionOccurrence = Readonly<{
  captureId: string
  eventId: string
  storyId: string
  persoKey: string
  declarationPath: readonly number[]
  startAt: number
  endAt: number
  sourceTimeMs: number
  destinationTimeMs: number
  fromTargetId?: string
  toTargetId?: string
  transition: MoveTransition
  flipMode?: MoveFlipMode
}>

/** Immutable journal of transition occurrences declared in a compiled scene. */
export class MoveTransitionJournal {
  private readonly occurrences: readonly MoveTransitionOccurrence[]

  /** Indexes every compiled move carrying a positive transition duration. */
  constructor(scene: CompiledScene) {
    this.occurrences = collectMoveTransitionOccurrences(scene)
  }

  /** Returns all statically declared move transitions active at one time. */
  findActive(timeMs: number): readonly MoveTransitionOccurrence[] {
    return this.occurrences
      .filter((occurrence) => timeMs >= occurrence.startAt && timeMs <= occurrence.endAt)
  }

  /** Returns active occurrences after same-tick policy keeps the last declaration. */
  findActiveEffective(timeMs: number): readonly MoveTransitionOccurrence[] {
    const effective = new Map<string, MoveTransitionOccurrence>()
    for (const occurrence of this.findActive(timeMs)) {
      effective.set(`${occurrence.persoKey}:${occurrence.startAt}`, occurrence)
    }
    return [...effective.values()]
      .sort((left, right) => left.startAt - right.startAt || comparePaths(left.declarationPath, right.declarationPath))
  }

  /** Returns occurrences starting after one boundary and no later than another. */
  findStartingBetween(startExclusive: number, endInclusive: number): readonly MoveTransitionOccurrence[] {
    return this.occurrences.filter((occurrence) =>
      occurrence.startAt > startExclusive && occurrence.startAt <= endInclusive)
  }

  /** Finds the stable occurrence corresponding to one solved move delta. */
  findByMove(persoKey: string, startAt: number): MoveTransitionOccurrence | undefined {
    return this.occurrences
      .filter((occurrence) => occurrence.persoKey === persoKey && occurrence.startAt === startAt)
      .at(-1)
  }
}

/** Collects nested eventime moves without executing any author code. */
function collectMoveTransitionOccurrences(scene: CompiledScene): readonly MoveTransitionOccurrence[] {
  const occurrences: MoveTransitionOccurrence[] = []
  for (const [storyId, story] of Object.entries(scene.scene.stories)) {
    for (const perso of story.persos) {
      for (const event of flattenEventimes(story.eventimes ?? [])) {
        const action = resolveAction(perso.actions[event.name], event.data)
        const move = action?.move
        if (!isPlainRecord(move)) continue
        const moveRecord = move as CompiledRecord
        const transition = readTransition(moveRecord.transition)
        if (transition?.duration === undefined || transition.duration <= 0) continue
        const eventId = `${storyId}:${perso.id}:${event.name}:${event.declarationPath.join('.')}`
        occurrences.push({
          captureId: `compiled:${eventId}:${event.startAt}`,
          eventId,
          storyId,
          persoKey: `${storyId}:${perso.id}`,
          declarationPath: event.declarationPath,
          startAt: event.startAt,
          endAt: event.startAt + transition.duration,
          sourceTimeMs: Math.max(0, event.startAt - 0.0001),
          destinationTimeMs: event.startAt,
          transition,
          ...(moveRecord.flipMode === 'local' || moveRecord.flipMode === 'overlay-world'
            ? { flipMode: moveRecord.flipMode }
            : {}),
        })
      }
    }
  }
  return occurrences.sort((left, right) => left.startAt - right.startAt || comparePaths(left.declarationPath, right.declarationPath))
}

/** Flattens nested eventimes into absolute declaration positions. */
function flattenEventimes(
  eventimes: readonly CompiledEventime[],
  parentStartAt = 0,
  parentPath: readonly number[] = [],
): readonly Readonly<{ name: string; data?: CompiledRecord; startAt: number; declarationPath: readonly number[] }>[] {
  return eventimes.flatMap((event, index) => {
    const startAt = parentStartAt + event.startAt
    const declarationPath = [...parentPath, index]
    return [
      { name: event.name, data: event.data, startAt, declarationPath },
      ...flattenEventimes(event.events ?? [], startAt, declarationPath),
    ]
  })
}

/** Selects one action record, including the null-action event-data form. */
function resolveAction(value: CompiledValue | undefined, eventData: CompiledRecord | undefined): CompiledRecord | undefined {
  if (isPlainRecord(value)) return value
  if (value === null && eventData !== undefined) return eventData
  return undefined
}

/** Reads compiler-prepared transition data without accepting runtime functions. */
function readTransition(value: CompiledValue | undefined): MoveTransition | undefined {
  if (!isPlainRecord(value)) return undefined
  const transition = value as CompiledRecord
  if (transition.duration !== undefined && typeof transition.duration !== 'number') return undefined
  if (transition.duration !== undefined && (!Number.isFinite(transition.duration) || transition.duration <= 0)) return undefined
  return transition as MoveTransition
}

/** Compares declaration paths without depending on object insertion order. */
function comparePaths(left: readonly number[], right: readonly number[]): number {
  const length = Math.min(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const difference = left[index]! - right[index]!
    if (difference !== 0) return difference
  }
  return left.length - right.length
}

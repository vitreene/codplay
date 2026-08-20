import { isPreparedPath, type Path } from '../../ace'
import { isPlainRecord } from '../../shared'
import type { CompiledEventime, CompiledRecord, CompiledScene, CompiledValue } from '../../scene/compiled'
import type { MoveFlipMode } from '../config/move'
import type { MotionPresentationMode } from './types'

/** One immutable direct movement scheduled by the compiled scene. */
export type ScheduledMotionIntent = Readonly<{
  id: string
  eventId: string
  itemId: string
  declarationPath: readonly number[]
  startAt: number
  duration: number
  ease: string
  presentationMode: MotionPresentationMode
  path?: Path
}>

/** Compiles the complete direct-motion schedule without executing author code. */
export function compileMotionSchedule(scene: CompiledScene): readonly ScheduledMotionIntent[] {
  const effective = new Map<string, ScheduledMotionIntent>()
  for (const [storyId, story] of Object.entries(scene.scene.stories)) {
    for (const perso of story.persos) {
      for (const event of flattenEventimes(story.eventimes ?? [])) {
        const action = resolveAction(perso.actions[event.name], event.data)
        const transition = readTransition(action?.move)
        if (transition === undefined) continue
        const itemId = `${storyId}:${perso.id}`
        const eventId = `${itemId}:${event.name}:${event.declarationPath.join('.')}`
        const intent: ScheduledMotionIntent = Object.freeze({
          id: `motion:${eventId}:${event.startAt}`,
          eventId,
          itemId,
          declarationPath: Object.freeze([...event.declarationPath]),
          startAt: event.startAt,
          duration: transition.duration,
          ease: transition.ease,
          presentationMode: resolvePresentationMode(transition.flipMode),
          ...(transition.path === undefined ? {} : { path: transition.path }),
        })
        // One item has one structural command at a boundary: the last declaration wins.
        effective.set(`${itemId}:${event.startAt}`, intent)
      }
    }
  }
  return Object.freeze([...effective.values()]
    .sort((left, right) => left.startAt - right.startAt || comparePaths(left.declarationPath, right.declarationPath)))
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

/** Reads one valid compiler-prepared movement transition. */
function readTransition(moveValue: CompiledValue | undefined): Readonly<{
  duration: number
  ease: string
  flipMode?: MoveFlipMode
  path?: Path
}> | undefined {
  if (!isPlainRecord(moveValue)) return undefined
  const move = moveValue as CompiledRecord
  if (!isPlainRecord(move.transition)) return undefined
  const transition = move.transition as CompiledRecord
  if (typeof transition.duration !== 'number'
    || !Number.isFinite(transition.duration)
    || transition.duration <= 0) return undefined
  if (transition.ease !== undefined && typeof transition.ease !== 'string') return undefined
  if (move.flipMode !== undefined && move.flipMode !== 'local' && move.flipMode !== 'overlay-world') return undefined
  if (transition.path !== undefined && !isPreparedPath(transition.path)) {
    throw new Error('Move transition path must be prepared by the scene compiler.')
  }
  return Object.freeze({
    duration: transition.duration,
    ease: (transition.ease as string | undefined) ?? 'out(2)',
    ...(move.flipMode === undefined ? {} : { flipMode: move.flipMode as MoveFlipMode }),
    ...(transition.path === undefined ? {} : { path: transition.path as Path }),
  })
}

/** Maps the public presentation choice to the graph's structural terminology. */
function resolvePresentationMode(mode: MoveFlipMode | undefined): MotionPresentationMode {
  return mode === 'overlay-world' ? 'reparent' : 'local'
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

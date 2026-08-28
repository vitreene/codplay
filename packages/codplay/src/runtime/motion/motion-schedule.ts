import { isPreparedPath, type Path } from 'ace'
import { compareNumberPaths, isPlainRecord } from '../../shared'
import type { CompiledEventime, CompiledRecord, CompiledScene, CompiledValue } from '../../scene/compiled'
import type { MoveFlipMode } from '../config/move'
import type { RuntimeTrackEvent, RuntimeTrackJournal } from '../player/pipeline/track-journal'
import type { MotionPresentationMode } from './types'

/** One immutable direct movement scheduled by the compiled scene. */
export type ScheduledMotionIntent = Readonly<{
  id: string
  eventId: string
  itemId: string
  declarationPath: readonly number[]
  startAt: number
  duration: number
  delay: number
  endAt: number
  ease: string
  presentationMode: MotionPresentationMode
  path?: Path
  /** Whether this movement may create target-sibling reflow segments. */
  targetReflow: boolean
}>

/** One action-owned transition that can contribute to a materialized pose. */
export type MotionScheduleTransition = Readonly<{
  duration: number
  delay?: number
  ease?: string
  flipMode?: MoveFlipMode
  path?: Path
  /** Move transitions reflow their source/target lists; pose transitions do not by default. */
  targetReflow?: boolean
}>

/** Selects which journaled facts participate in one motion schedule. */
export type MotionScheduleOptions = Readonly<{
  includePersistOnly?: boolean
  /** Resolves one materializer-specific action transition without reading the DOM. */
  resolveActionTransition?: (action: CompiledRecord | undefined) => MotionScheduleTransition | undefined
}>

/** Compiles the complete direct-motion schedule without executing author code. */
export function compileMotionSchedule(
  scene: CompiledScene,
  journal?: RuntimeTrackJournal,
  options: MotionScheduleOptions = {},
): readonly ScheduledMotionIntent[] {
  const effective = new Map<string, ScheduledMotionIntent>()
  for (const [storyId, story] of Object.entries(scene.scene.stories)) {
    for (const perso of story.persos) {
      for (const event of flattenEventimes(story.eventimes ?? [])) {
        const action = resolveAction(perso.actions[event.name], event.data)
        const itemId = `${storyId}:${perso.id}`
        const eventId = `${itemId}:${event.name}:${event.declarationPath.join('.')}`
        const moveTransition = readTransition(action?.move)
        const transition = moveTransition ?? options.resolveActionTransition?.(action)
        if (transition === undefined) continue
        const intent = createMotionIntent({
          id: `motion:${eventId}:${event.startAt}`,
          eventId,
          itemId,
          declarationPath: event.declarationPath,
          startAt: event.startAt,
          transition,
        })
        // One item has one effective action command at a boundary: the last declaration wins.
        effective.set(`${itemId}:${event.startAt}`, intent)
      }
    }
  }
  if (journal !== undefined) {
    for (const event of journalEvents(journal, options.includePersistOnly !== false)) {
      const targets = scene.actionTargetIndex[event.name] ?? []
      for (const target of targets) {
        if (!event.cascade && event.storyId !== target.storyId) continue
        const story = scene.scene.stories[target.storyId]
        const perso = story?.persos.find((candidate) => candidate.id === target.persoId)
        const action = resolveAction(perso?.actions[event.name], event.data)
        const transition = readTransition(action?.move) ?? options.resolveActionTransition?.(action)
        if (transition === undefined) continue
        const itemId = `${target.storyId}:${target.persoId}`
        const declarationPath = Object.freeze([Number.MAX_SAFE_INTEGER, event.eventSeq])
        effective.set(`${itemId}:${event.applyAtMs}`, createMotionIntent({
          id: `motion:${event.eventId}`,
          eventId: event.eventId,
          itemId,
          declarationPath,
          startAt: event.applyAtMs,
          transition,
        }))
      }
    }
  }
  return Object.freeze([...effective.values()]
    .sort((left, right) => left.startAt - right.startAt || compareNumberPaths(left.declarationPath, right.declarationPath)))
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
  if (isPlainRecord(value)) return eventData === undefined ? value : { ...value, ...eventData }
  if ((value === null || value === true) && eventData !== undefined) return eventData
  return undefined
}

/** Creates one normalized motion intent from compiled or journaled action data. */
function createMotionIntent(input: Readonly<{
  id: string
  eventId: string
  itemId: string
  declarationPath: readonly number[]
  startAt: number
  transition: Readonly<{
    duration: number
    delay?: number
    ease?: string
    flipMode?: MoveFlipMode
    path?: Path
    targetReflow?: boolean
  }>
}>): ScheduledMotionIntent {
  return Object.freeze({
    id: input.id,
    eventId: input.eventId,
    itemId: input.itemId,
    declarationPath: Object.freeze([...input.declarationPath]),
    startAt: input.startAt,
    duration: input.transition.duration,
    delay: input.transition.delay ?? 0,
    endAt: input.startAt + (input.transition.delay ?? 0) + input.transition.duration,
    ease: input.transition.ease ?? 'out(2)',
    presentationMode: resolvePresentationMode(input.transition.flipMode),
    targetReflow: input.transition.targetReflow ?? false,
    ...(input.transition.path === undefined ? {} : { path: input.transition.path }),
  })
}

/** Selects journaled events that can participate in the compiled action index. */
function journalEvents(
  journal: RuntimeTrackJournal,
  includePersistOnly: boolean,
): readonly RuntimeTrackEvent[] {
  return journal.getAllEvents()
    .filter((event) => includePersistOnly || event.mode !== 'persist-only')
    .filter((event) => journal.isTrackActive(event.trackId))
    .sort((left, right) => left.applyAtMs - right.applyAtMs || left.eventSeq - right.eventSeq)
}

/** Reads one valid compiler-prepared movement transition. */
function readTransition(moveValue: CompiledValue | undefined): Readonly<{
  duration: number
  delay?: number
  ease: string
  flipMode?: MoveFlipMode
  path?: Path
  targetReflow: boolean
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
    ...(transition.delay === undefined ? {} : { delay: readNonNegativeNumber(transition.delay, 'Move transition delay') }),
    ease: (transition.ease as string | undefined) ?? 'out(2)',
    ...(move.flipMode === undefined ? {} : { flipMode: move.flipMode as MoveFlipMode }),
    targetReflow: true,
    ...(transition.path === undefined ? {} : { path: transition.path as Path }),
  })
}

/** Reads one optional non-negative transition delay. */
function readNonNegativeNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite non-negative number.`)
  }
  return value
}

/** Maps the public presentation choice to the graph's structural terminology. */
function resolvePresentationMode(mode: MoveFlipMode | undefined): MotionPresentationMode {
  return mode === 'overlay-world' ? 'reparent' : 'local'
}

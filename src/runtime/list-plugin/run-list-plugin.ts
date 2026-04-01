import type { ListAutoAnimateConfig } from '../types'
import { computeListDiff } from './compute-list-diff'
import type {
  ListCommitPlan,
  ListDiff,
  ListPluginInput,
  ListPluginOutput,
  ListTraceEntry,
  ListTransitionDef
} from './types'

const DEFAULT_DURATION_MS = 280
const DEFAULT_EASING = 'easeOutQuad'
const DEFAULT_STAGGER_MS = 0
const DEFAULT_MAX_MOVE_ANIMATIONS = 24

/**
 * Resolves the animation config used for add/remove/move list transitions.
 */
function resolveAutoAnimateConfig(config: ListAutoAnimateConfig | undefined): Required<ListAutoAnimateConfig> {
  return {
    insert: config?.insert ?? true,
    remove: config?.remove ?? true,
    move: config?.move ?? true,
    durationMs: config?.durationMs ?? DEFAULT_DURATION_MS,
    easing: config?.easing ?? DEFAULT_EASING,
    staggerMs: config?.staggerMs ?? DEFAULT_STAGGER_MS
  }
}

/**
 * Creates one deterministic trace row for list plugin operations.
 */
function createTraceEntry(
  runtimeListId: string,
  eventName: ListTraceEntry['eventName'],
  traceIndex: number,
  payload?: Record<string, unknown>
): ListTraceEntry {
  return {
    traceId: `list-trace-${runtimeListId}-${eventName}-${traceIndex}`,
    eventName,
    runtimeListId,
    payload
  }
}

/**
 * Builds add/remove opacity transitions and commit plan from list diff.
 */
function buildPresenceTransitions(
  runtimeListId: string,
  diff: ListDiff,
  config: Required<ListAutoAnimateConfig>
): {
  transitions: ListTransitionDef[]
  commitPlan: ListCommitPlan
  trace: ListTraceEntry[]
} {
  const transitions: ListTransitionDef[] = []
  const trace: ListTraceEntry[] = []
  const commitPlan: ListCommitPlan = {
    leaving: [],
    detachAfterAnimation: []
  }

  let traceIndex = 1

  if (config.insert) {
    for (const [index, childId] of diff.added.entries()) {
      transitions.push({
        transitionId: `list-${runtimeListId}-enter-${childId}`,
        eventName: 'list:child:enter',
        childId,
        property: 'opacity',
        from: 0,
        to: 1,
        duration: config.durationMs,
        easing: config.easing,
        delayMs: index * config.staggerMs
      })

      trace.push(createTraceEntry(runtimeListId, 'list:child:enter', traceIndex, { childId }))
      traceIndex += 1
    }
  }

  if (config.remove) {
    for (const [index, childId] of diff.removed.entries()) {
      transitions.push({
        transitionId: `list-${runtimeListId}-leave-${childId}`,
        eventName: 'list:child:leave:started',
        childId,
        property: 'opacity',
        from: 1,
        to: 0,
        duration: config.durationMs,
        easing: config.easing,
        delayMs: index * config.staggerMs
      })

      commitPlan.leaving.push(childId)
      commitPlan.detachAfterAnimation.push(childId)
      trace.push(createTraceEntry(runtimeListId, 'list:child:leave:started', traceIndex, { childId }))
      traceIndex += 1
      trace.push(createTraceEntry(runtimeListId, 'list:child:leave:done', traceIndex, { childId }))
      traceIndex += 1
    }
  }

  return {
    transitions,
    commitPlan,
    trace
  }
}

/**
 * Builds FLIP move transitions from before/after position snapshots.
 */
function buildMoveTransitions(
  runtimeListId: string,
  diff: ListDiff,
  config: Required<ListAutoAnimateConfig>,
  input: ListPluginInput
): {
  transitions: ListTransitionDef[]
  trace: ListTraceEntry[]
  fallbackUsed: boolean
  droppedMoveAnimations: number
} {
  const transitions: ListTransitionDef[] = []
  const trace: ListTraceEntry[] = []

  if (!config.move) {
    return {
      transitions,
      trace,
      fallbackUsed: false,
      droppedMoveAnimations: 0
    }
  }

  const maxMoveAnimations = input.perf?.maxMoveAnimations ?? DEFAULT_MAX_MOVE_ANIMATIONS
  if (diff.moved.length > maxMoveAnimations) {
    trace.push(
      createTraceEntry(runtimeListId, 'list:perf:fallback', 1, {
        movedCount: diff.moved.length,
        maxMoveAnimations
      })
    )

    return {
      transitions,
      trace,
      fallbackUsed: true,
      droppedMoveAnimations: diff.moved.length
    }
  }

  for (const [index, childId] of diff.moved.entries()) {
    const before = input.positionsBefore?.[childId]
    const after = input.positionsAfter?.[childId]
    if (before === undefined || after === undefined) {
      continue
    }

    const deltaX = before.x - after.x
    const deltaY = before.y - after.y
    if (deltaX === 0 && deltaY === 0) {
      continue
    }

    if (deltaX !== 0) {
      transitions.push({
        transitionId: `list-${runtimeListId}-move-x-${childId}`,
        eventName: 'list:child:move:flip',
        childId,
        property: 'x',
        from: deltaX,
        to: 0,
        duration: config.durationMs,
        easing: config.easing,
        delayMs: index * config.staggerMs
      })
    }

    if (deltaY !== 0) {
      transitions.push({
        transitionId: `list-${runtimeListId}-move-y-${childId}`,
        eventName: 'list:child:move:flip',
        childId,
        property: 'y',
        from: deltaY,
        to: 0,
        duration: config.durationMs,
        easing: config.easing,
        delayMs: index * config.staggerMs
      })
    }

    trace.push(
      createTraceEntry(runtimeListId, 'list:child:move:flip', index + 1, {
        childId,
        deltaX,
        deltaY
      })
    )
  }

  return {
    transitions,
    trace,
    fallbackUsed: false,
    droppedMoveAnimations: 0
  }
}

/**
 * Runs the list plugin pipeline: diff -> transitions -> commit plan -> traces.
 */
export function runListPlugin(input: ListPluginInput): ListPluginOutput {
  const config = resolveAutoAnimateConfig(input.autoAnimate)
  const diff = computeListDiff(input.prevChildrenIds, input.nextChildrenIds)

  const presence = buildPresenceTransitions(input.runtimeListId, diff, config)
  const move = buildMoveTransitions(input.runtimeListId, diff, config, input)

  const trace: ListTraceEntry[] = [
    createTraceEntry(input.runtimeListId, 'list:diff:computed', 0, {
      added: diff.added,
      removed: diff.removed,
      moved: diff.moved,
      nowMs: input.nowMs
    }),
    ...presence.trace,
    ...move.trace
  ]

  return {
    diff,
    transitions: [...presence.transitions, ...move.transitions],
    commitPlan: presence.commitPlan,
    trace,
    perf: {
      fallbackUsed: move.fallbackUsed,
      droppedMoveAnimations: move.droppedMoveAnimations
    }
  }
}

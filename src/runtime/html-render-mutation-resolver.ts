import { RUNTIME_TRACE_STATUS } from './trace-constants'
import type {
  RenderMutationConflictReason,
  RenderMutationResolutionResult,
  RenderMutationTraceEntry,
  RenderMutationResolver,
  RuntimeResolvedMutation
} from './render-mutation-resolver'

type ClassPatchState = {
  add: Set<string>
  remove: Set<string>
}

type MutationState = {
  style?: Record<string, unknown>
  attr?: Record<string, unknown>
  className?: string | ClassPatchState
}

type Owner = {
  actionIndex: number
  eventId: string
}

/**
 * Resolves the runtime target identifier for one resolved mutation.
 */
function resolveTargetItemId(action: RuntimeResolvedMutation): string {
  return action.action.targetId ?? action.listenerId
}

/**
 * Splits a class token list into a normalized token set.
 */
function tokenizeClassList(value: string | undefined): Set<string> {
  if (!value) {
    return new Set<string>()
  }

  return new Set(value.split(/\s+/).filter((token) => token.length > 0))
}

/**
 * Converts one className payload into a mutable runtime state.
 */
function toClassPatchState(className: unknown): string | ClassPatchState | undefined {
  if (typeof className === 'string') {
    return className
  }

  if (typeof className !== 'object' || className === null) {
    return undefined
  }

  const patch = className as { add?: string; remove?: string }
  return {
    add: tokenizeClassList(patch.add),
    remove: tokenizeClassList(patch.remove)
  }
}

/**
 * Checks whether one class patch state has no effective operation.
 */
function isEmptyClassPatchState(className: string | ClassPatchState | undefined): boolean {
  if (className === undefined) {
    return true
  }

  if (typeof className === 'string') {
    return className.trim().length === 0
  }

  return className.add.size === 0 && className.remove.size === 0
}

/**
 * Checks whether one mutation state still mutates runtime data.
 */
function hasHtmlMutation(state: MutationState): boolean {
  const hasStyle = state.style !== undefined && Object.keys(state.style).length > 0
  const hasAttr = state.attr !== undefined && Object.keys(state.attr).length > 0
  const hasClassName = !isEmptyClassPatchState(state.className)
  return hasStyle || hasAttr || hasClassName
}

/**
 * Checks whether one mutation still has non-HTML mutations to preserve.
 */
function hasNonHtmlMutation(action: RuntimeResolvedMutation): boolean {
  return (
    action.action.move !== undefined ||
    action.action.content !== undefined ||
    action.action.src !== undefined ||
    action.action.alt !== undefined ||
    action.action.fitMode !== undefined ||
    action.action.broadcast !== undefined
  )
}

/**
 * Builds one deterministic conflict trace row.
 */
function buildConflictTrace(
  status: typeof RUNTIME_TRACE_STATUS.applied | typeof RUNTIME_TRACE_STATUS.rejected,
  reason: RenderMutationConflictReason,
  targetItemId: string,
  eventName: string,
  key: string,
  winnerEventId: string,
  loserEventId: string,
  traceIndex: number
): RenderMutationTraceEntry {
  return {
    traceId: `conflict-trace-${traceIndex}`,
    eventName,
    status,
    reason,
    targetItemId,
    payload: {
      key,
      winnerEventId,
      loserEventId
    }
  }
}

/**
 * Resolves conflicting HTML-oriented mutations in one same-batch group.
 */
export function resolveHtmlRenderMutations(
  mutations: RuntimeResolvedMutation[]
): RenderMutationResolutionResult {
  const mutationStates: MutationState[] = mutations.map((mutation) => ({
    style:
      typeof mutation.action.style === 'object' && mutation.action.style !== null
        ? { ...mutation.action.style }
        : undefined,
    attr:
      typeof mutation.action.attr === 'object' && mutation.action.attr !== null
        ? { ...mutation.action.attr }
        : undefined,
    className: toClassPatchState(mutation.action.className)
  }))

  const traces: RenderMutationTraceEntry[] = []
  const styleOwners = new Map<string, Owner>()
  const attrOwners = new Map<string, Owner>()
  const classTokenOwners = new Map<string, Owner>()
  const appliedConflictKeys = new Set<string>()

  for (let actionIndex = 0; actionIndex < mutations.length; actionIndex += 1) {
    const mutation = mutations[actionIndex]
    const state = mutationStates[actionIndex]
    const targetItemId = resolveTargetItemId(mutation)

    if (state.style) {
      for (const property of Object.keys(state.style)) {
        const ownerKey = `${targetItemId}|style|${property}`
        const previousOwner = styleOwners.get(ownerKey)
        if (previousOwner && previousOwner.actionIndex !== actionIndex) {
          const previousState = mutationStates[previousOwner.actionIndex]
          if (previousState.style) {
            delete previousState.style[property]
          }

          traces.push(
            buildConflictTrace(
              RUNTIME_TRACE_STATUS.rejected,
              'STYLE_OVERRIDDEN_SAME_TICK',
              targetItemId,
              mutation.eventName,
              property,
              mutation.eventId,
              previousOwner.eventId,
              traces.length + 1
            )
          )
          appliedConflictKeys.add(ownerKey)
        }

        styleOwners.set(ownerKey, {
          actionIndex,
          eventId: mutation.eventId
        })
      }
    }

    if (state.attr) {
      for (const key of Object.keys(state.attr)) {
        const ownerKey = `${targetItemId}|attr|${key}`
        const previousOwner = attrOwners.get(ownerKey)
        if (previousOwner && previousOwner.actionIndex !== actionIndex) {
          const previousState = mutationStates[previousOwner.actionIndex]
          if (previousState.attr) {
            delete previousState.attr[key]
          }

          traces.push(
            buildConflictTrace(
              RUNTIME_TRACE_STATUS.rejected,
              'ATTR_OVERRIDDEN_SAME_TICK',
              targetItemId,
              mutation.eventName,
              key,
              mutation.eventId,
              previousOwner.eventId,
              traces.length + 1
            )
          )
          appliedConflictKeys.add(ownerKey)
        }

        attrOwners.set(ownerKey, {
          actionIndex,
          eventId: mutation.eventId
        })
      }
    }

    if (typeof state.className !== 'string' && state.className) {
      for (const token of state.className.add) {
        const ownerKey = `${targetItemId}|class|${token}`
        const previousOwner = classTokenOwners.get(ownerKey)
        if (previousOwner && previousOwner.actionIndex !== actionIndex) {
          const previousState = mutationStates[previousOwner.actionIndex]
          if (typeof previousState.className !== 'string' && previousState.className) {
            previousState.className.add.delete(token)
            previousState.className.remove.delete(token)
          }

          traces.push(
            buildConflictTrace(
              RUNTIME_TRACE_STATUS.rejected,
              'CLASSNAME_OVERRIDDEN_SAME_TICK',
              targetItemId,
              mutation.eventName,
              token,
              mutation.eventId,
              previousOwner.eventId,
              traces.length + 1
            )
          )
          appliedConflictKeys.add(ownerKey)
        }

        classTokenOwners.set(ownerKey, {
          actionIndex,
          eventId: mutation.eventId
        })
      }

      for (const token of state.className.remove) {
        const ownerKey = `${targetItemId}|class|${token}`
        const previousOwner = classTokenOwners.get(ownerKey)
        if (previousOwner && previousOwner.actionIndex !== actionIndex) {
          const previousState = mutationStates[previousOwner.actionIndex]
          if (typeof previousState.className !== 'string' && previousState.className) {
            previousState.className.add.delete(token)
            previousState.className.remove.delete(token)
          }

          traces.push(
            buildConflictTrace(
              RUNTIME_TRACE_STATUS.rejected,
              'CLASSNAME_OVERRIDDEN_SAME_TICK',
              targetItemId,
              mutation.eventName,
              token,
              mutation.eventId,
              previousOwner.eventId,
              traces.length + 1
            )
          )
          appliedConflictKeys.add(ownerKey)
        }

        classTokenOwners.set(ownerKey, {
          actionIndex,
          eventId: mutation.eventId
        })
      }
    }
  }

  for (const ownerKey of appliedConflictKeys) {
    const [targetItemId, domain, key] = ownerKey.split('|')
    if (!targetItemId || !domain || !key) {
      continue
    }

    const ownerMap =
      domain === 'style' ? styleOwners : domain === 'attr' ? attrOwners : classTokenOwners
    const winnerOwner = ownerMap.get(ownerKey)
    if (!winnerOwner) {
      continue
    }

    const winnerMutation = mutations[winnerOwner.actionIndex]
    const reason: RenderMutationConflictReason =
      domain === 'style'
        ? 'STYLE_OVERRIDDEN_SAME_TICK'
        : domain === 'attr'
          ? 'ATTR_OVERRIDDEN_SAME_TICK'
          : 'CLASSNAME_OVERRIDDEN_SAME_TICK'

    traces.push(
      buildConflictTrace(
        RUNTIME_TRACE_STATUS.applied,
        reason,
        targetItemId,
        winnerMutation.eventName,
        key,
        winnerMutation.eventId,
        winnerMutation.eventId,
        traces.length + 1
      )
    )
  }

  const resolvedMutations: RuntimeResolvedMutation[] = []
  for (let actionIndex = 0; actionIndex < mutations.length; actionIndex += 1) {
    const mutation = mutations[actionIndex]
    const state = mutationStates[actionIndex]
    if (!hasHtmlMutation(state) && !hasNonHtmlMutation(mutation)) {
      continue
    }

    const className =
      typeof state.className === 'string'
        ? state.className
        : state.className
          ? {
              add: [...state.className.add].join(' '),
              remove: [...state.className.remove].join(' ')
            }
          : undefined

    resolvedMutations.push({
      ...mutation,
      action: {
        ...mutation.action,
        style: state.style,
        attr: state.attr,
        className
      }
    })
  }

  return {
    resolvedMutations,
    trace: traces
  }
}

export const htmlRenderMutationResolver: RenderMutationResolver = {
  resolve: resolveHtmlRenderMutations
}

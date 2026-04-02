import type { AnimationResolvedAction } from '../animation/types'

export type RuntimeConflictReason =
  | 'STYLE_OVERRIDDEN_SAME_TICK'
  | 'ATTR_OVERRIDDEN_SAME_TICK'
  | 'CLASSNAME_OVERRIDDEN_SAME_TICK'

export type RuntimeConflictTraceEntry = {
  traceId: string
  eventName: string
  status: 'applied' | 'rejected'
  reason: RuntimeConflictReason
  targetItemId: string
  payload: {
    key: string
    winnerEventId: string
    loserEventId: string
  }
}

export type ResolveSameTickConflictsResult = {
  resolvedActions: AnimationResolvedAction[]
  trace: RuntimeConflictTraceEntry[]
}

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
 * Resolves the runtime target identifier for one resolved action.
 */
function resolveTargetItemId(action: AnimationResolvedAction): string {
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
function hasMutation(state: MutationState): boolean {
  const hasStyle = state.style !== undefined && Object.keys(state.style).length > 0
  const hasAttr = state.attr !== undefined && Object.keys(state.attr).length > 0
  const hasClassName = !isEmptyClassPatchState(state.className)
  return hasStyle || hasAttr || hasClassName
}

/**
 * Checks whether one action still has non-conflict mutations to preserve.
 */
function hasNonConflictMutation(action: AnimationResolvedAction): boolean {
  return action.action.move !== undefined
}

/**
 * Builds one deterministic conflict trace row.
 */
function buildConflictTrace(
  status: 'applied' | 'rejected',
  reason: RuntimeConflictReason,
  targetItemId: string,
  eventName: string,
  key: string,
  winnerEventId: string,
  loserEventId: string,
  traceIndex: number
): RuntimeConflictTraceEntry {
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
 * Resolves style/attr/className conflicts for one same-tick action batch.
 */
export function resolveSameTickConflicts(
  actions: AnimationResolvedAction[]
): ResolveSameTickConflictsResult {
  const mutationStates: MutationState[] = actions.map((action) => ({
    style:
      typeof action.action.style === 'object' && action.action.style !== null
        ? { ...action.action.style }
        : undefined,
    attr:
      typeof action.action.attr === 'object' && action.action.attr !== null
        ? { ...action.action.attr }
        : undefined,
    className: toClassPatchState(action.action.className)
  }))

  const traces: RuntimeConflictTraceEntry[] = []
  const styleOwners = new Map<string, Owner>()
  const attrOwners = new Map<string, Owner>()
  const classTokenOwners = new Map<string, Owner>()
  const appliedConflictKeys = new Set<string>()

  for (let actionIndex = 0; actionIndex < actions.length; actionIndex += 1) {
    const action = actions[actionIndex]
    const state = mutationStates[actionIndex]
    const targetItemId = resolveTargetItemId(action)

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
              'rejected',
              'STYLE_OVERRIDDEN_SAME_TICK',
              targetItemId,
              action.eventName,
              property,
              action.eventId,
              previousOwner.eventId,
              traces.length + 1
            )
          )
          appliedConflictKeys.add(ownerKey)
        }

        styleOwners.set(ownerKey, {
          actionIndex,
          eventId: action.eventId
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
              'rejected',
              'ATTR_OVERRIDDEN_SAME_TICK',
              targetItemId,
              action.eventName,
              key,
              action.eventId,
              previousOwner.eventId,
              traces.length + 1
            )
          )
          appliedConflictKeys.add(ownerKey)
        }

        attrOwners.set(ownerKey, {
          actionIndex,
          eventId: action.eventId
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
              'rejected',
              'CLASSNAME_OVERRIDDEN_SAME_TICK',
              targetItemId,
              action.eventName,
              token,
              action.eventId,
              previousOwner.eventId,
              traces.length + 1
            )
          )
          appliedConflictKeys.add(ownerKey)
        }

        classTokenOwners.set(ownerKey, {
          actionIndex,
          eventId: action.eventId
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
              'rejected',
              'CLASSNAME_OVERRIDDEN_SAME_TICK',
              targetItemId,
              action.eventName,
              token,
              action.eventId,
              previousOwner.eventId,
              traces.length + 1
            )
          )
          appliedConflictKeys.add(ownerKey)
        }

        classTokenOwners.set(ownerKey, {
          actionIndex,
          eventId: action.eventId
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

    const winnerAction = actions[winnerOwner.actionIndex]
    const reason: RuntimeConflictReason =
      domain === 'style'
        ? 'STYLE_OVERRIDDEN_SAME_TICK'
        : domain === 'attr'
          ? 'ATTR_OVERRIDDEN_SAME_TICK'
          : 'CLASSNAME_OVERRIDDEN_SAME_TICK'

    traces.push(
      buildConflictTrace(
        'applied',
        reason,
        targetItemId,
        winnerAction.eventName,
        key,
        winnerAction.eventId,
        winnerAction.eventId,
        traces.length + 1
      )
    )
  }

  const resolvedActions: AnimationResolvedAction[] = []
  for (let actionIndex = 0; actionIndex < actions.length; actionIndex += 1) {
    const action = actions[actionIndex]
    const state = mutationStates[actionIndex]
    if (!hasMutation(state) && !hasNonConflictMutation(action)) {
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

    resolvedActions.push({
      ...action,
      action: {
        ...action.action,
        style: state.style,
        attr: state.attr,
        className
      }
    })
  }

  return {
    resolvedActions,
    trace: traces
  }
}

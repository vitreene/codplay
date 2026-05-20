import type { EventListener, ResolvedAction, TimelineEvent } from './types'

export type DispatchContext<Action = unknown> = {
  listeners: EventListener<Action>[]
}

function mergeActionWithEventPayload<Action>(action: Action, payload: Record<string, unknown> | undefined): Action {
  if (payload === undefined) {
    return action
  }

  if (typeof action !== 'object' || action === null) {
    return payload as Action
  }

  return {
    ...(action as Record<string, unknown>),
    ...payload
  } as Action
}

/**
 * Dispatches timeline events to listeners using exact action-key matching.
 */
export function dispatchEvents<Action>(
  events: TimelineEvent[],
  context: DispatchContext<Action>
): ResolvedAction<Action>[] {
  const resolvedActions: ResolvedAction<Action>[] = []

  for (const event of events) {
    for (const listener of context.listeners) {
      if (event.scopeStoryId !== undefined && listener.scopeStoryId !== event.scopeStoryId) {
        continue
      }

      const action = listener.actionsByEventName[event.name]
      if (action === undefined) {
        continue
      }

      resolvedActions.push({
        eventId: event.id,
        eventName: event.name,
        listenerId: listener.listenerId,
        actionKey: event.name,
        action: mergeActionWithEventPayload(action, event.payload)
      })
    }
  }

  return resolvedActions
}

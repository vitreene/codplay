import type { EventListener, ResolvedAction, TimelineEvent } from './types'

export type DispatchContext<Action = unknown> = {
  listeners: EventListener<Action>[]
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
      const action = listener.actionsByEventName[event.name]
      if (action === undefined) {
        continue
      }

      resolvedActions.push({
        eventId: event.id,
        eventName: event.name,
        listenerId: listener.listenerId,
        actionKey: event.name,
        action
      })
    }
  }

  return resolvedActions
}

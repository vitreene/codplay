export type RuntimeEventSource = 'story' | 'user' | 'system'

export type EventNode = {
  name: string
  startAt: number
  payload?: Record<string, unknown>
  events?: EventNode[]
}

export type TimelineEvent = {
  id: string
  ms: number
  name: string
  payload?: Record<string, unknown>
  index: number
  source: RuntimeEventSource
  trackId?: string
}

export type TrackMeta = {
  order: number
  source: RuntimeEventSource
}

export type EventListener<Action = unknown> = {
  listenerId: string
  actionsByEventName: Record<string, Action>
}

export type ResolvedAction<Action = unknown> = {
  eventId: string
  eventName: string
  listenerId: string
  actionKey: string
  action: Action
}

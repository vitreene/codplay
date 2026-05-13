import { RUNTIME_EVENT_SOURCE } from './constants'

export type RuntimeEventSource = typeof RUNTIME_EVENT_SOURCE[keyof typeof RUNTIME_EVENT_SOURCE]

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
  scopeStoryId?: string
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
  scopeStoryId?: string
  actionsByEventName: Record<string, Action>
}

export type ResolvedAction<Action = unknown> = {
  eventId: string
  eventName: string
  listenerId: string
  actionKey: string
  action: Action
}

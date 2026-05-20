import type { RuntimeEventSource } from '../core/events/types'
import type { StoryEvent } from './player-schedule'

export type StrapMeta = {
  originEventName: string
  origin?: {
    persoId?: string
    userEvent?: string
  }
}

export type StrapHelperHandle = {
  id: string
  cancel: () => void
}

export type StrapHelpers = {
  delay: (ms: number, event: StoryEvent) => StrapHelperHandle
  repeat: (
    options: { everyMs: number; times: number },
    factory: (index: number) => StoryEvent[]
  ) => StrapHelperHandle
  loop: (
    options: { everyMs: number },
    factory: (index: number) => StoryEvent[]
  ) => StrapHelperHandle
  stagger: (options: { stepMs: number }, events: StoryEvent[]) => StrapHelperHandle[]
}

export type StrapContext = {
  api: unknown
  helpers: StrapHelpers
}

export type StrapInput = {
  event: StoryEvent
  state: Record<string, unknown>
  meta: StrapMeta
  context: StrapContext
}

export type StrapOutput = {
  events?: StoryEvent[]
  warnings?: string[]
  update?: Record<string, unknown>
}

export type StrapFn = (input: StrapInput) => Promise<StrapOutput | void> | StrapOutput | void

export type StrapCollection = Record<string, StrapFn>

export type StrapExecutionScope = {
  scopeStoryId?: string
  source: RuntimeEventSource
  ms: number
  trackId?: string
}

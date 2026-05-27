import type { RuntimeEventSource } from '../core/events/types'
import type { DeepReadonly, HelperHandle, HelperTickContext, LoopOptions, RepeatOptions, StaggerOptions, StoryEvent, WaitOptions } from './helper-types'

export type StrapMeta = {
  originEventName: string
  origin?: {
    persoId?: string
    userEvent?: string
  }
}

export type StrapHelperHandle = HelperHandle

export type StrapStep = {
  event?: StoryEvent
  update?: Record<string, unknown>
}

export type StrapStepResult = StrapStep | StrapStep[] | void

export type StrapStepFactory = (context: HelperTickContext) => StrapStepResult

export type StrapStepInput = StrapStep | StrapStep[] | StrapStepFactory

export type StrapHelpers = {
  wait: (ms: number, input: StrapStepInput, options?: WaitOptions) => StrapHelperHandle
  delay: (ms: number, input: StrapStepInput, options?: WaitOptions) => StrapHelperHandle
  repeat: (
    options: RepeatOptions,
    input: StrapStepInput
  ) => StrapHelperHandle
  loop: (
    options: LoopOptions,
    factory: StrapStepFactory
  ) => StrapHelperHandle
  stagger: (options: StaggerOptions, input: StrapStepInput) => StrapHelperHandle[]
}

export type StrapContext = {
  api: unknown
  helpers: StrapHelpers
}

export type StrapInput = {
  event: StoryEvent
  state: DeepReadonly<Record<string, unknown>>
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
  materialized?: boolean
}

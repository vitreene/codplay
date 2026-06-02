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

export type PlannedStrapOccurrence = {
  offsetMs: number
  step: StrapStep
}

export type StrapRuntimeOutput = {
  events?: StoryEvent[]
  warnings?: string[]
  update?: Record<string, unknown>
}

export type PlannedStrapHelpers = {
  wait: (ms: number, input: StrapStepInput, options?: WaitOptions) => PlannedStrapOccurrence[]
  delay: (ms: number, input: StrapStepInput, options?: WaitOptions) => PlannedStrapOccurrence[]
  repeat: (
    options: RepeatOptions,
    input: StrapStepInput
  ) => PlannedStrapOccurrence[]
  loop: (
    options: LoopOptions,
    factory: StrapStepFactory
  ) => PlannedStrapOccurrence[]
  stagger: (options: StaggerOptions, input: StrapStepInput) => PlannedStrapOccurrence[]
}

export type LiveStrapHelpers = {
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

export type StrapHelpers = LiveStrapHelpers

export type PlayerStrapApi = {
  getPersoIdAt: (x: number, y: number, excludeId?: string) => string | null
}

export type StrapContext = {
  api: PlayerStrapApi
  planned: PlannedStrapHelpers
  live: LiveStrapHelpers
}

export type StrapInput = {
  event: StoryEvent
  state: DeepReadonly<Record<string, unknown>>
  meta: StrapMeta
  context: StrapContext
}

export type StrapOutput = StrapRuntimeOutput

export type StrapReturnChunk = StrapRuntimeOutput | PlannedStrapOccurrence[]

export type StrapReturnValue = StrapReturnChunk | StrapReturnValue[] | void

export type StrapFn = (input: StrapInput) => Promise<StrapReturnValue> | StrapReturnValue

export type StrapCollection = Record<string, StrapFn>

export type TransformFn = (event: StoryEvent) => StoryEvent[]

export type StrapExecutionScope = {
  scopeStoryId?: string
  source: RuntimeEventSource
  ms: number
  trackId?: string
  materialized?: boolean
}

import type { RuntimeEventSource } from '../core/events/types'
import type { DeepReadonly, HelperHandle, HelperTickContext, LoopOptions, RepeatOptions, StaggerOptions, StoryEvent, WaitOptions } from './helper-types'

export type StrapMeta = {
  originEventName: string
  origin?: {
    persoId?: string
    userEvent?: string
  }
  /** Position courante dans la timeline de la scène, en millisecondes, au moment où ce strap est appelé. */
  ms?: number
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

/**
 * Declares one heterogeneous step of the `sequence` chaining helper — each
 * step carries its own `StrapStep` (so it can target a different perso or
 * mix `event`/`update`) and its own duration for chaining. Distinct from
 * `repeat`/`stagger`, which repeat one template at a uniform spacing.
 */
export type ActionSequenceStrapStep = {
  step: StrapStep
  durationMs?: number
  startAt?: number
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
  /**
   * Chains a fixed list of heterogeneous steps by each step's own duration —
   * not a repetition of one template (see `repeat`/`stagger`). Each step can
   * target a different perso from one single trigger. No `context.live`
   * counterpart in V1: a fixed sequence is fully resolvable in advance and
   * does not need `live`'s event-driven/interruptible semantics.
   */
  sequence: (steps: ActionSequenceStrapStep[]) => PlannedStrapOccurrence[]
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
  eventInsertMode?: 'apply-now' | 'persist-future' | 'persist-only'
}

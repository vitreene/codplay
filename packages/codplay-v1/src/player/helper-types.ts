export type DeepReadonly<T> =
  T extends (...args: never[]) => unknown ? T :
  T extends readonly (infer U)[] ? readonly DeepReadonly<U>[] :
  T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } :
  T

export type StoryEvent = {
  name: string
  data?: Record<string, unknown>
  cascade?: boolean
}

export type HelperHandle = {
  id: string
  cancel: () => void
}

export type HelperTickContext = {
  currentTimeMs: number
  startedAtMs: number
  elapsedMs: number
  index: number
  state: DeepReadonly<Record<string, unknown>>
}

export type HelperMode = 'planned' | 'jit'

export type LoopStopCondition =
  | { type: 'times'; max: number }
  | { type: 'duration'; maxMs: number }
  | { type: 'event'; name: string }

export type LoopOptions = {
  eachMs: number
  until: LoopStopCondition | LoopStopCondition[]
  mode?: HelperMode
}

export type WaitOptions = {
  mode?: HelperMode
}

export type RepeatOptions = {
  everyMs: number
  times: number
  mode?: HelperMode
}

export type StaggerOptions = {
  stepMs: number
  mode?: HelperMode
}

export type EventResult = StoryEvent | StoryEvent[] | void

export type EventFactory = (context: HelperTickContext) => EventResult

export type EventInput = StoryEvent | StoryEvent[] | EventFactory

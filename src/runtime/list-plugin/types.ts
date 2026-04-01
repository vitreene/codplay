import type { ListAutoAnimateConfig, ListPerfConfig } from '../types'

export type ListChildPosition = {
  x: number
  y: number
}

export type ListChildPositionMap = Record<string, ListChildPosition>

export type ListDiff = {
  added: string[]
  removed: string[]
  moved: string[]
}

export type ListTransitionProperty = 'opacity' | 'x' | 'y'

export type ListTransitionEventName =
  | 'list:child:enter'
  | 'list:child:leave:started'
  | 'list:child:move:flip'

export type ListTransitionDef = {
  transitionId: string
  eventName: ListTransitionEventName
  childId: string
  property: ListTransitionProperty
  from?: number
  to: number
  duration: number
  easing?: string
  delayMs?: number
}

export type ListCommitPlan = {
  leaving: string[]
  detachAfterAnimation: string[]
}

export type ListTraceEventName =
  | 'list:diff:computed'
  | 'list:child:enter'
  | 'list:child:leave:started'
  | 'list:child:leave:done'
  | 'list:child:move:flip'
  | 'list:perf:fallback'

export type ListTraceEntry = {
  traceId: string
  eventName: ListTraceEventName
  runtimeListId: string
  payload?: Record<string, unknown>
}

export type ListPluginInput = {
  runtimeListId: string
  nodeRef: unknown
  prevChildrenIds: string[]
  nextChildrenIds: string[]
  autoAnimate?: ListAutoAnimateConfig
  perf?: ListPerfConfig
  nowMs: number
  positionsBefore?: ListChildPositionMap
  positionsAfter?: ListChildPositionMap
}

export type ListPluginOutput = {
  diff: ListDiff
  transitions: ListTransitionDef[]
  commitPlan: ListCommitPlan
  trace: ListTraceEntry[]
  perf: {
    fallbackUsed: boolean
    droppedMoveAnimations: number
  }
}

export type ListPlugin = {
  name: 'list-plugin'
  runtimeListId: string
  nodeRef: unknown
  compute: (input: Omit<ListPluginInput, 'runtimeListId' | 'nodeRef'>) => ListPluginOutput
}

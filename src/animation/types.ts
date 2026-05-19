import { RUNTIME_TRACE_STATUS } from '../runtime/trace-constants'
import type { ResolvedAction } from '../core/events/types'
import type { BroadcastAction, MoveValue } from '../runtime/types'

export type AnimatedProperty = string

export type AnimationTimerOptions = {
  duration?: number
  delayMs?: number
  loopDelayMs?: number
  reversed?: boolean
  alternate?: boolean
  loop?: boolean | number
  ease?: string
  stagger?: number
  ignoreDuration?: boolean
}

export type AnimationAction = {
  target?: unknown
  targetId?: string
  ref?: string
  className?: string | { add?: string; remove?: string }
  style?: Record<string, unknown>
  attr?: Record<string, unknown>
  move?: MoveValue
  content?: string
  src?: string
  alt?: string
  fitMode?: 'wallpaper' | 'sprite'
  broadcast?: BroadcastAction
}

export type AnimationResolvedAction = ResolvedAction<AnimationAction>

export type TransitionRequest = {
  transitionId: string
  eventId: string
  eventName: string
  listenerId: string
  property: AnimatedProperty
  target: unknown
  from?: number | string
  to: number | string
} & Required<Pick<AnimationTimerOptions, 'duration'>> & {
  easing?: string
} & AnimationTimerOptions & {
  composition?: 'merge' | 'replace'
  cleanupStyleProperty?: 'width' | 'height'
  onFinalize?: (reason: 'completed' | 'stopped') => void
  onFrame?: () => void
}

export type AnimationTraceEntry = {
  traceId: string
  eventId: string
  eventName: string
  transitionId: string
  property: AnimatedProperty
  status: typeof RUNTIME_TRACE_STATUS.applied
}

export type AnimationHandle = {
  transitionId: string
  target: unknown
  stop: () => void
}

export type AnimationAdapter = {
  run: (transitions: TransitionRequest[]) => AnimationHandle[]
  stop: (target?: unknown) => void
  pause?: (target?: unknown) => void
  resume?: (target?: unknown) => void
  seek?: (timelineMs: number, eventMsByEventId: ReadonlyMap<string, number>, target?: unknown) => void
  renderFrame?: (frameNowMs: number) => void
}

export type AnimationBatchResult = {
  appliedCount: number
  trace: AnimationTraceEntry[]
}

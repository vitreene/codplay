import type { ResolvedAction } from '../core/events/types'
import type { MoveValue } from '../runtime/types'

export type AnimatedProperty = string

export type AnimationAction = {
  target?: unknown
  targetId?: string
  className?: string | { add?: string; remove?: string }
  style?: Record<string, unknown>
  attr?: Record<string, unknown>
  move?: MoveValue
  content?: string
  src?: string
  alt?: string
  fitMode?: 'wallpaper' | 'sprite'
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
  duration: number
  easing?: string
  delayMs?: number
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
  status: 'applied'
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

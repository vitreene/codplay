import type { ResolvedAction } from '../core/events/types'

export type SimpleAnimatedProperty = 'opacity' | 'x' | 'y' | 'scale' | 'rotate'

export type AnimationAction = {
  target?: unknown
  targetId?: string
  style?: Record<string, unknown>
}

export type AnimationResolvedAction = ResolvedAction<AnimationAction>

export type TransitionRequest = {
  transitionId: string
  eventId: string
  eventName: string
  listenerId: string
  property: SimpleAnimatedProperty
  target: unknown
  from?: number | string
  to: number | string
  duration: number
  easing?: string
}

export type AnimationTraceEntry = {
  traceId: string
  eventId: string
  eventName: string
  transitionId: string
  property: SimpleAnimatedProperty
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
}

export type AnimationBatchResult = {
  appliedCount: number
  trace: AnimationTraceEntry[]
}

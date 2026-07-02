import { RUNTIME_TRACE_STATUS } from '../runtime/trace-constants'
import type { ResolvedAction } from '../core/events/types'
import type { BroadcastAction, InputVisualStateValue, MoveValue, ReplaceActionValue, StyleValue, ClassNameValue } from '../runtime/types'

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
  className?: ClassNameValue
  style?: StyleValue
  attr?: Record<string, unknown>
  move?: MoveValue
  content?: string
  sides?: unknown
  inner?: unknown
  outer?: unknown
  rotationDeg?: unknown
  inflexion?: unknown
  morph?: unknown
  src?: string
  alt?: string
  fitMode?: 'wallpaper' | 'sprite'
  checked?: boolean
  disabled?: boolean
  visualState?: InputVisualStateValue
  canValidate?: boolean
  disableAnswers?: boolean
  showCorrection?: boolean
  selectedAnswerIds?: string[]
  correctAnswerIds?: string[]
  broadcast?: BroadcastAction
  replace?: ReplaceActionValue
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
  finalValue?: number | string
  modifier?: (value: number) => number | string
} & Required<Pick<AnimationTimerOptions, 'duration'>> & {
  easing?: string
} & AnimationTimerOptions & {
  composition?: 'merge' | 'replace'
  cleanupStyleProperty?: 'width' | 'height'
  onFinalize?: (reason: 'completed' | 'stopped') => void
  onFrame?: () => void
  group?: {
    id: string
    total: number
    onGroupFinalize: (reason: 'completed' | 'stopped') => void
  }
}

export type AnimeSvgMorphOperation = {
  kind: 'anime-svg:morphTo'
  operationId: string
  eventId: string
  eventName: string
  listenerId: string
  property: 'd' | 'points'
  target: unknown
  to: unknown
  finalValue?: string
} & Required<Pick<AnimationTimerOptions, 'duration'>> & {
  easing?: string
  precision?: number
} & AnimationTimerOptions

/**
 * Describes one animation operation accepted by the central animation adapter.
 * Rich Anime.js capabilities will extend this union without changing the
 * existing TransitionRequest contract.
 */
export type AnimationOperation = TransitionRequest | AnimeSvgMorphOperation

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
  run: (operations: AnimationOperation[]) => AnimationHandle[]
  stop: (target?: unknown) => void
  pause?: (target?: unknown) => void
  resume?: (target?: unknown) => void
  seek?: (timelineMs: number, eventMsByEventId: ReadonlyMap<string, number>, target?: unknown) => void
  renderFrame?: (frameNowMs: number) => void
  setRate?: (rate: number) => void
}

export type AnimationBatchResult = {
  appliedCount: number
  trace: AnimationTraceEntry[]
}

/**
 * Input passed to a continuous animation engine when it claims one resolved
 * action at the single trigger point (after `beforeUpdate`/`afterUpdate` and
 * component resolution have already run for it like any other action).
 */
export type ContinuousAnimationEngineTriggerInput = {
  resolvedAction: AnimationResolvedAction
  eventMs: number
}

/**
 * Declares one engine able to claim and drive a resolved action whose value
 * evolves continuously over time from a single trigger, instead of being
 * applied once as a static value. `TweenAction` (a pure `fn`-driven engine)
 * and the external animation library bridge are two sibling implementations
 * of this same role — this contract lets either be added, combined, or
 * replaced without touching the single dispatch point that calls `claims`.
 */
export type ContinuousAnimationEngine = {
  name: string
  claims(action: unknown): boolean
  trigger(input: ContinuousAnimationEngineTriggerInput): void
}

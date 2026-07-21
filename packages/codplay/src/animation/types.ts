import { RUNTIME_TRACE_STATUS } from '../runtime/trace-constants'
import type { ResolvedAction } from '../core/events/types'
import type { BroadcastAction, InputVisualStateValue, MoveValue, ReplaceActionValue, StyleValue, ClassNameValue } from '../runtime/types'

export type AnimatedProperty = string

/**
 * A transition ease, either a plain named easing (forwarded to whatever
 * animation library the adapter wraps) or a codplay-side descriptor — never
 * a third-party vocabulary above the adapter. `'physics'` describes a
 * spring/decay transition from an initial `velocity`; `bounce` absent or `0`
 * produces a progressive slowdown to rest with no overshoot (see
 * `v1-perso-spec.md` regle 5). Translating it into a concrete mechanism is
 * the adapter's job alone.
 */
export type TransitionEase = string | {
  type: 'physics'
  velocity?: number
  mass?: number
  stiffness?: number
  damping?: number
  bounce?: number
}

export type AnimationTimerOptions = {
  duration?: number
  delayMs?: number
  loopDelayMs?: number
  reversed?: boolean
  alternate?: boolean
  loop?: boolean | number
  ease?: TransitionEase
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

/**
 * One value update from a capture's continuous flow (`v1-capture-spec.md`).
 * Distinct from `TransitionRequest`: there is no `from`/`to`/`duration` to
 * interpolate — the capture already samples at frame rate, so each update is
 * the exact value for that frame. Applying it must never create a new
 * transition per call; see `AnimationAdapter.applyCaptureUpdate`. Naming and
 * shape stay codplay-side (no reference to the underlying animation
 * library), since that library is expected to be replaced over time.
 */
export type CaptureUpdate = {
  target: unknown
  property: AnimatedProperty
  value: number | string
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
  run: (operations: AnimationOperation[]) => AnimationHandle[]
  /**
   * Applies one `CaptureUpdate` without ever creating a new transition —
   * the counterpart to `run()` for capture's continuous flow. Safe to call
   * every frame: reuses one persistent handle per target/property instead
   * of instantiating a fresh animation each time (see
   * `2026-07-21-capture-animatable-channel-plan.md`).
   */
  applyCaptureUpdate: (update: CaptureUpdate) => void
  /**
   * Releases whatever persistent handle `applyCaptureUpdate` created for
   * this target/property, if any. Called when a capture ends, so the next
   * capture on the same node starts clean.
   */
  releaseCaptureUpdate: (target: unknown, property: AnimatedProperty) => void
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

import type { AnimationAdapter, AnimationBatchResult, TransitionRequest } from '../../animation/types'

export type Matrix2D = {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

export type FlipNodeRef = unknown

export type FlipEntry = {
  id: string
  nodeRef: FlipNodeRef
}

export type FlipSnapshot = {
  id: string
  nodeRef: FlipNodeRef
  left: number
  top: number
  width: number
  height: number
  parentMatrix: Matrix2D
  transformValue: string
  translateX: number
  translateY: number
  matrix: Matrix2D
  transformOrigin: string
}

export type FlipPlanOptions = {
  includeSize?: boolean
  includeTransformMatrix?: boolean
  durationMs?: number
  easing?: string
  staggerMs?: number
}

export type FlipTransitionState = {
  x?: number
  y?: number
  width?: number
  height?: number
}

export type FlipTransitionRequest = {
  transitionId: string
  nodeRef: FlipNodeRef
  from: FlipTransitionState
  to: FlipTransitionState
  duration: number
  easing?: string
  delayMs?: number
}

export type FlipPlanResult = {
  transitions: FlipTransitionRequest[]
}

export type FlipRunOptions = {
  entries: FlipEntry[]
  mutate: () => void
  animationAdapter: AnimationAdapter
  options?: FlipPlanOptions
  applyInvertTransformToTarget?: boolean
}

export type FlipRunResult = {
  first: FlipSnapshot[]
  last: FlipSnapshot[]
  transitions: FlipTransitionRequest[]
  animationTransitions: TransitionRequest[]
  animation: AnimationBatchResult
}

export type FlipEngine = {
  capture: (entries: FlipEntry[]) => FlipSnapshot[]
  plan: (first: FlipSnapshot[], last: FlipSnapshot[], options?: FlipPlanOptions) => FlipPlanResult
  toAnimationTransitions: (transitions: FlipTransitionRequest[]) => TransitionRequest[]
  run: (options: FlipRunOptions) => Promise<FlipRunResult>
}

export type FlipEngineOptions = {
  requestFrame?: (callback: () => void) => void
}

/** First validation phase for structural shape checks. */
export const GUARD_PHASE_SHAPE = 'shape' as const

/** Second validation phase for semantic scene checks. */
export const GUARD_PHASE_SEMANTIC = 'semantic' as const

/** Third validation phase for capability checks. */
export const GUARD_PHASE_CAPABILITY = 'capability' as const

/** Shared validation phase state. */
export type GuardPhase =
  | typeof GUARD_PHASE_SHAPE
  | typeof GUARD_PHASE_SEMANTIC
  | typeof GUARD_PHASE_CAPABILITY

/** Stable validation phase order. */
export const GUARD_PHASE_ORDER: readonly GuardPhase[] = [
  GUARD_PHASE_SHAPE,
  GUARD_PHASE_SEMANTIC,
  GUARD_PHASE_CAPABILITY,
]

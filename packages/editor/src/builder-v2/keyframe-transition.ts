import { TransitionTiming } from '@codplay/scene-factory/transition-timing'
import type { Keyframe } from '../app/commands/types'
import { DEFAULT_EASING } from '../sequence-editor/constants'
import { normalizeMotionEasing } from '../motion-editor/easing'

/** Resolves the existing author-time transition window shared by build and geometry projection. */
export function resolveKeyframeTransition(source: Keyframe, destination: Keyframe) {
  const transition = destination.transitionIn?.kind === 'interpolated'
    ? destination.transitionIn
    : source.transitionOut?.kind === 'interpolated' ? source.transitionOut : undefined
  const durationMs = transition?.durationMs ?? Math.max(0, destination.timeMs - source.timeMs)
  const startAtMs = durationMs <= 0 ? destination.timeMs : TransitionTiming.interpolatedTransitionTriggerMs({
    sourceKfTimeMs: source.timeMs,
    destKfTimeMs: destination.timeMs,
    durationMs,
    direction: transition?.direction ?? 'after',
  })
  return { durationMs, startAtMs, ease: normalizeMotionEasing(transition?.easing ?? DEFAULT_EASING) }
}

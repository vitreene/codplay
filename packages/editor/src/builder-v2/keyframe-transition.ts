import { parseEase } from 'ace'
import { TransitionTiming } from '@codplay/capsule-automation'
import type { EditorScene, Item, Keyframe } from '../app/commands/types'
import { DEFAULT_EASING } from '../sequence-editor/constants'
import { normalizeMotionEasing } from '../motion-editor/easing'
import { STRAIGHT_MOTION_PATH } from '../motion-editor/item-rotation/item-rotation'

/** Author-time clock of one keyframe segment: start, duration and ACE easing. */
export type SegmentTiming = Readonly<{ startAtMs: number; durationMs: number; ease: string }>

/** Resolves the existing author-time transition window shared by build and geometry projection. */
export function resolveKeyframeTransition(source: Keyframe, destination: Keyframe): SegmentTiming {
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

/**
 * Motion path followed by the segment ending at `destination`: its own `Decor.path`, or the
 * implicit straight path of an item oriented along its trajectory. `undefined` = straight segment.
 */
export function resolveSegmentMotionPath(scene: EditorScene, item: Item, destination: Keyframe): string | undefined {
  const path = scene.decors[destination.decorId]?.path
    ?? (item.rotationMode === 'tangent' ? STRAIGHT_MOTION_PATH : undefined)
  return typeof path === 'string' && path.trim() !== '' ? path : undefined
}

/**
 * Pose clock of one segment, as compiled by the Builder: a timed path segment moves over the whole
 * interval from its source keyframe; a straight segment follows the transition window.
 */
export function resolveSegmentTiming(scene: EditorScene, item: Item, source: Keyframe, destination: Keyframe): SegmentTiming {
  const transition = resolveKeyframeTransition(source, destination)
  const intervalMs = Math.max(0, destination.timeMs - source.timeMs)
  if (resolveSegmentMotionPath(scene, item, destination) === undefined || intervalMs <= 0) return transition
  return { startAtMs: source.timeMs, durationMs: intervalMs, ease: transition.ease }
}

/** Eased progress of a segment clock at one author time, clamped to [0, 1]. */
export function resolveSegmentProgress(timing: SegmentTiming, timeMs: number): number {
  if (timing.durationMs <= 0) return 1
  const progress = Math.min(1, Math.max(0, (timeMs - timing.startAtMs) / timing.durationMs))
  return parseEase(timing.ease)(progress)
}

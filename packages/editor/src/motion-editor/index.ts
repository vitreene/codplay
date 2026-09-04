/** Public, document-agnostic building blocks for the editor motion overlay. */

export {
  clampMotionDuration,
  createDisplayArcPath,
  createMotionArcPath,
  denormalizeMotionControl,
  distanceToSegment,
  frameVisualCenter,
  isStraightMotion,
  motionControlFromPath,
  midpoint,
  normalizeMotionControl,
  translateFrame,
} from './geometry'
export type { MotionPoint } from './geometry'

export {
  DEFAULT_MOTION_TRANSITION_WINDOW_MS,
  resolveMotionKeyframeAlignment,
  resolveMotionLifetime,
  resolveMotionTransitionWindow,
  sortMotionKeyframes,
} from './timing'
export type {
  MotionInheritedLifetime,
  MotionKeyframeAlignment,
  MotionKeyframeReference,
  MotionLifetime,
  MotionLifetimeBoundary,
  MotionTimingDefinition,
  MotionTransitionWindow,
} from './timing'

export { createMotionOverlay } from './overlay'
export type {
  MotionDrop,
  MotionOverlayCallbacks,
  MotionOverlayHandle,
  MotionOverlayRole,
  MotionOverlaySegment,
  MotionPathChange,
} from './overlay'

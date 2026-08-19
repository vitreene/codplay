export { get, set, type PersoState } from './state'
export type { UnitValue } from './values'
export { parseColor } from './adapters/color-adapter'
export {
  getTransformOrder,
  materializeTransformIdentity,
  normalizeTransformProperties,
  prepareTransformTween,
  resolveTransformFrom,
  type TransformAuthorProperty,
  type TransformNormalizationIssue,
  type TransformNormalizationResult,
  type TransformOperation,
  type TransformProperty,
  type TransformIdentityValue,
  type TransformFromResolution,
  type TransformTweenInput,
} from './adapters/transform-adapter'
export {
  prepareInterval,
  resolveInterval,
  type ColorSpace,
  type ColorValue,
  type HuePath,
  type InterpolationObject,
  type InterpolationValue,
  type Interval,
} from './interval'
export { parseEase, type EasingFunction } from './easings'
export { spring, type Spring, type SpringParams } from './spring'
export {
  preparePath,
  prepareSegmentPath,
  resolvePath,
  isPreparedPath,
  type Path,
  type PathInput,
  type PathSegment,
  type PathSegmentInput,
  type PathTraversal,
  type Point,
} from './path'
export { prepareSvgPath, type SvgPathOptions } from './svg-path'
export {
  preparePolarTween,
  resolvePolarTween,
  type PolarCoordinates,
  type PolarInput,
  type PolarMeasure,
  type PolarTween,
} from './polar'
export {
  createIdentityMatrix,
  createRotateMatrix,
  createScaleMatrix,
  createTranslateMatrix,
  invertMatrix,
  multiplyMatrix,
  transformPoint,
  type Matrix2D,
  type MatrixPoint,
} from './matrix-2d'
export { prepareTween, resolveTween, resolveTweenProgress, type Tween, type TweenInput } from './tween'
export { prepareKeyframes, resolveKeyframes, type Keyframe, type KeyframeInput, type Keyframes } from './keyframes'
export { resolve, type PreparedAnimation } from './resolve'

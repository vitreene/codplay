import { decompose } from '../values'
import { prepareTween, type Tween, type TweenInput } from '../tween'
import type { InterpolationValue } from '../interval'

/** Transform channel names supported by the V2 CSS-style preparation boundary. */
export type TransformProperty =
  | 'perspective'
  | 'translateX'
  | 'translateY'
  | 'translateZ'
  | 'rotate'
  | 'rotateX'
  | 'rotateY'
  | 'rotateZ'
  | 'rotate3d'
  | 'scale'
  | 'scaleX'
  | 'scaleY'
  | 'scaleZ'
  | 'skew'
  | 'skewX'
  | 'skewY'
  | 'matrix'
  | 'matrix3d'

/** One authored transform property before value preparation. */
export type TransformAuthorProperty = Readonly<{
  property: string
  value: unknown
}>

/** One normalized transform operation with its authored value preserved. */
export type TransformOperation = Readonly<{
  property: TransformProperty
  value: unknown
}>

/** One deterministic transform normalization failure. */
export type TransformNormalizationIssue = Readonly<{
  code: 'TRANSFORM_PROPERTY_UNSUPPORTED' | 'TRANSFORM_PROPERTY_DUPLICATE'
  property: string
  message: string
}>

/** Result of transforming authored property names into the canonical operation order. */
export type TransformNormalizationResult =
  | Readonly<{ ok: true; operations: readonly TransformOperation[] }>
  | Readonly<{ ok: false; issues: readonly TransformNormalizationIssue[] }>

/** Identity value materialized against an already explicit transform endpoint. */
export type TransformIdentityValue = number | string

/** Scalar transform tween input with an optional author-provided lower bound. */
export type TransformTweenInput = Readonly<Omit<TweenInput, 'from'> & {
  property: TransformProperty
  from?: InterpolationValue
  to: InterpolationValue
}>

/** Resolution status for an authored transform lower bound. */
const TRANSFORM_FROM_RESOLVED = 'resolved' as const

/** Resolution status requiring a runtime transform lower bound. */
const TRANSFORM_FROM_DEFERRED = 'deferred' as const

/** Resolution state for a transform lower bound before ACE preparation. */
export type TransformFromResolution =
  | Readonly<{ status: typeof TRANSFORM_FROM_RESOLVED; value: InterpolationValue }>
  | Readonly<{ status: typeof TRANSFORM_FROM_DEFERRED; property: TransformProperty; to: InterpolationValue }>

const TRANSFORM_ALIASES: Readonly<Record<string, TransformProperty>> = {
  x: 'translateX',
  y: 'translateY',
  z: 'translateZ',
}

/** AnimeJS-observed order kept as an explicit V2 preparation order, not a runtime import. */
const TRANSFORM_ORDER: readonly TransformProperty[] = Object.freeze([
  'perspective',
  'translateX',
  'translateY',
  'translateZ',
  'rotate',
  'rotateX',
  'rotateY',
  'rotateZ',
  'rotate3d',
  'scale',
  'scaleX',
  'scaleY',
  'scaleZ',
  'skew',
  'skewX',
  'skewY',
  'matrix',
  'matrix3d',
])

const TRANSFORM_PROPERTIES = new Set<string>(TRANSFORM_ORDER)

/** Normalizes supported transform aliases and returns operations in canonical order. */
export function normalizeTransformProperties(
  authored: Readonly<Record<string, unknown>>,
): TransformNormalizationResult {
  const operations = new Map<TransformProperty, TransformOperation>()
  const issues: TransformNormalizationIssue[] = []

  for (const [authoredProperty, value] of Object.entries(authored)) {
    const property = TRANSFORM_ALIASES[authoredProperty] ?? authoredProperty
    if (!TRANSFORM_PROPERTIES.has(property)) {
      issues.push({
        code: 'TRANSFORM_PROPERTY_UNSUPPORTED',
        property: authoredProperty,
        message: `Transform property "${authoredProperty}" is not supported by the V2 CSS-style boundary.`,
      })
      continue
    }

    if (operations.has(property)) {
      issues.push({
        code: 'TRANSFORM_PROPERTY_DUPLICATE',
        property: authoredProperty,
        message: `Transform property "${property}" is declared more than once, including through an alias.`,
      })
      continue
    }

    operations.set(property, { property, value })
  }

  if (issues.length > 0) {
    return { ok: false, issues }
  }

  return {
    ok: true,
    operations: TRANSFORM_ORDER.flatMap((property) => {
      const operation = operations.get(property)
      return operation === undefined ? [] : [operation]
    }),
  }
}

/** Returns the canonical order used for transform operations. */
export function getTransformOrder(): readonly TransformProperty[] {
  return TRANSFORM_ORDER
}

/** Materializes one transform identity without converting its reference unit. */
export function materializeTransformIdentity(
  property: TransformProperty,
  reference: number | string,
): TransformIdentityValue | undefined {
  if (isZeroIdentityProperty(property)) {
    const decomposed = decompose(reference)
    if (decomposed.operator !== null || (decomposed.kind !== 'number' && decomposed.kind !== 'unit')) {
      throw new Error(`ace: cannot materialize a transform identity from "${reference}".`)
    }
    return decomposed.unit === null ? 0 : `0${decomposed.unit}`
  }

  if (isOneIdentityProperty(property)) {
    const decomposed = decompose(reference)
    if (decomposed.operator !== null || decomposed.kind !== 'number') {
      throw new Error(`ace: scale identity requires a unitless numeric reference.`)
    }
    return 1
  }

  return undefined
}

/** Prepares one scalar transform tween after completing its deterministic identity. */
export function prepareTransformTween(input: TransformTweenInput): Tween {
  const resolution = resolveTransformFrom(input.property, input.from, input.to)
  if (resolution.status === TRANSFORM_FROM_DEFERRED) {
    throw new Error(`ace: transform "${input.property}" requires a runtime from before preparation.`)
  }
  return prepareTween({ ...input, from: resolution.value })
}

/** Resolves an authored or deterministic transform lower bound, or defers it to runtime state. */
export function resolveTransformFrom(
  property: TransformProperty,
  from: InterpolationValue | undefined,
  to: InterpolationValue,
): TransformFromResolution {
  if (from !== undefined) {
    return { status: TRANSFORM_FROM_RESOLVED, value: from }
  }

  if (typeof to !== 'number' && typeof to !== 'string') {
    return { status: TRANSFORM_FROM_DEFERRED, property, to }
  }
  const identity = materializeTransformIdentity(property, to)
  if (identity === undefined) {
    return { status: TRANSFORM_FROM_DEFERRED, property, to }
  }
  return { status: TRANSFORM_FROM_RESOLVED, value: identity }
}

/** Lists transform channels whose identity is a zero in the reference unit. */
function isZeroIdentityProperty(property: TransformProperty): boolean {
  return property === 'translateX'
    || property === 'translateY'
    || property === 'translateZ'
    || property === 'rotate'
    || property === 'rotateX'
    || property === 'rotateY'
    || property === 'rotateZ'
    || property === 'skew'
    || property === 'skewX'
    || property === 'skewY'
}

/** Lists transform channels whose identity is a unitless one. */
function isOneIdentityProperty(property: TransformProperty): boolean {
  return property === 'scale' || property === 'scaleX' || property === 'scaleY' || property === 'scaleZ'
}

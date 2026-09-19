import type { ValidationFunction } from 'codplay'
import { isComponentRecord, reportInvalidComponentValue } from 'codplay/runtime/components/component-validation'

type ValidationContext = Parameters<ValidationFunction>[1]

/** Validates one optional finite number without imposing a domain-specific bound. */
export function validateThreeNumber(
  value: Record<string, unknown>,
  property: string,
  context: ValidationContext,
): void {
  const candidate = value[property]
  if (candidate === undefined) return
  if (typeof candidate === 'number' && Number.isFinite(candidate)) return
  reportInvalidComponentValue(
    context,
    'AUTHOR_THREEJS_NUMBER_INVALID',
    `${property} must be a finite number.`,
    property,
  )
}

/** Validates one serializable vector of exactly three finite numbers. */
function validateThreeVector(
  value: Record<string, unknown>,
  property: string,
  context: ValidationContext,
): void {
  const candidate = value[property]
  if (candidate === undefined) return
  if (Array.isArray(candidate)
    && candidate.length === 3
    && candidate.every((part) => typeof part === 'number' && Number.isFinite(part))) return
  reportInvalidComponentValue(
    context,
    'AUTHOR_THREEJS_VECTOR_INVALID',
    `${property} must contain three finite numbers.`,
    property,
  )
}

/** Validates transform fields shared by the generic camera and light profiles. */
function validateThreeTransform(value: Record<string, unknown>, context: ValidationContext): void {
  validateThreeVector(value, 'position', context)
  validateThreeVector(value, 'lookAt', context)
  for (const property of ['fov', 'near', 'far', 'left', 'right', 'top', 'bottom']) {
    validateThreeNumber(value, property, context)
  }
}

/** Validates the scene-host initial profile. */
export const validateThreeSceneHostInitial: ValidationFunction = (value, context) => {
  if (!isComponentRecord(value)) {
    reportInvalidComponentValue(context, 'AUTHOR_THREE_SCENE_INITIAL_INVALID', 'Three.js scene host initial state must be a plain object.')
    return
  }
  validateThreeNumber(value, 'width', context)
  validateThreeNumber(value, 'height', context)
  if (value.background !== undefined
    && typeof value.background !== 'string'
    && (typeof value.background !== 'number' || !Number.isFinite(value.background))) {
    reportInvalidComponentValue(context, 'AUTHOR_THREEJS_COLOR_INVALID', 'background must be a string or a finite number.', 'background')
  }
  if (value.renderer !== undefined) {
    if (!isComponentRecord(value.renderer)) {
      reportInvalidComponentValue(context, 'AUTHOR_THREEJS_RENDERER_INVALID', 'renderer must be a plain object.', 'renderer')
    } else {
      validateThreeNumber(value.renderer, 'pixelRatio', context)
    }
  }
}

/** Validates one camera initial or action payload. */
export const validateThreeCamera: ValidationFunction = (value, context) => {
  if (!isComponentRecord(value)) {
    reportInvalidComponentValue(context, 'AUTHOR_THREE_CAMERA_INVALID', 'Three.js camera state must be a plain object.')
    return
  }
  if (value.kind !== undefined && value.kind !== 'perspective' && value.kind !== 'orthographic') {
    reportInvalidComponentValue(context, 'AUTHOR_THREE_CAMERA_KIND_INVALID', 'kind must be "perspective" or "orthographic".', 'kind')
  }
  validateThreeTransform(value, context)
}

/** Validates one light initial or action payload. */
export const validateThreeLight: ValidationFunction = (value, context) => {
  if (!isComponentRecord(value)) {
    reportInvalidComponentValue(context, 'AUTHOR_THREE_LIGHT_INVALID', 'Three.js light state must be a plain object.')
    return
  }
  if (context.target === 'initial'
    && value.kind !== 'ambient'
    && value.kind !== 'directional'
    && value.kind !== 'point') {
    reportInvalidComponentValue(context, 'AUTHOR_THREE_LIGHT_KIND_INVALID', 'kind must be "ambient", "directional" or "point".', 'kind')
  }
  validateThreeNumber(value, 'intensity', context)
  validateThreeNumber(value, 'distance', context)
  validateThreeNumber(value, 'decay', context)
  validateThreeVector(value, 'position', context)
}

/** Adds explicit defaults without introducing native Three.js values. */
export function sanitizeThreeSceneHostInitial(
  value: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return {
    ...value,
    width: value.width ?? 640,
    height: value.height ?? 480,
  }
}

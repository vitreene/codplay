import type { ValidationFunction } from 'codplay'

type AuthorRecord = Record<string, unknown>

/** Checks whether one authored payload is a plain record. */
function isRecord(value: unknown): value is AuthorRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Reports one invalid Three.js value at the validator's authored path. */
function reportInvalid(
  context: Parameters<ValidationFunction>[1],
  code: string,
  message: string,
  property?: string,
): void {
  context.diagnostics.error(code, message, {
    refs: context.refs,
    context: { path: property === undefined ? context.path : `${context.path}.${property}` },
  })
}

/** Validates one optional finite number in a Three.js profile. */
function validateNumber(
  value: AuthorRecord,
  property: string,
  context: Parameters<ValidationFunction>[1],
  minimum?: number,
): void {
  const candidate = value[property]
  if (candidate === undefined) return
  if (typeof candidate !== 'number' || !Number.isFinite(candidate) || (minimum !== undefined && candidate < minimum)) {
    reportInvalid(
      context,
      'AUTHOR_THREEJS_NUMBER_INVALID',
      `${property} must be a finite number${minimum === undefined ? '' : ` greater than or equal to ${minimum}`}.`,
      property,
    )
  }
}

/** Validates one serializable vector of exactly three finite numbers. */
function validateVector(
  value: AuthorRecord,
  property: string,
  context: Parameters<ValidationFunction>[1],
): void {
  const candidate = value[property]
  if (candidate === undefined) return
  if (!Array.isArray(candidate)
    || candidate.length !== 3
    || candidate.some((part) => typeof part !== 'number' || !Number.isFinite(part))) {
    reportInvalid(context, 'AUTHOR_THREEJS_VECTOR_INVALID', `${property} must contain three finite numbers.`, property)
  }
}

/** Validates the common relation-free camera and light fields. */
function validateTransform(value: AuthorRecord, context: Parameters<ValidationFunction>[1]): void {
  validateVector(value, 'position', context)
  validateVector(value, 'lookAt', context)
  validateNumber(value, 'fov', context, 0)
  validateNumber(value, 'near', context, 0)
  validateNumber(value, 'far', context, 0)
  validateNumber(value, 'left', context)
  validateNumber(value, 'right', context)
  validateNumber(value, 'top', context)
  validateNumber(value, 'bottom', context)
}

/** Validates the scene-host initial profile. */
export const validateThreeSceneHostInitial: ValidationFunction = (value, context) => {
  if (!isRecord(value)) {
    reportInvalid(context, 'AUTHOR_THREE_SCENE_INITIAL_INVALID', 'Three.js scene host initial state must be a plain object.')
    return
  }
  validateNumber(value, 'width', context, 1)
  validateNumber(value, 'height', context, 1)
  if (value.background !== undefined
    && typeof value.background !== 'string'
    && (typeof value.background !== 'number' || !Number.isFinite(value.background))) {
    reportInvalid(context, 'AUTHOR_THREEJS_COLOR_INVALID', 'background must be a string or a finite number.', 'background')
  }
  if (value.renderer !== undefined) {
    if (!isRecord(value.renderer)) {
      reportInvalid(context, 'AUTHOR_THREEJS_RENDERER_INVALID', 'renderer must be a plain object.', 'renderer')
    } else {
      validateNumber(value.renderer, 'pixelRatio', context, 0)
    }
  }
}

/** Validates one camera initial or action payload. */
export const validateThreeCamera: ValidationFunction = (value, context) => {
  if (!isRecord(value)) {
    reportInvalid(context, 'AUTHOR_THREE_CAMERA_INVALID', 'Three.js camera state must be a plain object.')
    return
  }
  if (value.kind !== undefined && value.kind !== 'perspective' && value.kind !== 'orthographic') {
    reportInvalid(context, 'AUTHOR_THREE_CAMERA_KIND_INVALID', 'kind must be "perspective" or "orthographic".', 'kind')
  }
  validateTransform(value, context)
}

/** Validates one light initial or action payload. */
export const validateThreeLight: ValidationFunction = (value, context) => {
  if (!isRecord(value)) {
    reportInvalid(context, 'AUTHOR_THREE_LIGHT_INVALID', 'Three.js light state must be a plain object.')
    return
  }
  if (context.target === 'initial'
    && value.kind !== 'ambient'
    && value.kind !== 'directional'
    && value.kind !== 'point') {
    reportInvalid(context, 'AUTHOR_THREE_LIGHT_KIND_INVALID', 'kind must be "ambient", "directional" or "point".', 'kind')
  }
  validateNumber(value, 'intensity', context, 0)
  validateNumber(value, 'distance', context, 0)
  validateNumber(value, 'decay', context, 0)
  validateVector(value, 'position', context)
}

/** Validates one instanced-grid initial or action payload. */
export const validateThreeInstancedGrid: ValidationFunction = (value, context) => {
  if (!isRecord(value)) {
    reportInvalid(context, 'AUTHOR_THREE_GRID_INVALID', 'Three.js instanced grid state must be a plain object.')
    return
  }
  validateNumber(value, 'gridSize', context, 1)
  validateNumber(value, 'cellSize', context, 0)
  validateNumber(value, 'expansion', context, 0)
  validateNumber(value, 'delayMaxMs', context, 0)
  validateNumber(value, 'durationMs', context, 0)
  validateNumber(value, 'holdMs', context, 0)
  validateNumber(value, 'rotationPeriodMs', context, 0)
  validateNumber(value, 'rotationXPeriodMs', context, 0)
  validateNumber(value, 'opacity', context, 0)
  if (value.animate !== undefined && typeof value.animate !== 'boolean') {
    reportInvalid(context, 'AUTHOR_THREE_GRID_ANIMATE_INVALID', 'animate must be a boolean.', 'animate')
  }
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

/** Adds explicit defaults for the first grid feature. */
export function sanitizeThreeInstancedGridInitial(
  value: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return {
    ...value,
    gridSize: value.gridSize ?? 4,
    cellSize: value.cellSize ?? 0.5,
    expansion: value.expansion ?? 4,
    delayMaxMs: value.delayMaxMs ?? 500,
    durationMs: value.durationMs ?? 2_000,
    holdMs: value.holdMs ?? 500,
    rotationPeriodMs: value.rotationPeriodMs ?? 9_000,
    rotationXPeriodMs: value.rotationXPeriodMs ?? 12_000,
    opacity: value.opacity ?? 0.35,
  }
}

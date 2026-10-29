import type { ValidationFunction } from '../../services'
import {
  isReplaceMaskShape,
  isReplaceStaggerPattern,
  isReplacePresetName,
  isReplaceSlotTransition,
  REPLACE_MEDIA_SPLITS,
} from '../capabilities/replace-presets'
import {
  isFiniteNonNegativeNumber,
  isFinitePositiveNumber,
  isPositiveInteger,
  isReplaceDirection,
} from '../capabilities/replace-presets/replace-value-validation'
import { isComponentRecord, reportInvalidComponentValue } from './component-validation'

const REPLACE_MEDIA_FIELDS = new Set([
  'transition', 'duration', 'shape', 'split', 'stagger', 'staggerPattern', 'direction', 'cellSize', 'cellX', 'cellY',
])

/** Validates one media replacement declaration while preserving slot profile options. */
export function validateReplaceMedia(
  value: unknown,
  context: Parameters<ValidationFunction>[1],
  field = 'replace',
): void {
  if (value === undefined) return
  if (typeof value === 'string') {
    if (isKnownMediaTransition(value)) return
    reportInvalidComponentValue(
      context,
      'AUTHOR_MEDIA_REPLACE_TRANSITION_INVALID',
      `${field} must name a known media preset or slot transition.`,
      field,
    )
    return
  }
  if (!isComponentRecord(value)) {
    reportInvalidComponentValue(
      context,
      'AUTHOR_MEDIA_REPLACE_INVALID',
      `${field} must name a media preset or provide a replace object.`,
      field,
    )
    return
  }

  for (const key of Object.keys(value)) {
    if (!REPLACE_MEDIA_FIELDS.has(key)) {
      reportInvalidComponentValue(
        context,
        'AUTHOR_MEDIA_REPLACE_FIELD_INVALID',
        `${field}.${key} is not supported by media replacement.`,
        `${field}.${key}`,
      )
    }
  }

  const transition = value.transition
  if (!isKnownMediaTransition(transition)) {
    reportInvalidComponentValue(
      context,
      'AUTHOR_MEDIA_REPLACE_TRANSITION_INVALID',
      `${field}.transition must name a known media preset or slot transition.`,
      `${field}.transition`,
    )
  }
  for (const name of ['duration', 'stagger'] as const) {
    const number = value[name]
    if (number !== undefined && !isFiniteNonNegativeNumber(number)) {
      reportInvalidComponentValue(
        context,
        'AUTHOR_MEDIA_REPLACE_NUMBER_INVALID',
        `${field}.${name} must be a finite non-negative number.`,
        `${field}.${name}`,
      )
    }
  }
  if (value.split !== undefined && !(REPLACE_MEDIA_SPLITS as readonly unknown[]).includes(value.split)) {
    reportInvalidComponentValue(
      context,
      'AUTHOR_MEDIA_REPLACE_SPLIT_INVALID',
      `${field}.split must be cells.`,
      `${field}.split`,
    )
  }
  if (value.direction !== undefined && !isReplaceDirection(value.direction)) {
    reportInvalidComponentValue(
      context,
      'AUTHOR_MEDIA_REPLACE_DIRECTION_INVALID',
      `${field}.direction must name a supported propagation origin.`,
      `${field}.direction`,
    )
  }
  if (value.staggerPattern !== undefined
    && (value.split !== 'cells'
      || !isReplaceStaggerPattern(value.staggerPattern)
      || (value.staggerPattern !== 'manhattan' && value.direction !== undefined))) {
    reportInvalidComponentValue(
      context,
      'AUTHOR_MEDIA_REPLACE_GRID_INVALID',
      `${field}.staggerPattern must be manhattan, row-wave, or column-wave with split: cells; direction is only valid with manhattan.`,
      `${field}.staggerPattern`,
    )
  }
  for (const name of ['cellX', 'cellY'] as const) {
    const dimension = value[name]
    if (dimension !== undefined && !isPositiveInteger(dimension)) {
      reportInvalidComponentValue(
        context,
        'AUTHOR_MEDIA_REPLACE_GRID_INVALID',
        `${field}.${name} must be a positive integer.`,
        `${field}.${name}`,
      )
    }
  }
  if (value.cellSize !== undefined
    && (value.split !== 'cells' || !isFinitePositiveNumber(value.cellSize))) {
    reportInvalidComponentValue(
      context,
      'AUTHOR_MEDIA_REPLACE_GRID_INVALID',
      `${field}.cellSize must be a positive finite percentage of media width when split is cells.`,
      `${field}.cellSize`,
    )
  }
  if (value.shape !== undefined) {
    if ((transition !== 'mask-reveal' && value.split !== 'cells') || !isReplaceMaskShape(value.shape)) {
      reportInvalidComponentValue(
        context,
        'AUTHOR_MEDIA_REPLACE_SHAPE_INVALID',
        `${field}.shape requires mask-reveal or split: cells and must be a supported SVG mask shape.`,
        `${field}.shape`,
      )
    }
  }
}

/** Checks the catalog presets and the established slot transition names. */
function isKnownMediaTransition(value: unknown): boolean {
  return isReplacePresetName(value)
    || isReplaceSlotTransition(value)
}


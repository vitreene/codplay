import type { ValidationFunction } from '../../../services'
import type { PersoValidationFunction } from '../../../scene/validation'
import {
  isReplaceMaskShape,
  isReplaceSlotTransition,
  isReplaceStaggerPattern,
} from '../../capabilities/replace-presets'
import {
  isFiniteNonNegativeNumber,
  isFinitePositiveNumber,
  isPositiveInteger,
  isReplaceDirection,
} from '../../capabilities/replace-presets/replace-value-validation'
import { isComponentRecord, isComponentTagName, reportInvalidComponentValue } from '../component-validation'
import type { ForeignContentValue } from './slot-types'

/** Validates one slot initial profile without reading a materialized node. */
export const validateSlotInitial: ValidationFunction = (value, context) => {
  if (!isComponentRecord(value)) {
    reportInvalidComponentValue(context, 'AUTHOR_SLOT_INITIAL_INVALID', 'slot initial state must be a plain object.')
    return
  }

  if (value.tag !== undefined && !isComponentTagName(value.tag)) {
    reportInvalidComponentValue(context, 'AUTHOR_SLOT_TAG_INVALID', 'slot.tag must be a valid HTML tag name.', 'tag')
  }
  if (value.name !== undefined) {
    reportInvalidComponentValue(
      context,
      'AUTHOR_SLOT_NAME_ROOT_ONLY',
      'slot.name is a perso-root property and cannot be declared in initial state.',
      'name',
    )
  }
  if (value.content !== undefined && !isForeignContentValue(value.content)) {
    reportInvalidComponentValue(
      context,
      'AUTHOR_SLOT_CONTENT_INVALID',
      'slot.content must be a JSON-compatible foreign reference.',
      'content',
    )
  }
  validateReplace(value.replace, context)
}

/** Validates one slot action patch while keeping shared replace fields opaque. */
export const validateSlotAction: ValidationFunction = (value, context) => {
  if (!isComponentRecord(value)) {
    reportInvalidComponentValue(context, 'AUTHOR_SLOT_ACTION_INVALID', 'slot action must be a plain object.')
    return
  }

  if (value.tag !== undefined && !isComponentTagName(value.tag)) {
    reportInvalidComponentValue(context, 'AUTHOR_SLOT_TAG_INVALID', 'slot.tag must be a valid HTML tag name.', 'tag')
  }
  if (value.name !== undefined) {
    reportInvalidComponentValue(
      context,
      'AUTHOR_SLOT_NAME_IMMUTABLE',
      'slot.name is immutable and cannot be changed by an action.',
      'name',
    )
  }
  if (value.content !== undefined && !isForeignContentValue(value.content)) {
    reportInvalidComponentValue(
      context,
      'AUTHOR_SLOT_CONTENT_INVALID',
      'slot.content must be a JSON-compatible foreign reference.',
      'content',
    )
  }
  validateReplace(value.replace, context)
}

/** Validates the structural root name required by every slot host perso. */
export const validateSlotPerso: PersoValidationFunction = (perso, context) => {
  if (typeof perso.name !== 'string' || perso.name.trim().length === 0) {
    context.diagnostics.error(
      'AUTHOR_SLOT_NAME_REQUIRED',
      'A slot perso must declare a non-empty root name.',
      {
        refs: context.refs,
        context: { path: `${context.path}.name`, type: 'slot' },
      },
    )
  }
}

/** Adds the documented structural div default without introducing visual CSS. */
export function sanitizeSlotInitial(value: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return { ...value, tag: value.tag === undefined ? 'div' : value.tag }
}

/** Checks one recursively JSON-compatible opaque content reference. */
function isForeignContentValue(value: unknown): value is ForeignContentValue {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return Number.isFinite(value as number) || typeof value !== 'number'
  }
  if (Array.isArray(value)) return value.every(isForeignContentValue)
  if (!isComponentRecord(value)) return false
  return Object.values(value).every(isForeignContentValue)
}

/** Validates one slot replacement profile and its optional SVG cell grid. */
function validateReplace(value: unknown, context: Parameters<ValidationFunction>[1]): void {
  if (value === undefined) return
  if (isReplaceSlotTransition(value)) return
  if (!isComponentRecord(value)) {
    reportInvalidComponentValue(
      context,
      'AUTHOR_SLOT_REPLACE_INVALID',
      'slot.replace must name a supported transition or be an object with a supported transition.',
      'replace',
    )
    return
  }
  if (!isReplaceSlotTransition(value.transition)) {
    reportInvalidComponentValue(
      context,
      'AUTHOR_SLOT_REPLACE_TRANSITION_INVALID',
      'slot.replace.transition must be fade, fade-in, mask-reveal, curtain, wipe, slide-over, or stack.',
      'replace.transition',
    )
  }
  if (value.duration !== undefined
    && (typeof value.duration !== 'number' || !Number.isFinite(value.duration) || value.duration < 0)) {
    reportInvalidComponentValue(
      context,
      'AUTHOR_SLOT_REPLACE_DURATION_INVALID',
      'slot.replace.duration must be a finite non-negative number.',
      'replace.duration',
    )
  }
  const split = value.split
  if (split !== undefined && split !== 'letter' && split !== 'word' && split !== 'line' && split !== 'cells') {
    reportInvalidComponentValue(
      context,
      'AUTHOR_SLOT_REPLACE_SPLIT_INVALID',
      'slot.replace.split must be cells; legacy text split values remain inert.',
      'replace.split',
    )
  }
  validateCellGrid(value, split, context)
  if (value.shape !== undefined) {
    if (value.transition !== 'mask-reveal' && split !== 'cells') {
      reportInvalidComponentValue(
        context,
        'AUTHOR_SLOT_REPLACE_SHAPE_UNSUPPORTED',
        'slot.replace.shape requires mask-reveal or split: cells.',
        'replace.shape',
      )
    }
    if (!isReplaceMaskShape(value.shape)) {
      reportInvalidComponentValue(
        context,
        'AUTHOR_SLOT_REPLACE_SHAPE_INVALID',
        'slot.replace.shape must be circle, star, diamond, or an SVG path with a viewBox.',
        'replace.shape',
      )
    }
  }
}

/** Validates the shared responsive grid settings used by slot and media masks. */
function validateCellGrid(
  value: Readonly<Record<string, unknown>>,
  split: unknown,
  context: Parameters<ValidationFunction>[1],
): void {
  const fields = ['stagger', 'staggerPattern', 'direction', 'cellSize', 'cellX', 'cellY'] as const
  const hasGridSettings = fields.some((field) => value[field] !== undefined)
  if (split !== 'cells') {
    if (!hasGridSettings) return
    reportInvalidComponentValue(
      context,
      'AUTHOR_SLOT_REPLACE_GRID_INVALID',
      'slot.replace grid settings require split: cells.',
      'replace.split',
    )
    return
  }

  const stagger = value.stagger
  if (stagger !== undefined && !isFiniteNonNegativeNumber(stagger)) {
    reportInvalidComponentValue(
      context,
      'AUTHOR_SLOT_REPLACE_GRID_INVALID',
      'slot.replace.stagger must be a finite non-negative number.',
      'replace.stagger',
    )
  }
  const direction = value.direction
  if (direction !== undefined && !isReplaceDirection(direction)) {
    reportInvalidComponentValue(
      context,
      'AUTHOR_SLOT_REPLACE_DIRECTION_INVALID',
      'slot.replace.direction must name a supported propagation origin.',
      'replace.direction',
    )
  }
  const staggerPattern = value.staggerPattern
  if (staggerPattern !== undefined && !isReplaceStaggerPattern(staggerPattern)) {
    reportInvalidComponentValue(
      context,
      'AUTHOR_SLOT_REPLACE_GRID_INVALID',
      'slot.replace.staggerPattern must be manhattan, row-wave, or column-wave.',
      'replace.staggerPattern',
    )
  }
  if (staggerPattern !== undefined && staggerPattern !== 'manhattan' && direction !== undefined) {
    reportInvalidComponentValue(
      context,
      'AUTHOR_SLOT_REPLACE_GRID_INVALID',
      'slot.replace.direction is only valid with the manhattan stagger pattern.',
      'replace.direction',
    )
  }
  for (const dimensionName of ['cellX', 'cellY'] as const) {
    const dimension = value[dimensionName]
    if (dimension !== undefined && !isPositiveInteger(dimension)) {
      reportInvalidComponentValue(
        context,
        'AUTHOR_SLOT_REPLACE_GRID_INVALID',
        `slot.replace.${dimensionName} must be a positive integer.`,
        `replace.${dimensionName}`,
      )
    }
  }
  const cellSize = value.cellSize
  if (cellSize !== undefined && !isFinitePositiveNumber(cellSize)) {
    reportInvalidComponentValue(
      context,
      'AUTHOR_SLOT_REPLACE_GRID_INVALID',
      'slot.replace.cellSize must be a positive finite percentage of slot width.',
      'replace.cellSize',
    )
  }
}

import type { ValidationFunction } from '../../../services'
import type { PersoValidationFunction } from '../../../scene/validation'
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

/** Validates the slot replacement profile while deliberately ignoring split. */
function validateReplace(value: unknown, context: Parameters<ValidationFunction>[1]): void {
  if (value === undefined) return
  if (value === 'fade') return
  if (!isComponentRecord(value)) {
    reportInvalidComponentValue(
      context,
      'AUTHOR_SLOT_REPLACE_INVALID',
      'slot.replace must be "fade" or an object with transition: "fade".',
      'replace',
    )
    return
  }
  if (value.transition !== 'fade') {
    reportInvalidComponentValue(
      context,
      'AUTHOR_SLOT_REPLACE_TRANSITION_INVALID',
      'slot.replace.transition must be "fade".',
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
}

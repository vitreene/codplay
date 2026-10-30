import type { ValidationFunction } from '../../../services'
import { isReplacePresetName, REPLACE_DIRECTIONS, REPLACE_TEXT_SPLITS } from '../../capabilities/replace-presets'
import { isComponentRecord, isComponentTagName, reportInvalidComponentValue } from '../component-validation'

const TEXT_REPLACE_FIELDS = new Set(['transition', 'duration', 'split', 'stagger', 'direction', 'skipUnchanged'])

/** Validates the author data shared by rich-text initial and action profiles. */
export const validateTextInitial: ValidationFunction = (value, context) => {
  if (!isComponentRecord(value)) {
    reportInvalidComponentValue(context, 'AUTHOR_TEXT_INITIAL_INVALID', 'text initial state must be a plain object.')
    return
  }
  validateTextFields(value, context)
}

/** Validates one rich-text action, including its replace presentation options. */
export const validateTextAction: ValidationFunction = (value, context) => {
  if (!isComponentRecord(value)) return
  validateTextFields(value, context)
  validateTextReplace(value.replace, context)
}

/** Adds the documented div tag when the author leaves the rich-text tag unset. */
export function sanitizeTextInitial(value: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return { ...value, tag: value.tag === undefined ? 'div' : value.tag }
}

/** Validates the shared plain-text tag action replace setting. */
export function validateTagReplace(value: unknown, context: Parameters<ValidationFunction>[1]): void {
  validateTextReplace(value, context)
}

/** Validates common rich-text tag/content fields without interpreting HTML. */
function validateTextFields(value: Record<string, unknown>, context: Parameters<ValidationFunction>[1]): void {
  if (value.tag !== undefined && !isComponentTagName(value.tag)) {
    reportInvalidComponentValue(context, 'AUTHOR_TEXT_TAG_INVALID', 'text.tag must be a valid HTML tag name.', 'tag')
  }
  if (value.content !== undefined
    && value.content !== null
    && typeof value.content !== 'string'
    && typeof value.content !== 'number') {
    reportInvalidComponentValue(
      context,
      'AUTHOR_TEXT_CONTENT_INVALID',
      'text.content must be a string, number, or null.',
      'content',
    )
  }
}

/** Validates one V1-compatible replace command for text or tag content. */
function validateTextReplace(value: unknown, context: Parameters<ValidationFunction>[1]): void {
  if (value === undefined) return
  if (typeof value === 'string') {
    if (!isReplacePresetName(value)) {
      reportInvalidComponentValue(context, 'AUTHOR_TEXT_REPLACE_TRANSITION_INVALID', 'replace.transition must name a known text preset.', 'replace')
    }
    return
  }
  if (!isComponentRecord(value)) {
    reportInvalidComponentValue(context, 'AUTHOR_TEXT_REPLACE_INVALID', 'replace must name a text preset or provide a replace object.', 'replace')
    return
  }
  for (const key of Object.keys(value)) {
    if (!TEXT_REPLACE_FIELDS.has(key)) {
      reportInvalidComponentValue(context, 'AUTHOR_TEXT_REPLACE_FIELD_INVALID', `replace.${key} is not supported by text replacement.`, `replace.${key}`)
    }
  }
  if (!isReplacePresetName(value.transition)) {
    reportInvalidComponentValue(context, 'AUTHOR_TEXT_REPLACE_TRANSITION_INVALID', 'replace.transition must name a known text preset.', 'replace.transition')
  }
  for (const name of ['duration', 'stagger'] as const) {
    const number = value[name]
    if (number !== undefined && (typeof number !== 'number' || !Number.isFinite(number) || number < 0)) {
      reportInvalidComponentValue(context, 'AUTHOR_TEXT_REPLACE_NUMBER_INVALID', `replace.${name} must be a finite non-negative number.`, `replace.${name}`)
    }
  }
  if (value.split !== undefined && !(REPLACE_TEXT_SPLITS as readonly unknown[]).includes(value.split)) {
    reportInvalidComponentValue(context, 'AUTHOR_TEXT_REPLACE_SPLIT_INVALID', 'replace.split must be letter, word, or line.', 'replace.split')
  }
  if (value.direction !== undefined && !(REPLACE_DIRECTIONS as readonly unknown[]).includes(value.direction)) {
    reportInvalidComponentValue(context, 'AUTHOR_TEXT_REPLACE_DIRECTION_INVALID', 'replace.direction must name a supported propagation origin.', 'replace.direction')
  }
  if (value.skipUnchanged !== undefined && typeof value.skipUnchanged !== 'boolean') {
    reportInvalidComponentValue(context, 'AUTHOR_TEXT_REPLACE_SKIP_UNCHANGED_INVALID', 'replace.skipUnchanged must be a boolean.', 'replace.skipUnchanged')
  }
  if (value.skipUnchanged !== undefined
    && value.transition !== 'slot-up'
    && value.transition !== 'slot-down') {
    reportInvalidComponentValue(context, 'AUTHOR_TEXT_REPLACE_SKIP_UNCHANGED_UNSUPPORTED', 'replace.skipUnchanged is only supported by the slot-up and slot-down presets.', 'replace.skipUnchanged')
  }
}

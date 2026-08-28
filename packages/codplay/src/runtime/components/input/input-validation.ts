import { isPlainRecord } from '../../../shared'
import type { ValidationFunction } from '../../../services'
import { isComponentRecord, reportInvalidComponentValue } from '../component-validation'
import type {
  InputCorrectionIconDefinition,
  InputPartDefinition,
} from './input-types'

/** Validates the initial author profile of one quiz input. */
export const validateInputInitial: ValidationFunction = (value, context) => {
  if (!isComponentRecord(value)) {
    reportInvalidComponentValue(context, 'AUTHOR_INPUT_INITIAL_INVALID', 'input initial state must be a plain object.')
    return
  }
  validateInputFields(value, context)
}

/** Validates one input action patch. */
export const validateInputAction: ValidationFunction = (value, context) => {
  if (!isPlainRecord(value)) return
  validateInputFields(value, context)
}

/** Completes the initial input profile before it enters CompiledScene. */
export function sanitizeInputInitial(value: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  const result = { ...value }
  result.inputType = normalizeString(value.inputType, 'text')
  if (value.id === undefined || value.id === '') delete result.id
  if (value.name === undefined) delete result.name
  if (value.value !== undefined) result.value = value.value
  result.label = normalizeText(value.label)
  result.hint = normalizeText(value.hint)
  if (value.checked === undefined) delete result.checked
  if (value.disabled === undefined) delete result.disabled
  if (value.placeholder === undefined) delete result.placeholder
  if (value.min === undefined) delete result.min
  if (value.max === undefined) delete result.max
  if (value.step === undefined) delete result.step
  if (value.form === undefined) delete result.form
  result.required = value.required === true
  result.readOnly = value.readOnly === true
  result.selectedAnswerIds = normalizeStringList(value.selectedAnswerIds)
  result.correctAnswerIds = normalizeStringList(value.correctAnswerIds)
  result.disableAnswers = value.disableAnswers === true
  result.showCorrection = value.showCorrection === true
  result.selectionIcon = sanitizePart(value.selectionIcon, true)
  result.correctionIcon = sanitizeCorrectionIcon(value.correctionIcon, true)
  if (value.visualState === undefined) delete result.visualState
  return result
}

/** Normalizes only the fields present in one input action patch. */
export function sanitizeInputAction(value: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  const result = { ...value }
  if (result.inputType !== undefined) result.inputType = normalizeString(result.inputType, 'text')
  if (result.id === '') delete result.id
  if (result.label !== undefined) result.label = normalizeText(result.label)
  if (result.hint !== undefined) result.hint = normalizeText(result.hint)
  if (result.selectedAnswerIds !== undefined) result.selectedAnswerIds = normalizeStringList(result.selectedAnswerIds)
  if (result.correctAnswerIds !== undefined) result.correctAnswerIds = normalizeStringList(result.correctAnswerIds)
  if (result.selectionIcon !== undefined) result.selectionIcon = sanitizePart(result.selectionIcon, false)
  if (result.correctionIcon !== undefined) result.correctionIcon = sanitizeCorrectionIcon(result.correctionIcon, false)
  return result
}

/** Validates input-specific fields without duplicating shared root service validation. */
function validateInputFields(value: Record<string, unknown>, context: Parameters<ValidationFunction>[1]): void {
  for (const field of ['inputType', 'id', 'name', 'placeholder', 'form']) {
    if (value[field] !== undefined && typeof value[field] !== 'string') {
      reportInvalidComponentValue(context, 'AUTHOR_INPUT_FIELD_INVALID', `input.${field} must be a string.`, field)
    }
  }
  for (const field of ['value', 'label', 'hint', 'min', 'max', 'step']) {
    if (value[field] !== undefined && !isStringOrNumber(value[field])) {
      reportInvalidComponentValue(context, 'AUTHOR_INPUT_FIELD_INVALID', `input.${field} must be a string or number.`, field)
    }
  }
  for (const field of ['checked', 'disabled', 'required', 'readOnly', 'disableAnswers', 'showCorrection']) {
    if (value[field] !== undefined && typeof value[field] !== 'boolean') {
      reportInvalidComponentValue(context, 'AUTHOR_INPUT_FIELD_INVALID', `input.${field} must be a boolean.`, field)
    }
  }
  for (const field of ['selectedAnswerIds', 'correctAnswerIds']) {
    const list = value[field]
    if (list !== undefined && (!Array.isArray(list) || !list.every((entry) => typeof entry === 'string'))) {
      reportInvalidComponentValue(context, 'AUTHOR_INPUT_ANSWER_IDS_INVALID', `input.${field} must be a string array.`, field)
    }
  }
  if (value.visualState !== undefined && !isVisualState(value.visualState)) {
    reportInvalidComponentValue(context, 'AUTHOR_INPUT_VISUAL_STATE_INVALID', 'input.visualState is not supported.', 'visualState')
  }
  validatePart(value.selectionIcon, context, 'selectionIcon')
  validatePart(value.correctionIcon, context, 'correctionIcon')
}

/** Validates one nested icon part and its scalar display fields. */
function validatePart(
  value: unknown,
  context: Parameters<ValidationFunction>[1],
  field: string,
): void {
  if (value === undefined) return
  if (!isPlainRecord(value)) {
    reportInvalidComponentValue(context, 'AUTHOR_INPUT_PART_INVALID', `input.${field} must be a plain object.`, field)
    return
  }
  if (value.content !== undefined && !isStringOrNumber(value.content)) {
    reportInvalidComponentValue(context, 'AUTHOR_INPUT_PART_INVALID', `input.${field}.content must be a string or number.`, `${field}.content`)
  }
  for (const property of ['className', 'style', 'attr']) {
    if (value[property] !== undefined && (property === 'className'
      ? !isClassNameValue(value[property])
      : !isPlainRecord(value[property]))) {
      reportInvalidComponentValue(context, 'AUTHOR_INPUT_PART_INVALID', `input.${field}.${property} has an invalid value.`, `${field}.${property}`)
    }
  }
  for (const property of ['correctContent', 'incorrectContent', 'missedCorrectContent']) {
    if (value[property] !== undefined && !isStringOrNumber(value[property])) {
      reportInvalidComponentValue(context, 'AUTHOR_INPUT_PART_INVALID', `input.${field}.${property} must be a string or number.`, `${field}.${property}`)
    }
  }
}

/** Normalizes one scalar author value to the text used by an internal part. */
function normalizeText(value: unknown): string {
  return isStringOrNumber(value) ? String(value) : ''
}

/** Normalizes an optional non-empty string. */
function normalizeString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

/** Normalizes one answer identifier list without carrying empty identifiers. */
function normalizeStringList(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
    : []
}

/** Normalizes one nested icon part while preserving service values. */
function sanitizePart(value: unknown, complete: boolean): InputPartDefinition {
  if (!isPlainRecord(value)) return {}
  const result: Record<string, unknown> = {}
  if (complete || value.className !== undefined) result.className = value.className
  if (complete || value.style !== undefined) result.style = value.style
  if (complete || value.attr !== undefined) result.attr = value.attr
  if (value.content !== undefined) result.content = String(value.content as string | number)
  return result as InputPartDefinition
}

/** Normalizes the correction icon and its three state-specific labels. */
function sanitizeCorrectionIcon(value: unknown, complete: boolean): InputCorrectionIconDefinition {
  const part = sanitizePart(value, complete)
  if (!isPlainRecord(value)) return part
  const result: Record<string, unknown> = { ...part }
  for (const property of ['correctContent', 'incorrectContent', 'missedCorrectContent']) {
    if (value[property] !== undefined) result[property] = String(value[property] as string | number)
  }
  return result as InputCorrectionIconDefinition
}

/** Checks the scalar values accepted by native input fields and labels. */
function isStringOrNumber(value: unknown): value is string | number {
  return typeof value === 'string' || typeof value === 'number'
}

/** Checks the supported input visual-state vocabulary. */
function isVisualState(value: unknown): boolean {
  return value === 'idle'
    || value === 'selected'
    || value === 'disabled'
    || value === 'revealed-correct'
    || value === 'revealed-incorrect'
    || value === 'revealed-missed-correct'
}

/** Checks the shared class patch accepted by the className service. */
function isClassNameValue(value: unknown): boolean {
  if (typeof value === 'string') return true
  return isPlainRecord(value)
    && (value.add === undefined || typeof value.add === 'string')
    && (value.remove === undefined || typeof value.remove === 'string')
}

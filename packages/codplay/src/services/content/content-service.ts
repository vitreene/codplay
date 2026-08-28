import type { ServiceValidationDefinition, ValidationFunction } from '../service-validation-types'
import { reportInvalidServiceValue } from '../service-validation-report'

/** Runtime content accepted by the default content service. */
export type ContentValue = string | number | HTMLElement

/** Reports whether a value is an HTMLElement available in the current runtime. */
export function isContentElement(value: unknown): value is HTMLElement {
  return typeof HTMLElement !== 'undefined' && value instanceof HTMLElement
}

/** Validates the serializable content values accepted by CompiledScene. */
export const validateContent: ValidationFunction = (value, context) => {
  if (typeof value === 'string' || typeof value === 'number') return
  reportInvalidServiceValue(
    context.diagnostics,
    'AUTHOR_CONTENT_INVALID',
    'content must be a string or number in SceneDoc; HTMLElement values are runtime-only.',
    context,
  )
}

/** Declares the core content service consumed by tag components. */
export const CONTENT_SERVICE: ServiceValidationDefinition = {
  name: 'content',
  validate: validateContent,
}

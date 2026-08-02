import type { ServiceValidationDefinition, ValidationFunction } from '../service-validation-types'
import { reportInvalidServiceValue } from '../service-validation-report'

/** Validates the scalar values accepted by the content service. */
export const validateContent: ValidationFunction = (value, context) => {
  if (typeof value === 'string' || typeof value === 'number') return
  reportInvalidServiceValue(
    context.diagnostics,
    'AUTHOR_CONTENT_INVALID',
    'content must be a string or a number.',
    context,
  )
}

/** Declares the core content service consumed by tag components. */
export const CONTENT_SERVICE: ServiceValidationDefinition = {
  name: 'content',
  validate: validateContent,
}

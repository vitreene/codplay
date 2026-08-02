import type { ServiceValidationDefinition, ValidationFunction } from '../service-validation-types'
import { reportInvalidServiceValue } from '../service-validation-report'
import { isPlainRecord } from '../../shared'

/** Validates the shape shared by style service payloads. */
export const validateStyle: ValidationFunction = (value, context) => {
  if (!isPlainRecord(value)) {
    reportInvalidServiceValue(context.diagnostics, 'AUTHOR_STYLE_INVALID', 'style must be a plain object.', context)
  }
}

/** Declares the core style service consumed by components and compilation. */
export const STYLE_SERVICE: ServiceValidationDefinition = {
  name: 'style',
  validate: validateStyle,
  /** Preserves modern CSS syntax; URL/resource policy belongs to preload. */
  sanitizeMarkupAttribute: ({ attributeName, value }) => attributeName === 'style' ? value : undefined,
}

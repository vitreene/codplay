import type { ServiceValidationDefinition, ValidationFunction } from '../service-validation-types'
import { reportInvalidServiceValue } from '../service-validation-report'
import { isPlainRecord } from '../../shared'

/** Validates the plain attribute map accepted by the attr service. */
export const validateAttr: ValidationFunction = (value, context) => {
  if (!isPlainRecord(value)) {
    reportInvalidServiceValue(context.diagnostics, 'AUTHOR_ATTR_INVALID', 'attr must be a plain object.', context)
  }
}

/** Declares the core attr service consumed by components and compilation. */
export const ATTR_SERVICE: ServiceValidationDefinition = {
  name: 'attr',
  validate: validateAttr,
}

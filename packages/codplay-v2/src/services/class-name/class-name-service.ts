import type { ServiceValidationDefinition, ValidationFunction } from '../service-validation-types'
import { reportInvalidServiceValue } from '../service-validation-report'
import { isPlainRecord } from '../service-validation-utils'

/** Validates the string or patch form accepted by the className service. */
export const validateClassName: ValidationFunction = (value, context) => {
  if (typeof value === 'string') {
    return
  }

  if (isPlainRecord(value)) {
    for (const key of Object.keys(value)) {
      if (key !== 'add' && key !== 'remove') {
        reportInvalidServiceValue(
          context.diagnostics,
          'AUTHOR_CLASS_NAME_INVALID',
          'className only accepts add and remove keys.',
          context,
        )
        return
      }
    }

    if (value.add !== undefined && typeof value.add !== 'string') {
      reportInvalidServiceValue(context.diagnostics, 'AUTHOR_CLASS_NAME_INVALID', 'className.add must be a string.', context)
    }
    if (value.remove !== undefined && typeof value.remove !== 'string') {
      reportInvalidServiceValue(context.diagnostics, 'AUTHOR_CLASS_NAME_INVALID', 'className.remove must be a string.', context)
    }
    return
  }

  reportInvalidServiceValue(
    context.diagnostics,
    'AUTHOR_CLASS_NAME_INVALID',
    'className must be a string or a plain add/remove object.',
    context,
  )
}

/** Declares the core className service consumed by components and compilation. */
export const CLASS_NAME_SERVICE: ServiceValidationDefinition = {
  name: 'className',
  validate: validateClassName,
}

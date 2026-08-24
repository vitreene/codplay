import type { ValidationFunction } from '../../../services'
import { isComponentRecord, isComponentTagName, reportInvalidComponentValue } from '../component-validation'

/** Validates the list root and its declared reorder policy. */
export const validateListInitial: ValidationFunction = (value, context) => {
  if (!isComponentRecord(value)) {
    reportInvalidComponentValue(context, 'AUTHOR_LIST_INITIAL_INVALID', 'list initial state must be a plain object.')
    return
  }

  if (value.tag !== undefined
    && (typeof value.tag !== 'string' || (value.tag.trim().length > 0 && !isComponentTagName(value.tag)))) {
    reportInvalidComponentValue(context, 'AUTHOR_LIST_TAG_INVALID', 'list.tag must be a valid HTML tag name.', 'tag')
  }

  if (value.config === undefined) return
  if (!isComponentRecord(value.config)) {
    reportInvalidComponentValue(context, 'AUTHOR_LIST_CONFIG_INVALID', 'list.config must be a plain object.', 'config')
    return
  }

  for (const property of ['reorderOnMove', 'reorderOnAdd', 'reorderOnRemove']) {
    const propertyValue = value.config[property]
    if (propertyValue !== undefined && typeof propertyValue !== 'boolean') {
      reportInvalidComponentValue(
        context,
        'AUTHOR_LIST_CONFIG_INVALID',
        `list.config.${property} must be a boolean.`,
        `config.${property}`,
      )
    }
  }
}

/** Makes the documented section default explicit before the component is created. */
export function sanitizeListInitial(value: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  const tag = typeof value.tag === 'string' && value.tag.trim().length > 0 ? value.tag : 'section'
  return { ...value, tag }
}

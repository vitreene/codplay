import type { ValidationFunction } from '../../../services'
import { isComponentRecord, isComponentTagName, reportInvalidComponentValue } from '../component-validation'

/** Validates the tag-specific initial contract without inspecting a materialized node. */
export const validateTagInitial: ValidationFunction = (value, context) => {
  if (!isComponentRecord(value)) {
    reportInvalidComponentValue(context, 'AUTHOR_TAG_INITIAL_INVALID', 'tag initial state must be a plain object.')
    return
  }

  if (value.tag !== undefined && !isComponentTagName(value.tag)) {
    reportInvalidComponentValue(context, 'AUTHOR_TAG_NAME_INVALID', 'tag must be a valid HTML tag name.', 'tag')
  }
}

/** Makes the documented div default explicit before the component is created. */
export function sanitizeTagInitial(value: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return { ...value, tag: value.tag === undefined ? 'div' : value.tag }
}

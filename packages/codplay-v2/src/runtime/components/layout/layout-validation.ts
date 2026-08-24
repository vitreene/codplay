import type { ValidationFunction } from '../../../services'
import { isComponentRecord, reportInvalidComponentValue } from '../component-validation'

/** Validates the layout template required before HTML materialization. */
export const validateLayoutInitial: ValidationFunction = (value, context) => {
  if (!isComponentRecord(value) || typeof value.markup !== 'string' || value.markup.trim().length === 0) {
    reportInvalidComponentValue(
      context,
      'AUTHOR_LAYOUT_MARKUP_INVALID',
      'layout.markup must be a non-empty string.',
      'markup',
    )
  }
}

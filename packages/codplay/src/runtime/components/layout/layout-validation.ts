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
  if (!isComponentRecord(value) || value.flowReservations === undefined) return
  if (!Array.isArray(value.flowReservations) || value.flowReservations.some((entry) =>
    !isComponentRecord(entry)
    || typeof entry.partId !== 'string'
    || entry.partId.length === 0
    || typeof entry.blockSize !== 'string'
    || entry.blockSize.length === 0
  )) {
    reportInvalidComponentValue(
      context,
      'AUTHOR_LAYOUT_FLOW_RESERVATION_INVALID',
      'layout.flowReservations must list existing part ids and CSS block sizes.',
      'flowReservations',
    )
  }
}

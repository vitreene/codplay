import { isPlainRecord } from '../../../shared'
import type { ValidationFunction } from '../../../services'
import { isComponentRecord, reportInvalidComponentValue } from '../component-validation'

/** Validates one image initial payload, including the deliberate fitMode removal. */
export const validateImageInitial: ValidationFunction = (value, context) => {
  if (!isComponentRecord(value)) {
    reportInvalidComponentValue(context, 'AUTHOR_IMAGE_INITIAL_INVALID', 'img initial state must be a plain object.')
    return
  }

  validateImageFields(value, context, 'initial')
}

/** Validates one image action payload without accepting the retired fitMode field. */
export const validateImageAction: ValidationFunction = (value, context) => {
  if (!isPlainRecord(value)) return
  validateImageFields(value, context, 'action')
}

/** Validates image-specific fields independently from shared service validation. */
function validateImageFields(
  value: Record<string, unknown>,
  context: Parameters<ValidationFunction>[1],
  scope: 'initial' | 'action',
): void {
  if ('fitMode' in value) {
    reportInvalidComponentValue(
      context,
      'AUTHOR_IMAGE_FIT_MODE_REMOVED',
      'img.fitMode is not part of the V2 contract; use img.style.objectFit.',
      'fitMode',
    )
  }
  if (value.src !== undefined && typeof value.src !== 'string') {
    reportInvalidComponentValue(context, 'AUTHOR_IMAGE_SRC_INVALID', `img ${scope} src must be a string.`, 'src')
  }
  if (value.alt !== undefined && typeof value.alt !== 'string') {
    reportInvalidComponentValue(context, 'AUTHOR_IMAGE_ALT_INVALID', `img ${scope} alt must be a string.`, 'alt')
  }
  if (value.img !== undefined && !isPlainRecord(value.img)) {
    reportInvalidComponentValue(context, 'AUTHOR_IMAGE_PART_INVALID', 'img.img must be a plain object.', 'img')
  }
  validateImageReplace(value.replace, context)
}

/** Validates the simple replacement declaration without adding split semantics to img. */
function validateImageReplace(value: unknown, context: Parameters<ValidationFunction>[1]): void {
  if (value === undefined || value === 'fade') return
  if (!isPlainRecord(value)) {
    reportInvalidComponentValue(
      context,
      'AUTHOR_IMAGE_REPLACE_INVALID',
      'img.replace must be "fade" or an object with transition: "fade".',
      'replace',
    )
    return
  }
  if (value.transition !== 'fade') {
    reportInvalidComponentValue(
      context,
      'AUTHOR_IMAGE_REPLACE_TRANSITION_INVALID',
      'img.replace.transition must be "fade".',
      'replace.transition',
    )
  }
  if (value.duration !== undefined
    && (typeof value.duration !== 'number' || !Number.isFinite(value.duration) || value.duration < 0)) {
    reportInvalidComponentValue(
      context,
      'AUTHOR_IMAGE_REPLACE_DURATION_INVALID',
      'img.replace.duration must be a finite non-negative number.',
      'replace.duration',
    )
  }
}

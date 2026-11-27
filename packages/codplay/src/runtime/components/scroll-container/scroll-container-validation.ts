import type { ValidationFunction } from '../../../services'
import { isPlainRecord } from '../../../shared'
import { reportInvalidComponentValue } from '../component-validation'
import { validateTagInitial } from '../tag'

/** Validates one scrollport tag and its optional progress profile. */
export const validateScrollContainerInitial: ValidationFunction = (value, context) => {
  validateTagInitial(value, context)
  if (!isPlainRecord(value) || value.values === undefined) return
  if (!isPlainRecord(value.values)) {
    reportInvalidComponentValue(context, 'AUTHOR_SCROLL_CONTAINER_VALUES_INVALID', 'scroll-container.values must be a plain object.', 'values')
    return
  }
  if (value.values.progress === undefined) return
  if (!isPlainRecord(value.values.progress)) {
    reportInvalidComponentValue(context, 'AUTHOR_SCROLL_CONTAINER_PROGRESS_INVALID', 'scroll-container.values.progress must be a plain object.', 'values.progress')
    return
  }
  const { axis, range } = value.values.progress
  if (axis !== undefined && axis !== 'block' && axis !== 'inline') {
    reportInvalidComponentValue(context, 'AUTHOR_SCROLL_CONTAINER_AXIS_INVALID', 'scroll-container.values.progress.axis must be block or inline.', 'values.progress.axis')
  }
  if (range !== undefined && range !== 'scrollport') {
    reportInvalidComponentValue(context, 'AUTHOR_SCROLL_CONTAINER_RANGE_INVALID', 'scroll-container.values.progress.range must be scrollport.', 'values.progress.range')
  }
}


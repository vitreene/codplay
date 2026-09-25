import type { ValidationContext, ValidationFunction } from 'codplay/services'
import { validateTagInitial } from 'codplay/runtime/components'
import { isPlainRecord } from 'codplay/shared'

/** Validates one scrollport tag and its optional progress profile. */
export const validateScrollContainerInitial: ValidationFunction = (value, context) => {
  validateTagInitial(value, context)
  if (!isPlainRecord(value)) return

  if (value.values === undefined) return
  if (!isPlainRecord(value.values)) {
    reportScrollContainerIssue(
      context,
      'AUTHOR_SCROLL_CONTAINER_VALUES_INVALID',
      'scroll-container.values must be a plain object.',
      'values',
    )
    return
  }
  if (value.values.progress === undefined) return
  if (!isPlainRecord(value.values.progress)) {
    reportScrollContainerIssue(
      context,
      'AUTHOR_SCROLL_CONTAINER_PROGRESS_INVALID',
      'scroll-container.values.progress must be a plain object.',
      'values.progress',
    )
    return
  }
  const { axis, range } = value.values.progress
  if (axis !== undefined && axis !== 'block' && axis !== 'inline') {
    reportScrollContainerIssue(
      context,
      'AUTHOR_SCROLL_CONTAINER_AXIS_INVALID',
      'scroll-container.values.progress.axis must be block or inline.',
      'values.progress.axis',
    )
  }
  if (range !== undefined && range !== 'scrollport') {
    reportScrollContainerIssue(
      context,
      'AUTHOR_SCROLL_CONTAINER_RANGE_INVALID',
      'scroll-container.values.progress.range must be scrollport.',
      'values.progress.range',
    )
  }
}

/** Reports a component validation error at its authored profile path. */
function reportScrollContainerIssue(
  context: ValidationContext,
  code: string,
  message: string,
  suffix: string,
): void {
  context.diagnostics.error(code, message, {
    refs: context.refs,
    context: { path: `${context.path}.${suffix}` },
  })
}

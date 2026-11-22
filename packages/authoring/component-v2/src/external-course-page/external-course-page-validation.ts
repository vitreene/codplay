import { isPlainRecord } from 'codplay/shared/is-plain-record'
import type { ValidationContext, ValidationFunction } from 'codplay/services'
import { validateTagAction, validateTagInitial } from 'codplay/runtime/components/tag'

/** Validates the serialized URL, source identity, and config for one reader page. */
export const validateExternalCoursePageInitial: ValidationFunction = (value, context) => {
  validateTagInitial(value, context)
  if (!isPlainRecord(value)) return

  validateNonEmptyString(value.sourceUrl, context, 'sourceUrl')
  validateNonEmptyString(value.chapterId, context, 'chapterId')
  validateNonEmptyString(value.pageId, context, 'pageId')
  if (value.sourceUrl !== undefined) validateSourceUrl(value.sourceUrl, context)
  if (value.title !== undefined && typeof value.title !== 'string') {
    reportExternalCoursePageIssue(context, 'AUTHOR_EXTERNAL_COURSE_TITLE_INVALID', 'title must be a string.', 'title')
  }
  if (value.content !== undefined || value.attr !== undefined || value.tag !== undefined) {
    reportExternalCoursePageIssue(
      context,
      'AUTHOR_EXTERNAL_COURSE_ROOT_FIELDS_UNSUPPORTED',
      'External course pages accept className and style for their iframe root.',
      'root',
    )
  }
  validateConfig(value.config, context)
}

/** Accepts only className and style changes on the fixed iframe root. */
export const validateExternalCoursePageAction: ValidationFunction = (value, context) => {
  validateTagAction(value, context)
  if (!isPlainRecord(value)) return
  const unsupportedFields = Object.keys(value).filter((key) => key !== 'className' && key !== 'style')
  if (unsupportedFields.length === 0) return
  reportExternalCoursePageIssue(
    context,
    'AUTHOR_EXTERNAL_COURSE_ACTION_FIELD_UNSUPPORTED',
    `Unsupported external course page action fields: ${unsupportedFields.join(', ')}.`,
    'action',
  )
}

/** Confirms one required profile value is a non-empty string. */
function validateNonEmptyString(value: unknown, context: ValidationContext, key: string): void {
  if (typeof value === 'string' && value.trim().length > 0) return
  reportExternalCoursePageIssue(
    context,
    'AUTHOR_EXTERNAL_COURSE_PROFILE_VALUE_INVALID',
    `${key} must be a non-empty string.`,
    key,
  )
}

/** Validates the HTTP or HTTPS launch URL at the authored-profile boundary. */
function validateSourceUrl(value: unknown, context: ValidationContext): void {
  if (typeof value !== 'string') return
  try {
    const url = new URL(value)
    if (url.protocol === 'http:' || url.protocol === 'https:') return
  } catch {
    // Invalid URLs are reported through the same authored-profile boundary.
  }
  reportExternalCoursePageIssue(
    context,
    'AUTHOR_EXTERNAL_COURSE_URL_INVALID',
    'sourceUrl must be an absolute HTTP or HTTPS URL.',
    'sourceUrl',
  )
}

/** Validates the JSON-safe scalar configuration passed through the launch URL. */
function validateConfig(value: unknown, context: ValidationContext): void {
  if (!isPlainRecord(value)) {
    reportExternalCoursePageIssue(
      context,
      'AUTHOR_EXTERNAL_COURSE_CONFIG_INVALID',
      'config must be a plain object of strings, finite numbers, and booleans.',
      'config',
    )
    return
  }
  const invalidKey = Object.entries(value).find(([, entry]) => (
    typeof entry !== 'string'
    && typeof entry !== 'boolean'
    && !(typeof entry === 'number' && Number.isFinite(entry))
  ))?.[0]
  if (invalidKey === undefined) return
  reportExternalCoursePageIssue(
    context,
    'AUTHOR_EXTERNAL_COURSE_CONFIG_VALUE_INVALID',
    `config.${invalidKey} must be a string, finite number, or boolean.`,
    `config.${invalidKey}`,
  )
}

/** Reports one profile problem at the exact authored field path. */
function reportExternalCoursePageIssue(
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

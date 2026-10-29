import { isPlainRecord } from '../../../shared'
import type { ValidationFunction } from '../../../services'
import { reportInvalidServiceValue } from '../../../services/service-validation-report'
import { validateReplaceMedia } from '../replace-media-validation'

/** Validates the source and template options declared by one media perso. */
export const validateMediaInitial: ValidationFunction = (value, context) => {
  if (!isPlainRecord(value) || typeof value.src !== 'string' || value.src.length === 0) {
    reportInvalidServiceValue(context.diagnostics, 'AUTHOR_MEDIA_SRC_INVALID', 'media.src must be a non-empty string.', context)
    return
  }
  if (value.tag !== undefined && value.tag !== 'video' && value.tag !== 'audio') {
    reportInvalidServiceValue(context.diagnostics, 'AUTHOR_MEDIA_TAG_INVALID', 'media.tag only accepts "video" or "audio".', context)
  }
  if (value.controls !== undefined && typeof value.controls !== 'boolean') {
    reportInvalidServiceValue(context.diagnostics, 'AUTHOR_MEDIA_CONTROLS_INVALID', 'media.controls must be a boolean.', context)
  }
  if ('master' in value) {
    reportInvalidServiceValue(context.diagnostics, 'AUTHOR_MEDIA_MASTER_REMOVED', 'media.master has been replaced by media.sync.', context)
  }
  if (value.sync !== undefined && value.sync !== 'auto' && value.sync !== 'master' && value.sync !== 'independent') {
    reportInvalidServiceValue(context.diagnostics, 'AUTHOR_MEDIA_SYNC_INVALID', 'media.sync only accepts "auto", "master" or "independent".', context)
  }
  validateMediaPart(value.video, context, 'video')
}

/** Validates a source replacement carried by one media action. */
export const validateMediaAction: ValidationFunction = (value, context) => {
  if (!isPlainRecord(value)) return
  if ('sync' in value || 'master' in value) {
    reportInvalidServiceValue(context.diagnostics, 'AUTHOR_MEDIA_SYNC_INITIAL_ONLY', 'media.sync is an initial configuration and cannot be changed by an action.', context)
  }
  if (value.src !== undefined && (typeof value.src !== 'string' || value.src.length === 0)) {
    reportInvalidServiceValue(context.diagnostics, 'AUTHOR_MEDIA_SRC_INVALID', 'media action src must be a non-empty string.', context)
  }
  validateMediaPart(value.video, context, 'video')
  validateBroadcast(value.broadcast, context)
  validateReplaceMedia(value.replace, context, 'media.replace')
}

/** Validates one optional patch targeted at the native media part. */
function validateMediaPart(
  value: unknown,
  context: Parameters<ValidationFunction>[1],
  name: string,
): void {
  if (value === undefined || isPlainRecord(value)) return
  reportInvalidServiceValue(
    context.diagnostics,
    'AUTHOR_MEDIA_PART_INVALID',
    `media.${name} must be a plain object.`,
    context,
  )
}

/** Validates one optional media broadcast action. */
function validateBroadcast(value: unknown, context: Parameters<ValidationFunction>[1]): void {
  if (value === undefined) return
  if (!isPlainRecord(value)) {
    reportInvalidServiceValue(context.diagnostics, 'AUTHOR_MEDIA_BROADCAST_INVALID', 'media action broadcast must be an object.', context)
    return
  }
  if (value.type !== 'START' && value.type !== 'PAUSE' && value.type !== 'STOP') {
    reportInvalidServiceValue(context.diagnostics, 'AUTHOR_MEDIA_BROADCAST_TYPE_INVALID', 'media action broadcast.type must be START, PAUSE or STOP.', context)
  }
  for (const name of ['startAt', 'endAt'] as const) {
    const position = value[name]
    if (position !== undefined && (typeof position !== 'number' || !Number.isFinite(position) || position < 0)) {
      reportInvalidServiceValue(context.diagnostics, 'AUTHOR_MEDIA_BROADCAST_POSITION_INVALID', `media action broadcast.${name} must be a finite non-negative number.`, context)
    }
  }
  if (typeof value.startAt === 'number' && typeof value.endAt === 'number' && value.endAt < value.startAt) {
    reportInvalidServiceValue(context.diagnostics, 'AUTHOR_MEDIA_BROADCAST_WINDOW_INVALID', 'media action broadcast.endAt must not be before startAt.', context)
  }
  if (value.transition === undefined) return
  if (!isPlainRecord(value.transition)) {
    reportInvalidServiceValue(context.diagnostics, 'AUTHOR_MEDIA_BROADCAST_TRANSITION_INVALID', 'media action broadcast.transition must be an object.', context)
    return
  }
  const transition = value.transition
  if (transition.duration !== undefined
    && (typeof transition.duration !== 'number' || !Number.isFinite(transition.duration) || transition.duration < 0)) {
    reportInvalidServiceValue(context.diagnostics, 'AUTHOR_MEDIA_BROADCAST_TRANSITION_DURATION_INVALID', 'media action broadcast.transition.duration must be a finite non-negative number.', context)
  }
  for (const name of ['from', 'to'] as const) {
    if (transition[name] !== undefined && !isPlainRecord(transition[name])) {
      reportInvalidServiceValue(context.diagnostics, 'AUTHOR_MEDIA_BROADCAST_TRANSITION_VALUES_INVALID', `media action broadcast.transition.${name} must be an object.`, context)
    }
  }
}

import type { ValidationFunction } from 'codplay'
import { isComponentRecord, reportInvalidComponentValue } from 'codplay/runtime/components/component-validation'
import { MOOD_BASELINES } from '@codplay/avatar-engine'

type ValidationContext = Parameters<ValidationFunction>[1]

/** Validates only the stable model fields understood by the Avatar core. */
export const validateAvatarInitial: ValidationFunction = (value, context) => {
  if (!isComponentRecord(value)) {
    reportInvalidComponentValue(context, 'AUTHOR_AVATAR_INITIAL_INVALID', 'Avatar initial state must be a plain object.')
    return
  }
  if (typeof value.src !== 'string' || value.src.length === 0) {
    reportInvalidComponentValue(context, 'AUTHOR_AVATAR_SRC_INVALID', 'src must be a non-empty string.', 'src')
  }
  if (value.morphPrefix !== undefined && typeof value.morphPrefix !== 'string') {
    reportInvalidComponentValue(context, 'AUTHOR_AVATAR_MORPH_PREFIX_INVALID', 'morphPrefix must be a string.', 'morphPrefix')
  }
  validateMood(value.mood, context, 'mood')
  if (value.modelRotationY !== undefined
    && (typeof value.modelRotationY !== 'number' || !Number.isFinite(value.modelRotationY))) {
    reportInvalidComponentValue(context, 'AUTHOR_AVATAR_ROTATION_INVALID', 'modelRotationY must be a finite number.', 'modelRotationY')
  }
}

/** Validates a mood contribution without inspecting model morphs. */
export const validateAvatarMood: ValidationFunction = (value, context) => {
  validateRecord(value, context, 'AUTHOR_AVATAR_MOOD_INVALID', 'Avatar mood state must be a plain object.')
  if (!isComponentRecord(value)) return
  validateMood(value.mood, context, 'mood')
  validateFiniteNumber(value.durationMs, context, 'durationMs')
}

/** Validates the generic viseme payload and optional weight. */
export const validateAvatarLipSync: ValidationFunction = (value, context) => {
  validateRecord(value, context, 'AUTHOR_AVATAR_LIP_SYNC_INVALID', 'Avatar lip-sync state must be a plain object.')
  if (!isComponentRecord(value)) return
  if (value.viseme !== undefined && value.viseme !== null && typeof value.viseme !== 'string') {
    reportInvalidComponentValue(context, 'AUTHOR_AVATAR_VISEME_INVALID', 'viseme must be a string or null.', 'viseme')
  }
  validateFiniteNumber(value.weight, context, 'weight')
  validateFiniteNumber(value.durationMs, context, 'durationMs')
}

/** Validates one gesture name and optional deterministic seed. */
export const validateAvatarGesture: ValidationFunction = (value, context) => {
  validateRecord(value, context, 'AUTHOR_AVATAR_GESTURE_INVALID', 'Avatar gesture state must be a plain object.')
  if (!isComponentRecord(value)) return
  if (value.gesture !== undefined && value.gesture !== null && typeof value.gesture !== 'string') {
    reportInvalidComponentValue(context, 'AUTHOR_AVATAR_GESTURE_NAME_INVALID', 'gesture must be a string or null.', 'gesture')
  }
  validateFiniteNumber(value.seed, context, 'seed')
}

/** Validates the optional idle controls without inspecting the Avatar model. */
export const validateAvatarIdle: ValidationFunction = (value, context) => {
  validateRecord(value, context, 'AUTHOR_AVATAR_IDLE_INVALID', 'Avatar idle state must be a plain object.')
  if (!isComponentRecord(value)) return
  if (value.blink !== undefined && typeof value.blink !== 'boolean') {
    reportInvalidComponentValue(context, 'AUTHOR_AVATAR_BLINK_INVALID', 'blink must be a boolean.', 'blink')
  }
  validateFiniteNumber(value.blinkSeed, context, 'blinkSeed')
}

/** Reports the common payload shape while leaving native model validation external. */
function validateRecord(
  value: unknown,
  context: ValidationContext,
  code: string,
  message: string,
): void {
  if (!isComponentRecord(value)) reportInvalidComponentValue(context, code, message)
}

/** Validates one optional finite number without imposing an artificial range. */
function validateFiniteNumber(value: unknown, context: ValidationContext, property: string): void {
  if (value === undefined) return
  if (typeof value === 'number' && Number.isFinite(value)) return
  reportInvalidComponentValue(context, 'AUTHOR_AVATAR_NUMBER_INVALID', `${property} must be a finite number.`, property)
}

/** Validates only the mood vocabulary owned by the TalkingHead-derived engine. */
function validateMood(value: unknown, context: ValidationContext, property: string): void {
  if (value === undefined) return
  if (typeof value === 'string' && value in MOOD_BASELINES) return
  reportInvalidComponentValue(context, 'AUTHOR_AVATAR_MOOD_NAME_INVALID', `${property} is not a supported Avatar mood.`, property)
}

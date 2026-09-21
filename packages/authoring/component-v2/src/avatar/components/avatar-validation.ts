/** Authoring validation for the public Avatar component definitions. */
import type { ValidationFunction } from 'codplay'
import { isComponentRecord, reportInvalidComponentValue } from 'codplay/runtime/components/component-validation'
import { MOOD_BASELINES } from '../mood/expression-engine'

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
  validatePosition(value.position, context)
  validateAnimationSources(value.animations, context)
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
  validateFiniteNumber(value.durationMs, context, 'durationMs')
}

/** Validates the optional idle controls without inspecting the Avatar model. */
export const validateAvatarIdle: ValidationFunction = (value, context) => {
  validateRecord(value, context, 'AUTHOR_AVATAR_IDLE_INVALID', 'Avatar idle state must be a plain object.')
  if (!isComponentRecord(value)) return
  if (value.pose !== undefined && typeof value.pose !== 'string') {
    reportInvalidComponentValue(context, 'AUTHOR_AVATAR_POSE_INVALID', 'pose must be a string.', 'pose')
  }
  if (value.blink !== undefined && typeof value.blink !== 'boolean') {
    reportInvalidComponentValue(context, 'AUTHOR_AVATAR_BLINK_INVALID', 'blink must be a boolean.', 'blink')
  }
  validateFiniteNumber(value.blinkSeed, context, 'blinkSeed')
  if (value.breathe !== undefined && typeof value.breathe !== 'boolean') {
    reportInvalidComponentValue(context, 'AUTHOR_AVATAR_BREATHE_INVALID', 'breathe must be a boolean.', 'breathe')
  }
  if (value.headDrift !== undefined && typeof value.headDrift !== 'boolean') {
    reportInvalidComponentValue(context, 'AUTHOR_AVATAR_HEAD_DRIFT_INVALID', 'headDrift must be a boolean.', 'headDrift')
  }
}

/** Validates the generic camera-contact controls without inspecting the model. */
export const validateAvatarGaze: ValidationFunction = (value, context) => {
  validateRecord(value, context, 'AUTHOR_AVATAR_GAZE_INVALID', 'Avatar gaze state must be a plain object.')
  if (!isComponentRecord(value)) return
  if (value.enabled !== undefined && typeof value.enabled !== 'boolean') {
    reportInvalidComponentValue(context, 'AUTHOR_AVATAR_GAZE_ENABLED_INVALID', 'enabled must be a boolean.', 'enabled')
  }
  if (value.contact !== undefined && value.contact !== null) {
    validateFiniteNumber(value.contact, context, 'contact')
  }
  validateFiniteNumber(value.durationMs, context, 'durationMs')
}

/** Validates the serializable resource declarations attached to one Avatar. */
function validateAnimationSources(
  value: unknown,
  context: ValidationContext,
): void {
  if (value === undefined) return
  if (!isComponentRecord(value)) {
    reportInvalidComponentValue(context, 'AUTHOR_AVATAR_ANIMATIONS_INVALID', 'animations must be a plain object.', 'animations')
    return
  }
  for (const [name, source] of Object.entries(value)) {
    if (!isComponentRecord(source)) {
      reportInvalidComponentValue(context, 'AUTHOR_AVATAR_ANIMATION_SOURCE_INVALID', `animations.${name} must be a plain object.`, `animations.${name}`)
      continue
    }
    if (typeof source.src !== 'string' || source.src.length === 0) {
      reportInvalidComponentValue(context, 'AUTHOR_AVATAR_ANIMATION_SRC_INVALID', `animations.${name}.src must be a non-empty string.`, `animations.${name}.src`)
    }
    if (source.format !== undefined && source.format !== 'glb' && source.format !== 'fbx') {
      reportInvalidComponentValue(context, 'AUTHOR_AVATAR_ANIMATION_FORMAT_INVALID', `animations.${name}.format must be "glb" or "fbx".`, `animations.${name}.format`)
    }
    if (source.clip !== undefined
      && typeof source.clip !== 'string'
      && (typeof source.clip !== 'number' || !Number.isFinite(source.clip))) {
      reportInvalidComponentValue(context, 'AUTHOR_AVATAR_ANIMATION_CLIP_INVALID', `animations.${name}.clip must be a string or a finite number.`, `animations.${name}.clip`)
    }
    if (source.mode !== undefined && source.mode !== 'animation' && source.mode !== 'pose') {
      reportInvalidComponentValue(context, 'AUTHOR_AVATAR_ANIMATION_MODE_INVALID', `animations.${name}.mode must be "animation" or "pose".`, `animations.${name}.mode`)
    }
    validateFiniteNumber(source.scale, context, `animations.${name}.scale`)
  }
}

/** Validates the initial playback controls of the Avatar motion component. */
export const validateAvatarMotion: ValidationFunction = (value, context) => {
  validateRecord(value, context, 'AUTHOR_AVATAR_MOTION_INVALID', 'Avatar motion state must be a plain object.')
  if (!isComponentRecord(value)) return
  if (value.motion !== undefined && value.motion !== null && typeof value.motion !== 'string') {
    reportInvalidComponentValue(context, 'AUTHOR_AVATAR_MOTION_NAME_INVALID', 'motion must be a string or null.', 'motion')
  }
  validateFiniteNumber(value.speed, context, 'speed')
  validateFiniteNumber(value.durationMs, context, 'durationMs')
  if (value.loop !== undefined && typeof value.loop !== 'boolean') {
    reportInvalidComponentValue(context, 'AUTHOR_AVATAR_MOTION_LOOP_INVALID', 'loop must be a boolean.', 'loop')
  }
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

/** Validates an optional local Three position without constraining its range. */
function validatePosition(value: unknown, context: ValidationContext): void {
  if (value === undefined) return
  if (!Array.isArray(value) || value.length !== 3 || value.some((item) => typeof item !== 'number' || !Number.isFinite(item))) {
    reportInvalidComponentValue(context, 'AUTHOR_AVATAR_POSITION_INVALID', 'position must contain three finite numbers.', 'position')
  }
}

/** Validates only the mood vocabulary owned by the TalkingHead-derived engine. */
function validateMood(value: unknown, context: ValidationContext, property: string): void {
  if (value === undefined) return
  if (typeof value === 'string' && value in MOOD_BASELINES) return
  reportInvalidComponentValue(context, 'AUTHOR_AVATAR_MOOD_NAME_INVALID', `${property} is not a supported Avatar mood.`, property)
}

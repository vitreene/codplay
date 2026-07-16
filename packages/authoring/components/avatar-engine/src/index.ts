export { createAvatarEngine } from './avatar-engine.js'
export type { AvatarEngine, AvatarEngineOptions, HeadDriftFn, BlinkScheduleFn, BreathTriggerFn } from './avatar-engine.js'

export { MorphEngine } from './morph-engine.js'
export type { MorphEntry, MorphSlot, BoneMorphName, MorphAlias, BoneCallback } from './morph-engine.js'
export { MORPH_ALIASES, BONE_MORPH_NAMES } from './morph-engine.js'

export { ExpressionEngine } from './expression-engine.js'
export type { MoodName } from './expression-engine.js'
export { MOOD_BASELINES } from './expression-engine.js'

export { GestureEngine } from './gesture-engine.js'
export type { Rng, ResolvedPose, GestureTemplate, BodyPoseTemplate } from './gesture-engine.js'
export { GESTURE_TEMPLATES, POSE_TEMPLATES } from './gesture-engine.js'

export { buildModelInstance } from './model-loader.js'
export type { LoadedModel, ModelLoaderOptions, RetargetConfig } from './model-loader.js'

export { preloadAvatar3DModel, getModelEntry } from './model-preload.js'
export type { ModelPreloadEntry } from './model-preload.js'

export { retarget } from './retargeter.js'

export { GazeService } from './gaze-service.js'

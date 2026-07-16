export { createAvatar3DBinding } from './create-avatar3d-binding.js'

export { Avatar3DBaseComponent } from './avatar3d-base-component.js'

export {
  createHeadDriftFn,
  createBlinkScheduleFn,
  createBreathTriggerFn,
} from './avatar3d-component.js'

export type { Avatar3DInitial } from './avatar3d-types.js'

export type {
  Avatar3DMotion,
  Avatar3DMotionCatalog,
  Avatar3DMotionRef,
  Avatar3DMotionSupport,
  Avatar3DMotionSupportStatus,
} from './semantic-motion/avatar3d-motion-types.js'

export {
  BUILTIN_AVATAR3D_MOTIONS,
  DEFAULT_AVATAR3D_GESTURE_NAMES,
  DEFAULT_AVATAR3D_MOTION_CHANNELS,
  DEFAULT_AVATAR3D_POSE_NAMES,
  listBuiltinAvatar3DMotionNames,
  resolveAvatar3DMotionSupport,
  resolveBuiltinAvatar3DMotionSupport,
} from './semantic-motion/avatar3d-motion-catalog.js'

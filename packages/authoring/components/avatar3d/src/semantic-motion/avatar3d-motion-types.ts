export type Avatar3DMotionGestureCommand = readonly [string, unknown?, boolean?]

export type Avatar3DMotionValue = number | string | Avatar3DMotionGestureCommand | null

export type Avatar3DMotionOverlayBone = {
  freq?: number
  amp?: readonly number[]
  phase?: number
  custom?: string
}

export type Avatar3DMotionOverlay = {
  bones?: Record<string, Avatar3DMotionOverlayBone>
  delay?: number
  duration?: number
}

export type Avatar3DMotion = {
  _description?: string
  _tags?: string[]
  _track?: 'action' | 'mood'
  _overlay?: Avatar3DMotionOverlay
  dt?: number[]
  rescale?: number[]
  vs?: Record<string, Avatar3DMotionValue[]>
}

export type Avatar3DMotionCatalog = Record<string, Avatar3DMotion>

export type Avatar3DMotionRef = string | Avatar3DMotion

export type Avatar3DMotionSupportStatus = 'supported' | 'partial' | 'unsupported'

export type Avatar3DMotionSupport = {
  status: Avatar3DMotionSupportStatus
  unsupportedChannels: string[]
  unsupportedFeatures: string[]
}

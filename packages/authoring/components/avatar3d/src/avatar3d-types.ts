import type { MoodName, RetargetConfig } from '@codplay/avatar-engine'

/**
 * Declarative config for the 'avatar3d' perso type — read from perso.initial.
 * camera/scene/renderer are NOT passed in: avatar3d is an autonomous component
 * (own canvas/renderer/scene/camera built in init()), so only the parameters
 * that shape that construction are declarative here. See
 * docs/formalisation/2026-06-23-avatar3d-component-integration-plan.md §7.
 */
export type Avatar3DInitial = {
  /** URL of the GLB model — must be preloaded via createAvatar3DBinding()'s preload strategy. */
  src: string
  /**
   * Prefix stripped from raw morph target names in the GLB.
   * ReadyPlayerMe models: /^Wolf3D_[^_]+_/. Pure ARKit models: leave undefined.
   */
  morphPrefix?: string | RegExp
  /** Mixamo retarget config — bone adjustments, scale, origin. */
  retarget?: RetargetConfig
  /** Initial mood (expression baselines). Default: 'neutral' */
  mood?: MoodName
  /** Max viseme morph weight. Default: 0.75 */
  visemeWeight?: number
  /** Canvas size in CSS pixels. Default: 600x600 */
  width?: number
  height?: number
  camera?: {
    /** Vertical field of view in degrees. Default: 10 */
    fov?: number
    position?: { x?: number; y?: number; z?: number }
    lookAt?: { x?: number; y?: number; z?: number }
  }
  /** Generic cross-component reparenting, consumed by the runtime orchestrator. */
  move?: { parentId: string }
}

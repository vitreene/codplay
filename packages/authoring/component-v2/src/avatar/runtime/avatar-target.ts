import type { BlinkScheduleFn, BreathTriggerFn, HeadDriftFn } from '../idle/avatar-idle-schedule.js'
import type { AvatarGestureFrame } from '../gesture/motion-catalog.js'
import type { ActiveAnimation, AvatarAnimationMode } from '../motion/avatar-animation-player.js'

/** Morph layer contributed by one Avatar capability. */
export type AvatarMorphs = Readonly<Record<string, number>>

/** Capability published by the central Avatar component to attached features. */
export type AvatarTarget = Readonly<{
  /** Applies the current mood baseline layer. */
  applyMood: (morphs: AvatarMorphs) => void
  /** Applies the current speech/lip-sync morph layer. */
  applyMorphs: (morphs: AvatarMorphs) => void
  /** Applies one resolved semantic gesture frame. */
  applyGestureMotion: (frame: AvatarGestureFrame, seed?: number) => void
  /** Selects or releases one named gesture. */
  setGesture: (name: string | null, seed?: number) => void
  /** Selects the active body pose. */
  setPose: (name: string) => void
  /** Installs or removes the idle blink schedule. */
  setBlinkSchedule: (schedule: BlinkScheduleFn | null) => void
  /** Installs or removes the idle breathing trigger. */
  setBreathTrigger: (schedule: BreathTriggerFn | null) => void
  /** Installs or removes the idle head drift schedule. */
  setHeadDrift: (schedule: HeadDriftFn | null) => void
  /** Enables or disables camera contact and sets its strength. */
  setGaze: (enabled: boolean, contact?: number | null) => void
  /** Returns the default playback mode for one animation registered by the Avatar. */
  getAnimation: (name: string) => AvatarAnimationMode | undefined
  /** Selects one registered animation on the absolute scene timeline. */
  setAnimation: (animation: ActiveAnimation) => void
  /** Releases the current animation and returns control to Avatar features. */
  releaseAnimation: () => void
}>

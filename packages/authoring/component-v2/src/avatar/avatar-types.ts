import type { PersoInitialCommon } from 'codplay'
import type { MoodName, RetargetConfig } from '@codplay/avatar-engine'

/** Morph layer produced by one Avatar feature component. */
export type AvatarMorphs = Readonly<Record<string, number>>

/** Stable author data used to load one Avatar model into a Three host. */
export type AvatarInitial = PersoInitialCommon & Readonly<{
  src: string
  morphPrefix?: string
  retarget?: RetargetConfig
  mood?: MoodName
  modelRotationY?: number
}>

/** Optional mood contribution attached to one Avatar target. */
export type AvatarMoodInitial = PersoInitialCommon & Readonly<{
  mood?: MoodName
  durationMs?: number
}>

/** Optional lip-sync contribution attached to one Avatar target. */
export type AvatarLipSyncInitial = PersoInitialCommon & Readonly<{
  viseme?: string | null
  weight?: number
  durationMs?: number
}>

/** Optional gesture contribution attached to one Avatar target. */
export type AvatarGestureInitial = PersoInitialCommon & Readonly<{
  gesture?: string | null
  seed?: number
}>

/** Optional idle contribution attached to one Avatar target. */
export type AvatarIdleInitial = PersoInitialCommon & Readonly<{
  blink?: boolean
  blinkSeed?: number
}>

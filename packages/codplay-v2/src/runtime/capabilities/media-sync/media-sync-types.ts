import type { MaterializedAction } from '../../player/pipeline'
import type {
  MediaComponentSurface,
  MediaTransition,
} from '../../components/component-surface-types'

/** Compatibility name for the typed media surface consumed by media-sync. */
export type MediaSyncRuntimeComponent = MediaComponentSurface

/** Resolves a media surface for one mounted runtime item. */
export type MediaComponentSurfaceResolver = (
  runtimeItemId: string,
) => MediaComponentSurface | undefined

/** Logical playback states tracked independently from the native media node. */
export type MediaLogicalState = 'idle' | 'playing' | 'paused' | 'stopped'

/** Mutable state for one media item during the lifetime of a player. */
export type MediaRuntimeState = {
  runtimeItemId: string
  storyId: string
  trackId: string
  trackActive: boolean
  isMaster: boolean
  logicalState: MediaLogicalState
  sequenceStartMs: number | null
  sourceStartMs: number
  sourceEndMs: number | null
  frozenMediaMs: number
  activationOrder: number
  needsResync: boolean
  transition: MediaTransition | null
}

/** One compiled broadcast occurrence ordered for deterministic replay. */
export type BroadcastOccurrence = Readonly<{
  persoKey: string
  trackId: string
  trackActive: boolean
  action: MaterializedAction
  broadcast: BroadcastAction
}>

/** Supported media broadcast payload after boundary validation. */
export type BroadcastAction = Readonly<{
  type: 'START' | 'PAUSE' | 'STOP'
  startAt?: number
  endAt?: number
  transition?: MediaTransition
}>

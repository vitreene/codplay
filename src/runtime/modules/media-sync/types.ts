import type { AnimationResolvedAction } from '../../../animation/types'
import type { RuntimePersos } from '../../types'

export type MediaSyncPlaybackState = 'playing' | 'paused'

export type MediaSyncRuntimeComponent = {
  seekTo: (mediaMs: number) => void
  play: () => void
  pause: () => void
  stopAt: (mediaMs: number) => void
  getCurrentTimeMs: () => number
  getDurationMs: () => number | null
  isPaused: () => boolean
}

export type MediaSyncModuleContext = {
  getComponentById: (runtimeItemId: string) => MediaSyncRuntimeComponent | null
}

export type MediaSyncModule = {
  loadRuntimePersos: (runtimePersos: RuntimePersos) => void
  reset: () => void
  applyResolvedActions: (timelineMs: number, resolvedActions: AnimationResolvedAction[]) => void
  syncTimeline: (timelineMs: number, playbackState: MediaSyncPlaybackState) => void
  handleSequenceEnd: (timelineMs: number) => void
  resolveTimelineMsFromActiveMaster: (fallbackTimelineMs: number) => number
}

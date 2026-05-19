import type { AnimationResolvedAction } from '../../../animation/types'
import type { BroadcastAction, RuntimePersos } from '../../types'
import type {
  MediaSyncModule,
  MediaSyncModuleContext,
  MediaSyncPlaybackState
} from './types'

type MediaLogicalState = 'idle' | 'playing' | 'paused' | 'stopped'

type MediaRuntimeState = {
  runtimeItemId: string
  storyId: string
  isMaster: boolean
  logicalState: MediaLogicalState
  sequenceStartMs: number | null
  sourceStartMs: number
  frozenMediaMs: number
  activationOrder: number
  needsResync: boolean
}

const MEDIA_DRIFT_TOLERANCE_MS = 150

/**
 * Checks whether one action carries one supported media broadcast.
 */
function readBroadcastAction(action: Record<string, unknown>): BroadcastAction | null {
  const broadcast = action.broadcast
  if (typeof broadcast !== 'object' || broadcast === null) {
    return null
  }

  const type = (broadcast as { type?: unknown }).type
  return type === 'START' || type === 'PAUSE' || type === 'STOP'
    ? (broadcast as BroadcastAction)
    : null
}

/**
 * Clamps one media time into the non-negative domain.
 */
function clampMediaMs(mediaMs: number): number {
  return mediaMs < 0 ? 0 : mediaMs
}

/**
 * Implements one player-facing media synchronization module.
 */
class MediaSyncModuleInstance implements MediaSyncModule {
  private readonly context: MediaSyncModuleContext
  private readonly mediaById = new Map<string, MediaRuntimeState>()
  private nextActivationOrder = 1

  constructor(context: MediaSyncModuleContext) {
    this.context = context
  }

  loadRuntimePersos(runtimePersos: RuntimePersos): void {
    const nextMediaById = new Map<string, MediaRuntimeState>()

    for (const item of Object.values(runtimePersos.persos)) {
      if (item.type !== 'media') {
        continue
      }

      const previousMedia = this.mediaById.get(item.id)
      nextMediaById.set(item.id, previousMedia ?? {
        runtimeItemId: item.id,
        storyId: item.storyId,
        isMaster: item.initial.master === true,
        logicalState: 'idle',
        sequenceStartMs: null,
        sourceStartMs: 0,
        frozenMediaMs: 0,
        activationOrder: 0,
        needsResync: false
      })
    }

    this.mediaById.clear()
    for (const [runtimeItemId, mediaState] of nextMediaById) {
      this.mediaById.set(runtimeItemId, mediaState)
    }
  }

  reset(): void {
    this.mediaById.clear()
    this.nextActivationOrder = 1
  }

  pauseActivePlayback(timelineMs: number): void {
    for (const mediaState of this.mediaById.values()) {
      if (mediaState.logicalState === 'idle' || mediaState.logicalState === 'stopped') {
        continue
      }

      mediaState.frozenMediaMs = this.resolveExpectedMediaMs(mediaState, timelineMs)
      mediaState.logicalState = 'paused'
      mediaState.needsResync = true
      this.context.getComponentById(mediaState.runtimeItemId)?.pause()
    }
  }

  resetPlayback(): void {
    for (const mediaState of this.mediaById.values()) {
      this.context.getComponentById(mediaState.runtimeItemId)?.stopAt(0)
      mediaState.logicalState = 'idle'
      mediaState.sequenceStartMs = null
      mediaState.sourceStartMs = 0
      mediaState.frozenMediaMs = 0
      mediaState.activationOrder = 0
      mediaState.needsResync = false
    }

    this.nextActivationOrder = 1
  }

  applyResolvedActions(timelineMs: number, resolvedActions: AnimationResolvedAction[]): void {
    for (const resolvedAction of resolvedActions) {
      const targetRuntimeItemId = resolvedAction.action.targetId ?? resolvedAction.listenerId
      const mediaState = this.mediaById.get(targetRuntimeItemId)
      if (!mediaState) {
        continue
      }

      const broadcast = readBroadcastAction(resolvedAction.action as Record<string, unknown>)
      if (broadcast === null) {
        continue
      }

      if (broadcast.type === 'START') {
        mediaState.logicalState = 'playing'
        mediaState.sequenceStartMs = timelineMs
        mediaState.sourceStartMs = clampMediaMs(typeof broadcast.startAt === 'number' ? broadcast.startAt : 0)
        mediaState.frozenMediaMs = mediaState.sourceStartMs
        mediaState.activationOrder = this.nextActivationOrder
        mediaState.needsResync = true
        this.nextActivationOrder += 1
        continue
      }

      if (broadcast.type === 'PAUSE') {
        mediaState.frozenMediaMs = this.resolveExpectedMediaMs(mediaState, timelineMs)
        mediaState.logicalState = 'paused'
        mediaState.needsResync = true
        continue
      }

      mediaState.frozenMediaMs = this.resolveExpectedMediaMs(mediaState, timelineMs)
      mediaState.logicalState = 'stopped'
      mediaState.needsResync = true
    }
  }

  syncTimeline(timelineMs: number, playbackState: MediaSyncPlaybackState): void {
    for (const mediaState of this.mediaById.values()) {
      const component = this.context.getComponentById(mediaState.runtimeItemId)
      if (!component) {
        continue
      }

      if (mediaState.logicalState === 'idle') {
        if (mediaState.needsResync) {
          component.stopAt(0)
          mediaState.needsResync = false
        }
        continue
      }

      if (mediaState.logicalState === 'stopped') {
        if (mediaState.needsResync || !component.isPaused()) {
          component.stopAt(mediaState.frozenMediaMs)
          mediaState.needsResync = false
        }
        continue
      }

      if (mediaState.logicalState === 'paused') {
        if (mediaState.needsResync || this.shouldCorrectDrift(component.getCurrentTimeMs(), mediaState.frozenMediaMs)) {
          component.seekTo(mediaState.frozenMediaMs)
        }

        if (!component.isPaused()) {
          component.pause()
        }

        mediaState.needsResync = false
        continue
      }

      const expectedMediaMs = this.resolveExpectedMediaMs(mediaState, timelineMs)
      const durationMs = component.getDurationMs()
      if (durationMs !== null && expectedMediaMs >= durationMs) {
        mediaState.logicalState = 'stopped'
        mediaState.frozenMediaMs = durationMs
        component.stopAt(durationMs)
        mediaState.needsResync = false
        continue
      }

      if (playbackState === 'playing') {
        if (mediaState.needsResync) {
          component.seekTo(expectedMediaMs)
        }

        if (mediaState.isMaster && this.shouldCorrectDrift(component.getCurrentTimeMs(), expectedMediaMs)) {
          component.seekTo(expectedMediaMs)
        }

        if (component.isPaused()) {
          component.play()
        }
      } else {
        if (mediaState.needsResync || this.shouldCorrectDrift(component.getCurrentTimeMs(), expectedMediaMs)) {
          component.seekTo(expectedMediaMs)
        }

        if (!component.isPaused()) {
          component.pause()
        }
        mediaState.frozenMediaMs = expectedMediaMs
      }

      mediaState.needsResync = false
    }
  }

  handleSequenceEnd(timelineMs: number): void {
    for (const mediaState of this.mediaById.values()) {
      if (mediaState.logicalState === 'idle' || mediaState.logicalState === 'stopped') {
        continue
      }

      const component = this.context.getComponentById(mediaState.runtimeItemId)
      const stopMediaMs =
        mediaState.logicalState === 'playing'
          ? this.resolveExpectedMediaMs(mediaState, timelineMs)
          : mediaState.frozenMediaMs

      mediaState.logicalState = 'stopped'
      mediaState.frozenMediaMs = stopMediaMs
      mediaState.needsResync = false

      component?.stopAt(stopMediaMs)
    }
  }

  resolveTimelineMsFromActiveMaster(fallbackTimelineMs: number): number {
    const activeMaster = [...this.mediaById.values()]
      .filter((mediaState) => mediaState.isMaster)
      .filter((mediaState) => mediaState.logicalState === 'playing')
      .sort((left, right) => right.activationOrder - left.activationOrder)[0]

    if (!activeMaster || activeMaster.sequenceStartMs === null) {
      return fallbackTimelineMs
    }

    const component = this.context.getComponentById(activeMaster.runtimeItemId)
    if (!component) {
      return fallbackTimelineMs
    }

    const mediaCurrentTimeMs = component.getCurrentTimeMs()
    const timelineMs = activeMaster.sequenceStartMs + (mediaCurrentTimeMs - activeMaster.sourceStartMs)
    return timelineMs >= 0 && Number.isFinite(timelineMs) ? timelineMs : fallbackTimelineMs
  }

  /**
   * Resolves one expected media time from sequence time and the media start offsets.
   */
  private resolveExpectedMediaMs(mediaState: MediaRuntimeState, timelineMs: number): number {
    if (mediaState.sequenceStartMs === null) {
      return mediaState.frozenMediaMs
    }

    return clampMediaMs(mediaState.sourceStartMs + (timelineMs - mediaState.sequenceStartMs))
  }

  /**
   * Returns true when one explicit drift correction is justified.
   */
  private shouldCorrectDrift(currentMediaMs: number, expectedMediaMs: number): boolean {
    return Math.abs(currentMediaMs - expectedMediaMs) > MEDIA_DRIFT_TOLERANCE_MS
  }
}

export function createMediaSyncModule(context: MediaSyncModuleContext): MediaSyncModule {
  return new MediaSyncModuleInstance(context)
}

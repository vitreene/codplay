import type { RuntimeModuleServiceDefinition } from '../../catalog'
import type {
  RuntimeModuleServiceContext,
  RuntimeModuleServiceInstance,
  RuntimeModuleServiceSeekHandle,
} from '../../engine'
import {
  collectBroadcastOccurrences,
  createBroadcastOccurrenceKey,
  createSceneSignature,
  isBroadcastAdditionOnly,
} from './media-sync-broadcasts'
import {
  applyBroadcastOccurrences,
  pauseActivePlayback,
  replayBroadcastOccurrences,
  resolveTimelineFromMaster,
  syncTimeline,
} from './media-sync-playback'
import { initializeMediaStates } from './media-sync-state'
import type {
  MediaComponentSurfaceResolver,
  MediaRuntimeState,
} from './media-sync-types'

/** Runtime module identifier for component-owned media playback synchronization. */
export const MEDIA_SYNC_MODULE_SERVICE_ID = 'media-sync' as const

/** Compatibility export for the typed media surface consumed by media-sync. */
export type { MediaSyncRuntimeComponent } from './media-sync-types'

/** Creates the player-scoped media synchronization module declaration. */
export function createMediaSyncModuleServiceDefinition(): RuntimeModuleServiceDefinition {
  return {
    id: MEDIA_SYNC_MODULE_SERVICE_ID,
    create: (context) => createMediaSyncModuleService(context),
  }
}

/** Creates one media synchronization service bound to one player and its components. */
export function createMediaSyncModuleService(
  context: RuntimeModuleServiceContext,
): RuntimeModuleServiceInstance {
  const getMediaComponent: MediaComponentSurfaceResolver = context.componentSurfaces === undefined
    ? () => undefined
    : (runtimeItemId) => context.componentSurfaces?.getSurface(runtimeItemId, 'media')
  const mediaById = new Map<string, MediaRuntimeState>()
  let sceneSignature: string | undefined
  let broadcastOccurrenceKeys = new Set<string>()
  let nextActivationOrder = 1
  let forceResync = false
  let replayBroadcastsOnNextPresentation = false

  const service: RuntimeModuleServiceInstance = {
    initializeScene: (scene) => initializeMediaStates(scene, mediaById),
    onScenePresented: (scene, playbackState) => {
      initializeMediaStates(scene, mediaById)
      const occurrences = collectBroadcastOccurrences(scene)
      const nextSignature = createSceneSignature(scene, occurrences)
      const nextOccurrenceKeys = new Set(occurrences.map(createBroadcastOccurrenceKey))
      const fullReplayRequested = sceneSignature === undefined || replayBroadcastsOnNextPresentation
      if (fullReplayRequested) {
        nextActivationOrder = 1
        replayBroadcastOccurrences(occurrences, mediaById, getMediaComponent, () => nextActivationOrder++)
        replayBroadcastsOnNextPresentation = false
        forceResync = true
      } else if (nextSignature !== sceneSignature && isBroadcastAdditionOnly(
        broadcastOccurrenceKeys,
        nextOccurrenceKeys,
      )) {
        applyBroadcastOccurrences(
          occurrences.filter((occurrence) => !broadcastOccurrenceKeys.has(createBroadcastOccurrenceKey(occurrence))),
          mediaById,
          getMediaComponent,
          () => nextActivationOrder++,
        )
      } else if (nextSignature !== sceneSignature) {
        nextActivationOrder = 1
        replayBroadcastOccurrences(occurrences, mediaById, getMediaComponent, () => nextActivationOrder++)
        forceResync = true
      }
      sceneSignature = nextSignature
      broadcastOccurrenceKeys = nextOccurrenceKeys
      if (forceResync) {
        for (const state of mediaById.values()) state.needsResync = true
        forceResync = false
      }
      syncTimeline(scene.timeMs, playbackState, mediaById, getMediaComponent)
    },
    onPlaybackStateChange: (playbackState, timeMs) => {
      syncTimeline(timeMs, playbackState, mediaById, getMediaComponent)
    },
    onRateChange: (rate) => {
      for (const state of mediaById.values()) {
        getMediaComponent(state.runtimeItemId)?.setRate?.(rate)
      }
    },
    resolveTimelineMs: (fallbackTimeMs) => resolveTimelineFromMaster(
      fallbackTimeMs,
      mediaById,
      getMediaComponent,
    ),
    beforeSeek: (timeMs) => {
      pauseActivePlayback(timeMs, mediaById, getMediaComponent)
    },
    prepareSeek: (): RuntimeModuleServiceSeekHandle => {
      const previous = forceResync
      const previousReplay = replayBroadcastsOnNextPresentation
      return {
        commit: () => {
          forceResync = true
          replayBroadcastsOnNextPresentation = true
        },
        abort: () => {
          forceResync = previous
          replayBroadcastsOnNextPresentation = previousReplay
        },
      }
    },
    destroy: () => {
      for (const state of mediaById.values()) {
        const component = getMediaComponent(state.runtimeItemId)
        if (component !== undefined) component.stopAt(state.frozenMediaMs)
      }
      mediaById.clear()
      sceneSignature = undefined
      broadcastOccurrenceKeys = new Set()
      nextActivationOrder = 1
      replayBroadcastsOnNextPresentation = false
    },
  }

  return service
}

export type PlayerPlaybackState = 'playing' | 'paused'

export type MediaIntent = 'idle' | 'playing' | 'paused' | 'ended'

export type MediaPlaybackState = 'playing' | 'paused'

export type MediaTrackConfig = {
  trackId: string
  order: number
  active: boolean
}

export type MediaEntryConfig = {
  runtimeItemId: string
  trackId: string
  isMaster: boolean
  logicalIntent?: MediaIntent
  mediaMs?: number
  playbackState?: MediaPlaybackState
}

export type TrackStatePatch = {
  trackId: string
  active?: boolean
  order?: number
}

export type MediaSnapshotPatch = {
  mediaMs?: number
  logicalIntent?: MediaIntent
  playbackState?: MediaPlaybackState
}

export type MediaRuntimeOperation =
  | { type: 'media:play'; runtimeItemId: string; startMediaMs?: number }
  | { type: 'media:pause'; runtimeItemId: string }
  | { type: 'media:seek'; runtimeItemId: string; targetMediaMs: number }

export type MediaTraceEventName = 'media:master:switched' | 'media:sync:corrected'

export type MediaTraceEntry = {
  traceId: string
  eventName: MediaTraceEventName
  runtimeItemId?: string
  payload?: Record<string, unknown>
}

export type MediaSyncResult = {
  activeMasterRuntimeItemId: string | null
  operations: MediaRuntimeOperation[]
  trace: MediaTraceEntry[]
}

export type MediaSyncRuntime = {
  registerTrack: (track: MediaTrackConfig) => void
  registerMedia: (media: MediaEntryConfig) => void
  applyTrackStatePatches: (patches: TrackStatePatch[]) => MediaSyncResult
  setPlayerPlaybackState: (state: PlayerPlaybackState) => MediaSyncResult
  syncMasterToTimeline: (expectedMediaMs: number) => MediaSyncResult
  refreshMaster: () => MediaSyncResult
  updateMediaSnapshot: (runtimeItemId: string, patch: MediaSnapshotPatch) => void
  getActiveMasterRuntimeItemId: () => string | null
}

export type MediaSyncRuntimeOptions = {
  thresholdMs?: number
  initialPlayerPlaybackState?: PlayerPlaybackState
  traceIdFactory?: () => string
}

type RuntimeTrackState = {
  trackId: string
  order: number
  active: boolean
}

type RuntimeMediaState = {
  runtimeItemId: string
  trackId: string
  isMaster: boolean
  logicalIntent: MediaIntent
  mediaMs: number
  playbackState: MediaPlaybackState
  registrationOrder: number
}

const DEFAULT_THRESHOLD_MS = 80

/**
 * Creates one deterministic trace identifier.
 */
function createTraceId(nextTraceIndex: number, traceIdFactory?: () => string): string {
  if (traceIdFactory) {
    return traceIdFactory()
  }

  return `media-trace-${nextTraceIndex}`
}

/**
 * Checks whether one media entry can currently play.
 */
function shouldPlayMedia(media: RuntimeMediaState, playerPlaybackState: PlayerPlaybackState): boolean {
  if (playerPlaybackState !== 'playing') {
    return false
  }

  return media.logicalIntent === 'playing'
}

/**
 * Clamps one media time value into a non-negative timeline value.
 */
function clampMediaMs(mediaMs: number): number {
  if (mediaMs < 0) {
    return 0
  }

  return mediaMs
}

/**
 * Creates one in-memory runtime for media master switching and sync.
 */
export function createMediaSyncRuntime(options: MediaSyncRuntimeOptions = {}): MediaSyncRuntime {
  const thresholdMs = options.thresholdMs ?? DEFAULT_THRESHOLD_MS
  const tracksById = new Map<string, RuntimeTrackState>()
  const mediaById = new Map<string, RuntimeMediaState>()
  const traceIdFactory = options.traceIdFactory
  let playerPlaybackState: PlayerPlaybackState = options.initialPlayerPlaybackState ?? 'paused'
  let activeMasterRuntimeItemId: string | null = null
  let nextMediaRegistrationOrder = 1
  let nextTraceIndex = 1

  /**
   * Selects the active master media according to track state and registration order.
   */
  function selectActiveMasterRuntimeItemId(): string | null {
    const masterCandidates = [...mediaById.values()]
      .filter((media) => media.isMaster)
      .filter((media) => (tracksById.get(media.trackId)?.active ?? false))
      .sort((left, right) => {
        const leftTrackOrder = tracksById.get(left.trackId)?.order ?? 0
        const rightTrackOrder = tracksById.get(right.trackId)?.order ?? 0
        if (leftTrackOrder !== rightTrackOrder) {
          return leftTrackOrder - rightTrackOrder
        }

        return left.registrationOrder - right.registrationOrder
      })

    return masterCandidates[0]?.runtimeItemId ?? null
  }

  /**
   * Creates one trace row with deterministic ordering.
   */
  function pushTrace(
    trace: MediaTraceEntry[],
    eventName: MediaTraceEntry['eventName'],
    runtimeItemId?: string,
    payload?: Record<string, unknown>
  ): void {
    trace.push({
      traceId: createTraceId(nextTraceIndex, traceIdFactory),
      eventName,
      runtimeItemId,
      payload
    })
    nextTraceIndex += 1
  }

  /**
   * Re-evaluates active master selection and applies required play/pause operations.
   */
  function reconcileMasterSwitch(): MediaSyncResult {
    const operations: MediaRuntimeOperation[] = []
    const trace: MediaTraceEntry[] = []
    const nextMasterRuntimeItemId = selectActiveMasterRuntimeItemId()

    if (nextMasterRuntimeItemId !== activeMasterRuntimeItemId) {
      const previousMaster =
        activeMasterRuntimeItemId === null ? undefined : mediaById.get(activeMasterRuntimeItemId)
      const nextMaster = nextMasterRuntimeItemId === null ? undefined : mediaById.get(nextMasterRuntimeItemId)

      if (previousMaster && previousMaster.playbackState === 'playing') {
        operations.push({
          type: 'media:pause',
          runtimeItemId: previousMaster.runtimeItemId
        })
        previousMaster.playbackState = 'paused'
      }

      if (nextMaster && shouldPlayMedia(nextMaster, playerPlaybackState) && nextMaster.playbackState !== 'playing') {
        operations.push({
          type: 'media:play',
          runtimeItemId: nextMaster.runtimeItemId,
          startMediaMs: nextMaster.mediaMs
        })
        nextMaster.playbackState = 'playing'
      }

      activeMasterRuntimeItemId = nextMasterRuntimeItemId

      if (previousMaster || nextMaster) {
        pushTrace(trace, 'media:master:switched', nextMasterRuntimeItemId ?? undefined, {
          fromRuntimeItemId: previousMaster?.runtimeItemId,
          toRuntimeItemId: nextMasterRuntimeItemId
        })
      }
    }

    return {
      activeMasterRuntimeItemId,
      operations,
      trace
    }
  }

  /**
   * Applies player-level playback precedence on the active master.
   */
  function applyPlayerPlaybackState(nextState: PlayerPlaybackState): MediaSyncResult {
    playerPlaybackState = nextState

    const switched = reconcileMasterSwitch()
    const operations = [...switched.operations]
    const trace = [...switched.trace]

    if (activeMasterRuntimeItemId === null) {
      return {
        activeMasterRuntimeItemId,
        operations,
        trace
      }
    }

    const activeMaster = mediaById.get(activeMasterRuntimeItemId)
    if (!activeMaster) {
      return {
        activeMasterRuntimeItemId,
        operations,
        trace
      }
    }

    if (!shouldPlayMedia(activeMaster, playerPlaybackState)) {
      if (activeMaster.playbackState === 'playing') {
        operations.push({
          type: 'media:pause',
          runtimeItemId: activeMaster.runtimeItemId
        })
        activeMaster.playbackState = 'paused'
      }

      return {
        activeMasterRuntimeItemId,
        operations,
        trace
      }
    }

    if (activeMaster.playbackState !== 'playing') {
      operations.push({
        type: 'media:play',
        runtimeItemId: activeMaster.runtimeItemId,
        startMediaMs: activeMaster.mediaMs
      })
      activeMaster.playbackState = 'playing'
    }

    return {
      activeMasterRuntimeItemId,
      operations,
      trace
    }
  }

  /**
   * Registers one runtime track used for master selection.
   */
  function registerTrack(track: MediaTrackConfig): void {
    tracksById.set(track.trackId, {
      trackId: track.trackId,
      order: track.order,
      active: track.active
    })
  }

  /**
   * Registers one runtime media entry.
   */
  function registerMedia(media: MediaEntryConfig): void {
    mediaById.set(media.runtimeItemId, {
      runtimeItemId: media.runtimeItemId,
      trackId: media.trackId,
      isMaster: media.isMaster,
      logicalIntent: media.logicalIntent ?? 'idle',
      mediaMs: clampMediaMs(media.mediaMs ?? 0),
      playbackState: media.playbackState ?? 'paused',
      registrationOrder: nextMediaRegistrationOrder
    })
    nextMediaRegistrationOrder += 1
  }

  /**
   * Applies track state patches in one batch and resolves master switching once.
   */
  function applyTrackStatePatches(patches: TrackStatePatch[]): MediaSyncResult {
    for (const patch of patches) {
      const previousTrack = tracksById.get(patch.trackId)
      tracksById.set(patch.trackId, {
        trackId: patch.trackId,
        order: patch.order ?? previousTrack?.order ?? 0,
        active: patch.active ?? previousTrack?.active ?? false
      })
    }

    return reconcileMasterSwitch()
  }

  /**
   * Synchronizes active master time with timeline when drift exceeds threshold.
   */
  function syncMasterToTimeline(expectedMediaMs: number): MediaSyncResult {
    const operations: MediaRuntimeOperation[] = []
    const trace: MediaTraceEntry[] = []

    if (activeMasterRuntimeItemId === null) {
      return {
        activeMasterRuntimeItemId,
        operations,
        trace
      }
    }

    const activeMaster = mediaById.get(activeMasterRuntimeItemId)
    if (!activeMaster) {
      return {
        activeMasterRuntimeItemId,
        operations,
        trace
      }
    }

    const normalizedExpectedMediaMs = clampMediaMs(expectedMediaMs)
    const driftMs = normalizedExpectedMediaMs - activeMaster.mediaMs
    if (Math.abs(driftMs) <= thresholdMs) {
      return {
        activeMasterRuntimeItemId,
        operations,
        trace
      }
    }

    operations.push({
      type: 'media:seek',
      runtimeItemId: activeMaster.runtimeItemId,
      targetMediaMs: normalizedExpectedMediaMs
    })
    activeMaster.mediaMs = normalizedExpectedMediaMs

    pushTrace(trace, 'media:sync:corrected', activeMaster.runtimeItemId, {
      driftMs
    })

    return {
      activeMasterRuntimeItemId,
      operations,
      trace
    }
  }

  /**
   * Updates one media snapshot used for master playback and drift checks.
   */
  function updateMediaSnapshot(runtimeItemId: string, patch: MediaSnapshotPatch): void {
    const media = mediaById.get(runtimeItemId)
    if (!media) {
      return
    }

    if (patch.mediaMs !== undefined) {
      media.mediaMs = clampMediaMs(patch.mediaMs)
    }

    if (patch.logicalIntent !== undefined) {
      media.logicalIntent = patch.logicalIntent
    }

    if (patch.playbackState !== undefined) {
      media.playbackState = patch.playbackState
    }
  }

  /**
   * Returns the current active master runtime identifier.
   */
  function getActiveMasterRuntimeItemId(): string | null {
    return activeMasterRuntimeItemId
  }

  /**
   * Re-evaluates current master selection without changing external inputs.
   */
  function refreshMaster(): MediaSyncResult {
    return reconcileMasterSwitch()
  }

  return {
    registerTrack,
    registerMedia,
    applyTrackStatePatches,
    setPlayerPlaybackState: applyPlayerPlaybackState,
    syncMasterToTimeline,
    refreshMaster,
    updateMediaSnapshot,
    getActiveMasterRuntimeItemId
  }
}

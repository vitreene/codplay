import type {
  BroadcastOccurrence,
  MediaComponentSurfaceResolver,
  MediaRuntimeState,
  MediaSyncRuntimeComponent,
} from './media-sync-types'

const MEDIA_POSITION_TOLERANCE_MS = 150

/** Applies one broadcast occurrence to the corresponding logical media state. */
export function applyBroadcastOccurrence(
  state: MediaRuntimeState | undefined,
  occurrence: BroadcastOccurrence,
  mediaById: Map<string, MediaRuntimeState>,
  getMediaComponent: MediaComponentSurfaceResolver,
  nextActivation: () => number,
): void {
  if (state === undefined) return
  state.trackId = occurrence.trackId
  state.trackActive = occurrence.trackActive
  if (occurrence.broadcast.type === 'START') {
    if (state.isMaster) pausePreviousMasters(state, occurrence.action.startAt, mediaById, getMediaComponent)
    state.logicalState = 'playing'
    state.sequenceStartMs = occurrence.action.startAt
    state.sourceStartMs = clampMediaMs(occurrence.broadcast.startAt ?? 0)
    state.sourceEndMs = occurrence.broadcast.endAt === undefined
      ? null
      : Math.max(state.sourceStartMs, clampMediaMs(occurrence.broadcast.endAt))
    state.frozenMediaMs = state.sourceStartMs
    state.activationOrder = nextActivation()
    state.needsResync = true
    state.transition = occurrence.broadcast.transition ?? null
    const component = getMediaComponent(state.runtimeItemId)
    component?.setPlaybackWindow?.(
      state.sourceStartMs,
      component === undefined ? state.sourceEndMs : resolveEffectiveEndMs(state, component),
    )
    return
  }

  if (occurrence.broadcast.type === 'PAUSE') {
    state.frozenMediaMs = resolveExpectedMediaMs(state, occurrence.action.startAt, getMediaComponent)
    state.logicalState = 'paused'
    state.needsResync = true
    return
  }

  state.frozenMediaMs = resolveExpectedMediaMs(state, occurrence.action.startAt, getMediaComponent)
  state.logicalState = 'stopped'
  state.needsResync = true
}

/** Pauses every previously active master before a newly started master takes over. */
function pausePreviousMasters(
  nextMaster: MediaRuntimeState,
  timelineMs: number,
  mediaById: Map<string, MediaRuntimeState>,
  getMediaComponent: MediaComponentSurfaceResolver,
): void {
  for (const previous of mediaById.values()) {
    if (previous === nextMaster || !previous.isMaster || previous.logicalState !== 'playing') continue
    previous.frozenMediaMs = resolveExpectedMediaMs(previous, timelineMs, getMediaComponent)
    previous.logicalState = 'paused'
    previous.needsResync = true
    getMediaComponent(previous.runtimeItemId)?.pause()
  }
}

/** Applies newly entered broadcast occurrences without resetting other media. */
export function applyBroadcastOccurrences(
  occurrences: readonly BroadcastOccurrence[],
  mediaById: Map<string, MediaRuntimeState>,
  getMediaComponent: MediaComponentSurfaceResolver,
  nextActivation: () => number,
): void {
  for (const occurrence of occurrences) {
    applyBroadcastOccurrence(
      mediaById.get(occurrence.persoKey),
      occurrence,
      mediaById,
      getMediaComponent,
      nextActivation,
    )
  }
}

/** Synchronizes every media component against one absolute player position. */
export function syncTimeline(
  timelineMs: number,
  playbackState: 'playing' | 'paused',
  mediaById: ReadonlyMap<string, MediaRuntimeState>,
  getMediaComponent: MediaComponentSurfaceResolver,
): void {
  for (const state of mediaById.values()) {
    const component = getMediaComponent(state.runtimeItemId)
    if (component === undefined) continue

    applyMediaTransition(state, timelineMs, component)

    if (state.logicalState === 'idle') {
      if (state.needsResync) {
        component.stopAt(0)
        state.needsResync = false
      }
      continue
    }

    if (state.logicalState === 'stopped') {
      if (state.needsResync || !component.isPaused()) {
        component.stopAt(state.frozenMediaMs)
        state.needsResync = false
      }
      continue
    }

    if (state.logicalState === 'paused') {
      if (state.needsResync || shouldReconcileFrozenPosition(component.getCurrentTimeMs(), state.frozenMediaMs)) {
        component.seekTo(state.frozenMediaMs)
      }
      if (!component.isPaused()) component.pause()
      state.needsResync = false
      continue
    }

    const expectedMediaMs = resolveExpectedMediaMs(state, timelineMs, getMediaComponent)
    const effectiveEndMs = resolveEffectiveEndMs(state, component)
    const nativeMediaHasEnded = playbackState === 'playing'
      && !state.needsResync
      && effectiveEndMs !== null
      && component.isPaused()
      && component.getCurrentTimeMs() >= effectiveEndMs
    if (effectiveEndMs !== null && (expectedMediaMs >= effectiveEndMs || nativeMediaHasEnded)) {
      state.logicalState = 'stopped'
      state.frozenMediaMs = effectiveEndMs
      component.stopAt(effectiveEndMs)
      state.needsResync = false
      continue
    }

    if (playbackState === 'playing') {
      // A playing master is the source of the logical clock. It must not be
      // seeked from the ticker-derived position during ordinary playback.
      if (state.needsResync) component.seekTo(expectedMediaMs)
      if (component.isPaused()) component.play()
    } else {
      if (state.needsResync || shouldReconcileFrozenPosition(component.getCurrentTimeMs(), expectedMediaMs)) {
        component.seekTo(expectedMediaMs)
      }
      if (!component.isPaused()) component.pause()
      state.frozenMediaMs = expectedMediaMs
    }
    state.needsResync = false
  }
}

/** Pauses active native media before a seek reconstructs the solved scene. */
export function pauseActivePlayback(
  timelineMs: number,
  mediaById: ReadonlyMap<string, MediaRuntimeState>,
  getMediaComponent: MediaComponentSurfaceResolver,
): void {
  for (const state of mediaById.values()) {
    if (state.logicalState === 'idle' || state.logicalState === 'stopped') continue
    state.frozenMediaMs = resolveExpectedMediaMs(state, timelineMs, getMediaComponent)
    state.logicalState = 'paused'
    state.needsResync = true
    getMediaComponent(state.runtimeItemId)?.pause()
  }
}

/** Selects the active master media and lets it replace the ticker when available. */
export function resolveTimelineFromMaster(
  fallbackTimelineMs: number,
  mediaById: ReadonlyMap<string, MediaRuntimeState>,
  getMediaComponent: MediaComponentSurfaceResolver,
): number {
  const activeMaster = [...mediaById.values()]
    .filter((state) => state.isMaster && state.logicalState === 'playing')
    .filter((state) => state.trackActive)
    .sort((left, right) => right.activationOrder - left.activationOrder)[0]
  if (activeMaster === undefined || activeMaster.sequenceStartMs === null) return fallbackTimelineMs
  const component = getMediaComponent(activeMaster.runtimeItemId)
  if (component === undefined || component.isPaused()) return fallbackTimelineMs
  const currentMediaMs = component.getCurrentTimeMs()
  const effectiveEndMs = resolveEffectiveEndMs(activeMaster, component)
  if (effectiveEndMs !== null && currentMediaMs >= effectiveEndMs) return fallbackTimelineMs
  const resolved = activeMaster.sequenceStartMs + (currentMediaMs - activeMaster.sourceStartMs)
  return Number.isFinite(resolved) && resolved >= 0 ? resolved : fallbackTimelineMs
}

/** Applies a complete reset for initialization, seek replay, or non-monotonic changes. */
export function resetPlaybackStates(
  mediaById: ReadonlyMap<string, MediaRuntimeState>,
  getMediaComponent: MediaComponentSurfaceResolver,
): void {
  for (const state of mediaById.values()) {
    const component = getMediaComponent(state.runtimeItemId)
    if (state.logicalState !== 'idle') component?.pause()
    component?.setPlaybackWindow?.(0, null)
    state.logicalState = 'idle'
    state.sequenceStartMs = null
    state.sourceStartMs = 0
    state.sourceEndMs = null
    state.frozenMediaMs = 0
    state.activationOrder = 0
    state.needsResync = false
    state.transition = null
  }
}

/** Replays the active compiled broadcasts without recreating media components. */
export function replayBroadcastOccurrences(
  occurrences: readonly BroadcastOccurrence[],
  mediaById: Map<string, MediaRuntimeState>,
  getMediaComponent: MediaComponentSurfaceResolver,
  nextActivation: () => number,
): void {
  resetPlaybackStates(mediaById, getMediaComponent)
  applyBroadcastOccurrences(occurrences, mediaById, getMediaComponent, nextActivation)
}

/** Resolves one media position from its broadcast segment and the sequence clock. */
function resolveExpectedMediaMs(
  state: MediaRuntimeState,
  timelineMs: number,
  getMediaComponent: MediaComponentSurfaceResolver,
): number {
  if (state.sequenceStartMs === null) return state.frozenMediaMs
  const raw = state.sourceStartMs + (timelineMs - state.sequenceStartMs)
  const component = getMediaComponent(state.runtimeItemId)
  const end = state.sourceEndMs ?? (component === undefined ? null : component.getDurationMs())
  return clampMediaWindow(raw, state.sourceStartMs, end)
}

/** Applies one broadcast transition at the current sequence position. */
function applyMediaTransition(
  state: MediaRuntimeState,
  timelineMs: number,
  component: MediaSyncRuntimeComponent,
): void {
  if (state.transition === null || component.applyTransition === undefined) return
  const duration = state.transition.duration ?? 0
  const progress = duration <= 0 || state.sequenceStartMs === null
    ? (state.sequenceStartMs === null || timelineMs < state.sequenceStartMs ? 0 : 1)
    : Math.min(1, Math.max(0, (timelineMs - state.sequenceStartMs) / duration))
  component.applyTransition(state.transition, progress)
}

/** Resolves the effective segment end from an explicit broadcast window or native duration. */
function resolveEffectiveEndMs(state: MediaRuntimeState, component: MediaSyncRuntimeComponent): number | null {
  const duration = component.getDurationMs()
  if (state.sourceEndMs === null) return duration
  return duration === null ? state.sourceEndMs : Math.min(state.sourceEndMs, duration)
}

/** Clamps one non-negative media position. */
function clampMediaMs(mediaMs: number): number {
  return Math.max(0, mediaMs)
}

/** Clamps one media position to its effective authored/native segment. */
function clampMediaWindow(mediaMs: number, startMs: number, endMs: number | null): number {
  const lower = Math.max(0, startMs)
  return endMs === null ? Math.max(lower, mediaMs) : Math.min(endMs, Math.max(lower, mediaMs))
}

/** Returns true when a paused media position needs boundary reconciliation. */
function shouldReconcileFrozenPosition(currentMs: number, expectedMs: number): boolean {
  return Math.abs(currentMs - expectedMs) > MEDIA_POSITION_TOLERANCE_MS
}

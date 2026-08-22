import { isPlainRecord } from '../../../shared'
import type { CompiledRecord, CompiledScene } from '../../../scene/compiled'
import type { RuntimeModuleServiceDefinition } from '../../catalog'
import type {
  RuntimeModuleServiceContext,
  RuntimeModuleServiceInstance,
  RuntimeModuleServiceSeekHandle,
} from '../../engine'
import type { MaterializedAction, SolvedPerso, SolvedScene } from '../../player/pipeline'
import { buildTrackRegistry, resolveStoryTrackId } from '../../player/pipeline'
import type { MediaTransition } from '../../components/media-component'

/** Runtime module identifier for component-owned media playback synchronization. */
export const MEDIA_SYNC_MODULE_SERVICE_ID = 'media-sync' as const

/** Native operations required from one materialized media component. */
export type MediaSyncRuntimeComponent = Readonly<{
  seekTo: (mediaMs: number) => void
  play: () => void
  pause: () => void
  stopAt: (mediaMs: number) => void
  getCurrentTimeMs: () => number
  getDurationMs: () => number | null
  isPaused: () => boolean
  setPlaybackWindow?: (startMs: number, endMs: number | null) => void
  applyTransition?: (transition: MediaTransition, progress: number) => void
  setRate?: (rate: number) => void
}>

type MediaLogicalState = 'idle' | 'playing' | 'paused' | 'stopped'

type MediaRuntimeState = {
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

type BroadcastOccurrence = Readonly<{
  persoKey: string
  trackId: string
  trackActive: boolean
  action: MaterializedAction
  broadcast: BroadcastAction
}>

type BroadcastAction = Readonly<{
  type: 'START' | 'PAUSE' | 'STOP'
  startAt?: number
  endAt?: number
  transition?: MediaTransition
}>

const MEDIA_POSITION_TOLERANCE_MS = 150

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
  const getComponentById = context.getComponentById ?? (() => undefined)
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
        replayBroadcastOccurrences(occurrences, mediaById, getComponentById, () => nextActivationOrder++)
        replayBroadcastsOnNextPresentation = false
        forceResync = true
      } else if (nextSignature !== sceneSignature && isBroadcastAdditionOnly(
        broadcastOccurrenceKeys,
        nextOccurrenceKeys,
      )) {
        applyBroadcastOccurrences(
          occurrences.filter((occurrence) => !broadcastOccurrenceKeys.has(createBroadcastOccurrenceKey(occurrence))),
          mediaById,
          getComponentById,
          () => nextActivationOrder++,
        )
      } else if (nextSignature !== sceneSignature) {
        nextActivationOrder = 1
        replayBroadcastOccurrences(occurrences, mediaById, getComponentById, () => nextActivationOrder++)
        forceResync = true
      }
      sceneSignature = nextSignature
      broadcastOccurrenceKeys = nextOccurrenceKeys
      if (forceResync) {
        for (const state of mediaById.values()) state.needsResync = true
        forceResync = false
      }
      syncTimeline(scene.timeMs, playbackState, mediaById, getComponentById)
    },
    onPlaybackStateChange: (playbackState, timeMs) => {
      syncTimeline(timeMs, playbackState, mediaById, getComponentById)
    },
    onRateChange: (rate) => {
      for (const state of mediaById.values()) {
        getMediaComponent(getComponentById, state.runtimeItemId)?.setRate?.(rate)
      }
    },
    resolveTimelineMs: (fallbackTimeMs) => resolveTimelineFromMaster(
      fallbackTimeMs,
      mediaById,
      getComponentById,
    ),
    beforeSeek: (timeMs) => {
      pauseActivePlayback(timeMs, mediaById, getComponentById)
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
        const component = getMediaComponent(getComponentById, state.runtimeItemId)
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

/** Registers the media states visible in one solved scene without touching playback. */
function initializeMediaStates(
  scene: SolvedScene,
  mediaById: Map<string, MediaRuntimeState>,
): void {
  const activeIds = new Set<string>()
  const tracks = buildTrackRegistry(scene.scene)
  for (const perso of Object.values(scene.persos)) {
    if (perso.type !== 'media') continue
    activeIds.add(perso.key)
    const initialMaster = readInitialMaster(scene.scene, perso)
    const trackId = resolveStoryTrackId({ id: perso.storyId })
    const trackActive = tracks.tracks[trackId]?.active ?? true
    const previous = mediaById.get(perso.key)
    if (previous === undefined) {
      mediaById.set(perso.key, {
        runtimeItemId: perso.key,
        storyId: perso.storyId,
        trackId,
        trackActive,
        isMaster: initialMaster,
        logicalState: 'idle',
        sequenceStartMs: null,
        sourceStartMs: 0,
        sourceEndMs: null,
        frozenMediaMs: 0,
        activationOrder: 0,
        needsResync: false,
        transition: null,
      })
    } else {
      previous.storyId = perso.storyId
      previous.trackId = trackId
      previous.trackActive = trackActive
      previous.isMaster = initialMaster
    }
  }
  for (const runtimeItemId of mediaById.keys()) {
    if (!activeIds.has(runtimeItemId)) mediaById.delete(runtimeItemId)
  }
}

/** Reads the media master flag from the immutable compiled perso declaration. */
function readInitialMaster(scene: CompiledScene, perso: SolvedPerso): boolean {
  const compiledPerso = scene.scene.stories[perso.storyId]?.persos.find((candidate) => candidate.id === perso.persoId)
  return compiledPerso?.initial.master === true
}

/** Collects all active media broadcast actions in one deterministic timeline order. */
function collectBroadcastOccurrences(scene: SolvedScene): readonly BroadcastOccurrence[] {
  const occurrences: BroadcastOccurrence[] = []
  const tracks = buildTrackRegistry(scene.scene)
  for (const perso of Object.values(scene.persos)) {
    if (perso.type !== 'media') continue
    for (const action of perso.actions ?? []) {
      const broadcast = readBroadcastAction(action.action)
      if (broadcast === null) continue
      occurrences.push({
        persoKey: perso.key,
        trackId: action.trackId,
        trackActive: tracks.tracks[action.trackId]?.active ?? true,
        action,
        broadcast,
      })
    }
  }
  return occurrences.sort(compareBroadcastOccurrences)
}

/** Produces a stable signature for the active media actions at one scene time. */
function createSceneSignature(scene: SolvedScene, occurrences: readonly BroadcastOccurrence[]): string {
  const mediaFlags = Object.values(scene.persos)
    .filter((perso) => perso.type === 'media')
    .map((perso) => `${perso.key}:${readInitialMaster(scene.scene, perso) ? '1' : '0'}`)
    .sort()
  return JSON.stringify([
    mediaFlags,
    occurrences.map((occurrence) => [
      occurrence.persoKey,
      occurrence.trackId,
      occurrence.action.startAt,
      occurrence.action.eventId,
      occurrence.action.declarationPath,
      occurrence.broadcast,
    ]),
  ])
}

/** Applies one broadcast occurrence to the corresponding logical media state. */
function applyBroadcastOccurrence(
  state: MediaRuntimeState | undefined,
  occurrence: BroadcastOccurrence,
  mediaById: Map<string, MediaRuntimeState>,
  getComponentById: (runtimeItemId: string) => unknown,
  nextActivation: () => number,
): void {
  if (state === undefined) return
  state.trackId = occurrence.trackId
  state.trackActive = occurrence.trackActive
  if (occurrence.broadcast.type === 'START') {
    if (state.isMaster) pausePreviousMasters(state, occurrence.action.startAt, mediaById, getComponentById)
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
    const component = getMediaComponent(getComponentById, state.runtimeItemId)
    component?.setPlaybackWindow?.(
      state.sourceStartMs,
      component === undefined ? state.sourceEndMs : resolveEffectiveEndMs(state, component),
    )
    return
  }

  if (occurrence.broadcast.type === 'PAUSE') {
    state.frozenMediaMs = resolveExpectedMediaMs(state, occurrence.action.startAt, getComponentById)
    state.logicalState = 'paused'
    state.needsResync = true
    return
  }

  state.frozenMediaMs = resolveExpectedMediaMs(state, occurrence.action.startAt, getComponentById)
  state.logicalState = 'stopped'
  state.needsResync = true
}

/** Pauses every previously active master before a newly started master takes over. */
function pausePreviousMasters(
  nextMaster: MediaRuntimeState,
  timelineMs: number,
  mediaById: Map<string, MediaRuntimeState>,
  getComponentById: (runtimeItemId: string) => unknown,
): void {
  for (const previous of mediaById.values()) {
    if (previous === nextMaster || !previous.isMaster || previous.logicalState !== 'playing') continue
    previous.frozenMediaMs = resolveExpectedMediaMs(previous, timelineMs, getComponentById)
    previous.logicalState = 'paused'
    previous.needsResync = true
    getMediaComponent(getComponentById, previous.runtimeItemId)?.pause()
  }
}

/** Applies newly entered broadcast occurrences without resetting other media. */
function applyBroadcastOccurrences(
  occurrences: readonly BroadcastOccurrence[],
  mediaById: Map<string, MediaRuntimeState>,
  getComponentById: (runtimeItemId: string) => unknown,
  nextActivation: () => number,
): void {
  for (const occurrence of occurrences) {
    applyBroadcastOccurrence(
      mediaById.get(occurrence.persoKey),
      occurrence,
      mediaById,
      getComponentById,
      nextActivation,
    )
  }
}

/** Synchronizes every media component against one absolute player position. */
function syncTimeline(
  timelineMs: number,
  playbackState: 'playing' | 'paused',
  mediaById: ReadonlyMap<string, MediaRuntimeState>,
  getComponentById: (runtimeItemId: string) => unknown,
): void {
  for (const state of mediaById.values()) {
    const component = getMediaComponent(getComponentById, state.runtimeItemId)
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

    const expectedMediaMs = resolveExpectedMediaMs(state, timelineMs, getComponentById)
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
      if (state.needsResync) {
        component.seekTo(expectedMediaMs)
      }
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
function pauseActivePlayback(
  timelineMs: number,
  mediaById: ReadonlyMap<string, MediaRuntimeState>,
  getComponentById: (runtimeItemId: string) => unknown,
): void {
  for (const state of mediaById.values()) {
    if (state.logicalState === 'idle' || state.logicalState === 'stopped') continue
    state.frozenMediaMs = resolveExpectedMediaMs(state, timelineMs, getComponentById)
    state.logicalState = 'paused'
    state.needsResync = true
    getMediaComponent(getComponentById, state.runtimeItemId)?.pause()
  }
}

/** Selects the active master media and lets it replace the ticker when available. */
function resolveTimelineFromMaster(
  fallbackTimelineMs: number,
  mediaById: ReadonlyMap<string, MediaRuntimeState>,
  getComponentById: (runtimeItemId: string) => unknown,
): number {
  const activeMaster = [...mediaById.values()]
    .filter((state) => state.isMaster && state.logicalState === 'playing')
    .filter((state) => state.trackActive)
    .sort((left, right) => right.activationOrder - left.activationOrder)[0]
  if (activeMaster === undefined || activeMaster.sequenceStartMs === null) return fallbackTimelineMs
  const component = getMediaComponent(getComponentById, activeMaster.runtimeItemId)
  if (component === undefined || component.isPaused()) return fallbackTimelineMs
  const currentMediaMs = component.getCurrentTimeMs()
  const effectiveEndMs = resolveEffectiveEndMs(activeMaster, component)
  if (effectiveEndMs !== null && currentMediaMs >= effectiveEndMs) return fallbackTimelineMs
  const resolved = activeMaster.sequenceStartMs + (currentMediaMs - activeMaster.sourceStartMs)
  return Number.isFinite(resolved) && resolved >= 0 ? resolved : fallbackTimelineMs
}

/** Applies a complete reset for initialization, seek replay, or non-monotonic changes. */
function resetPlaybackStates(
  mediaById: ReadonlyMap<string, MediaRuntimeState>,
  getComponentById: (runtimeItemId: string) => unknown,
): void {
  for (const state of mediaById.values()) {
    const component = getMediaComponent(getComponentById, state.runtimeItemId)
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
function replayBroadcastOccurrences(
  occurrences: readonly BroadcastOccurrence[],
  mediaById: Map<string, MediaRuntimeState>,
  getComponentById: (runtimeItemId: string) => unknown,
  nextActivation: () => number,
): void {
  resetPlaybackStates(mediaById, getComponentById)
  applyBroadcastOccurrences(occurrences, mediaById, getComponentById, nextActivation)
}

/** Resolves one media position from its broadcast segment and the sequence clock. */
function resolveExpectedMediaMs(
  state: MediaRuntimeState,
  timelineMs: number,
  getComponentById: (runtimeItemId: string) => unknown,
): number {
  if (state.sequenceStartMs === null) return state.frozenMediaMs
  const raw = state.sourceStartMs + (timelineMs - state.sequenceStartMs)
  const component = getMediaComponent(getComponentById, state.runtimeItemId)
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

/** Resolves one component from the opaque module context with a runtime surface check. */
function getMediaComponent(
  getComponentById: (runtimeItemId: string) => unknown,
  runtimeItemId: string,
): MediaSyncRuntimeComponent | undefined {
  const value = getComponentById(runtimeItemId)
  if (typeof value !== 'object' || value === null) return undefined
  const required = ['seekTo', 'play', 'pause', 'stopAt', 'getCurrentTimeMs', 'getDurationMs', 'isPaused']
  const candidate = value as Record<string, unknown>
  return required.every((name) => typeof candidate[name] === 'function')
    ? value as unknown as MediaSyncRuntimeComponent
    : undefined
}

/** Reads one supported broadcast payload from one compiled action. */
function readBroadcastAction(action: CompiledRecord): BroadcastAction | null {
  const value = action.broadcast
  if (!isPlainRecord(value)) return null
  const broadcast = value as CompiledRecord
  const type = broadcast.type
  if (type !== 'START' && type !== 'PAUSE' && type !== 'STOP') return null
  return {
    type,
    startAt: typeof broadcast.startAt === 'number' ? broadcast.startAt : undefined,
    endAt: typeof broadcast.endAt === 'number' ? broadcast.endAt : undefined,
    transition: readMediaTransition(broadcast.transition),
  }
}

/** Reads the optional transition payload without interpreting foreign properties. */
function readMediaTransition(value: unknown): MediaTransition | undefined {
  if (!isPlainRecord(value)) return undefined
  const duration = value.duration
  return {
    from: isPlainRecord(value.from) ? value.from : undefined,
    to: isPlainRecord(value.to) ? value.to : undefined,
    duration: typeof duration === 'number' && Number.isFinite(duration) && duration >= 0 ? duration : undefined,
  }
}

/** Sorts occurrences by authored timeline order and declaration path. */
function compareBroadcastOccurrences(left: BroadcastOccurrence, right: BroadcastOccurrence): number {
  return left.action.startAt - right.action.startAt
    || left.action.trackOrder - right.action.trackOrder
    || comparePaths(left.action.declarationPath, right.action.declarationPath)
    || left.persoKey.localeCompare(right.persoKey)
}

/** Compares two declaration paths without relying on object or DOM order. */
function comparePaths(left: readonly number[], right: readonly number[]): number {
  const length = Math.min(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index]
  }
  return left.length - right.length
}

/** Identifies one compiled broadcast occurrence across consecutive presentations. */
function createBroadcastOccurrenceKey(occurrence: BroadcastOccurrence): string {
  return JSON.stringify([
    occurrence.persoKey,
    occurrence.trackId,
    occurrence.trackActive,
    occurrence.action.startAt,
    occurrence.action.eventId,
    occurrence.action.eventSeq,
    occurrence.action.declarationPath,
    occurrence.broadcast,
  ])
}

/** Returns whether the next broadcast set only adds occurrences to the current set. */
function isBroadcastAdditionOnly(
  previous: ReadonlySet<string>,
  next: ReadonlySet<string>,
): boolean {
  if (next.size <= previous.size) return false
  for (const key of previous) {
    if (!next.has(key)) return false
  }
  return true
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

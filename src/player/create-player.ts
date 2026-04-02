import type { AnimationAdapter, AnimationResolvedAction } from '../animation/types'
import { dispatchEvents } from '../core/events/dispatch'
import { sortRuntimeEvents } from '../core/events/sort'
import type { EventListener, TimelineEvent, TrackMeta } from '../core/events/types'
import { applyResolvedActions } from '../runtime/apply-actions'
import { mountSceneElements } from '../runtime/mount-elements'
import { createRuntimeTraceStore, type RuntimeTraceRow, type RuntimeTraceStatus } from '../runtime/trace-store'
import type { CreateElementOptions } from '../runtime/create-element'
import type { RuntimeElementMap, StoryDoc } from '../runtime/types'
import type {
  PlayerApi,
  PlayerCommandResult,
  PlayerRuntimePolicy,
  PlayerStateListener,
  PlayerStateSnapshot,
  PlayerStatus,
  PlayerTraceListener,
  RebuildMode,
  SceneDoc
} from './types'

export type CreatePlayerOptions = {
  runtimePolicy?: Partial<PlayerRuntimePolicy>
  createElementOptions?: CreateElementOptions
  animationAdapter?: AnimationAdapter
}

const DEFAULT_RUNTIME_POLICY: PlayerRuntimePolicy = {
  allowedRebuildModes: ['state', 'full']
}

const NOOP_ANIMATION_ADAPTER: AnimationAdapter = {
  run: () => [],
  stop: () => {
    return
  }
}

/**
 * Clamps timeline values into a non-negative domain.
 */
function clampTimelineMs(value: number): number {
  if (value < 0) {
    return 0
  }

  return value
}

/**
 * Resolves the story used as active runtime story for one scene.
 */
function resolveActiveStory(scene: SceneDoc): StoryDoc | null {
  if (scene.initialStoryId) {
    return scene.stories[scene.initialStoryId] ?? null
  }

  const firstStory = Object.values(scene.stories)[0]
  return firstStory ?? null
}

/**
 * Resolves one monotonic timestamp for timeline computations.
 */
function resolveNowMs(): number {
  if (typeof globalThis.performance !== 'undefined') {
    return globalThis.performance.now()
  }

  return Date.now()
}

/**
 * Resolves track ordering metadata from scene tracks payload.
 */
function resolveTrackMeta(scene: SceneDoc): Record<string, TrackMeta> {
  const result: Record<string, TrackMeta> = {}
  if (typeof scene.tracks !== 'object' || scene.tracks === null) {
    return result
  }

  for (const [trackId, rawTrack] of Object.entries(scene.tracks)) {
    if (typeof rawTrack !== 'object' || rawTrack === null) {
      continue
    }

    const track = rawTrack as Record<string, unknown>
    const source = track.source === 'user' || track.source === 'system' ? track.source : 'story'
    result[trackId] = {
      order: typeof track.order === 'number' ? track.order : 0,
      source
    }
  }

  return result
}

/**
 * Resolves the timeline event list from scene/story payload.
 */
function resolveTimelineEvents(scene: SceneDoc, story: StoryDoc): TimelineEvent[] {
  const timelineEvents: TimelineEvent[] = []
  let fallbackIndex = 0

  if (typeof scene.tracks === 'object' && scene.tracks !== null) {
    for (const [trackId, rawTrack] of Object.entries(scene.tracks)) {
      if (typeof rawTrack !== 'object' || rawTrack === null) {
        continue
      }

      const track = rawTrack as Record<string, unknown>
      const events = Array.isArray(track.events) ? (track.events as Array<Record<string, unknown>>) : []
      for (const event of events) {
        const eventName = typeof event.name === 'string' ? event.name : undefined
        if (!eventName) {
          continue
        }

        const ms = typeof event.ms === 'number' ? event.ms : 0
        const index = typeof event.index === 'number' ? event.index : fallbackIndex
        const id = typeof event.id === 'string' ? event.id : `evt-${ms}-${fallbackIndex}`
        timelineEvents.push({
          id,
          ms,
          name: eventName,
          payload: typeof event.payload === 'object' && event.payload !== null ? (event.payload as Record<string, unknown>) : undefined,
          index,
          source: event.source === 'user' || event.source === 'system' ? event.source : 'story',
          trackId
        })
        fallbackIndex += 1
      }
    }
  }

  if (timelineEvents.length > 0) {
    return timelineEvents
  }

  const storyEvents = ((story as unknown as Record<string, unknown>).events as Array<Record<string, unknown>> | undefined) ?? []
  for (const event of storyEvents) {
    const eventName = typeof event.name === 'string' ? event.name : undefined
    if (!eventName) {
      continue
    }

    const ms = typeof event.ms === 'number' ? event.ms : 0
    const index = typeof event.index === 'number' ? event.index : fallbackIndex
    const id = typeof event.id === 'string' ? event.id : `evt-${ms}-${fallbackIndex}`
    timelineEvents.push({
      id,
      ms,
      name: eventName,
      payload: typeof event.payload === 'object' && event.payload !== null ? (event.payload as Record<string, unknown>) : undefined,
      index,
      source: event.source === 'user' || event.source === 'system' ? event.source : 'story',
      trackId: typeof event.trackId === 'string' ? event.trackId : undefined
    })
    fallbackIndex += 1
  }

  return timelineEvents
}

/**
 * Resolves runtime listeners from story items and action maps.
 */
function resolveActionListeners(story: StoryDoc): EventListener[] {
  return Object.values(story.items).map((item) => ({
    listenerId: item.id,
    actionsByEventName: item.actions
  }))
}

/**
 * Creates one player API with lifecycle commands and subscriptions.
 */
export function createPlayer(options: CreatePlayerOptions = {}): PlayerApi {
  const runtimePolicy: PlayerRuntimePolicy = {
    allowedRebuildModes: options.runtimePolicy?.allowedRebuildModes ?? DEFAULT_RUNTIME_POLICY.allowedRebuildModes
  }

  const animationAdapter = options.animationAdapter ?? NOOP_ANIMATION_ADAPTER
  const traceStore = createRuntimeTraceStore({ maxEntries: 2000 })
  const traceListeners = new Set<PlayerTraceListener>()
  const stateListeners = new Set<PlayerStateListener>()

  let status: PlayerStatus = 'idle'
  let scene: SceneDoc | null = null
  let activeStory: StoryDoc | null = null
  let runtimeElements: RuntimeElementMap = new Map()
  let runtimeRevision = 0
  let timelineMs = 0
  let playbackStartMs: number | null = null
  let scheduledTimeoutIds: number[] = []

  /**
   * Resolves current timeline cursor using playback clock when active.
   */
  function resolveCurrentTimelineMs(): number {
    if (playbackStartMs === null) {
      return timelineMs
    }

    return clampTimelineMs(resolveNowMs() - playbackStartMs)
  }

  /**
   * Cancels all currently scheduled timeline events.
   */
  function clearScheduledEvents(): void {
    for (const timeoutId of scheduledTimeoutIds) {
      globalThis.clearTimeout(timeoutId)
    }

    scheduledTimeoutIds = []
  }

  /**
   * Emits one state snapshot to all state subscribers.
   */
  function emitStateSnapshot(): void {
    const snapshot = getState()
    for (const listener of stateListeners) {
      listener(snapshot)
    }
  }

  /**
   * Updates internal player status and notifies state subscribers.
   */
  function setStatus(nextStatus: PlayerStatus): void {
    if (status === nextStatus) {
      return
    }

    status = nextStatus
    emitStateSnapshot()
  }

  /**
   * Emits one runtime trace row and forwards it to trace subscribers.
   */
  function emitTrace(
    eventName: string,
    statusValue: RuntimeTraceStatus,
    payload?: Record<string, unknown>
  ): RuntimeTraceRow {
    const row = traceStore.append({
      scope: 'player',
      eventName,
      status: statusValue,
      payload
    })

    for (const listener of traceListeners) {
      listener(row)
    }

    return row
  }

  /**
   * Builds one rejected command result and emits associated trace.
   */
  function reject(
    code: string,
    message: string,
    eventName: string,
    details?: Record<string, unknown>
  ): PlayerCommandResult {
    emitTrace(eventName, 'rejected', {
      code,
      message,
      ...details
    })

    return {
      ok: false,
      error: {
        code,
        message,
        details
      }
    }
  }

  /**
   * Returns true when player has one initialized scene.
   */
  function isInitialized(): boolean {
    return scene !== null
  }

  /**
   * Clears runtime references while preserving policy and subscribers.
   */
  function resetRuntime(): void {
    clearScheduledEvents()
    runtimeElements = new Map()
    activeStory = null
    scene = null
    timelineMs = 0
    playbackStartMs = null
  }

  /**
   * Executes one timeline event against runtime listeners and actions.
   */
  function runTimelineEvent(event: TimelineEvent): void {
    if (activeStory === null) {
      return
    }

    const listeners = resolveActionListeners(activeStory)
    const resolvedActions = dispatchEvents<Record<string, unknown>>([event], {
      listeners: listeners as EventListener<Record<string, unknown>>[]
    })
    if (resolvedActions.length === 0) {
      return
    }

    const applyResult = applyResolvedActions(
      resolvedActions as unknown as AnimationResolvedAction[],
      runtimeElements,
      animationAdapter
    )
    emitTrace('player:event:applied', 'applied', {
      eventId: event.id,
      eventName: event.name,
      appliedActionsCount: applyResult.appliedActionsCount,
      animationAppliedCount: applyResult.animation.appliedCount,
      conflictCount: applyResult.conflictTrace.length
    })
  }

  /**
   * Schedules pending timeline events from current timeline cursor.
   */
  function schedulePendingEvents(): void {
    clearScheduledEvents()
    if (scene === null || activeStory === null) {
      return
    }

    const trackMeta = resolveTrackMeta(scene)
    const sortedEvents = sortRuntimeEvents(resolveTimelineEvents(scene, activeStory), trackMeta)
    const fromTimelineMs = resolveCurrentTimelineMs()

    for (const event of sortedEvents) {
      if (event.ms < fromTimelineMs) {
        continue
      }

      const delayMs = clampTimelineMs(event.ms - fromTimelineMs)
      const timeoutId = globalThis.setTimeout(() => {
        if (status !== 'playing') {
          return
        }

        runTimelineEvent(event)
      }, delayMs)
      scheduledTimeoutIds.push(timeoutId)
    }
  }

  /**
   * Initializes player runtime with one scene document.
   */
  async function init(nextScene: SceneDoc): Promise<PlayerCommandResult> {
    emitTrace('player:init:started', 'applied', {
      sceneId: nextScene.id
    })

    const nextActiveStory = resolveActiveStory(nextScene)
    if (nextActiveStory === null) {
      return reject(
        'SCENE_STORY_NOT_FOUND',
        'Scene must provide at least one story',
        'player:init:failed',
        {
          sceneId: nextScene.id
        }
      )
    }

    scene = nextScene
    activeStory = nextActiveStory
    runtimeElements = mountSceneElements(nextActiveStory, options.createElementOptions)
    runtimeRevision += 1
    setStatus('ready')

    emitTrace('player:init:done', 'applied', {
      sceneId: nextScene.id,
      activeStoryId: nextActiveStory.id,
      runtimeElementCount: runtimeElements.size,
      runtimeRevision
    })

    return { ok: true }
  }

  /**
   * Destroys player runtime resources and returns to idle state.
   */
  async function destroy(): Promise<PlayerCommandResult> {
    emitTrace('player:destroy:started', 'applied')

    resetRuntime()
    animationAdapter.stop()
    runtimeRevision += 1
    setStatus('idle')

    emitTrace('player:destroy:done', 'applied', {
      runtimeRevision
    })

    return { ok: true }
  }

  /**
   * Starts playback when player is ready or paused.
   */
  async function play(): Promise<PlayerCommandResult> {
    if (!isInitialized()) {
      return reject('PLAYER_NOT_INITIALIZED', 'init must be called before play', 'player:play')
    }

    if (status !== 'ready' && status !== 'paused') {
      return reject('INVALID_PLAYER_STATE', 'play is only allowed from ready or paused', 'player:play', {
        currentState: status
      })
    }

    playbackStartMs = resolveNowMs() - timelineMs
    setStatus('playing')
    schedulePendingEvents()
    emitTrace('player:play', 'applied')
    return { ok: true }
  }

  /**
   * Pauses playback when player is currently playing.
   */
  async function pause(): Promise<PlayerCommandResult> {
    if (!isInitialized()) {
      return reject('PLAYER_NOT_INITIALIZED', 'init must be called before pause', 'player:pause')
    }

    if (status !== 'playing') {
      return reject('INVALID_PLAYER_STATE', 'pause is only allowed from playing', 'player:pause', {
        currentState: status
      })
    }

    timelineMs = resolveCurrentTimelineMs()
    playbackStartMs = null
    clearScheduledEvents()
    setStatus('paused')
    emitTrace('player:pause', 'applied')
    return { ok: true }
  }

  /**
   * Seeks timeline to target position without forcing autoplay.
   */
  async function seek(targetTimelineMs: number): Promise<PlayerCommandResult> {
    if (!isInitialized()) {
      return reject('PLAYER_NOT_INITIALIZED', 'init must be called before seek', 'player:seek')
    }

    if (status !== 'ready' && status !== 'paused' && status !== 'playing') {
      return reject('INVALID_PLAYER_STATE', 'seek is only allowed from ready, paused, or playing', 'player:seek', {
        currentState: status
      })
    }

    const previousStatus = status
    setStatus('seeking')
    emitTrace('player:seek:started', 'applied', {
      targetTimelineMs
    })

    timelineMs = clampTimelineMs(targetTimelineMs)
    if (previousStatus === 'playing') {
      playbackStartMs = resolveNowMs() - timelineMs
      schedulePendingEvents()
    }

    setStatus(previousStatus)
    emitTrace('player:seek:done', 'applied', {
      targetTimelineMs: timelineMs
    })

    return { ok: true }
  }

  /**
   * Rewinds timeline to zero while preserving playback intent.
   */
  async function rewind(): Promise<PlayerCommandResult> {
    if (!isInitialized()) {
      return reject('PLAYER_NOT_INITIALIZED', 'init must be called before rewind', 'player:rewind')
    }

    if (status !== 'ready' && status !== 'paused' && status !== 'playing') {
      return reject('INVALID_PLAYER_STATE', 'rewind is only allowed from ready, paused, or playing', 'player:rewind', {
        currentState: status
      })
    }

    const previousStatus = status
    setStatus('rewinding')
    emitTrace('player:rewind:started', 'applied')

    timelineMs = 0
    if (previousStatus === 'playing') {
      playbackStartMs = resolveNowMs()
      schedulePendingEvents()
    }

    setStatus(previousStatus)
    emitTrace('player:rewind:done', 'applied', {
      targetTimelineMs: 0
    })

    return { ok: true }
  }

  /**
   * Rebuilds runtime according to runtime policy constraints.
   */
  async function rebuild(mode: RebuildMode = 'state'): Promise<PlayerCommandResult> {
    if (!isInitialized() || scene === null) {
      return reject('PLAYER_NOT_INITIALIZED', 'init must be called before rebuild', 'player:rebuild')
    }

    if (!runtimePolicy.allowedRebuildModes.includes(mode)) {
      return reject('MODE_NOT_ALLOWED_BY_POLICY', 'Requested rebuild mode is not allowed by policy', 'player:rebuild', {
        mode,
        allowedModes: runtimePolicy.allowedRebuildModes
      })
    }

    const previousStatus = status
    setStatus('seeking')
    emitTrace('player:rebuild:started', 'applied', {
      mode
    })

    if (mode === 'full') {
      const nextActiveStory = resolveActiveStory(scene)
      if (nextActiveStory === null) {
        return reject(
          'SCENE_STORY_NOT_FOUND',
          'Scene must provide at least one story',
          'player:rebuild:failed',
          {
            sceneId: scene.id,
            mode
          }
        )
      }

      activeStory = nextActiveStory
      runtimeElements = mountSceneElements(nextActiveStory, options.createElementOptions)
      runtimeRevision += 1
      if (status === 'playing') {
        schedulePendingEvents()
      }
    }

    setStatus(previousStatus)
    emitTrace('player:rebuild:done', 'applied', {
      mode,
      runtimeRevision
    })

    return { ok: true }
  }

  /**
   * Returns one immutable snapshot of current player state.
   */
  function getState(): PlayerStateSnapshot {
    return {
      status,
      initialized: isInitialized(),
      sceneId: scene?.id,
      activeStoryId: activeStory?.id,
      timelineMs: resolveCurrentTimelineMs(),
      runtimeRevision
    }
  }

  /**
   * Subscribes to trace rows emitted by player commands.
   */
  function onTrace(listener: PlayerTraceListener): () => void {
    traceListeners.add(listener)
    return () => {
      traceListeners.delete(listener)
    }
  }

  /**
   * Subscribes to player state changes.
   */
  function onStateChange(listener: PlayerStateListener): () => void {
    stateListeners.add(listener)
    return () => {
      stateListeners.delete(listener)
    }
  }

  return {
    init,
    destroy,
    play,
    pause,
    seek,
    rewind,
    rebuild,
    getState,
    onTrace,
    onStateChange
  }
}

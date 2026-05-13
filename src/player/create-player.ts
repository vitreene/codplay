import type { AnimationAdapter } from '../animation/types'
import type { TimelineEvent } from '../core/events/types'
import { TimeTicker } from '../core/time/ticker'
import { DirectorCore } from '../director/create-director'
import { RendererFacade } from '../renderer/create-renderer'
import {
  createRuntimeTraceStore,
  type RuntimeTraceRow,
  type RuntimeTraceStatus
} from '../runtime/trace-store'
import type { RuntimeComponentClass } from '../runtime/components'
import type { CreateElementOptions } from '../runtime/create-element'
import { RUNTIME_EVENT_SOURCE } from '../core/events/constants'
import { RUNTIME_TRACE_STATUS } from '../runtime/trace-constants'
import { TrackManager } from '../track-manager/create-track-manager'
import type { TrackAuthorMeta } from '../track-manager/types'
import { createSceneLifecycleOptions, PlayerRuntimePlanner, type PlayerRuntimePlan } from './create-player-utils'
import { PLAYER_STATUS } from './player-constants'
import type {
  PlayerApi,
  PlayerCommandResult,
  PlayerPublicEventInput,
  PlayerRuntimePolicy,
  PlayerSceneLifecycleOptions,
  PlayerSceneInput,
  PlayerStateListener,
  PlayerStateSnapshot,
  PlayerStatus,
  PlayerTraceListener,
  RebuildMode,
  SceneStoryDoc,
  StrictSceneDoc
} from './types'

export type CreatePlayerOptions = {
  runtimePolicy?: Partial<PlayerRuntimePolicy>
  createElementOptions?: CreateElementOptions
  animationAdapter?: AnimationAdapter
  onRuntimeEmit?: (event: PlayerPublicEventInput) => void
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

const PLAYER_TRACE_EVENT = {
  mountFailed: 'player:mount:failed',
  trackControl: 'player:track-control',
  trackControlWarning: 'player:track-control:warning',
  initStarted: 'player:init:started',
  initDone: 'player:init:done'
} as const

const PLAYER_TRACK = {
  global: 'global'
} as const

const PLAYER_TRACK_CONTROL_EVENT = {
  activate: 'track:activate',
  deactivate: 'track:deactivate',
  toggle: 'track:toggle'
} as const

const PLAYER_RUNTIME_ERROR_MESSAGE = {
  mountedStoryRequired: 'Scene must provide at least one mounted story'
} as const

/**
 * Implements one player facade with lifecycle commands and subscriptions.
 */
export class PlayerFacade implements PlayerApi {
  private readonly runtimePolicy: PlayerRuntimePolicy
  private readonly runtimePlanner = new PlayerRuntimePlanner()
  private readonly director = new DirectorCore()
  private readonly renderer: RendererFacade
  private readonly trackManager = new TrackManager()

  private status: PlayerStatus = PLAYER_STATUS.idle
  private scene: StrictSceneDoc | null = null
  private timelineMs = 0
  private timelineEndMs = 0
  private playbackStartMs: number | null = null
  private readonly ticker = new TimeTicker()
  private nextPublicEventIndex = 0
  private readonly mountedStoryIds = new Set<string>()
  private readonly startedStoryIds = new Set<string>()

  private readonly traceStore = createRuntimeTraceStore({ maxEntries: 2000 })
  private readonly traceListeners = new Set<PlayerTraceListener>()
  private readonly stateListeners = new Set<PlayerStateListener>()

  /**
   * Builds one frozen scene-level track registry with defaults and story contributions.
   */
  private consolidateSceneTracks(scene: StrictSceneDoc): Record<string, unknown> {
    const consolidatedTracks: Record<string, unknown> = {
      [PLAYER_TRACK.global]: {
        active: true
      }
    }

    for (const story of Object.values(scene.stories)) {
      consolidatedTracks[story.id] = {
        active: true
      }
    }

    for (const [trackId, rawTrack] of Object.entries(scene.tracks)) {
      consolidatedTracks[trackId] = this.mergeTrackMeta(consolidatedTracks[trackId], rawTrack)
    }

    for (const story of Object.values(scene.stories)) {
      for (const [trackId, rawTrack] of Object.entries(story.tracks ?? {})) {
        consolidatedTracks[trackId] = this.mergeTrackMeta(consolidatedTracks[trackId], rawTrack)
      }
    }

    return consolidatedTracks
  }

  /**
   * Merges one raw track declaration onto one existing scene-level track meta.
   */
  private mergeTrackMeta(existingTrack: unknown, nextTrack: unknown): TrackAuthorMeta {
    const baseTrack = typeof existingTrack === 'object' && existingTrack !== null
      ? (existingTrack as TrackAuthorMeta)
      : {}
    const incomingTrack = typeof nextTrack === 'object' && nextTrack !== null
      ? (nextTrack as TrackAuthorMeta)
      : {}

    return {
      ...baseTrack,
      ...incomingTrack,
      ...(incomingTrack.active !== undefined ? { active: incomingTrack.active } : {})
    }
  }

  /**
   * Resolves the fallback track id for one event context.
   */
  private resolveDefaultTrackId(scopeStoryId?: string): string {
    if (scopeStoryId && this.trackManager.state.loadedTrackIds.includes(scopeStoryId)) {
      return scopeStoryId
    }

    return PLAYER_TRACK.global
  }

  /**
   * Parses one track control payload into one string id list.
   */
  private readTrackControlIds(payload: Record<string, unknown> | undefined): string[] {
    const trackIds = payload?.trackIds
    if (!Array.isArray(trackIds)) {
      return []
    }

    return trackIds.filter((trackId): trackId is string => typeof trackId === 'string' && trackId.length > 0)
  }

  /**
   * Applies one scene-level track control event when supported.
   */
  private handleTrackControlEvent(event: TimelineEvent): boolean {
    if (
      event.name !== PLAYER_TRACK_CONTROL_EVENT.activate &&
      event.name !== PLAYER_TRACK_CONTROL_EVENT.deactivate &&
      event.name !== PLAYER_TRACK_CONTROL_EVENT.toggle
    ) {
      return false
    }

    const requestedTrackIds = this.readTrackControlIds(event.payload)
    const knownTrackIds = new Set(this.trackManager.state.loadedTrackIds)
    const activeTrackIds = new Set(this.trackManager.state.activeTrackIds)
    const appliedTrackIds = requestedTrackIds.filter((trackId) => knownTrackIds.has(trackId))
    const ignoredTrackIds = requestedTrackIds.filter((trackId) => !knownTrackIds.has(trackId))

    if (event.name === PLAYER_TRACK_CONTROL_EVENT.activate) {
      this.trackManager.setActiveTracks({ activate: appliedTrackIds, reason: event.name })
    } else if (event.name === PLAYER_TRACK_CONTROL_EVENT.deactivate) {
      this.trackManager.setActiveTracks({ deactivate: appliedTrackIds, reason: event.name })
    } else {
      this.trackManager.setActiveTracks({
        activate: appliedTrackIds.filter((trackId) => !activeTrackIds.has(trackId)),
        deactivate: appliedTrackIds.filter((trackId) => activeTrackIds.has(trackId)),
        reason: event.name
      })
    }

    this.emitTrace(PLAYER_TRACE_EVENT.trackControl, RUNTIME_TRACE_STATUS.applied, {
      eventId: event.id,
      eventName: event.name,
      appliedTrackIds,
      ignoredTrackIds
    })

    if (ignoredTrackIds.length > 0) {
      this.emitTrace(PLAYER_TRACE_EVENT.trackControlWarning, RUNTIME_TRACE_STATUS.info, {
        code: 'RUNTIME_TRACK_UNKNOWN_IGNORED',
        eventId: event.id,
        eventName: event.name,
        ignoredTrackIds
      })
    }

    return true
  }

  /**
   * Configures one player facade from explicit options.
   */
  constructor(options: CreatePlayerOptions = {}) {
    this.runtimePolicy = {
      allowedRebuildModes:
        options.runtimePolicy?.allowedRebuildModes ?? DEFAULT_RUNTIME_POLICY.allowedRebuildModes
    }

    const animationAdapter = options.animationAdapter ?? NOOP_ANIMATION_ADAPTER
    this.renderer = new RendererFacade({
      animationAdapter,
      createElementOptions: options.createElementOptions,
      emitRuntimeEvent: (event) => {
        const runtimeEvent: PlayerPublicEventInput = {
          name: event.name,
          payload: event.data,
          scopeStoryId: event.scopeStoryId,
          source: RUNTIME_EVENT_SOURCE.user
        }

        if (options.onRuntimeEmit) {
          options.onRuntimeEmit(runtimeEvent)
          return
        }

        void this.emit({
          ...runtimeEvent
        })
      }
    })

    this.renderer.onError((error) => {
      this.emitTrace('renderer:error', RUNTIME_TRACE_STATUS.error, {
        code: error.code,
        message: error.message,
        ...(error.details ?? {})
      })
    })
  }

  /**
   * Registers one component class before scene load.
   */
  registerComponent(persoType: string, componentClass: RuntimeComponentClass): PlayerCommandResult {
    if (this.isInitialized()) {
      return this.reject(
        'PLAYER_COMPONENT_REGISTRY_LOCKED',
        'registerComponent is only allowed before init',
        'player:register-component',
        { persoType }
      )
    }

    const result = this.renderer.registerComponent(persoType, componentClass)
    if (!result.ok) {
      return this.reject(
        result.code,
        result.message,
        'player:register-component',
        result.details
      )
    }

      this.emitTrace('player:register-component', RUNTIME_TRACE_STATUS.applied, {
      persoType,
      status: result.status,
      code: result.code
    })

    return { ok: true }
  }

  /**
   * Overrides one component class before scene load.
   */
  overrideComponent(persoType: string, componentClass: RuntimeComponentClass): PlayerCommandResult {
    if (this.isInitialized()) {
      return this.reject(
        'PLAYER_COMPONENT_REGISTRY_LOCKED',
        'overrideComponent is only allowed before init',
        'player:override-component',
        { persoType }
      )
    }

    const result = this.renderer.overrideComponent(persoType, componentClass)
    if (!result.ok) {
      return this.reject(
        result.code,
        result.message,
        'player:override-component',
        result.details
      )
    }

      this.emitTrace('player:override-component', RUNTIME_TRACE_STATUS.applied, {
      persoType,
      status: result.status
    })

    return { ok: true }
  }

  /**
   * Exposes one stable runtime registry for integration/editing flows.
   */
  getRuntimeRegistry(): import('../runtime/components').RuntimeRegistrySnapshot {
    return this.renderer.getRuntimeRegistry()
  }

  /**
   * Resolves current timeline cursor using playback clock when active.
   */
  private resolveCurrentTimelineMs(): number {
    if (this.playbackStartMs === null) {
      return Math.min(this.timelineMs, this.timelineEndMs)
    }

    return Math.min(
      this.runtimePlanner.clampTimelineMs(this.runtimePlanner.resolveNowMs() - this.playbackStartMs),
      this.timelineEndMs
    )
  }

  /**
   * Stops frame-driven playback scheduling when currently active.
   */
  private stopPlaybackLoop(): void {
    if (!this.ticker.isRunning()) {
      return
    }

    this.ticker.stop()
  }

  /**
   * Returns true when player has one initialized scene.
   */
  private isInitialized(): boolean {
    return this.scene !== null
  }

  /**
   * Clears runtime references while preserving policy and subscribers.
   */
  private resetRuntime(): void {
    this.stopPlaybackLoop()
    this.director.destroy()
    this.renderer.destroy()
    this.trackManager.load({ tracks: {} })
    this.scene = null
    this.timelineMs = 0
    this.timelineEndMs = 0
    this.playbackStartMs = null
    this.nextPublicEventIndex = 0
    this.mountedStoryIds.clear()
    this.startedStoryIds.clear()
  }

  /**
   * Returns mounted story ids in deterministic insertion order.
   */
  private getMountedStoryIds(): string[] {
    return [...this.mountedStoryIds]
  }

  /**
   * Builds one runtime plan from all currently mounted stories.
   */
  private createMountedRuntimePlan(): PlayerRuntimePlan | null {
    if (this.scene === null || this.mountedStoryIds.size === 0) {
      return null
    }

    return this.runtimePlanner.createRuntimePlan(
      this.scene,
      this.getMountedStoryIds(),
      this.trackManager.getAllEvents({ activeOnly: true })
    )
  }

  /**
   * Rebuilds the runtime plan from all mounted stories and current track state.
   */
  private syncMountedRuntimePlan(): PlayerCommandResult {
    const runtimePlan = this.createMountedRuntimePlan()
    if (runtimePlan === null) {
      return this.reject(
        'SCENE_STORY_NOT_FOUND',
        PLAYER_RUNTIME_ERROR_MESSAGE.mountedStoryRequired,
        'player:sync-runtime'
      )
    }

    this.director.load(runtimePlan)
    this.timelineEndMs = this.runtimePlanner.resolveTimelineEndMsFromPlan(runtimePlan)
    return { ok: true }
  }

  /**
   * Resolves one existing scene story from id or direct reference.
   */
  private resolveSceneStory(story: string | SceneStoryDoc): SceneStoryDoc | null {
    if (this.scene === null) {
      return null
    }

    return this.runtimePlanner.resolveStory(this.scene, story)
  }

  /**
   * Resolves one target track id for anchored eventimes of a started story.
   */
  private resolveStoryTrackId(storyId: string): string {
    if (this.scene !== null && storyId in this.scene.tracks) {
      return storyId
    }

    return PLAYER_TRACK.global
  }

  /**
   * Mounts one story into renderer/director without starting its portable eventimes.
   */
  private mountStory(story: string | SceneStoryDoc): void {
    const nextStory = this.resolveSceneStory(story)
    if (nextStory === null) {
      return
    }

    this.mountedStoryIds.add(nextStory.id)

    const runtimePlan = this.createMountedRuntimePlan()
    if (runtimePlan === null) {
      return
    }

    this.director.load(runtimePlan)
    this.timelineEndMs = this.runtimePlanner.resolveTimelineEndMsFromPlan(runtimePlan)

    const rendererLoadResult = this.renderer.load({ story: runtimePlan.story })
    if (!rendererLoadResult.ok) {
      this.emitTrace(PLAYER_TRACE_EVENT.mountFailed, RUNTIME_TRACE_STATUS.error, {
        storyId: nextStory.id,
        mountedStoryIds: this.getMountedStoryIds(),
        code: rendererLoadResult.error.code,
        message: rendererLoadResult.error.message
      })
      return
    }
  }

  /**
   * Starts one mounted story once per player cycle and anchors its portable eventimes.
   */
  private startStory(story: string | SceneStoryDoc): void {
    const nextStory = this.resolveSceneStory(story)
    if (nextStory === null) {
      return
    }

    this.mountStory(nextStory)

    if (this.startedStoryIds.has(nextStory.id)) {
      return
    }

    this.startedStoryIds.add(nextStory.id)

    if (Array.isArray(nextStory.eventimes) && nextStory.eventimes.length > 0) {
      this.trackManager.appendAnchoredEventimes({
        trackId: this.resolveStoryTrackId(nextStory.id),
        anchorMs: this.resolveCurrentTimelineMs(),
        storyId: nextStory.id,
        eventimes: nextStory.eventimes
      })
    }

    this.syncMountedRuntimePlan()
  }

  /**
   * Builds lifecycle runtime options exposed to scene hooks.
   */
  private createLifecycleOptions(): PlayerSceneLifecycleOptions {
    return createSceneLifecycleOptions({
      mount: (story) => {
        this.mountStory(story)
      },
      start: (story) => {
        this.startStory(story)
      }
    })
  }

  /**
   * Applies all timeline events due at or before the provided timeline cursor.
   */
  private runDueTimelineEvents(timelineMs: number): void {
    const dueEvents = this.trackManager.collectDueEvents({ nowMs: timelineMs }).events
    for (const event of dueEvents) {
      this.runTimelineEvent(event)
    }
  }

  /**
   * Runs one frame tick when player is in playing state.
   */
  private runPlaybackTick(frameNowMs?: number): void {
    if (this.status !== PLAYER_STATUS.playing) {
      return
    }

    const timelineMs = this.resolveCurrentTimelineMs()
    this.timelineMs = timelineMs
    this.runDueTimelineEvents(timelineMs)
    this.renderer.renderFrame(frameNowMs ?? this.runtimePlanner.resolveNowMs())
    this.completePlaybackIfReachedEnd()
  }

  /**
   * Stops frame playback when timeline reaches its deterministic end.
   */
  private completePlaybackIfReachedEnd(): void {
    if (this.status !== PLAYER_STATUS.playing) {
      return
    }

    if (this.timelineMs < this.timelineEndMs) {
      return
    }

    this.timelineMs = this.timelineEndMs
    this.playbackStartMs = null
    this.stopPlaybackLoop()
    this.director.pause()

    const rendererPauseResult = this.renderer.pause()
    if (!rendererPauseResult.ok) {
      this.emitTrace('player:play:ended', RUNTIME_TRACE_STATUS.error, {
        timelineMs: this.timelineMs,
        code: rendererPauseResult.error.code,
        message: rendererPauseResult.error.message
      })
      this.setStatus(PLAYER_STATUS.paused)
      return
    }

    this.setStatus(PLAYER_STATUS.paused)
    this.emitTrace('player:play:ended', RUNTIME_TRACE_STATUS.applied, {
      timelineMs: this.timelineMs
    })
  }

  /**
   * Starts frame-driven playback scheduling through the shared ticker.
   */
  private startPlaybackLoop(): void {
    if (this.ticker.isRunning()) {
      return
    }

    this.ticker.start((tickPayload) => {
      this.runPlaybackTick(tickPayload.nowMs)
    })
  }

  /**
   * Builds one normalized timeline event from public event input.
   */
  private createTimelineEvent(input: PlayerPublicEventInput): TimelineEvent {
    const eventMs = input.ms ?? this.resolveCurrentTimelineMs()
    const eventId = input.id ?? `evt-public-${Math.round(eventMs)}-${this.nextPublicEventIndex}`
    const trackId = input.trackId ?? this.resolveDefaultTrackId(input.scopeStoryId)

    const event: TimelineEvent = {
      id: eventId,
      ms: eventMs,
      name: input.name,
      payload: input.payload,
      scopeStoryId: input.scopeStoryId,
      index: this.nextPublicEventIndex,
      source: input.source ?? RUNTIME_EVENT_SOURCE.user,
      trackId
    }

    this.nextPublicEventIndex += 1
    return event
  }

  /**
   * Executes one timeline event against runtime listeners and actions.
   */
  private runTimelineEvent(event: TimelineEvent): void {
    if (this.handleTrackControlEvent(event)) {
      return
    }

    const directorResult = this.director.runTimelineEvent(event)
    if (directorResult.commits.length === 0) {
      return
    }

    let enqueuedCommitCount = 0

    for (const commit of directorResult.commits) {
      const enqueueResult = this.renderer.enqueueCommit(commit)
      if (enqueueResult.ok) {
        enqueuedCommitCount += 1
      }
    }

    const tickResult = this.renderer.tick(event.ms)
    this.emitTrace('player:event:applied', RUNTIME_TRACE_STATUS.applied, {
      eventId: event.id,
      eventName: event.name,
      enqueuedCommitCount,
      appliedCommitCount: tickResult.appliedCommitCount,
      appliedActionsCount: tickResult.appliedActionCount,
      animationAppliedCount: tickResult.animationAppliedCount,
      conflictCount: tickResult.conflictCount
    })
  }

  /**
   * Initializes all scene stories before scene-level init logic runs.
   */
  private initializeSceneStories(scene: StrictSceneDoc): void {
    for (const story of Object.values(scene.stories)) {
      story.state = story.init?.(story.initial)
    }
  }

  /**
   * Initializes player runtime with one scene document.
   */
  async init(nextScene: PlayerSceneInput): Promise<PlayerCommandResult> {
    this.emitTrace(PLAYER_TRACE_EVENT.initStarted, RUNTIME_TRACE_STATUS.applied, {
      sceneId: nextScene.id
    })

    this.resetRuntime()

    const runtimeScene = nextScene as StrictSceneDoc

    this.scene = runtimeScene
    this.timelineMs = 0
    this.playbackStartMs = null
    this.nextPublicEventIndex = 0
    runtimeScene.tracks = this.consolidateSceneTracks(runtimeScene)
    this.trackManager.load({ tracks: runtimeScene.tracks })

    this.initializeSceneStories(runtimeScene)
    runtimeScene.init?.(runtimeScene, this.createLifecycleOptions())
    this.setStatus(PLAYER_STATUS.ready)

    const rendererState = this.renderer.getState()
    this.emitTrace(PLAYER_TRACE_EVENT.initDone, RUNTIME_TRACE_STATUS.applied, {
      sceneId: runtimeScene.id,
      mountedStoryCount: this.mountedStoryIds.size,
      initializedStoryCount: Object.keys(runtimeScene.stories).length,
      loadedTrackCount: this.trackManager.state.loadedTrackIds.length,
      activeTrackCount: this.trackManager.state.activeTrackIds.length,
      runtimeElementCount: rendererState.runtimeElementCount,
      runtimeRevision: rendererState.runtimeRevision
    })

    return { ok: true }
  }

  /**
   * Destroys player runtime resources and returns to idle state.
   */
  async destroy(): Promise<PlayerCommandResult> {
    this.emitTrace('player:destroy:started', RUNTIME_TRACE_STATUS.applied)

    this.resetRuntime()
    this.setStatus(PLAYER_STATUS.idle)

    const rendererState = this.renderer.getState()
    this.emitTrace('player:destroy:done', RUNTIME_TRACE_STATUS.applied, {
      runtimeRevision: rendererState.runtimeRevision
    })

    return { ok: true }
  }

  /**
   * Starts playback when player is ready or paused.
   */
  async play(): Promise<PlayerCommandResult> {
    if (!this.isInitialized() || this.scene === null) {
      return this.reject('PLAYER_NOT_INITIALIZED', 'init must be called before play', 'player:play')
    }

    if (this.status !== PLAYER_STATUS.ready && this.status !== PLAYER_STATUS.paused) {
      return this.reject('INVALID_PLAYER_STATE', 'play is only allowed from ready or paused', 'player:play', {
        currentState: this.status
      })
    }

    if (this.status === PLAYER_STATUS.ready) {
      this.scene.onStart?.(this.scene, this.createLifecycleOptions())
      if (this.mountedStoryIds.size === 0) {
        return this.reject(
          'SCENE_STORY_NOT_FOUND',
          PLAYER_RUNTIME_ERROR_MESSAGE.mountedStoryRequired,
          'player:play'
        )
      }

      const syncResult = this.syncMountedRuntimePlan()
      if (!syncResult.ok) {
        return syncResult
      }

      this.director.start()
    } else {
      this.director.resume()
    }

    const rendererResult = this.status === PLAYER_STATUS.ready ? this.renderer.start() : this.renderer.resume()
    if (!rendererResult.ok) {
      return this.reject('RENDERER_INVALID_STATE', 'Renderer rejected play transition', 'player:play', {
        currentState: this.status,
        code: rendererResult.error.code
      })
    }

    this.playbackStartMs = this.runtimePlanner.resolveNowMs() - this.timelineMs
    this.setStatus(PLAYER_STATUS.playing)
    const currentTimelineMs = this.resolveCurrentTimelineMs()
    this.timelineMs = currentTimelineMs
    this.runDueTimelineEvents(currentTimelineMs)
    this.completePlaybackIfReachedEnd()
    if (this.playbackStartMs !== null) {
      this.startPlaybackLoop()
    }
    this.emitTrace('player:play', RUNTIME_TRACE_STATUS.applied, {
      startTimelineMs: this.timelineMs
    })
    return { ok: true }
  }

  /**
   * Pauses playback when player is currently playing.
   */
  async pause(): Promise<PlayerCommandResult> {
    if (!this.isInitialized()) {
      return this.reject('PLAYER_NOT_INITIALIZED', 'init must be called before pause', 'player:pause')
    }

    if (this.status !== PLAYER_STATUS.playing) {
      return this.reject('INVALID_PLAYER_STATE', 'pause is only allowed from playing', 'player:pause', {
        currentState: this.status
      })
    }

    this.director.pause()

    const rendererResult = this.renderer.pause()
    if (!rendererResult.ok) {
      return this.reject('RENDERER_INVALID_STATE', 'Renderer rejected pause transition', 'player:pause', {
        currentState: this.status,
        code: rendererResult.error.code
      })
    }

    this.timelineMs = this.resolveCurrentTimelineMs()
    this.playbackStartMs = null
    this.stopPlaybackLoop()
    this.setStatus(PLAYER_STATUS.paused)
    this.emitTrace('player:pause', RUNTIME_TRACE_STATUS.applied)
    return { ok: true }
  }

  /**
   * Injects one public event into runtime processing.
   */
  async emit(event: PlayerPublicEventInput): Promise<PlayerCommandResult> {
    if (!this.isInitialized()) {
      return this.reject('PLAYER_NOT_INITIALIZED', 'init must be called before emit', 'player:emit')
    }

    const timelineEvent = this.createTimelineEvent(event)
    this.runTimelineEvent(timelineEvent)
    this.emitTrace('player:emit', RUNTIME_TRACE_STATUS.applied, {
      eventId: timelineEvent.id,
      eventName: timelineEvent.name,
      eventMs: timelineEvent.ms,
      trackId: timelineEvent.trackId,
      payload: timelineEvent.payload,
      source: timelineEvent.source
    })

    return { ok: true }
  }

  /**
   * Seeks timeline to target position without forcing autoplay.
   */
  async seek(targetTimelineMs: number): Promise<PlayerCommandResult> {
    if (!this.isInitialized() || this.scene === null) {
      return this.reject('PLAYER_NOT_INITIALIZED', 'init must be called before seek', 'player:seek')
    }

    if (
      this.status !== PLAYER_STATUS.ready &&
      this.status !== PLAYER_STATUS.paused &&
      this.status !== PLAYER_STATUS.playing
    ) {
      return this.reject(
        'INVALID_PLAYER_STATE',
        'seek is only allowed from ready, paused, or playing',
        'player:seek',
        {
          currentState: this.status
        }
      )
    }

    if (this.mountedStoryIds.size === 0) {
      return this.reject(
        'SCENE_STORY_NOT_FOUND',
        PLAYER_RUNTIME_ERROR_MESSAGE.mountedStoryRequired,
        'player:seek'
      )
    }

    this.setStatus(PLAYER_STATUS.seeking)
    this.emitTrace('player:seek:started', RUNTIME_TRACE_STATUS.applied, {
      targetTimelineMs
    })

    this.playbackStartMs = null
    this.stopPlaybackLoop()

    const runtimePlan = this.createMountedRuntimePlan()
    if (runtimePlan === null) {
      return this.reject(
        'SCENE_STORY_NOT_FOUND',
        PLAYER_RUNTIME_ERROR_MESSAGE.mountedStoryRequired,
        'player:seek:failed',
        {
          sceneId: this.scene.id,
          targetTimelineMs
        }
      )
    }

    this.director.load(runtimePlan)
    this.timelineEndMs = this.runtimePlanner.resolveTimelineEndMsFromPlan(runtimePlan)

    const rendererLoadResult = this.renderer.load({ story: runtimePlan.story })
    if (!rendererLoadResult.ok) {
      return this.reject('RENDERER_LOAD_FAILED', 'Renderer failed to seek story', 'player:seek:failed', {
        sceneId: this.scene.id,
        targetTimelineMs,
        code: rendererLoadResult.error.code
      })
    }

    this.emitStateSnapshot()

    this.timelineMs = Math.min(this.runtimePlanner.clampTimelineMs(targetTimelineMs), this.timelineEndMs)

    this.director.start()
    const rendererStartResult = this.renderer.start()
    if (!rendererStartResult.ok) {
      return this.reject(
        'RENDERER_INVALID_STATE',
        'Renderer could not start for seek replay',
        'player:seek:failed',
        {
          sceneId: this.scene.id,
          targetTimelineMs,
          code: rendererStartResult.error.code
        }
      )
    }

    const eventMsByEventId = new Map<string, number>(
      this.director.getSortedEvents().map((event) => [event.id, event.ms])
    )

    const sortedEvents = this.director.getSortedEvents()
    for (const timelineEvent of sortedEvents) {
      if (timelineEvent.ms > this.timelineMs) {
        break
      }

      this.renderer.syncAnimationsToTimeline(timelineEvent.ms, eventMsByEventId)
      this.runTimelineEvent(timelineEvent)
    }

    this.trackManager.syncCursor({ nowMs: this.timelineMs })
    this.renderer.syncAnimationsToTimeline(this.timelineMs, eventMsByEventId)

    this.director.pause()
    const rendererPauseResult = this.renderer.pause()
    if (!rendererPauseResult.ok) {
      return this.reject(
        'RENDERER_INVALID_STATE',
        'Renderer could not pause after seek replay',
        'player:seek:failed',
        {
          sceneId: this.scene.id,
          targetTimelineMs,
          code: rendererPauseResult.error.code
        }
      )
    }

    this.setStatus(PLAYER_STATUS.paused)
    this.emitTrace('player:seek:done', RUNTIME_TRACE_STATUS.applied, {
      targetTimelineMs: this.timelineMs
    })

    return { ok: true }
  }

  /**
   * Rewinds timeline to zero while preserving playback intent.
   */
  async rewind(): Promise<PlayerCommandResult> {
    if (!this.isInitialized() || this.scene === null) {
      return this.reject('PLAYER_NOT_INITIALIZED', 'init must be called before rewind', 'player:rewind')
    }

    if (
      this.status !== PLAYER_STATUS.ready &&
      this.status !== PLAYER_STATUS.paused &&
      this.status !== PLAYER_STATUS.playing
    ) {
      return this.reject(
        'INVALID_PLAYER_STATE',
        'rewind is only allowed from ready, paused, or playing',
        'player:rewind',
        {
          currentState: this.status
        }
      )
    }

    if (this.mountedStoryIds.size === 0) {
      return this.reject(
        'SCENE_STORY_NOT_FOUND',
        PLAYER_RUNTIME_ERROR_MESSAGE.mountedStoryRequired,
        'player:rewind'
      )
    }

    const previousStatus = this.status
    this.setStatus(PLAYER_STATUS.rewinding)
    this.emitTrace('player:rewind:started', RUNTIME_TRACE_STATUS.applied)

    this.timelineMs = 0
    this.playbackStartMs = null
    this.stopPlaybackLoop()

    const runtimePlan = this.createMountedRuntimePlan()
    if (runtimePlan === null) {
      return this.reject(
        'SCENE_STORY_NOT_FOUND',
        PLAYER_RUNTIME_ERROR_MESSAGE.mountedStoryRequired,
        'player:rewind:failed'
      )
    }

    this.director.load(runtimePlan)
    this.timelineEndMs = this.runtimePlanner.resolveTimelineEndMsFromPlan(runtimePlan)

    const rendererLoadResult = this.renderer.load({ story: runtimePlan.story })
    if (!rendererLoadResult.ok) {
      return this.reject('RENDERER_LOAD_FAILED', 'Renderer failed to rewind story', 'player:rewind:failed', {
        sceneId: this.scene.id,
        code: rendererLoadResult.error.code
      })
    }

    if (previousStatus === PLAYER_STATUS.playing || previousStatus === PLAYER_STATUS.paused) {
      this.director.start()

      const rendererStartResult = this.renderer.start()
      if (!rendererStartResult.ok) {
        return this.reject(
          'RENDERER_INVALID_STATE',
          'Renderer could not restore state after rewind',
          'player:rewind:failed',
          {
            sceneId: this.scene.id,
            code: rendererStartResult.error.code,
            previousStatus
          }
        )
      }

      if (previousStatus === PLAYER_STATUS.paused) {
        this.director.pause()

        const rendererPauseResult = this.renderer.pause()
        if (!rendererPauseResult.ok) {
          return this.reject(
            'RENDERER_INVALID_STATE',
            'Renderer could not restore paused state after rewind',
            'player:rewind:failed',
            {
              sceneId: this.scene.id,
              code: rendererPauseResult.error.code
            }
          )
        }
      }
    }

    this.trackManager.syncCursor({ nowMs: this.timelineMs })

    if (previousStatus === PLAYER_STATUS.playing) {
      this.playbackStartMs = this.runtimePlanner.resolveNowMs()
      this.runDueTimelineEvents(this.timelineMs)
      this.startPlaybackLoop()
    }

    this.setStatus(previousStatus)
    const rendererState = this.renderer.getState()
    this.emitTrace('player:rewind:done', RUNTIME_TRACE_STATUS.applied, {
      targetTimelineMs: 0,
      runtimeRevision: rendererState.runtimeRevision
    })

    return { ok: true }
  }

  /**
   * Rebuilds runtime according to runtime policy constraints.
   */
  async rebuild(mode: RebuildMode = 'state'): Promise<PlayerCommandResult> {
    if (!this.isInitialized() || this.scene === null || this.mountedStoryIds.size === 0) {
      return this.reject('PLAYER_NOT_INITIALIZED', 'init must be called before rebuild', 'player:rebuild')
    }

    if (!this.runtimePolicy.allowedRebuildModes.includes(mode)) {
      return this.reject(
        'MODE_NOT_ALLOWED_BY_POLICY',
        'Requested rebuild mode is not allowed by policy',
        'player:rebuild',
        {
          mode,
          allowedModes: this.runtimePolicy.allowedRebuildModes
        }
      )
    }

    const previousStatus = this.status
    this.setStatus(PLAYER_STATUS.seeking)
    this.emitTrace('player:rebuild:started', RUNTIME_TRACE_STATUS.applied, {
      mode
    })

    if (mode === 'full') {
      const runtimePlan = this.createMountedRuntimePlan()
      if (runtimePlan === null) {
        return this.reject(
          'SCENE_STORY_NOT_FOUND',
          PLAYER_RUNTIME_ERROR_MESSAGE.mountedStoryRequired,
          'player:rebuild:failed',
          {
            sceneId: this.scene.id,
            mode
          }
        )
      }

      this.director.load(runtimePlan)
      this.timelineEndMs = this.runtimePlanner.resolveTimelineEndMsFromPlan(runtimePlan)

      const rendererLoadResult = this.renderer.load({ story: runtimePlan.story })
      if (!rendererLoadResult.ok) {
        return this.reject(
          'RENDERER_LOAD_FAILED',
          'Renderer failed to rebuild story',
          'player:rebuild:failed',
          {
            sceneId: this.scene.id,
            mode,
            code: rendererLoadResult.error.code
          }
        )
      }

      if (previousStatus === PLAYER_STATUS.playing || previousStatus === PLAYER_STATUS.paused) {
        this.director.start()

        const rendererStartResult = this.renderer.start()
        if (!rendererStartResult.ok) {
          return this.reject(
            'RENDERER_INVALID_STATE',
            'Renderer could not resume after full rebuild',
            'player:rebuild:failed',
            {
              sceneId: this.scene.id,
              mode,
              code: rendererStartResult.error.code
            }
          )
        }

        if (previousStatus === PLAYER_STATUS.paused) {
          this.director.pause()

          const rendererPauseResult = this.renderer.pause()
          if (!rendererPauseResult.ok) {
            return this.reject(
              'RENDERER_INVALID_STATE',
              'Renderer could not restore paused state after full rebuild',
              'player:rebuild:failed',
              {
                sceneId: this.scene.id,
                mode,
                code: rendererPauseResult.error.code
              }
            )
          }
        }

        if (previousStatus === PLAYER_STATUS.playing) {
          this.runDueTimelineEvents(this.timelineMs)
          this.startPlaybackLoop()
        }
      }
    }

    this.trackManager.syncCursor({ nowMs: this.timelineMs })
    this.setStatus(previousStatus)
    const rendererState = this.renderer.getState()

    this.emitTrace('player:rebuild:done', RUNTIME_TRACE_STATUS.applied, {
      mode,
      runtimeRevision: rendererState.runtimeRevision
    })

    return { ok: true }
  }

  /**
   * Returns one immutable snapshot of current player state.
   */
  getState(): PlayerStateSnapshot {
    const rendererState = this.renderer.getState()

    return {
      status: this.status,
      initialized: this.isInitialized(),
      sceneId: this.scene?.id,
      timelineMs: this.resolveCurrentTimelineMs(),
      runtimeRevision: rendererState.runtimeRevision
    }
  }

  /**
   * Updates internal player status and notifies state subscribers.
   */
  private setStatus(nextStatus: PlayerStatus): void {
    if (this.status === nextStatus) {
      return
    }

    this.status = nextStatus
    this.emitStateSnapshot()
  }

  /**
   * Emits one state snapshot to all state subscribers.
   */
  private emitStateSnapshot(): void {
    const snapshot = this.getState()
    for (const listener of this.stateListeners) {
      listener(snapshot)
    }
  }

  /**
   * Emits one runtime trace row and forwards it to trace subscribers.
   */
  private emitTrace(
    eventName: string,
    statusValue: RuntimeTraceStatus,
    payload?: Record<string, unknown>
  ): RuntimeTraceRow {
    const row = this.traceStore.append({
      scope: 'player',
      eventName,
      status: statusValue,
      payload
    })

    for (const listener of this.traceListeners) {
      listener(row)
    }

    return row
  }

  /**
   * Builds one rejected command result and emits associated trace.
   */
  private reject(
    code: string,
    message: string,
    eventName: string,
    details?: Record<string, unknown>
  ): PlayerCommandResult {
    this.emitTrace(eventName, RUNTIME_TRACE_STATUS.rejected, {
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
   * Subscribes to trace rows emitted by player commands.
   */
  onTrace(listener: PlayerTraceListener): () => void {
    this.traceListeners.add(listener)
    return () => {
      this.traceListeners.delete(listener)
    }
  }

  /**
   * Subscribes to player state changes.
   */
  onStateChange(listener: PlayerStateListener): () => void {
    this.stateListeners.add(listener)
    return () => {
      this.stateListeners.delete(listener)
    }
  }
}

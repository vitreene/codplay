import type { ApiResult, CompiledScene, ResourceManifest } from '../builder/types'
import { RUNTIME_EVENT_SOURCE } from '../core/events/constants'
import type { RuntimeTraceRow } from '../runtime/trace-store'
import type { PlayerStateListener, PlayerStateSnapshot } from './types'
import { PlayerFacade, type CreatePlayerOptions } from './create-player'
import { PlayerScheduleFacade, type StrapHelpers, type StoryEvent } from './player-schedule'
import { createRuntimeEventPolicy, type ResolvedRuntimeEventPolicy, type RuntimeEventPolicy } from './runtime-policy'
import type { RuntimeEventSource } from '../core/events/types'
import type { StrapCollection, StrapExecutionScope, StrapOutput } from './strap-types'

export type PlayerInitInput = {
  mountTarget: unknown
  compiledScene: CompiledScene
  resourceManifest?: ResourceManifest
  runtimePolicy?: RuntimeEventPolicy
  strapCollection?: StrapCollection
}

export type PlayerScheduleApi = StrapHelpers

export type PlayerApi = {
  init: (input: PlayerInitInput) => Promise<ApiResult<void>>
  play: () => Promise<ApiResult<void>>
  pause: () => Promise<ApiResult<void>>
  resume: () => Promise<ApiResult<void>>
  stop: () => Promise<ApiResult<void>>
  destroy: () => Promise<ApiResult<void>>
  seek: (input: { timelineMs: number }) => Promise<ApiResult<void>>
  emit: (input: StoryEvent) => Promise<ApiResult<void>>
  getState: () => PlayerStateSnapshot
  onChange: (listener: PlayerStateListener) => () => void
  onTrace: (listener: (row: RuntimeTraceRow) => void) => () => void
  schedule: PlayerScheduleApi
}

/**
 * Adapts the internal player facade to the public compiled-scene contract.
 */
export class Player implements PlayerApi {
  private readonly player: PlayerFacade
  private readonly scheduleRuntime: PlayerScheduleFacade
  private runtimePolicy: ResolvedRuntimeEventPolicy = createRuntimeEventPolicy()
  private currentScene: CompiledScene['scene'] | null = null
  private strapCollection: StrapCollection = {}
  private readonly strapLoopSchedulers = new Set<PlayerScheduleFacade>()
  private readonly generatedHelperTrackIds = new Set<string>()
  private nextStrapHelperIndex = 1
  private initialSceneState: Record<string, unknown> | undefined
  private initialStoryStateById = new Map<string, Record<string, unknown> | undefined>()

  readonly schedule: PlayerScheduleApi

  private static readonly LIFECYCLE_EVENT = {
    sceneReady: 'scene:ready',
    sceneStart: 'scene:start',
    sceneEnd: 'scene:end'
  } as const

  /**
   * Keeps the public scheduler surface stable for runtime helpers.
   */
  constructor(options: CreatePlayerOptions = {}) {
    this.player = new PlayerFacade({
      ...options,
      onTimelineEvent: async (event) => {
        return this.routeTimelineEvent(event)
      },
      onRuntimeEmit: (event) => {
        void this.routeSceneEvent(
          {
            name: event.name,
            data: event.payload,
            cascade: event.cascade
          },
          event.source ?? RUNTIME_EVENT_SOURCE.user,
          event.scopeStoryId
        )
      }
    })
    this.scheduleRuntime = new PlayerScheduleFacade({
      emitEvent: async (event) => {
        await this.routeSceneEvent(event, RUNTIME_EVENT_SOURCE.system)
      }
    })
    this.schedule = this.scheduleRuntime
  }

  /**
   * Initializes one compiled scene through the internal player facade.
   */
  async init(input: PlayerInitInput): Promise<ApiResult<void>> {
    void input.mountTarget
    void input.resourceManifest

    this.runtimePolicy = createRuntimeEventPolicy(input.runtimePolicy)
    this.scheduleRuntime.configurePolicy(this.runtimePolicy)

    this.currentScene = input.compiledScene.scene
    this.strapCollection = input.strapCollection ?? {}
    this.nextStrapHelperIndex = 1
    this.generatedHelperTrackIds.clear()
    this.destroyStrapLoopSchedulers()
    this.scheduleRuntime.reset()
    const initResult = this.normalizeResult(await this.player.init(input.compiledScene.scene))
    if (!initResult.ok) {
      return initResult
    }

    const readyResult = await this.routeSceneEvent({ name: Player.LIFECYCLE_EVENT.sceneReady }, RUNTIME_EVENT_SOURCE.system)
    if (readyResult.ok) {
      this.captureInitialAuthorState()
    }

    return readyResult
  }

  /**
   * Starts playback.
   */
  play(): Promise<ApiResult<void>> {
    if (this.player.getState().sequenceEnded) {
      this.destroyStrapLoopSchedulers()
      this.resetAuthorState()
    }

    return this.normalizeAsyncResult(this.player.play(), async () => {
      this.scheduleRuntime.resume()
      this.resumeStrapLoopSchedulers()
      await this.routeSceneEvent({ name: Player.LIFECYCLE_EVENT.sceneStart }, RUNTIME_EVENT_SOURCE.system)
    })
  }

  /**
   * Pauses playback.
   */
  pause(): Promise<ApiResult<void>> {
    return this.normalizeAsyncResult(this.player.pause(), () => {
      this.scheduleRuntime.pause()
      this.pauseStrapLoopSchedulers()
    })
  }

  /**
   * Resumes playback using the same internal play path.
   */
  resume(): Promise<ApiResult<void>> {
    return this.normalizeAsyncResult(this.player.play(), async () => {
      this.scheduleRuntime.resume()
      this.resumeStrapLoopSchedulers()
      await this.routeSceneEvent({ name: Player.LIFECYCLE_EVENT.sceneStart }, RUNTIME_EVENT_SOURCE.system)
    })
  }

  /**
   * Stops playback without tearing down the runtime.
   */
  stop(): Promise<ApiResult<void>> {
    return this.normalizeAsyncResult(this.player.pause(), async () => {
      await this.routeSceneEvent({ name: Player.LIFECYCLE_EVENT.sceneEnd }, RUNTIME_EVENT_SOURCE.system)
      this.scheduleRuntime.stop()
      this.destroyStrapLoopSchedulers()
    })
  }

  /**
   * Destroys the player runtime.
   */
  destroy(): Promise<ApiResult<void>> {
    return this.normalizeAsyncResult(this.player.destroy(), async () => {
      await this.routeSceneEvent({ name: Player.LIFECYCLE_EVENT.sceneEnd }, RUNTIME_EVENT_SOURCE.system)
      this.scheduleRuntime.destroy()
      this.destroyStrapLoopSchedulers()
      this.currentScene = null
      this.strapCollection = {}
    })
  }

  /**
   * Seeks the current timeline.
   */
  seek(input: { timelineMs: number }): Promise<ApiResult<void>> {
    this.destroyStrapLoopSchedulers()
    return (async () => {
      if (this.player.getState().status === 'playing') {
        const pauseResult = await this.pause()
        if (!pauseResult.ok) {
          return pauseResult
        }
      }

      const helperTrackResetResult = await this.deactivateGeneratedHelperTracks()
      if (!helperTrackResetResult.ok) {
        return helperTrackResetResult
      }

      this.resetAuthorState()

      return this.normalizeResult(await this.player.seek(input.timelineMs))
    })()
  }

  /**
   * Emits one public runtime event.
   */
  emit(input: StoryEvent): Promise<ApiResult<void>> {
    return this.routeSceneEvent(input, RUNTIME_EVENT_SOURCE.user)
  }

  /**
   * Returns one public player state snapshot.
   */
  getState(): PlayerStateSnapshot {
    return this.player.getState()
  }

  /**
   * Exposes the internal runtime registry for integration checks.
   */
  getRuntimeRegistry(): ReturnType<PlayerFacade['getRuntimeRegistry']> {
    return this.player.getRuntimeRegistry()
  }

  /**
   * Subscribes to player state changes.
   */
  onChange(listener: PlayerStateListener): () => void {
    return this.player.onStateChange(listener)
  }

  /**
   * Subscribes to player trace rows.
   */
  onTrace(listener: (row: RuntimeTraceRow) => void): () => void {
    return this.player.onTrace(listener)
  }

  /**
   * Converts one internal player result into one public API result.
   */
  private normalizeResult(result: Awaited<ReturnType<PlayerFacade['init']>>): ApiResult<void> {
    if (!result.ok) {
      return result
    }

    return { ok: true, data: undefined }
  }

  /**
   * Converts one asynchronous internal player result into one public API result.
   */
  private async normalizeAsyncResult(
    resultPromise: Promise<Awaited<ReturnType<PlayerFacade['play']>>>,
    afterSuccess?: () => void | Promise<void>
  ): Promise<ApiResult<void>> {
    const result = this.normalizeResult(await resultPromise)
    if (result.ok) {
      await afterSuccess?.()
    }

    return result
  }

  /**
   * Resumes all active local loop schedulers.
   */
  private resumeStrapLoopSchedulers(): void {
    for (const scheduler of this.strapLoopSchedulers) {
      scheduler.resume()
    }
  }

  /**
   * Pauses all active local loop schedulers.
   */
  private pauseStrapLoopSchedulers(): void {
    for (const scheduler of this.strapLoopSchedulers) {
      scheduler.pause()
    }
  }

  /**
   * Destroys all active local loop schedulers.
   */
  private destroyStrapLoopSchedulers(): void {
    for (const scheduler of this.strapLoopSchedulers) {
      scheduler.destroy()
    }

    this.strapLoopSchedulers.clear()
  }

  /**
   * Deactivates all currently known helper-generated tracks before one seek rebuild.
   */
  private async deactivateGeneratedHelperTracks(): Promise<ApiResult<void>> {
    if (this.generatedHelperTrackIds.size === 0) {
      return { ok: true, data: undefined }
    }

    const trackIds = [...this.generatedHelperTrackIds]
    this.generatedHelperTrackIds.clear()

    return this.normalizeResult(await this.player.emit({
      name: 'track:deactivate',
      payload: { trackIds },
      source: RUNTIME_EVENT_SOURCE.system
    }))
  }

  /**
   * Clones one author-facing state payload when present.
   */
  private cloneState<T>(value: T): T {
    if (value === undefined) {
      return value
    }

    if (typeof globalThis.structuredClone === 'function') {
      return globalThis.structuredClone(value)
    }

    return JSON.parse(JSON.stringify(value)) as T
  }

  /**
   * Captures the stable author state baseline used by seek/replay reconstruction.
   */
  private captureInitialAuthorState(): void {
    if (this.currentScene === null) {
      return
    }

    this.initialSceneState = this.cloneState(this.currentScene.state)
    this.initialStoryStateById.clear()

    for (const [storyId, story] of Object.entries(this.currentScene.stories)) {
      this.initialStoryStateById.set(storyId, this.cloneState(story.state))
    }
  }

  /**
   * Restores author-visible scene/story state to the last stable baseline.
   */
  private resetAuthorState(): void {
    if (this.currentScene === null) {
      return
    }

    this.currentScene.state = this.cloneState(this.initialSceneState)
    for (const [storyId, story] of Object.entries(this.currentScene.stories)) {
      story.state = this.cloneState(this.initialStoryStateById.get(storyId))
    }
  }

  /**
   * Routes one timeline event emitted by the low-level player through the author pipeline.
   */
  private routeTimelineEvent(event: {
    name: string
    payload?: Record<string, unknown>
    scopeStoryId?: string
    source?: RuntimeEventSource
    ms?: number
    trackId?: string
    cascade?: boolean
  }): Promise<ApiResult<void>> {
    return this.routeSceneEvent(
      {
        name: event.name,
        data: event.payload,
        cascade: event.cascade
      },
      event.source ?? RUNTIME_EVENT_SOURCE.story,
      event.scopeStoryId,
      0,
      {
        scopeStoryId: event.scopeStoryId,
        source: event.source ?? RUNTIME_EVENT_SOURCE.story,
        ms: event.ms ?? this.player.getState().timelineMs,
        trackId: event.trackId
      }
    )
  }

  /**
   * Resolves the mutable state bucket targeted by one listen rule execution.
   */
  private resolveStateTarget(scopeStoryId: string | undefined): Record<string, unknown> {
    const scene = this.currentScene
    if (scene === null) {
      return {}
    }

    if (scopeStoryId !== undefined) {
      const story = scene.stories[scopeStoryId]
      if (story) {
        story.state = typeof story.state === 'object' && story.state !== null ? story.state : {}
        return story.state
      }
    }

    scene.state = typeof scene.state === 'object' && scene.state !== null ? scene.state : {}
    return scene.state
  }

  /**
   * Applies one shallow patch onto the targeted listen execution state.
   */
  private applyStatePatch(scopeStoryId: string | undefined, patch: Record<string, unknown>): void {
    const state = this.resolveStateTarget(scopeStoryId)
    Object.assign(state, patch)
  }

  /**
   * Creates one deterministic helper track identifier.
   */
  private createHelperTrackId(scopeStoryId: string | undefined, eventName: string): string {
    const scopeKey = scopeStoryId ?? 'scene'
    const trackId = `strap-${scopeKey}-${eventName}-${this.nextStrapHelperIndex}`
    this.nextStrapHelperIndex += 1
    return trackId
  }

  /**
   * Places one finite helper event batch into the runtime sequence on a dedicated track.
   */
  private placeHelperEvents(
    trackId: string,
    scope: StrapExecutionScope,
    events: Array<{ offsetMs: number; event: StoryEvent }>
  ): ApiResult<void> {
    const sourceTrackMeta = this.player.getTrackMeta(scope.trackId ?? (scope.scopeStoryId ?? 'global'))
    const ensureResult = this.player.ensureRuntimeTrack({
      trackId,
      order: sourceTrackMeta?.order ?? 0,
      source: RUNTIME_EVENT_SOURCE.system,
      active: true
    })
    if (!ensureResult.ok) {
      return ensureResult
    }

    const appendResult = this.player.appendGeneratedEvents({
      trackId,
      events: events.map(({ offsetMs, event }, index) => ({
        id: `evt-${trackId}-${index}`,
        ms: Math.max(0, scope.ms + offsetMs),
        name: event.name,
        payload: event.data,
        scopeStoryId: event.cascade === true ? undefined : scope.scopeStoryId,
        index,
        source: RUNTIME_EVENT_SOURCE.system,
        trackId
      }))
    })

    if (!appendResult.ok) {
      return appendResult
    }

    return { ok: true, data: undefined }
  }

  /**
   * Creates the helper facade exposed to one strap execution.
   */
  private createStrapHelpers(scope: StrapExecutionScope): StrapHelpers {
    const validateNonNegative = (value: number): void => {
      if (!Number.isFinite(value) || value < 0) {
        throw new Error('AUTHOR_HELPER_INVALID_ARG')
      }
    }

    return {
      delay: (ms, event) => {
        validateNonNegative(ms)
        const trackId = this.createHelperTrackId(scope.scopeStoryId, event.name)
        const placementResult = this.placeHelperEvents(trackId, scope, [{ offsetMs: ms, event }])
        if (!placementResult.ok) {
          throw new Error(placementResult.error.code)
        }
        this.generatedHelperTrackIds.add(trackId)
        return {
          id: trackId,
          cancel: () => {
            this.generatedHelperTrackIds.delete(trackId)
            void this.player.emit({
              name: 'track:deactivate',
              payload: { trackIds: [trackId] },
              source: RUNTIME_EVENT_SOURCE.system
            })
          }
        }
      },
      repeat: (options, factory) => {
        validateNonNegative(options.everyMs)
        if (!Number.isFinite(options.times) || options.times < 1) {
          throw new Error('AUTHOR_HELPER_INVALID_ARG')
        }
        const trackId = this.createHelperTrackId(scope.scopeStoryId, 'repeat')
        const events = Array.from({ length: options.times }).flatMap((_, index) =>
          factory(index).map((event, eventIndex) => ({
            offsetMs: index * options.everyMs + eventIndex,
            event
          }))
        )
        const placementResult = this.placeHelperEvents(trackId, scope, events)
        if (!placementResult.ok) {
          throw new Error(placementResult.error.code)
        }
        this.generatedHelperTrackIds.add(trackId)
        return {
          id: trackId,
          cancel: () => {
            this.generatedHelperTrackIds.delete(trackId)
            void this.player.emit({
              name: 'track:deactivate',
              payload: { trackIds: [trackId] },
              source: RUNTIME_EVENT_SOURCE.system
            })
          }
        }
      },
      loop: (options, factory) => {
        validateNonNegative(options.everyMs)
        const scheduler = new PlayerScheduleFacade({
          emitEvent: async (event) => {
            await this.routeSceneEvent(event, RUNTIME_EVENT_SOURCE.system, scope.scopeStoryId, 0, {
              ...scope,
              ms: this.player.getState().timelineMs
            })
          }
        })
        this.strapLoopSchedulers.add(scheduler)
        const handle = scheduler.loop(options, factory)
        if (this.player.getState().status === 'playing') {
          scheduler.resume()
        }
        return {
          id: handle.id,
          cancel: () => {
            handle.cancel()
            scheduler.destroy()
            this.strapLoopSchedulers.delete(scheduler)
          }
        }
      },
      stagger: (options, events) => {
        validateNonNegative(options.stepMs)
        return events.map((event, index) => this.createStrapHelpers(scope).delay(index * options.stepMs, event))
      }
    }
  }

  /**
   * Executes one strap by name and routes all its outputs.
   */
  private async executeStrap(
    strapName: string,
    event: StoryEvent,
    scope: StrapExecutionScope,
    depth: number
  ): Promise<ApiResult<void>> {
    const strap = this.strapCollection[strapName]
    if (!strap) {
      return { ok: true, data: undefined }
    }

    const output = await strap({
      event,
      state: this.resolveStateTarget(scope.scopeStoryId),
      meta: {
        originEventName: event.name,
        origin:
          typeof event.data?.self === 'object' && event.data.self !== null
            ? {
                persoId: typeof (event.data.self as { id?: unknown }).id === 'string'
                  ? ((event.data.self as { id: string }).id)
                  : undefined
              }
            : undefined
      },
      context: {
        api: {},
        helpers: this.createStrapHelpers(scope)
      }
    })

    const resolvedOutput: StrapOutput = output ?? {}
    if (resolvedOutput.update) {
      this.applyStatePatch(scope.scopeStoryId, resolvedOutput.update)
    }

    for (const emittedEvent of resolvedOutput.events ?? []) {
      const nextScopeStoryId = emittedEvent.cascade === true ? undefined : scope.scopeStoryId
      const childResult = await this.routeSceneEvent(
        emittedEvent,
        RUNTIME_EVENT_SOURCE.system,
        nextScopeStoryId,
        depth + 1,
        {
          ...scope,
          scopeStoryId: nextScopeStoryId
        }
      )

      if (!childResult.ok) {
        return childResult
      }
    }

    return { ok: true, data: undefined }
  }

  /**
   * Routes one scene event through scene.listen before falling back to runtime emission.
   */
  private async routeSceneEvent(
    event: StoryEvent,
    source: RuntimeEventSource,
    scopeStoryId?: string,
    depth = 0,
    scope: StrapExecutionScope = {
      scopeStoryId,
      source,
      ms: this.player.getState().timelineMs
    }
  ): Promise<ApiResult<void>> {
    if (depth > this.runtimePolicy.maxCascadeDepth) {
      return { ok: true, data: undefined }
    }

    const scene = this.currentScene
    if (scene === null) {
      return this.emitRuntimeEvent(event, source, scopeStoryId, scope.ms)
    }

    const isLocalStoryEvent = scopeStoryId !== undefined && event.cascade !== true

    if (isLocalStoryEvent) {
      const story = scene.stories[scopeStoryId]
      const storyRules = story?.listen.filter((rule) => rule.on === event.name) ?? []
      if (storyRules.length > 0) {
        return this.routeMatchingRules(storyRules, event, source, scopeStoryId, depth, scope)
      }

      return this.emitRuntimeEvent(event, source, scopeStoryId, scope.ms)
    }

    const sceneRules = scene.listen.filter((rule) => rule.on === event.name)
    if (sceneRules.length > 0) {
      return this.routeMatchingRules(sceneRules, event, source, undefined, depth, {
        ...scope,
        scopeStoryId: undefined
      })
    }

    return this.emitRuntimeEvent(event, source, undefined, scope.ms)
  }

  /**
   * Routes one matching listen rule set and reinjects emitted events.
   */
  private async routeMatchingRules(
    rules: NonNullable<CompiledScene['scene']>['listen'],
    event: StoryEvent,
    source: RuntimeEventSource,
    scopeStoryId: string | undefined,
    depth: number,
    scope: StrapExecutionScope
  ): Promise<ApiResult<void>> {
    const emittedEvents: StoryEvent[] = []
    for (const rule of rules) {
      for (const strapName of rule.straps ?? []) {
        const strapResult = await this.executeStrap(strapName, event, scope, depth)
        if (!strapResult.ok) {
          return strapResult
        }
      }
      emittedEvents.push(...(rule.emit ?? []).map((emittedEvent) => ({
        name: emittedEvent.name,
        data: emittedEvent.data,
        cascade: emittedEvent.cascade
      })))
    }

    if (emittedEvents.length === 0) {
      return this.emitRuntimeEvent(event, source, scopeStoryId, scope.ms)
    }

    for (const emittedEvent of emittedEvents) {
      const nextScopeStoryId = emittedEvent.cascade === true ? undefined : scopeStoryId
      const childResult = await this.routeSceneEvent(
        {
          name: emittedEvent.name,
          data: emittedEvent.data,
          cascade: emittedEvent.cascade
        },
        RUNTIME_EVENT_SOURCE.system,
        nextScopeStoryId,
        depth + 1,
        {
          ...scope,
          scopeStoryId: nextScopeStoryId
        }
      )

      if (!childResult.ok) {
        return childResult
      }
    }

    return { ok: true, data: undefined }
  }

  /**
   * Emits one routed event into the internal runtime facade.
   */
  private async emitRuntimeEvent(
    event: StoryEvent,
    source: RuntimeEventSource,
    scopeStoryId?: string,
    ms?: number
  ): Promise<ApiResult<void>> {
    const result = this.normalizeResult(
      await this.player.emit({
        name: event.name,
        ms,
        payload: event.data,
        scopeStoryId,
        cascade: event.cascade,
        source
      })
    )

    if (result.ok && event.name === 'sequence:end') {
      this.destroyStrapLoopSchedulers()
    }

    return result
  }
}

import type { ApiResult, CompiledScene, ResourceManifest } from '../builder/types'
import { RUNTIME_EVENT_SOURCE } from '../core/events/constants'
import type { RuntimeTraceRow } from '../runtime/trace-store'
import type { PlayerStateListener, PlayerStateSnapshot } from './types'
import { PlayerFacade, type CreatePlayerOptions } from './create-player'
import { PlayerScheduleFacade, type StrapHelpers, type StoryEvent } from './player-schedule'
import { createRuntimeEventPolicy, type ResolvedRuntimeEventPolicy, type RuntimeEventPolicy } from './runtime-policy'
import type { RuntimeEventSource } from '../core/events/types'

export type PlayerInitInput = {
  mountTarget: unknown
  compiledScene: CompiledScene
  resourceManifest?: ResourceManifest
  runtimePolicy?: RuntimeEventPolicy
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
    this.scheduleRuntime.reset()
    const initResult = this.normalizeResult(await this.player.init(input.compiledScene.scene))
    if (!initResult.ok) {
      return initResult
    }

    return this.routeSceneEvent({ name: Player.LIFECYCLE_EVENT.sceneReady }, RUNTIME_EVENT_SOURCE.system)
  }

  /**
   * Starts playback.
   */
  play(): Promise<ApiResult<void>> {
    return this.normalizeAsyncResult(this.player.play(), async () => {
      this.scheduleRuntime.resume()
      await this.routeSceneEvent({ name: Player.LIFECYCLE_EVENT.sceneStart }, RUNTIME_EVENT_SOURCE.system)
    })
  }

  /**
   * Pauses playback.
   */
  pause(): Promise<ApiResult<void>> {
    return this.normalizeAsyncResult(this.player.pause(), () => this.scheduleRuntime.pause())
  }

  /**
   * Resumes playback using the same internal play path.
   */
  resume(): Promise<ApiResult<void>> {
    return this.normalizeAsyncResult(this.player.play(), async () => {
      this.scheduleRuntime.resume()
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
    })
  }

  /**
   * Destroys the player runtime.
   */
  destroy(): Promise<ApiResult<void>> {
    return this.normalizeAsyncResult(this.player.destroy(), async () => {
      await this.routeSceneEvent({ name: Player.LIFECYCLE_EVENT.sceneEnd }, RUNTIME_EVENT_SOURCE.system)
      this.scheduleRuntime.destroy()
      this.currentScene = null
    })
  }

  /**
   * Seeks the current timeline.
   */
  seek(input: { timelineMs: number }): Promise<ApiResult<void>> {
    return this.normalizeAsyncResult(this.player.seek(input.timelineMs))
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
   * Routes one scene event through scene.listen before falling back to runtime emission.
   */
  private async routeSceneEvent(
    event: StoryEvent,
    source: RuntimeEventSource,
    scopeStoryId?: string,
    depth = 0
  ): Promise<ApiResult<void>> {
    if (depth > this.runtimePolicy.maxCascadeDepth) {
      return { ok: true, data: undefined }
    }

    const scene = this.currentScene
    if (scene === null) {
      return this.emitRuntimeEvent(event, source, scopeStoryId)
    }

    const isLocalStoryEvent = scopeStoryId !== undefined && event.cascade !== true

    if (isLocalStoryEvent) {
      const story = scene.stories[scopeStoryId]
      const storyRules = story?.listen.filter((rule) => rule.on === event.name) ?? []
      if (storyRules.length > 0) {
        return this.routeMatchingRules(storyRules, event, source, scopeStoryId, depth)
      }

      return this.emitRuntimeEvent(event, source, scopeStoryId)
    }

    const sceneRules = scene.listen.filter((rule) => rule.on === event.name)
    if (sceneRules.length > 0) {
      return this.routeMatchingRules(sceneRules, event, source, undefined, depth)
    }

    return this.emitRuntimeEvent(event, source, undefined)
  }

  /**
   * Routes one matching listen rule set and reinjects emitted events.
   */
  private async routeMatchingRules(
    rules: NonNullable<CompiledScene['scene']>['listen'],
    event: StoryEvent,
    source: RuntimeEventSource,
    scopeStoryId: string | undefined,
    depth: number
  ): Promise<ApiResult<void>> {
    const emittedEvents = rules.flatMap((rule) => rule.emit ?? [])
    if (emittedEvents.length === 0) {
      return this.emitRuntimeEvent(event, source, scopeStoryId)
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
        depth + 1
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
    scopeStoryId?: string
  ): Promise<ApiResult<void>> {
    return this.normalizeResult(
      await this.player.emit({
        name: event.name,
        payload: event.data,
        scopeStoryId,
        cascade: event.cascade,
        source
      })
    )
  }
}

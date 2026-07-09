import type { ApiResult, CompiledScene, ResourceManifest } from '../builder/types'
import { createPreloadModule } from '../preload/create-preload-module'
import { RUNTIME_EVENT_SOURCE } from '../core/events/constants'
import type { RuntimeTraceRow } from '../runtime/trace-store'
import {
  isValidHelperDelayMs,
  isValidHelperRepeatOptions,
  isValidHelperStaggerOptions,
  planRepeatItems,
  planStaggerItems,
  planWaitItems
} from './helper-finite-core'
import { hasEventLoopStop, resolvePlannableLoopTimes } from './helper-loop-core'
import { resolveStrapStepInput } from './helper-input'
import { planGenericSequenceSteps } from './action-sequence'
import { resolveHelperMode } from './helper-mode'
import type { DeepReadonly, StoryEvent } from './helper-types'
import type { PlayerEmitInput, PlayerStateListener, PlayerStateSnapshot } from './types'
import { PlayerFacade, type CreatePlayerOptions } from './create-player'
import { PlayerScheduleFacade, type StrapHelpers as RuntimeScheduleHelpers } from './player-schedule'
import { createRuntimeEventPolicy, type ResolvedRuntimeEventPolicy, type RuntimeEventPolicy } from './runtime-policy'
import type { RuntimeEventSource } from '../core/events/types'
import { PLAYER_STATUS } from './player-constants'
import type {
  LiveStrapHelpers,
  PlannedStrapHelpers,
  PlannedStrapOccurrence,
  StrapCollection,
  StrapContext,
  StrapExecutionScope,
  StrapFn,
  StrapReturnValue,
  StrapRuntimeOutput,
  StrapStep,
  TransformFn
} from './strap-types'
import { createStrapTrackId } from './create-player-utils'
import { PLAYER_RUNTIME_EVENT } from './player-constants'

export type PreloadPolicy = {
  releaseOnSequenceEnd?: boolean
  timeout?: number
}

export type PlayerInitInput = {
  mountTarget: unknown
  compiledScene: CompiledScene
  resourceManifest?: ResourceManifest
  runtimePolicy?: RuntimeEventPolicy
  strapCollection?: StrapCollection
  mode?: 'author' | 'broadcast'
  preloadPolicy?: PreloadPolicy
  enableInteractionLock?: boolean
}

export type PlayerScheduleApi = RuntimeScheduleHelpers

export type PlayerApi = {
  init: (input: PlayerInitInput) => Promise<ApiResult<void>>
  play: () => Promise<ApiResult<void>>
  pause: () => Promise<ApiResult<void>>
  resume: () => Promise<ApiResult<void>>
  stop: () => Promise<ApiResult<void>>
  destroy: () => Promise<ApiResult<void>>
  rewind: () => Promise<ApiResult<void>>
  seek: (input: { timelineMs: number }) => Promise<ApiResult<void>>
  emit: (input: StoryEvent) => Promise<ApiResult<void>>
  getState: () => PlayerStateSnapshot
  getRate: () => number
  setRate: (rate: number) => void
  onChange: (listener: PlayerStateListener) => () => void
  onTrace: (listener: (row: RuntimeTraceRow) => void) => () => void
  subscribeToNode: (persoId: string, cb: (node: Element | null) => void) => () => void
  schedule: PlayerScheduleApi
}

/**
 * Adapts the internal player facade to the public compiled-scene contract.
 */
export class Player implements PlayerApi {
  private readonly player: PlayerFacade
  private readonly scheduleRuntime: PlayerScheduleFacade
  private readonly preload = createPreloadModule()
  private runtimePolicy: ResolvedRuntimeEventPolicy = createRuntimeEventPolicy()
  private currentScene: CompiledScene['scene'] | null = null
  private strapCollection: StrapCollection = {}
  private readonly strapLoopSchedulers = new Set<PlayerScheduleFacade>()
  private readonly strapLoopUnsubscribers = new Map<PlayerScheduleFacade, () => void>()
  private scheduleRuntimeUnsubscribe: (() => void) | null = null
  private initialSceneState: Record<string, unknown> | undefined
  private initialStoryStateById = new Map<string, Record<string, unknown> | undefined>()
  private playerMode: 'author' | 'broadcast' = 'broadcast'
  private preloadPolicy: PreloadPolicy = {}
  private activeManifest: ResourceManifest | null = null
  private lastInitInput: PlayerInitInput | null = null
  private interactionLockEnabled = false
  private mountTarget: Element | null = null
  private rootNodeIds: string[] = []
  private mountedRuntimeRevision = -1
  private unsubscribeMountSync: (() => void) | null = null

  readonly schedule: PlayerScheduleApi

  private static isElement(value: unknown): value is Element {
    return typeof globalThis.Element !== 'undefined' && value instanceof globalThis.Element
  }

  private static isNode(value: unknown): value is Node {
    return typeof globalThis.Node !== 'undefined' && value instanceof globalThis.Node
  }

  private static readonly LIFECYCLE_EVENT = {
    sceneReady: 'scene:ready',
    sceneStart: 'scene:start',
    sceneEnd: 'scene:end'
  } as const

  /**
   * Re-syncs the mount target's children with the current root nodes.
   * Skips replaceChildren() when the resolved list is identical (same nodes,
   * same order) to what is already mounted — every runtimeRevision bump calls
   * this, including ones with no structural change (e.g. a seek that only
   * mutates style), and replaceChildren() always detaches+reattaches even when
   * passed its own current children, which interrupts in-flight image/video
   * decoding on descendants during rapid scrubbing.
   */
  private mountRootNodes(): void {
    if (this.mountTarget === null) return
    const registry = this.player.getRuntimeRegistry()
    const nodes = this.rootNodeIds
      .map(id => registry.getNodeById(id))
      .filter(Player.isNode)
    const current = this.mountTarget.childNodes
    if (nodes.length === current.length && nodes.every((node, i) => node === current[i])) {
      return
    }
    this.mountTarget.replaceChildren(...nodes)
  }

  private syncMountTargetInteractionLock(status: string): void {
    const target = this.mountTarget
    if (target === null || !this.interactionLockEnabled) return
    const locked = status !== 'playing'
    ;(target as HTMLElement).style.pointerEvents = locked ? 'none' : ''
    if (locked) {
      target.setAttribute('inert', '')
    } else {
      target.removeAttribute('inert')
    }
  }

  /**
   * Keeps the public scheduler surface stable for runtime helpers.
   */
  constructor(options: CreatePlayerOptions = {}) {
    for (const binding of options.bindings ?? []) {
      for (const strategy of binding.preload ?? []) {
        this.preload.registerStrategy(strategy.type, strategy.load)
      }
    }
    this.player = new PlayerFacade({
      ...options,
      onTimelineEvent: async (event) => {
        return this.routeTimelineEvent(event)
      },
      onRuntimeEmit: (event) => {
        const source = event.source ?? RUNTIME_EVENT_SOURCE.user
        const isLiveTracking = source === RUNTIME_EVENT_SOURCE.system && event.ms === undefined

        if (isLiveTracking) {
          this.applyLiveSceneEvent(
            { name: event.name, data: event.payload, cascade: event.cascade },
            event.scopeStoryId
          )
          return
        }

        void this.routeSceneEvent(
          {
            name: event.name,
            data: event.payload,
            cascade: event.cascade
          },
          source,
          event.scopeStoryId,
          0,
          {
            scopeStoryId: event.scopeStoryId,
            source,
            ms: event.ms ?? this.player.getState().timelineMs,
            eventInsertMode: event.mode
          }
        )
      }
    })
    this.scheduleRuntime = new PlayerScheduleFacade({
      emitEvent: async (event) => {
        await this.routeSceneEvent(event, RUNTIME_EVENT_SOURCE.system)
      },
      resolveState: () => {
        return this.resolveStateTarget(undefined) as DeepReadonly<Record<string, unknown>>
      }
    })
    this.schedule = this.scheduleRuntime
  }

  /**
   * Initializes one compiled scene through the internal player facade.
   */
  async init(input: PlayerInitInput): Promise<ApiResult<void>> {
    this.lastInitInput = input
    this.interactionLockEnabled = input.enableInteractionLock === true
    this.mountTarget = Player.isElement(input.mountTarget) ? input.mountTarget : null
    this.rootNodeIds = input.compiledScene.rootNodeIds

    this.playerMode = input.mode ?? 'broadcast'
    this.preloadPolicy = input.preloadPolicy ?? {}
    this.activeManifest = input.resourceManifest ?? input.compiledScene.resources

    const preloadResult = await this.preload.load({
      manifest: this.activeManifest,
      options: { mode: this.playerMode, timeout: this.preloadPolicy.timeout, container: this.mountTarget }
    })
    if (!preloadResult.ok) return preloadResult

    this.runtimePolicy = createRuntimeEventPolicy(input.runtimePolicy)
    this.scheduleRuntime.configurePolicy(this.runtimePolicy)

    this.currentScene = input.compiledScene.scene
    this.strapCollection = input.strapCollection ?? {}
    this.destroyStrapLoopSchedulers()
    this.scheduleRuntime.reset()
    const initResult = this.normalizeResult(
      await this.player.init(input.compiledScene.scene, { mode: this.playerMode })
    )
    if (!initResult.ok) {
      return initResult
    }

    const readyResult = await this.routeSceneEvent({ name: Player.LIFECYCLE_EVENT.sceneReady }, RUNTIME_EVENT_SOURCE.system)
    if (readyResult.ok) {
      this.captureInitialAuthorState()
      this.mountRootNodes()
      const initialState = this.player.getState()
      this.mountedRuntimeRevision = initialState.runtimeRevision
      this.syncMountTargetInteractionLock(initialState.status)
      this.unsubscribeMountSync?.()
      this.unsubscribeMountSync = this.player.onStateChange((state) => {
        if (state.runtimeRevision !== this.mountedRuntimeRevision) {
          this.mountedRuntimeRevision = state.runtimeRevision
          this.mountRootNodes()
        }
        this.syncMountTargetInteractionLock(state.status)
      })
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
      this.scheduleRuntimeUnsubscribe = this.player.subscribeJitTick((deltaMs) => {
        this.scheduleRuntime.tick(deltaMs)
      })
      await this.routeSceneEvent({ name: Player.LIFECYCLE_EVENT.sceneStart }, RUNTIME_EVENT_SOURCE.system)
    })
  }

  /**
   * Pauses playback.
   */
  pause(): Promise<ApiResult<void>> {
    return this.normalizeAsyncResult(this.player.pause(), () => {
      this.scheduleRuntimeUnsubscribe?.()
      this.scheduleRuntimeUnsubscribe = null
    })
  }

  /**
   * Resumes playback using the same internal play path.
   */
  resume(): Promise<ApiResult<void>> {
    return this.normalizeAsyncResult(this.player.play(), async () => {
      this.scheduleRuntimeUnsubscribe = this.player.subscribeJitTick((deltaMs) => {
        this.scheduleRuntime.tick(deltaMs)
      })
      await this.routeSceneEvent({ name: Player.LIFECYCLE_EVENT.sceneStart }, RUNTIME_EVENT_SOURCE.system)
    })
  }

  /**
   * Stops playback without tearing down the runtime.
   */
  stop(): Promise<ApiResult<void>> {
    return this.normalizeAsyncResult(this.player.pause(), async () => {
      await this.routeSceneEvent({ name: Player.LIFECYCLE_EVENT.sceneEnd }, RUNTIME_EVENT_SOURCE.system)
      this.scheduleRuntimeUnsubscribe?.()
      this.scheduleRuntimeUnsubscribe = null
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
      this.scheduleRuntimeUnsubscribe?.()
      this.scheduleRuntimeUnsubscribe = null
      this.scheduleRuntime.destroy()
      this.destroyStrapLoopSchedulers()
      this.currentScene = null
      this.strapCollection = {}
      this.lastInitInput = null
      this.unsubscribeMountSync?.()
      this.unsubscribeMountSync = null
      this.mountTarget?.replaceChildren()
      this.mountTarget = null
      this.rootNodeIds = []
      this.mountedRuntimeRevision = -1
    })
  }

  /**
   * Destroys and reinitializes the player from the last init input.
   */
  async rewind(): Promise<ApiResult<void>> {
    const input = this.lastInitInput
    if (input === null) {
      return { ok: false, error: { code: 'PLAYER_NOT_INITIALIZED', message: 'rewind requires a prior init call' } }
    }
    const destroyResult = await this.destroy()
    if (!destroyResult.ok) return destroyResult
    return this.init(input)
  }

  /**
   * Seeks the current timeline.
   */
  seek(input: { timelineMs: number }): Promise<ApiResult<void>> {
    return (async () => {
      if (this.player.getState().status === 'playing') {
        const pauseResult = await this.pause()
        if (!pauseResult.ok) {
          return pauseResult
        }
      }

      this.resetAuthorState()

      return this.normalizeResult(await this.player.seek(input.timelineMs))
    })()
  }

  /**
   * Emits one public runtime event.
   */
  emit(input: PlayerEmitInput): Promise<ApiResult<void>> {
    const currentStatus = this.player.getState().status
    if (currentStatus === PLAYER_STATUS.paused || currentStatus === PLAYER_STATUS.seeking) {
      return Promise.resolve({
        ok: false,
        error: {
          code: 'PLAYER_USER_EVENTS_PAUSED',
          message: 'user events are disabled while player is paused or seeking'
        }
      })
    }

    return this.routeSceneEvent(
      {
        name: input.name,
        data: input.data ?? input.payload,
        cascade: input.cascade
      },
      input.source ?? RUNTIME_EVENT_SOURCE.user,
      input.scopeStoryId,
      0,
      {
        scopeStoryId: input.scopeStoryId,
        source: input.source ?? RUNTIME_EVENT_SOURCE.user,
        ms: input.ms ?? this.player.getState().timelineMs,
        trackId: input.trackId,
        materialized: false
      }
    )
  }

  /**
   * Returns one public player state snapshot.
   */
  getState(): PlayerStateSnapshot {
    return this.player.getState()
  }

  getRate(): number {
    return this.player.getRate()
  }

  setRate(rate: number): void {
    this.player.setRate(rate)
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
   * Subscribes to the DOM node lifecycle of one perso (v1-author-api-spec).
   */
  subscribeToNode(persoId: string, cb: (node: Element | null) => void): () => void {
    return this.player.getRuntimeRegistry().subscribeToNode(persoId, cb)
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
   * Unsubscribes and destroys one JIT scheduler.
   */
  private destroySingleScheduler(scheduler: PlayerScheduleFacade): void {
    this.strapLoopUnsubscribers.get(scheduler)?.()
    this.strapLoopUnsubscribers.delete(scheduler)
    scheduler.destroy()
    this.strapLoopSchedulers.delete(scheduler)
  }

  /**
   * Destroys all active JIT schedulers and clears subscriptions.
   */
  private destroyStrapLoopSchedulers(): void {
    for (const scheduler of this.strapLoopSchedulers) {
      this.strapLoopUnsubscribers.get(scheduler)?.()
      scheduler.destroy()
    }
    this.strapLoopUnsubscribers.clear()
    this.strapLoopSchedulers.clear()
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
        trackId: event.trackId,
        materialized: true
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
   * Resolves the dedicated runtime track used by one strap declaration.
   */
  private resolveStrapTrackId(scopeStoryId: string | undefined, strapName: string): string {
    return createStrapTrackId(scopeStoryId, strapName)
  }

  /**
   * Materializes one finite helper step batch on the owning strap track.
   */
  private materializeHelperSteps(
    trackId: string,
    scope: StrapExecutionScope,
    steps: Array<{ offsetMs: number; step: StrapStep }>
  ): ApiResult<void> {
    const materializedEvents = steps.flatMap(({ offsetMs, step }, index) => {
      const ms = Math.max(0, scope.ms + offsetMs)
      const result = []

      if (step.event) {
        result.push({
          id: `evt-${trackId}-${index}-event`,
          ms,
          name: step.event.name,
          payload: step.event.data,
          scopeStoryId: step.event.cascade === true ? undefined : scope.scopeStoryId,
          index: result.length,
          source: RUNTIME_EVENT_SOURCE.system,
          trackId
        })
      }

      if (step.update) {
        result.push({
          id: `evt-${trackId}-${index}-update`,
          ms,
          name: PLAYER_RUNTIME_EVENT.stateUpdate,
          payload: step.update,
          scopeStoryId: scope.scopeStoryId,
          index: result.length,
          source: RUNTIME_EVENT_SOURCE.system,
          trackId
        })
      }

      return result
    })

    const appendResult = this.player.appendGeneratedEvents({
      trackId,
      events: materializedEvents.map((event, index) => ({
        ...event,
        index
      }))
    })

    if (!appendResult.ok) {
      return appendResult
    }

    return { ok: true, data: undefined }
  }

  /**
   * Returns true when one return chunk is one planned occurrence list.
   */
  private isPlannedStrapOccurrence(value: unknown): value is PlannedStrapOccurrence {
    return (
      typeof value === 'object' &&
      value !== null &&
      'offsetMs' in value &&
      typeof (value as { offsetMs?: unknown }).offsetMs === 'number' &&
      'step' in value &&
      typeof (value as { step?: unknown }).step === 'object' &&
      (value as { step?: unknown }).step !== null
    )
  }

  /**
   * Flattens one strap return tree into ordered runtime and planned chunks.
   */
  private normalizeStrapReturnValue(value: StrapReturnValue): Array<StrapRuntimeOutput | PlannedStrapOccurrence[]> {
    const chunks: Array<StrapRuntimeOutput | PlannedStrapOccurrence[]> = []

    const visit = (entry: unknown): void => {
      if (entry === undefined || entry === null) {
        return
      }

      if (Array.isArray(entry)) {
        if (entry.every((item) => this.isPlannedStrapOccurrence(item))) {
          chunks.push(entry as PlannedStrapOccurrence[])
          return
        }

        for (const item of entry) {
          visit(item)
        }
        return
      }

      if (typeof entry === 'object') {
        chunks.push(entry as StrapRuntimeOutput)
      }
    }

    visit(value)
    return chunks
  }

  /**
   * Creates the strap context exposed to one strap execution.
   */
  private createStrapHelpers(
    strapTrackId: string,
    scopeStoryId: string | undefined,
    startedAtMs: number,
    scope: StrapExecutionScope,
    depth: number,
    collectWarning: (warning: string) => void
  ): StrapContext {
    const resolveState = () => this.resolveStateTarget(scopeStoryId) as DeepReadonly<Record<string, unknown>>

    const emitWarnings = (warnings: string[]): void => {
      for (const warning of warnings) {
        collectWarning(warning)
      }
    }

    const toPlannedOccurrences = (steps: Array<{ offsetMs: number; step: StrapStep }>): PlannedStrapOccurrence[] => {
      return steps.map(({ offsetMs, step }) => ({
        offsetMs,
        step
      }))
    }

    const createJitScheduler = () => {
      let unsubscribe: (() => void) | null = null

      const scheduler = new PlayerScheduleFacade({
        emitEvent: async (event, context) => {
          if (this.player.getState().sequenceEnded) {
            return
          }
          const eventMs = startedAtMs + context.currentTimeMs
          if (event.name === PLAYER_RUNTIME_EVENT.stateUpdate) {
            await this.emitRuntimeEvent(
              { name: event.name, data: event.data },
              RUNTIME_EVENT_SOURCE.system,
              scopeStoryId,
              eventMs,
              strapTrackId,
              false
            )
            return
          }

          await this.routeSceneEvent(
            event,
            RUNTIME_EVENT_SOURCE.system,
            event.cascade === true ? undefined : scopeStoryId,
            depth + 1,
            {
              ...scope,
              scopeStoryId: event.cascade === true ? undefined : scopeStoryId,
              source: RUNTIME_EVENT_SOURCE.system,
              ms: eventMs,
              trackId: strapTrackId,
              materialized: false
            }
          )
        },
        emitWarning: collectWarning,
        resolveState,
        onIdle: () => {
          unsubscribe?.()
          this.strapLoopUnsubscribers.delete(scheduler)
          scheduler.destroy()
          this.strapLoopSchedulers.delete(scheduler)
        },
        policy: this.runtimePolicy
      })

      this.strapLoopSchedulers.add(scheduler)
      unsubscribe = this.player.subscribeJitTick((deltaMs) => {
        scheduler.tick(deltaMs)
      })
      this.strapLoopUnsubscribers.set(scheduler, unsubscribe)

      return scheduler
    }

    const toRuntimeLoopEvents = (factory: Parameters<LiveStrapHelpers['loop']>[1]) => {
      return (context: Parameters<RuntimeScheduleHelpers['loop']>[1] extends (context: infer T) => unknown ? T : never) => {
        return resolveStrapStepInput(factory, context).flatMap((step) => {
          const emitted: StoryEvent[] = []

          if (step.event) {
            emitted.push(step.event)
          }

          if (step.update) {
            emitted.push({
              name: PLAYER_RUNTIME_EVENT.stateUpdate,
              data: step.update
            })
          }

          return emitted
        })
      }
    }

    const createPlannedWait = (
      ms: number,
      input: Parameters<PlannedStrapHelpers['wait']>[1],
      _options: Parameters<PlannedStrapHelpers['wait']>[2] = {}
    ) => {
      return toPlannedOccurrences(
        planWaitItems({
          ms,
          startedAtMs,
          helperInput: input,
          resolveState,
          resolveItems: resolveStrapStepInput
        }).map(({ offsetMs, item }) => ({
          offsetMs,
          step: item
        }))
      )
    }

    const createPlannedRepeat = (options: Parameters<PlannedStrapHelpers['repeat']>[0], input: Parameters<PlannedStrapHelpers['repeat']>[1]) => {
      return toPlannedOccurrences(
        planRepeatItems({
          eachMs: options.everyMs,
          times: options.times,
          startedAtMs,
          helperInput: input,
          resolveState,
          resolveItems: resolveStrapStepInput
        }).map(({ offsetMs, item }) => ({
          offsetMs,
          step: item
        }))
      )
    }

    const createPlannedLoop = (options: Parameters<PlannedStrapHelpers['loop']>[0], factory: Parameters<PlannedStrapHelpers['loop']>[1]) => {
      if (!Number.isFinite(options.eachMs) || options.eachMs <= 0) {
        throw new Error('AUTHOR_HELPER_INVALID_ARG')
      }

      const plannedTimes = resolvePlannableLoopTimes(options)
      if (plannedTimes === null) {
        emitWarnings([
          hasEventLoopStop(options)
            ? 'helper loop mode planned falls back to jit because until.event requires jit'
            : 'helper loop cannot be planned'
        ])
        return []
      }

      return toPlannedOccurrences(
        planRepeatItems({
          eachMs: options.eachMs,
          times: plannedTimes,
          startedAtMs,
          helperInput: factory,
          resolveState,
          resolveItems: resolveStrapStepInput
        }).map(({ offsetMs, item }) => ({
          offsetMs,
          step: item
        }))
      )
    }

    const createPlannedSequence = (steps: Parameters<PlannedStrapHelpers['sequence']>[0]) => {
      return toPlannedOccurrences(
        planGenericSequenceSteps(
          steps.map((entry) => ({ content: entry.step, durationMs: entry.durationMs, startAt: entry.startAt }))
        ).map(({ offsetMs, content }) => ({ offsetMs, step: content }))
      )
    }

    const createPlannedStagger = (options: Parameters<PlannedStrapHelpers['stagger']>[0], input: Parameters<PlannedStrapHelpers['stagger']>[1]) => {
      if (!isValidHelperStaggerOptions(options)) {
        throw new Error('AUTHOR_HELPER_INVALID_ARG')
      }

      const resolvedSteps = resolveStrapStepInput(input, {
        currentTimeMs: startedAtMs,
        startedAtMs,
        elapsedMs: 0,
        index: 0,
        state: resolveState()
      })

      return toPlannedOccurrences(
        planStaggerItems({ stepMs: options.stepMs, items: resolvedSteps }).map(({ offsetMs, item }) => ({
          offsetMs,
          step: item
        }))
      )
    }

    const scheduleWait = (ms: number, input: Parameters<LiveStrapHelpers['wait']>[1], options: Parameters<LiveStrapHelpers['wait']>[2] = {}) => {
      if (!isValidHelperDelayMs(ms)) {
        throw new Error('AUTHOR_HELPER_INVALID_ARG')
      }

      const scheduler = createJitScheduler()
      const handle = scheduler.wait(ms, toRuntimeLoopEvents((context) => resolveStrapStepInput(input, context)), options)
      scheduler.tick(0)
      return {
        id: handle.id,
        cancel: () => {
          handle.cancel()
          this.destroySingleScheduler(scheduler)
        }
      }
    }

    const scheduleRepeat = (options: Parameters<LiveStrapHelpers['repeat']>[0], input: Parameters<LiveStrapHelpers['repeat']>[1]) => {
      if (!isValidHelperRepeatOptions(options)) {
        throw new Error('AUTHOR_HELPER_INVALID_ARG')
      }

      const scheduler = createJitScheduler()
      const handle = scheduler.repeat(options, toRuntimeLoopEvents((context) => resolveStrapStepInput(input, context)))
      scheduler.tick(0)
      return {
        id: handle.id,
        cancel: () => {
          handle.cancel()
          this.destroySingleScheduler(scheduler)
        }
      }
    }

    const scheduleLoop = (options: Parameters<LiveStrapHelpers['loop']>[0], factory: Parameters<LiveStrapHelpers['loop']>[1]) => {
      if (!Number.isFinite(options.eachMs) || options.eachMs <= 0) {
        throw new Error('AUTHOR_HELPER_INVALID_ARG')
      }

      const plannedTimes = resolvePlannableLoopTimes(options)
      const modeResolution = resolveHelperMode({
        helperName: 'loop',
        requestedMode: options.mode,
        defaultMode: 'jit',
        compatibleModes: hasEventLoopStop(options) ? ['jit'] : ['planned', 'jit'],
        fallbackMode: 'jit',
        reason: hasEventLoopStop(options) ? 'until.event requires jit' : undefined
      })
      emitWarnings(modeResolution.warnings)

      if (modeResolution.mode === 'planned' && plannedTimes !== null) {
        const scheduler = createJitScheduler()
        const handle = scheduler.repeat({ everyMs: options.eachMs, times: plannedTimes, mode: 'planned' }, toRuntimeLoopEvents(factory))
        scheduler.tick(0)

        return {
          id: handle.id,
          cancel: () => {
            handle.cancel()
            scheduler.destroy()
            this.strapLoopSchedulers.delete(scheduler)
          }
        }
      }

      const scheduler = createJitScheduler()
      const handle = scheduler.loop(options, toRuntimeLoopEvents(factory))
      scheduler.tick(0)

      return {
        id: handle.id,
        cancel: () => {
          handle.cancel()
          this.destroySingleScheduler(scheduler)
        }
      }
    }

    const scheduleStagger = (options: Parameters<LiveStrapHelpers['stagger']>[0], input: Parameters<LiveStrapHelpers['stagger']>[1]) => {
      if (!isValidHelperStaggerOptions(options)) {
        throw new Error('AUTHOR_HELPER_INVALID_ARG')
      }

      const resolvedSteps = resolveStrapStepInput(input, {
        currentTimeMs: startedAtMs,
        startedAtMs,
        elapsedMs: 0,
        index: 0,
        state: resolveState()
      })

      const scheduler = createJitScheduler()
      const handles = planStaggerItems({ stepMs: options.stepMs, items: resolvedSteps }).map(({ offsetMs, item }) => {
        return scheduler.wait(offsetMs, toRuntimeLoopEvents(() => item), options)
      })
      scheduler.tick(0)

      return handles.map((handle) => ({
        id: handle.id,
        cancel: () => {
          handle.cancel()
          this.destroySingleScheduler(scheduler)
        }
      }))
    }

    return {
      api: {
        getPersoIdAt: (x: number, y: number, excludeId?: string): string | null => {
          if (typeof globalThis.document?.elementsFromPoint !== 'function') return null
          const elements = globalThis.document.elementsFromPoint(x, y) as Element[]
          for (const element of elements) {
            const id = (element as HTMLElement).id
            if (id && id.length > 0 && id !== excludeId) {
              return id
            }
          }
          return null
        }
      },
      planned: {
        wait: createPlannedWait,
        delay: (ms, input, options) => {
          return createPlannedWait(ms, input, options)
        },
        repeat: createPlannedRepeat,
        loop: createPlannedLoop,
        stagger: createPlannedStagger,
        sequence: createPlannedSequence
      },
      live: {
        wait: scheduleWait,
        delay: (ms, input, options) => {
          return scheduleWait(ms, input, options)
        },
        repeat: scheduleRepeat,
        loop: scheduleLoop,
        stagger: scheduleStagger
      }
    }
  }

  /**
   * Resolves a strap function with strict story/scene isolation.
   * Story-level rules resolve from the story's own straps (embedded in the compiled scene).
   * Scene-level rules resolve from strapCollection. Isolation is strict — no cross-lookup.
   */
  private resolveStrap(strapName: string, scopeStoryId: string | undefined): StrapFn | undefined {
    if (scopeStoryId !== undefined) {
      return this.currentScene?.stories[scopeStoryId]?.straps?.[strapName]
    }
    return this.strapCollection[strapName]
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
    const strap = this.resolveStrap(strapName, scope.scopeStoryId)
    if (!strap) {
      if (scope.scopeStoryId !== undefined) {
        console.warn(`[codplay] story-strap "${strapName}" not found in story "${scope.scopeStoryId}" straps — ignored`)
      }
      return { ok: true, data: undefined }
    }

    const strapTrackId = this.resolveStrapTrackId(scope.scopeStoryId, strapName)
    const helperWarnings: string[] = []

    const strapContext = this.createStrapHelpers(strapTrackId, scope.scopeStoryId, scope.ms, scope, depth, (warning) => {
      helperWarnings.push(warning)
    })

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
            : undefined,
        ms: scope.ms
      },
      context: strapContext
    })

    const resolvedChunks = this.normalizeStrapReturnValue(output)
    for (const chunk of resolvedChunks) {
      if (Array.isArray(chunk)) {
        const helperResult = this.materializeHelperSteps(
          strapTrackId,
          scope,
          chunk.map(({ offsetMs, step }) => ({ offsetMs, step }))
        )
        if (!helperResult.ok) {
          return helperResult
        }
        continue
      }

      helperWarnings.push(...(chunk.warnings ?? []))

      if (chunk.update) {
        Object.assign(this.resolveStateTarget(scope.scopeStoryId), chunk.update)
        const updateResult = this.materializeHelperSteps(strapTrackId, scope, [{ offsetMs: 0, step: { update: chunk.update } }])
        if (!updateResult.ok) {
          return updateResult
        }

        const applyResult = await this.player.applyMaterializedEvent({
          name: PLAYER_RUNTIME_EVENT.stateUpdate,
          payload: chunk.update,
          scopeStoryId: scope.scopeStoryId,
          source: RUNTIME_EVENT_SOURCE.system,
          ms: scope.ms,
          trackId: strapTrackId
        })
        if (!applyResult.ok) {
          return applyResult
        }
      }

      for (const emittedEvent of chunk.events ?? []) {
        const nextScopeStoryId = emittedEvent.cascade === true ? undefined : scope.scopeStoryId
        const childResult = await this.routeSceneEvent(
          emittedEvent,
          RUNTIME_EVENT_SOURCE.system,
          nextScopeStoryId,
          depth + 1,
          {
            ...scope,
            materialized: false,
            trackId: strapTrackId,
            scopeStoryId: nextScopeStoryId,
            eventInsertMode: undefined
          }
        )

        if (!childResult.ok) {
          return childResult
        }
      }
    }

    return { ok: true, data: undefined }
  }

  /**
   * Applies one live tracking event synchronously through story listen transforms without timeline persistence.
   * Used for per-pointermove capture events that drive real-time visual feedback.
   */
  private applyLiveSceneEvent(event: StoryEvent, scopeStoryId?: string): void {
    const scene = this.currentScene
    if (scene === null) {
      return
    }

    const storyRules = scopeStoryId !== undefined
      ? (scene.stories[scopeStoryId]?.listen.filter((r) => r.on === event.name) ?? [])
      : []
    const rules = storyRules.length > 0
      ? storyRules
      : scene.listen.filter((r) => r.on === event.name)

    const emittedEvents: StoryEvent[] = []
    for (const rule of rules) {
      for (const transformFn of (rule.transform ?? []) as TransformFn[]) {
        emittedEvents.push(...transformFn(event))
      }
      emittedEvents.push(
        ...(rule.emit ?? []).map((e) => ({
          name: e.name,
          data: e.data ?? event.data,
          cascade: e.cascade
        }))
      )
    }

    for (const emittedEvent of emittedEvents) {
      void this.player.applyMaterializedEvent({
        name: emittedEvent.name,
        payload: emittedEvent.data,
        cascade: emittedEvent.cascade,
        scopeStoryId: emittedEvent.cascade === true ? undefined : scopeStoryId,
        source: RUNTIME_EVENT_SOURCE.system
      })
    }
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
    const currentStatus = this.player.getState().status
    if (source === RUNTIME_EVENT_SOURCE.user && (currentStatus === PLAYER_STATUS.paused || currentStatus === PLAYER_STATUS.seeking)) {
      return {
        ok: false,
        error: {
          code: 'PLAYER_USER_EVENTS_PAUSED',
          message: 'user events are disabled while player is paused or seeking'
        }
      }
    }

    this.notifyLoopSchedulers(event.name)

    if (depth > this.runtimePolicy.maxCascadeDepth) {
      return { ok: true, data: undefined }
    }

    const scene = this.currentScene
    if (scene === null) {
      return this.emitRuntimeEvent(event, source, scopeStoryId, scope.ms, scope.trackId, scope.materialized === true, scope.eventInsertMode)
    }

    const isLocalStoryEvent = scopeStoryId !== undefined

    if (isLocalStoryEvent) {
      const story = scene.stories[scopeStoryId]
      const storyRules = story?.listen.filter((rule) => rule.on === event.name) ?? []
      if (storyRules.length > 0) {
        return this.routeMatchingRules(storyRules, event, source, scopeStoryId, depth, scope)
      }
    }

    const sceneRules = scene.listen.filter((rule) => rule.on === event.name)
    if (sceneRules.length > 0) {
      return this.routeMatchingRules(sceneRules, event, source, undefined, depth, {
        ...scope,
        scopeStoryId: undefined
      })
    }

    const emitScopeStoryId = event.cascade === true ? undefined : scopeStoryId
    return this.emitRuntimeEvent(event, source, emitScopeStoryId, scope.ms, scope.trackId, scope.materialized === true, scope.eventInsertMode)
  }

  /**
   * Forwards one routed event to all active helper loop schedulers.
   */
  private notifyLoopSchedulers(eventName: string): void {
    this.scheduleRuntime.notifyEvent(eventName)
    for (const scheduler of this.strapLoopSchedulers) {
      scheduler.notifyEvent(eventName)
    }
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
    const emittedEvents: Array<{ event: StoryEvent; eventInsertMode: StrapExecutionScope['eventInsertMode'] }> = []
    for (const rule of rules) {
      for (const transformFn of (rule.transform ?? []) as TransformFn[]) {
        emittedEvents.push(...transformFn(event).map((e) => ({
          event: e,
          eventInsertMode: scope.eventInsertMode
        })))
      }
      for (const strapName of rule.straps ?? []) {
        const strapResult = await this.executeStrap(strapName, event, scope, depth)
        if (!strapResult.ok) {
          return strapResult
        }
      }
      emittedEvents.push(...(rule.emit ?? []).map((emittedEvent) => ({
        event: {
          name: emittedEvent.name,
          data: emittedEvent.data ?? event.data,
          cascade: emittedEvent.cascade
        },
        eventInsertMode: undefined as StrapExecutionScope['eventInsertMode']
      })))
    }

    const runtimeResult = await this.emitRuntimeEvent(event, source, scopeStoryId, scope.ms, scope.trackId, scope.materialized === true, scope.eventInsertMode)
    if (!runtimeResult.ok) {
      return runtimeResult
    }

    if (emittedEvents.length === 0) {
      return { ok: true, data: undefined }
    }

    for (const emitted of emittedEvents) {
      const emittedEvent = emitted.event
      const nextScopeStoryId = emittedEvent.cascade === true ? undefined : scopeStoryId
      const childResult = await this.routeSceneEvent(
        {
          name: emittedEvent.name,
          data: emittedEvent.data,
          cascade: emittedEvent.cascade
        },
        source,
        nextScopeStoryId,
        depth + 1,
        {
          ...scope,
          materialized: false,
          scopeStoryId: nextScopeStoryId,
          eventInsertMode: emitted.eventInsertMode
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
    ms?: number,
    trackId?: string,
    materialized = false,
    eventInsertMode?: StrapExecutionScope['eventInsertMode']
  ): Promise<ApiResult<void>> {
    const eventInput = {
      name: event.name,
      ms,
      payload: event.data,
      scopeStoryId,
      cascade: event.cascade,
      source,
      trackId
    }
    const result = this.normalizeResult(
      materialized
        ? await this.player.applyMaterializedEvent(eventInput)
        : eventInsertMode === 'persist-only'
          ? this.player.persistTrackEvent(eventInput)
          : await this.player.emit(eventInput)
    )

    if (result.ok && event.name === 'sequence:end') {
      this.destroyStrapLoopSchedulers()
      if (this.preloadPolicy.releaseOnSequenceEnd && this.activeManifest) {
        this.preload.release(this.activeManifest.entries.map((e) => e.url))
      }
    }

    return result
  }
}

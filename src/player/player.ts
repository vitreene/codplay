import type { ApiResult, CompiledScene, ResourceManifest } from '../builder/types'
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
import { resolveHelperMode } from './helper-mode'
import type { DeepReadonly, StoryEvent } from './helper-types'
import type { PlayerStateListener, PlayerStateSnapshot } from './types'
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
  StrapReturnValue,
  StrapRuntimeOutput,
  StrapStep,
  TransformFn
} from './strap-types'
import { createStrapTrackId } from './create-player-utils'
import { PLAYER_RUNTIME_EVENT } from './player-constants'

export type PlayerInitInput = {
  mountTarget: unknown
  compiledScene: CompiledScene
  resourceManifest?: ResourceManifest
  runtimePolicy?: RuntimeEventPolicy
  strapCollection?: StrapCollection
}

export type PlayerScheduleApi = RuntimeScheduleHelpers

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
            ms: event.ms ?? this.player.getState().timelineMs
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
    void input.mountTarget
    void input.resourceManifest

    this.runtimePolicy = createRuntimeEventPolicy(input.runtimePolicy)
    this.scheduleRuntime.configurePolicy(this.runtimePolicy)

    this.currentScene = input.compiledScene.scene
    this.strapCollection = input.strapCollection ?? {}
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
    this.pauseStrapLoopSchedulers()
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
  emit(input: StoryEvent): Promise<ApiResult<void>> {
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
      const scheduler = new PlayerScheduleFacade({
        emitEvent: async (event, context) => {
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
          scheduler.destroy()
          this.strapLoopSchedulers.delete(scheduler)
        },
        policy: this.runtimePolicy
      })

      this.strapLoopSchedulers.add(scheduler)
      if (this.player.getState().status === 'playing') {
        scheduler.resume()
      }

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
      return {
        id: handle.id,
        cancel: () => {
          handle.cancel()
          scheduler.destroy()
          this.strapLoopSchedulers.delete(scheduler)
        }
      }
    }

    const scheduleRepeat = (options: Parameters<LiveStrapHelpers['repeat']>[0], input: Parameters<LiveStrapHelpers['repeat']>[1]) => {
      if (!isValidHelperRepeatOptions(options)) {
        throw new Error('AUTHOR_HELPER_INVALID_ARG')
      }

      const scheduler = createJitScheduler()
      const handle = scheduler.repeat(options, toRuntimeLoopEvents((context) => resolveStrapStepInput(input, context)))
      return {
        id: handle.id,
        cancel: () => {
          handle.cancel()
          scheduler.destroy()
          this.strapLoopSchedulers.delete(scheduler)
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

      return {
        id: handle.id,
        cancel: () => {
          handle.cancel()
          scheduler.destroy()
          this.strapLoopSchedulers.delete(scheduler)
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

      return handles.map((handle) => ({
        id: handle.id,
        cancel: () => {
          handle.cancel()
          scheduler.destroy()
          this.strapLoopSchedulers.delete(scheduler)
        }
      }))
    }

    return {
      api: {},
      planned: {
        wait: createPlannedWait,
        delay: (ms, input, options) => {
          return createPlannedWait(ms, input, options)
        },
        repeat: createPlannedRepeat,
        loop: createPlannedLoop,
        stagger: createPlannedStagger
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
            : undefined
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
        const updateResult = this.materializeHelperSteps(strapTrackId, scope, [{ offsetMs: 0, step: { update: chunk.update } }])
        if (!updateResult.ok) {
          return updateResult
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
            scopeStoryId: nextScopeStoryId
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

    const isLocalStoryEvent = scopeStoryId !== undefined && event.cascade !== true
    const rules = isLocalStoryEvent
      ? (scene.stories[scopeStoryId!]?.listen.filter((r) => r.on === event.name) ?? [])
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
      return this.emitRuntimeEvent(event, source, scopeStoryId, scope.ms, scope.trackId, scope.materialized === true)
    }

    const isLocalStoryEvent = scopeStoryId !== undefined && event.cascade !== true

    if (isLocalStoryEvent) {
      const story = scene.stories[scopeStoryId]
      const storyRules = story?.listen.filter((rule) => rule.on === event.name) ?? []
      if (storyRules.length > 0) {
        return this.routeMatchingRules(storyRules, event, source, scopeStoryId, depth, scope)
      }

      return this.emitRuntimeEvent(event, source, scopeStoryId, scope.ms, scope.trackId, scope.materialized === true)
    }

    const sceneRules = scene.listen.filter((rule) => rule.on === event.name)
    if (sceneRules.length > 0) {
      return this.routeMatchingRules(sceneRules, event, source, undefined, depth, {
        ...scope,
        scopeStoryId: undefined
      })
    }

    return this.emitRuntimeEvent(event, source, undefined, scope.ms, scope.trackId, scope.materialized === true)
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
    const emittedEvents: StoryEvent[] = []
    for (const rule of rules) {
      for (const transformFn of (rule.transform ?? []) as TransformFn[]) {
        emittedEvents.push(...transformFn(event))
      }
      for (const strapName of rule.straps ?? []) {
        const strapResult = await this.executeStrap(strapName, event, scope, depth)
        if (!strapResult.ok) {
          return strapResult
        }
      }
      emittedEvents.push(...(rule.emit ?? []).map((emittedEvent) => ({
        name: emittedEvent.name,
        data: emittedEvent.data ?? event.data,
        cascade: emittedEvent.cascade
      })))
    }

    const runtimeResult = await this.emitRuntimeEvent(event, source, scopeStoryId, scope.ms, scope.trackId, scope.materialized === true)
    if (!runtimeResult.ok) {
      return runtimeResult
    }

    if (emittedEvents.length === 0) {
      return { ok: true, data: undefined }
    }

    for (const emittedEvent of emittedEvents) {
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
    ms?: number,
    trackId?: string,
    materialized = false
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
        : await this.player.emit(eventInput)
    )

    if (result.ok && event.name === 'sequence:end') {
      this.destroyStrapLoopSchedulers()
    }

    return result
  }
}

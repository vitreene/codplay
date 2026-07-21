import { deriveSimpleTransitions } from '../animation/derive-simple'
import { runAnimationBatch } from '../animation/run-batch'
import type { AnimationAdapter, AnimationResolvedAction, CaptureUpdate, ContinuousAnimationEngine } from '../animation/types'
import type { RenderMutationTraceEntry, RenderMutationResolver, RuntimeResolvedMutation } from '../runtime/render-mutation-resolver'
import { passThroughRenderMutationResolver } from '../runtime/render-mutation-resolver'
import { RuntimeComponentOrchestrator } from '../runtime/components'
import type {
  CreateRendererOptions,
  RendererApi,
  RendererCommandResult,
  RendererError,
  RendererErrorListener,
  RendererLoadInput,
  RendererStateSnapshot,
  RendererStatus,
  RendererTickResult,
  RuntimeCommit
} from './types'

const NOOP_ANIMATION_ADAPTER: AnimationAdapter = {
  run: () => [],
  applyCaptureUpdate: () => {
    return
  },
  releaseCaptureUpdate: () => {
    return
  },
  stop: () => {
    return
  }
}

const EMPTY_TICK_RESULT: RendererTickResult = {
  appliedCommitCount: 0,
  appliedActionCount: 0,
  animationAppliedCount: 0,
  conflictCount: 0
}

const RENDERER_STATUS = {
  idle: 'idle',
  ready: 'ready',
  running: 'running',
  paused: 'paused'
} as const

/**
 * Implements the renderer facade with component orchestration and action routing.
 */
export class RendererFacade implements RendererApi {
  private readonly animationAdapter: AnimationAdapter
  private readonly continuousAnimationEngines: ContinuousAnimationEngine[]
  private readonly orchestrator: RuntimeComponentOrchestrator
  private readonly runtimeCreateElementOptions: CreateRendererOptions['createElementOptions']

  private status: RendererStatus = RENDERER_STATUS.idle
  private loadedRuntimeId: string | null = null
  private pendingCommits: RuntimeCommit[] = []
  private lastAppliedCommitSeq = 0
  private runtimeRevision = 0

  private readonly errorListeners = new Set<RendererErrorListener>()

  /**
   * Resolves one target runtime item id from one resolved mutation.
   */
  private resolveTargetItemId(mutation: RuntimeResolvedMutation): string {
    return mutation.action.targetId ?? mutation.listenerId
  }

  /**
   * Resolves one mutation resolver for one runtime target item.
   */
  private resolveMutationResolver(targetItemId: string): RenderMutationResolver {
    return this.orchestrator.getRenderMutationResolverById(targetItemId) ?? passThroughRenderMutationResolver
  }

  /**
   * Applies registered render mutation resolvers while preserving uncontrolled items.
   */
  private resolveRenderMutations(mutations: RuntimeResolvedMutation[]): {
    resolvedMutations: RuntimeResolvedMutation[]
    trace: RenderMutationTraceEntry[]
  } {
    const passThroughMutations: RuntimeResolvedMutation[] = []
    const orderedResolvers: RenderMutationResolver[] = []
    const mutationsByResolver = new Map<RenderMutationResolver, RuntimeResolvedMutation[]>()
    const trace: RenderMutationTraceEntry[] = []

    for (const mutation of mutations) {
      const resolver = this.resolveMutationResolver(this.resolveTargetItemId(mutation))
      if (resolver === passThroughRenderMutationResolver) {
        passThroughMutations.push(mutation)
        continue
      }

      if (!mutationsByResolver.has(resolver)) {
        mutationsByResolver.set(resolver, [])
        orderedResolvers.push(resolver)
      }

      mutationsByResolver.get(resolver)?.push(mutation)
    }

    const resolvedMutations: RuntimeResolvedMutation[] = [...passThroughMutations]
    for (const resolver of orderedResolvers) {
      const resolution = resolver.resolve(mutationsByResolver.get(resolver) ?? [])
      resolvedMutations.push(...resolution.resolvedMutations)
      trace.push(...resolution.trace)
    }

    return {
      resolvedMutations,
      trace
    }
  }

  /**
   * Creates one renderer facade configured from explicit constructor options.
   */
  constructor(options: CreateRendererOptions = {}) {
    this.animationAdapter = options.animationAdapter ?? NOOP_ANIMATION_ADAPTER
    this.continuousAnimationEngines = options.continuousAnimationEngines ?? []
    this.runtimeCreateElementOptions = {
      ...options.createElementOptions,
      emitRuntimeEvent: options.emitRuntimeEvent,
      emitLiveCapture: options.emitLiveCapture,
      getCurrentTimelineMs: options.getCurrentTimelineMs,
      getStoryState: options.getStoryState,
      getSceneState: options.getSceneState
    }
    this.orchestrator = new RuntimeComponentOrchestrator({
      warn: (warning) => {
        this.emitError({
          code: warning.code,
          message: warning.message,
          details: warning.details
        })
      },
      createElementOptions: this.runtimeCreateElementOptions,
      coreServices: options.coreServices
    })
  }

  /**
   * Returns true when a story is currently loaded in renderer.
   */
  private isInitialized(): boolean {
    return this.loadedRuntimeId !== null
  }

  /**
   * Sorts pending commits by commit sequence to keep deterministic execution.
   */
  private sortPendingCommits(): void {
    this.pendingCommits.sort((left, right) => left.commitSeq - right.commitSeq)
  }

  /**
   * Splits pending commits into ready and waiting groups for one tick.
   */
  private takeReadyCommits(nowMs: number): RuntimeCommit[] {
    const readyCommits: RuntimeCommit[] = []
    const waitingCommits: RuntimeCommit[] = []

    for (const commit of this.pendingCommits) {
      if (commit.applyAtMs <= nowMs) {
        readyCommits.push(commit)
        continue
      }

      waitingCommits.push(commit)
    }

    this.pendingCommits = waitingCommits
    return readyCommits
  }

  /**
   * Resolves event sequence for a resolved action from ready commit metadata.
   */
  private buildEventSeqMap(commits: RuntimeCommit[]): Map<string, number> {
    const eventSeqByEventId = new Map<string, number>()
    for (const commit of commits) {
      for (const operation of commit.operations) {
        eventSeqByEventId.set(operation.eventId, commit.commitSeq)
      }

      if (commit.commitSeq > this.lastAppliedCommitSeq) {
        this.lastAppliedCommitSeq = commit.commitSeq
      }
    }

    return eventSeqByEventId
  }

  /**
   * Resolves the triggering ms for a resolved action from ready commit metadata.
   */
  private buildEventMsMap(commits: RuntimeCommit[]): Map<string, number> {
    const eventMsByEventId = new Map<string, number>()
    for (const commit of commits) {
      if (commit.causeEventId === undefined) {
        continue
      }

      eventMsByEventId.set(commit.causeEventId, commit.applyAtMs)
    }

    return eventMsByEventId
  }

  /**
   * Routes each animatable action to the first continuous animation engine
   * that claims it (`TweenAction`, or any future engine registered the same
   * way) — exactly once, right after this action's own `beforeUpdate`/
   * component-resolution/`afterUpdate` cycle already ran identically to any
   * other action. Actions claimed by an engine are removed from the list
   * handed to the external animation library bridge.
   */
  private dispatchToContinuousAnimationEngines(
    animatableActions: AnimationResolvedAction[],
    eventMsByEventId: ReadonlyMap<string, number>
  ): AnimationResolvedAction[] {
    if (this.continuousAnimationEngines.length === 0) {
      return animatableActions
    }

    const remaining: AnimationResolvedAction[] = []
    for (const resolvedAction of animatableActions) {
      const engine = this.continuousAnimationEngines.find((candidate) => candidate.claims(resolvedAction.action))
      if (engine === undefined) {
        remaining.push(resolvedAction)
        continue
      }

      engine.trigger({
        resolvedAction,
        eventMs: eventMsByEventId.get(resolvedAction.eventId) ?? 0
      })
    }

    return remaining
  }

  readonly component: import('../runtime/components').ComponentRegistryApi = {
    register: (input) => {
      if (this.isInitialized()) {
        return { ok: false, error: { code: 'RENDERER_COMPONENT_REGISTRY_LOCKED', message: 'component.register is only allowed before load' } }
      }
      return this.orchestrator.registerComponent(input)
    },
    override: (input) => {
      if (this.isInitialized()) {
        return { ok: false, error: { code: 'RENDERER_COMPONENT_REGISTRY_LOCKED', message: 'component.override is only allowed before load' } }
      }
      return this.orchestrator.overrideComponent(input)
    }
  }

  readonly service: import('../runtime/components').ServiceRegistryApi = {
    register: (input) => {
      if (this.isInitialized()) {
        return { ok: false, error: { code: 'RENDERER_SERVICE_REGISTRY_LOCKED', message: 'service.register is only allowed before load' } }
      }
      return this.orchestrator.registerService(input)
    },
    override: (input) => {
      if (this.isInitialized()) {
        return { ok: false, error: { code: 'RENDERER_SERVICE_REGISTRY_LOCKED', message: 'service.override is only allowed before load' } }
      }
      return this.orchestrator.overrideService(input)
    }
  }

  readonly module: import('../runtime/components').ModuleRegistryApi = {
    register: (input) => {
      if (this.isInitialized()) {
        return { ok: false, error: { code: 'RENDERER_MODULE_REGISTRY_LOCKED', message: 'module.register is only allowed before load' } }
      }
      return this.orchestrator.registerModule(input)
    },
    override: (input) => {
      if (this.isInitialized()) {
        return { ok: false, error: { code: 'RENDERER_MODULE_REGISTRY_LOCKED', message: 'module.override is only allowed before load' } }
      }
      return this.orchestrator.overrideModule(input)
    }
  }

  /**
   * Exposes one stable runtime registry for player-level integrations.
   */
  getRuntimeRegistry(): import('../runtime/components').RuntimeRegistrySnapshot {
    return this.orchestrator.getRuntimeRegistrySnapshot()
  }

  /**
   * Resolves mounted state at one seek target from a proposed effective move
   * per perso — see RuntimeComponentOrchestrator.resolveMountedStateAtSeek.
   */
  resolveMountedStateAtSeek(input: {
    effectiveMoveByPersoId: ReadonlyMap<string, import('../runtime/types').MoveCommand | null>
  }): Map<string, boolean> {
    return this.orchestrator.resolveMountedStateAtSeek(input)
  }

  /**
   * Loads one runtime perso graph and instantiates one runtime component per perso.
   */
  load(input: RendererLoadInput): RendererCommandResult {
    this.animationAdapter.stop()
    this.orchestrator.setCreateElementOptions(this.runtimeCreateElementOptions)
    this.orchestrator.loadPersos(input.runtimePersos, input.mountedPersoIds, input.effectiveMoveByPersoId)
    this.loadedRuntimeId = input.runtimePersos.id
    this.pendingCommits = []
    this.lastAppliedCommitSeq = 0
    this.status = RENDERER_STATUS.ready
    this.runtimeRevision += 1
    return { ok: true }
  }

  /**
   * Starts rendering execution from ready state.
   */
  start(): RendererCommandResult {
    if (!this.isInitialized()) {
      return this.reject('RENDERER_NOT_INITIALIZED', 'load must be called before start')
    }

    if (this.status !== RENDERER_STATUS.ready) {
      return this.reject('RENDERER_INVALID_STATE', 'start is only allowed from ready', {
        currentState: this.status
      })
    }

    this.status = RENDERER_STATUS.running
    return { ok: true }
  }

  /**
   * Pauses rendering execution from running state.
   */
  pause(): RendererCommandResult {
    if (!this.isInitialized()) {
      return this.reject('RENDERER_NOT_INITIALIZED', 'load must be called before pause')
    }

    if (this.status !== RENDERER_STATUS.running) {
      return this.reject('RENDERER_INVALID_STATE', 'pause is only allowed from running', {
        currentState: this.status
      })
    }

    this.animationAdapter.pause?.()
    this.status = RENDERER_STATUS.paused
    return { ok: true }
  }

  /**
   * Resumes rendering execution from paused state.
   */
  resume(): RendererCommandResult {
    if (!this.isInitialized()) {
      return this.reject('RENDERER_NOT_INITIALIZED', 'load must be called before resume')
    }

    if (this.status !== RENDERER_STATUS.paused) {
      return this.reject('RENDERER_INVALID_STATE', 'resume is only allowed from paused', {
        currentState: this.status
      })
    }

    this.animationAdapter.resume?.()
    this.status = RENDERER_STATUS.running
    return { ok: true }
  }

  /**
   * Synchronizes active animations with one target timeline cursor.
   */
  syncAnimationsToTimeline(timelineMs: number, eventMsByEventId: ReadonlyMap<string, number>): void {
    this.animationAdapter.seek?.(timelineMs, eventMsByEventId)
  }

  /**
   * Advances the external animation engine by one frame.
   */
  renderFrame(frameNowMs: number): void {
    if (!this.isInitialized()) {
      return
    }

    this.animationAdapter.renderFrame?.(frameNowMs)
  }

  setRate(rate: number): void {
    this.animationAdapter.setRate?.(rate)
  }

  /**
   * Applies one `CaptureUpdate` directly, bypassing `run()`/transitions
   * entirely — see `AnimationAdapter.applyCaptureUpdate`.
   */
  applyCaptureUpdate(update: CaptureUpdate): void {
    this.animationAdapter.applyCaptureUpdate(update)
  }

  /**
   * Releases whatever persistent handle backs one target/property's capture
   * updates, if any — called when a capture ends.
   */
  releaseCaptureUpdate(target: unknown, property: string): void {
    this.animationAdapter.releaseCaptureUpdate(target, property)
  }

  /**
   * Stops renderer execution and clears pending commits.
   */
  stop(): RendererCommandResult {
    if (!this.isInitialized()) {
      return { ok: true }
    }

    this.pendingCommits = []
    if (this.status !== RENDERER_STATUS.idle) {
      this.status = RENDERER_STATUS.ready
    }

    return { ok: true }
  }

  /**
   * Destroys renderer runtime and returns to idle state.
   */
  destroy(): RendererCommandResult {
    this.pendingCommits = []
    this.loadedRuntimeId = null
    this.status = RENDERER_STATUS.idle
    this.animationAdapter.stop()
    this.orchestrator.destroy()
    this.runtimeRevision += 1
    return { ok: true }
  }

  /**
   * Enqueues one runtime commit for frame-based application.
   */
  enqueueCommit(commit: RuntimeCommit): RendererCommandResult {
    if (!this.isInitialized()) {
      return this.reject('RENDERER_NOT_INITIALIZED', 'load must be called before enqueueCommit', {
        commitSeq: commit.commitSeq
      })
    }

    this.pendingCommits.push(commit)
    this.sortPendingCommits()
    return { ok: true }
  }

  /**
   * Applies all ready commits for one renderer tick.
   */
  tick(nowMs: number): RendererTickResult {
    if (!this.isInitialized()) {
      return EMPTY_TICK_RESULT
    }

    const readyCommits = this.takeReadyCommits(nowMs)
    if (readyCommits.length === 0) {
      return EMPTY_TICK_RESULT
    }

    const eventSeqByEventId = this.buildEventSeqMap(readyCommits)
    const eventMsByEventId = this.buildEventMsMap(readyCommits)
    const resolvedActions = readyCommits.flatMap((commit) => commit.operations)
    const conflictResolution = this.resolveRenderMutations(resolvedActions)

    try {
      const isSeekReplayByEventId = new Map<string, boolean>()
      for (const commit of readyCommits) {
        for (const operation of commit.operations) {
          isSeekReplayByEventId.set(operation.eventId, commit.isSeekReplay === true)
        }
      }

      const routed = this.orchestrator.routeUpdates(
        conflictResolution.resolvedMutations.map((resolvedAction) => ({
          resolvedAction,
          eventMs: eventMsByEventId.get(resolvedAction.eventId) ?? 0,
          eventSeq: eventSeqByEventId.get(resolvedAction.eventId) ?? 0,
          isSeekReplay: isSeekReplayByEventId.get(resolvedAction.eventId) === true
        }))
      )

      const remainingAnimatableActions = this.dispatchToContinuousAnimationEngines(
        routed.animatableActions,
        eventMsByEventId
      )
      const animationOperations = [
        ...deriveSimpleTransitions(remainingAnimatableActions),
        ...routed.directTransitions,
        ...routed.animationOperations
      ]
      const animation = runAnimationBatch(animationOperations, this.animationAdapter)

      return {
        appliedCommitCount: readyCommits.length,
        appliedActionCount: routed.appliedActionsCount,
        animationAppliedCount: animation.appliedCount,
        conflictCount: conflictResolution.trace.length
      }
    } catch (error) {
      this.emitError({
        code: 'RENDERER_COMMIT_APPLY_FAILED',
        message: 'Renderer failed to apply one commit batch',
        details: {
          nowMs,
          appliedCommitCount: readyCommits.length,
          error: error instanceof Error ? error.message : 'unknown_error'
        }
      })

      return {
        appliedCommitCount: readyCommits.length,
        appliedActionCount: 0,
        animationAppliedCount: 0,
        conflictCount: 0
      }
    }
  }

  /**
   * Returns one immutable renderer state snapshot.
   */
  getState(): RendererStateSnapshot {
    const runtimeElements = this.orchestrator.getRuntimeElements()
    return {
      status: this.status,
      initialized: this.isInitialized(),
      runtimeElementCount: runtimeElements.size,
      pendingCommitCount: this.pendingCommits.length,
      lastAppliedCommitSeq: this.lastAppliedCommitSeq,
      runtimeRevision: this.runtimeRevision
    }
  }

  /**
   * Dispatches one module-internal event to registered module event handlers.
   */
  dispatchModuleEvent(name: string, payload: Record<string, unknown>, ms: number): void {
    this.orchestrator.dispatchModuleEvent(name, {
      name,
      payload,
      insertMode: 'persist-only',
      ms,
    })
  }

  /**
   * Emits one renderer warning/error to all listeners.
   */
  private emitError(error: RendererError): void {
    for (const listener of this.errorListeners) {
      listener(error)
    }
  }

  /**
   * Builds one rejected command result and emits the error payload.
   */
  private reject(code: string, message: string, details?: Record<string, unknown>): RendererCommandResult {
    this.emitError({ code, message, details })
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
   * Subscribes to renderer errors and returns one unsubscribe callback.
   */
  onError(listener: RendererErrorListener): () => void {
    this.errorListeners.add(listener)
    return () => {
      this.errorListeners.delete(listener)
    }
  }
}

import type { DiagnosticReport } from '../../diagnostics'
import { DiagnosticCollector } from '../../diagnostics'
import type {
  CompiledFunctionCollection,
  CompiledRecord,
  CompiledScene,
} from '../../scene/compiled'
import type { EngineFrame } from '../engine'
import {
  RuntimeEngine,
  type RuntimeModuleServiceInstance,
  type RuntimeModuleServiceSeekHandle,
} from '../engine'
import { diffSolvedScenes } from '../move'
import {
  PLAYER_LIFECYCLE_DESTROYED,
  PLAYER_LIFECYCLE_IDLE,
  PLAYER_LIFECYCLE_PAUSED,
  PLAYER_LIFECYCLE_PLAYING,
  PLAYER_LIFECYCLE_READY,
  type PlayerLifecycleState,
} from '../config/player-lifecycle'
import { STRAP_SCOPE_SCENE, STRAP_SCOPE_STORY } from '../config/strap-scope'
import { EVENT_INSERT_MODE_PERSIST_ONLY } from '../config/event-insertion'
import { RenderSync } from './render-sync'
import type { RuntimeMaterializer, RuntimeMaterializerSceneContext } from '../materializer'
import type { RuntimeComponentRuntime } from '../components'
import {
  RuntimeCaptureSession,
  resolveCompiledCaptureDeclaration,
  type RuntimeCaptureBeginInput,
  type RuntimeCaptureBeginResult,
  type RuntimeCaptureFailure,
  type RuntimeCapturePlayerEndResult,
  type RuntimeCaptureSample,
  type RuntimeCaptureState,
  type RuntimeCaptureTrackResult,
  type RuntimeCompiledCaptureBeginInput,
} from '../capture'
import {
  collectSolvedMoveDiagnostics,
  createEmptyDiagnosticReport,
  createSolvedMoveDiagnostics,
} from './diagnostics'
import {
  applyCaptureStateUpdate,
  applyLiveCaptureActions,
  cancelActiveCaptures,
  indexCompiledCaptureActionTargets,
  reapplyLiveCaptureStateUpdates,
  type ActiveCaptureAction,
  type CaptureActionTarget,
  type RuntimeCaptureSessionEntry,
  type RuntimePlayerEmitInput,
} from './capture'
import {
  materializeScene,
  RuntimeStateStore,
  validateStrapCollections,
  RuntimeEventDispatcher,
  type SolvedScene,
  type MountTargetDeclaration,
  type RuntimeEventDispatchResult,
  type StrapCollections,
} from './pipeline'
import { RuntimeTrackJournal } from './pipeline'
import { StructuralTimeline } from './structural-timeline'
import { reconstructPlayerScene } from './scene'
import {
  abortPendingModuleSeek,
  initializeModuleServices,
  notifyModuleMoveDeltas,
  notifyModulePlaybackState,
  notifyModuleRateChange,
  notifyModuleScenePresented,
  resolveModuleTimeline,
  resolveStructuralOrder,
} from './modules'

export type { PlayerLifecycleState } from '../config/player-lifecycle'

/** Result returned by player initialization. */
export type PlayerInitResult = Readonly<
  | { ok: true; diagnostics: DiagnosticReport }
  | { ok: false; diagnostics: DiagnosticReport }
>

/** Result returned after one local seek and its pure reconstruction. */
export type PlayerSeekResult = Readonly<
  | { ok: true; timeMs: number; diagnostics: DiagnosticReport }
  | { ok: false; timeMs: number; diagnostics: DiagnosticReport }
>

/** One compiled-scene runtime instance with one optional materializer boundary. */
export class RuntimePlayer {
  readonly id: string
  readonly engine: RuntimeEngine
  readonly compiledScene: CompiledScene
  readonly renderSync: RenderSync
  readonly strapCollections: StrapCollections | undefined
  readonly trackJournal: RuntimeTrackJournal
  readonly functions: CompiledFunctionCollection
  readonly stateStore: RuntimeStateStore
  readonly mountTargets: readonly MountTargetDeclaration[]
  readonly materializer: RuntimeMaterializer | undefined
  readonly componentRuntime: RuntimeComponentRuntime | undefined
  private state: PlayerLifecycleState = PLAYER_LIFECYCLE_IDLE
  private currentTimeMs = 0
  private rate = 1
  private skipNextDelta = false
  private solvedScene: SolvedScene | undefined
  private pendingSolvedScene: SolvedScene | undefined
  private pendingSeekDiagnostics: DiagnosticReport = createEmptyDiagnosticReport()
  private includePersistOnlyInCurrent = true
  private structuralTimeline: StructuralTimeline | undefined
  private structuralTimelineRevision = -1
  private structuralTimelineIncludesPersistOnly = true
  private moduleServiceInstances = new Map<string, RuntimeModuleServiceInstance>()
  private pendingModuleSeekHandles: Array<{
    instance: RuntimeModuleServiceInstance
    handle: RuntimeModuleServiceSeekHandle
  }> = []
  private readonly captureSessions = new Map<string, RuntimeCaptureSessionEntry>()
  private readonly activeCaptureActions = new Map<string, ActiveCaptureAction>()
  private readonly liveCaptureStateUpdates = new Map<string, CompiledRecord>()
  private liveCapturePersoKeys = new Set<string>()
  private readonly compiledCaptureActionTargets: ReadonlyMap<string, readonly CaptureActionTarget[]>
  private nextRuntimeEventId = 0

  /** Creates one player bound to one engine and one immutable compiled scene. */
  constructor(
    id: string,
    engine: RuntimeEngine,
    compiledScene: CompiledScene,
    renderSync: RenderSync = new RenderSync([]),
    strapCollections?: StrapCollections,
    trackJournal?: RuntimeTrackJournal,
    mountTargets: readonly MountTargetDeclaration[] = [],
    materializer?: RuntimeMaterializer,
    componentRuntime?: RuntimeComponentRuntime,
    functions: CompiledFunctionCollection = {},
  ) {
    this.id = id
    this.engine = engine
    this.compiledScene = compiledScene
    this.renderSync = renderSync
    this.strapCollections = strapCollections
    this.trackJournal = trackJournal ?? new RuntimeTrackJournal(compiledScene)
    this.functions = functions
    this.mountTargets = mountTargets
    this.materializer = materializer
    this.componentRuntime = componentRuntime
    this.stateStore = new RuntimeStateStore(compiledScene)
    this.compiledCaptureActionTargets = indexCompiledCaptureActionTargets(compiledScene)
  }

  /** Returns the current lifecycle state. */
  getLifecycleState(): PlayerLifecycleState {
    return this.state
  }

  /** Returns the logical time advanced by the engine or set by seek. */
  getCurrentTimeMs(): number {
    return this.currentTimeMs
  }

  /** Returns the currently presented solved scene for a host transaction. */
  getSolvedScene(): SolvedScene | undefined {
    return this.solvedScene
  }

  /** Reconstructs one solved scene for a historical host presentation. */
  resolveSceneAt(timeMs: number, includePersistOnly = true): SolvedScene {
    return this.reconstructScene(timeMs, includePersistOnly)
  }

  /** Reconstructs the exact logical state immediately before one event boundary. */
  resolveSceneBeforeBoundary(timeMs: number, includePersistOnly = true): SolvedScene {
    return this.reconstructSceneBeforeBoundary(timeMs, includePersistOnly)
  }

  /** Returns whether the current presentation head includes persisted-only facts. */
  includesPersistOnlyInCurrent(): boolean {
    return this.includePersistOnlyInCurrent
  }

  /**
   * Presents one solved scene on the persistent component host for runner-owned
   * geometry capture, without advancing state, modules, media or live actions.
   */
  presentSceneForGeometryCapture(scene: SolvedScene): void {
    if (this.state === PLAYER_LIFECYCLE_IDLE || this.state === PLAYER_LIFECYCLE_DESTROYED) {
      throw new Error('Geometry capture requires an initialized runtime player.')
    }
    this.componentRuntime?.sync(scene)
    this.materializer?.materializeScene(scene, {
      moveDeltas: [],
      phase: 'geometry-capture',
    })
  }

  /** Validates capabilities and attaches this player to the shared engine. */
  init(): PlayerInitResult {
    const diagnostics = new DiagnosticCollector()
    if (this.state !== PLAYER_LIFECYCLE_IDLE) {
      diagnostics.error('RUNTIME_PLAYER_STATE_INVALID', 'Player can only be initialized from idle state.', {
        context: { state: this.state },
      })
      return { ok: false, diagnostics: diagnostics.report() }
    }
    for (const issue of this.strapCollections === undefined
      ? []
      : validateStrapCollections(this.compiledScene, this.strapCollections)) {
      diagnostics.warning(issue.code, issue.message, {
        context: { scope: issue.scope, storyId: issue.storyId, strapName: issue.strapName },
      })
    }
    this.engine.validateRequirements(this.compiledScene.requirements, diagnostics)
    if (diagnostics.hasErrors()) return { ok: false, diagnostics: diagnostics.report() }
    try {
      this.moduleServiceInstances = new Map(this.engine.createModuleServiceInstances(
        this.id,
        this.compiledScene,
        this.compiledScene.requirements.modules,
        { componentSurfaces: this.componentRuntime?.getComponentSurfaces() },
      ))
    } catch (error) {
      diagnostics.error('RUNTIME_MODULE_INIT_FAILED', error instanceof Error ? error.message : 'Runtime module initialization failed.')
      return { ok: false, diagnostics: diagnostics.report() }
    }
    this.componentRuntime?.setModuleServices(this.moduleServiceInstances)
    const initialSolvedScene = this.reconstructBaseScene(0)
    this.componentRuntime?.sync(initialSolvedScene)
    const resolvedInitialScene = this.reconstructBaseScene(0)
    initializeModuleServices(this.moduleServiceInstances, resolvedInitialScene)
    notifyModuleRateChange(this.moduleServiceInstances, this.rate)
    this.rebuildStructuralTimeline()
    this.solvedScene = this.reconstructScene(0)
    this.synchronizeStateStoreFromScene(this.solvedScene)
    this.materializeScene(this.solvedScene, { moveDeltas: [] })
    collectSolvedMoveDiagnostics(this.solvedScene, diagnostics)
    this.engine.registerInstance(this.id, (frame) => this.onEngineFrame(frame), {
      validateSeek: (timeMs) => this.validateSeek(timeMs),
      getSeekDiagnostics: () => this.pendingSeekDiagnostics,
      abortSeek: () => abortPendingModuleSeek(this.pendingModuleSeekHandles),
      prepareSeek: () => this.renderSync.prepareSeek(),
      commitSeek: (timeMs) => {
        if (this.pendingSolvedScene === undefined || this.pendingSolvedScene.timeMs !== timeMs) {
          throw new Error('Player seek reconstruction is missing.')
        }
        const previousSolvedScene = this.solvedScene
        const moveDeltas = previousSolvedScene === undefined
          ? []
          : diffSolvedScenes(previousSolvedScene, this.pendingSolvedScene)
        if (this.pendingModuleSeekHandles.length > 0) {
          const preparedInstances = new Set(this.pendingModuleSeekHandles.map((entry) => entry.instance))
          for (const { handle } of this.pendingModuleSeekHandles) handle.commit()
          notifyModuleMoveDeltas(this.moduleServiceInstances, previousSolvedScene, this.pendingSolvedScene, preparedInstances, moveDeltas)
          this.pendingModuleSeekHandles = []
        } else {
          notifyModuleMoveDeltas(this.moduleServiceInstances, previousSolvedScene, this.pendingSolvedScene, new Set(), moveDeltas)
        }
        this.solvedScene = this.pendingSolvedScene
        this.includePersistOnlyInCurrent = true
        this.synchronizeStateStoreFromScene(this.solvedScene)
        this.materializeScene(this.solvedScene, { previousScene: previousSolvedScene, moveDeltas })
        this.pendingSolvedScene = undefined
        this.pendingSeekDiagnostics = createEmptyDiagnosticReport()
        this.currentTimeMs = timeMs
        this.skipNextDelta = true
      },
      presentSeek: () => {
        this.renderSync.seek(this.engine.getCurrentNowMs(), this.currentTimeMs)
      },
    })
    this.state = PLAYER_LIFECYCLE_READY
    return { ok: true, diagnostics: diagnostics.report() }
  }

  /** Starts logical playback without creating a clock or rendering anything. */
  play(): void {
    this.requireState(PLAYER_LIFECYCLE_READY, PLAYER_LIFECYCLE_PAUSED)
    if (this.state === PLAYER_LIFECYCLE_PAUSED) {
      this.skipNextDelta = true
      this.renderSync.resume()
    }
    this.state = PLAYER_LIFECYCLE_PLAYING
    notifyModulePlaybackState(this.moduleServiceInstances, 'playing', this.currentTimeMs)
  }

  /** Pauses logical playback at the current engine-provided time. */
  pause(): void {
    this.requireState(PLAYER_LIFECYCLE_PLAYING)
    this.renderSync.pause()
    this.state = PLAYER_LIFECYCLE_PAUSED
    notifyModulePlaybackState(this.moduleServiceInstances, 'paused', this.currentTimeMs)
  }

  /** Changes the player rate without changing the current absolute timeline position. */
  setRate(rate: number): void {
    this.requireState(PLAYER_LIFECYCLE_READY, PLAYER_LIFECYCLE_PAUSED, PLAYER_LIFECYCLE_PLAYING)
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error('Player rate must be a finite positive number.')
    }
    this.rate = rate
    this.renderSync.rateChange(rate)
    notifyModuleRateChange(this.moduleServiceInstances, rate)
  }

  /** Returns the currently configured player rate. */
  getRate(): number {
    return this.rate
  }

  /** Positions logical time without replaying events or effects. */
  seek(timeMs: number): PlayerSeekResult {
    const diagnostics = new DiagnosticCollector({ output: () => undefined })
    try {
      this.pendingSolvedScene = undefined
      const engineResult = this.engine.seek([{ instanceId: this.id, timeMs }])
      return { ok: true, timeMs, diagnostics: engineResult.diagnostics[this.id] ?? diagnostics.report() }
    } catch (error) {
      this.pendingSolvedScene = undefined
      diagnostics.error(
        'RUNTIME_SEEK_FAILED',
        error instanceof Error ? error.message : 'Runtime seek failed.',
      )
      return { ok: false, timeMs, diagnostics: diagnostics.report() }
    }
  }

  /** Reapplies the current solved scene after a materializer-context change. */
  refresh(): void {
    if (this.solvedScene === undefined) throw new Error('Player has not been initialized.')
    this.materializeScene(this.solvedScene, { previousScene: this.solvedScene, moveDeltas: [] })
  }

  /**
   * Appends and routes one live event through the same journal later consumed
   * by seek, then refreshes the current materialization from that journal.
   */
  async emit(input: RuntimePlayerEmitInput): Promise<RuntimeEventDispatchResult> {
    return this.emitEvent(input)
  }

  /** Routes one event with an optional internal presentation boundary policy. */
  private async emitEvent(
    input: RuntimePlayerEmitInput,
    includePersistOnlyOverride?: boolean,
  ): Promise<RuntimeEventDispatchResult> {
    this.requireState(PLAYER_LIFECYCLE_READY, PLAYER_LIFECYCLE_PLAYING, PLAYER_LIFECYCLE_PAUSED)
    this.synchronizeStateStore(this.currentTimeMs, this.includePersistOnlyInCurrent)
    const dispatcher = new RuntimeEventDispatcher({
      scene: this.compiledScene,
      journal: this.trackJournal,
      strapCollections: this.strapCollections,
      functions: this.functions,
      stateStore: this.stateStore,
      eventIdFactory: () => this.createRuntimeEventId(),
    })
    const result = await dispatcher.dispatch({
      ...input,
      applyAtMs: input.applyAtMs ?? this.currentTimeMs,
    })
    if (includePersistOnlyOverride !== undefined) {
      this.includePersistOnlyInCurrent = includePersistOnlyOverride
    } else if (input.mode === EVENT_INSERT_MODE_PERSIST_ONLY) {
      this.includePersistOnlyInCurrent = false
    }
    this.synchronizeStateStore(this.currentTimeMs, this.includePersistOnlyInCurrent)
    // A persist-only event is recorded for later reconstruction, but it is
    // deliberately outside the current playback head. In particular, do not
    // reconstruct or materialize here: the source may still be presenting the
    // final live capture value until the next normal frame or seek.
    if (input.mode === EVENT_INSERT_MODE_PERSIST_ONLY) return result
    const nextSolvedScene = this.reconstructScene(this.currentTimeMs, this.includePersistOnlyInCurrent)
    const previousSolvedScene = this.solvedScene
    const moveDeltas = previousSolvedScene === undefined
      ? []
      : diffSolvedScenes(previousSolvedScene, nextSolvedScene)
    notifyModuleMoveDeltas(this.moduleServiceInstances, previousSolvedScene, nextSolvedScene, new Set(), moveDeltas)
    this.solvedScene = nextSolvedScene
    this.materializeScene(nextSolvedScene, { previousScene: previousSolvedScene, moveDeltas })
    return result
  }

  /** Opens one source-agnostic capture session against the current player state. */
  beginCapture(input: RuntimeCaptureBeginInput): RuntimeCaptureBeginResult {
    this.requireState(PLAYER_LIFECYCLE_READY, PLAYER_LIFECYCLE_PLAYING, PLAYER_LIFECYCLE_PAUSED)
    if (input.captureId.trim().length === 0) {
      return {
        ok: false,
        code: 'RUNTIME_CAPTURE_ID_INVALID',
        message: 'Capture id must not be empty.',
      }
    }
    if (this.captureSessions.has(input.captureId)) {
      return {
        ok: false,
        code: 'RUNTIME_CAPTURE_DUPLICATE',
        message: `Capture session is already open: ${input.captureId}`,
      }
    }
    const stateScope = input.declaration.stateScope ?? 'story'
    const state = stateScope === 'scene'
      ? this.stateStore.snapshot(STRAP_SCOPE_SCENE)
      : this.stateStore.snapshot(STRAP_SCOPE_STORY, input.storyId)
    const opened = RuntimeCaptureSession.open({
      declaration: input.declaration,
      state,
      startedAtMs: this.currentTimeMs,
    })
    if (!opened.ok) return opened
    this.captureSessions.set(input.captureId, {
      storyId: input.storyId,
      stateScope,
      session: opened.session,
    })
    return {
      ok: true,
      captureId: input.captureId,
      captureState: opened.session.getCaptureState(),
    }
  }

  /** Resolves a compiled capture declaration before opening the runtime session. */
  beginCompiledCapture(input: RuntimeCompiledCaptureBeginInput): RuntimeCaptureBeginResult {
    let declaration: RuntimeCaptureBeginInput['declaration']
    try {
      declaration = resolveCompiledCaptureDeclaration(input.declaration, this.functions)
    } catch (error) {
      return {
        ok: false,
        code: 'RUNTIME_CAPTURE_FUNCTION_UNAVAILABLE',
        message: error instanceof Error ? error.message : 'Capture function is not available.',
      }
    }
    return this.beginCapture({
      captureId: input.captureId,
      storyId: input.storyId,
      declaration,
    })
  }

  /** Forwards one source sample to an existing capture without journal writes. */
  trackCapture(captureId: string, sample: RuntimeCaptureSample): RuntimeCaptureTrackResult {
    const entry = this.captureSessions.get(captureId)
    if (entry === undefined) {
      return {
        ok: false,
        code: 'RUNTIME_CAPTURE_UNKNOWN',
        message: `Capture session is not open: ${captureId}`,
      }
    }
    const tracked = entry.session.track(sample)
    if (!tracked.ok) return tracked
    if (tracked.action === undefined) {
      this.activeCaptureActions.delete(captureId)
    } else {
      const previous = this.activeCaptureActions.get(captureId)
      const targets = previous?.action.actionName === tracked.action.actionName
        ? previous.targets
        : this.compiledCaptureActionTargets.get(tracked.action.actionName) ?? []
      this.activeCaptureActions.set(captureId, { action: tracked.action, targets })
    }
    if (tracked.updateState !== undefined) {
      const previous = this.liveCaptureStateUpdates.get(captureId) ?? {}
      const merged = { ...previous, ...tracked.updateState }
      this.liveCaptureStateUpdates.set(captureId, merged)
      this.applyCaptureStateUpdate(entry, tracked.updateState)
    }
    try {
      this.applyLiveCaptureActions()
    } catch (error) {
      return {
        ok: false,
        code: 'RUNTIME_CAPTURE_LIVE_APPLY_FAILED',
        message: error instanceof Error ? error.message : 'Live capture application failed.',
      }
    }
    return tracked
  }

  /** Closes one capture and routes each declared end event through RuntimePlayer.emit(). */
  async endCapture(
    captureId: string,
    meta: Readonly<Record<string, unknown>> = {},
    captureStateOverride?: RuntimeCaptureState,
  ): Promise<RuntimeCapturePlayerEndResult | RuntimeCaptureFailure> {
    const entry = this.captureSessions.get(captureId)
    if (entry === undefined) {
      return {
        ok: false,
        code: 'RUNTIME_CAPTURE_UNKNOWN',
        message: `Capture session is not open: ${captureId}`,
      }
    }
    const state = entry.stateScope === 'scene'
      ? this.stateStore.snapshot(STRAP_SCOPE_SCENE)
      : this.stateStore.snapshot(STRAP_SCOPE_STORY, entry.storyId)
    const ended = entry.session.end(state, meta, this.currentTimeMs, captureStateOverride)
    this.activeCaptureActions.delete(captureId)
    if (!ended.ok) {
      this.captureSessions.delete(captureId)
      this.liveCaptureStateUpdates.delete(captureId)
      this.synchronizeStateStore(this.currentTimeMs, this.includePersistOnlyInCurrent)
      return ended
    }

    const dispatchResults: RuntimeEventDispatchResult[] = []
    const hasPersistOnlyEndCaptureEvents = ended.endCaptureEvents.length > 0
    try {
      for (const event of ended.endCaptureEvents) {
        dispatchResults.push(await this.emitEvent({
          name: event.name,
          applyAtMs: event.applyAtMs,
          storyId: event.cascade === true ? undefined : entry.storyId,
          cascade: event.cascade,
          data: event.data,
          mode: event.mode,
          meta,
        }, false))
      }
      if (ended.endEmitEvent !== undefined) {
        const event = ended.endEmitEvent
        dispatchResults.push(await this.emitEvent({
          name: event.name,
          applyAtMs: event.applyAtMs,
          storyId: event.cascade === true ? undefined : entry.storyId,
          cascade: event.cascade,
          data: event.data,
          mode: event.mode,
          meta,
        }, hasPersistOnlyEndCaptureEvents || event.mode === EVENT_INSERT_MODE_PERSIST_ONLY
          ? false
          : undefined))
      }
    } finally {
      this.captureSessions.delete(captureId)
      this.liveCaptureStateUpdates.delete(captureId)
      this.synchronizeStateStore(this.currentTimeMs, this.includePersistOnlyInCurrent)
      // Removing the live action must not immediately reset the materialized
      // component. The persist-only boundary leaves the last live pose visible
      // until the next ordinary materialization; applyLiveCaptureActions() is
      // therefore intentionally deferred to that boundary.
    }
    return { ...ended, dispatchResults }
  }

  /** Cancels one open capture without producing an event or state update. */
  cancelCapture(captureId: string): Readonly<{ ok: true } | RuntimeCaptureFailure> {
    const entry = this.captureSessions.get(captureId)
    if (entry === undefined) {
      return {
        ok: false,
        code: 'RUNTIME_CAPTURE_UNKNOWN',
        message: `Capture session is not open: ${captureId}`,
      }
    }
    entry.session.cancel()
    this.captureSessions.delete(captureId)
    this.activeCaptureActions.delete(captureId)
    this.liveCaptureStateUpdates.delete(captureId)
    this.synchronizeStateStore(this.currentTimeMs, this.includePersistOnlyInCurrent)
    this.applyLiveCaptureActions()
    return { ok: true }
  }

  /** Detaches the player from the engine and closes its lifecycle. */
  destroy(): void {
    if (this.state === PLAYER_LIFECYCLE_DESTROYED) return
    cancelActiveCaptures(
      this.captureSessions,
      this.activeCaptureActions,
      this.liveCaptureStateUpdates,
    )
    for (const instance of this.moduleServiceInstances.values()) instance.destroy?.()
    this.moduleServiceInstances.clear()
    abortPendingModuleSeek(this.pendingModuleSeekHandles)
    this.engine.unregisterInstance(this.id)
    this.renderSync.stop()
    this.materializer?.destroy?.()
    this.componentRuntime?.destroy()
    this.state = PLAYER_LIFECYCLE_DESTROYED
  }

  /** Applies one engine frame to the logical clock while playing. */
  private onEngineFrame(frame: EngineFrame): void {
    if (this.state !== PLAYER_LIFECYCLE_PLAYING) return
    if (this.skipNextDelta) {
      this.skipNextDelta = false
      this.renderSync.tick(frame.nowMs, this.currentTimeMs, this.rate)
      return
    }
    this.currentTimeMs += frame.deltaMs * this.rate
    this.currentTimeMs = resolveModuleTimeline(this.moduleServiceInstances, this.currentTimeMs)
    const nextSolvedScene = this.reconstructScene(this.currentTimeMs, this.includePersistOnlyInCurrent)
    this.synchronizeStateStoreFromScene(nextSolvedScene)
    const previousSolvedScene = this.solvedScene
    const moveDeltas = previousSolvedScene === undefined ? [] : diffSolvedScenes(previousSolvedScene, nextSolvedScene)
    notifyModuleMoveDeltas(this.moduleServiceInstances, previousSolvedScene, nextSolvedScene, new Set(), moveDeltas)
    this.solvedScene = nextSolvedScene
    this.materializeScene(this.solvedScene, { previousScene: previousSolvedScene, moveDeltas })
    this.renderSync.tick(frame.nowMs, this.currentTimeMs, this.rate)
  }

  /** Materializes one scene while keeping authored writes inside the render boundary. */
  private materializeScene(scene: SolvedScene, context: RuntimeMaterializerSceneContext): void {
    this.componentRuntime?.sync(scene)
    notifyModuleScenePresented(
      this.moduleServiceInstances,
      scene,
      this.state === PLAYER_LIFECYCLE_PLAYING ? 'playing' : 'paused',
    )
    this.applyLiveCaptureActions(scene)
    this.materializer?.materializeScene(scene, context)
  }

  /** Reapplies active capture actions through the normal component update path. */
  private applyLiveCaptureActions(scene = this.solvedScene): void {
    if (scene === undefined || this.componentRuntime === undefined) return
    this.liveCapturePersoKeys = applyLiveCaptureActions(
      scene,
      this.componentRuntime,
      this.activeCaptureActions,
      this.liveCapturePersoKeys,
      this.functions,
    )
  }

  /** Enforces one valid lifecycle transition. */
  private requireState(...allowed: PlayerLifecycleState[]): void {
    if (!allowed.includes(this.state)) {
      throw new Error(`Player cannot perform this operation from ${this.state} state.`)
    }
  }

  /** Validates one local seek before the engine enters a group transaction. */
  private validateSeek(timeMs: number): void {
    if (this.state === PLAYER_LIFECYCLE_IDLE || this.state === PLAYER_LIFECYCLE_DESTROYED) {
      throw new Error(`Player cannot seek from ${this.state} state.`)
    }
    if (!Number.isFinite(timeMs) || timeMs < 0) {
      throw new Error('Player seek time must be a finite positive number.')
    }
    cancelActiveCaptures(
      this.captureSessions,
      this.activeCaptureActions,
      this.liveCaptureStateUpdates,
    )
    for (const instance of this.moduleServiceInstances.values()) {
      instance.beforeSeek?.(this.currentTimeMs)
    }
    this.pendingSolvedScene = this.reconstructScene(timeMs)
    this.pendingSeekDiagnostics = createSolvedMoveDiagnostics(this.pendingSolvedScene)
    this.pendingModuleSeekHandles = []
    try {
      for (const instance of this.moduleServiceInstances.values()) {
        const handle = instance.prepareSeek?.(this.pendingSolvedScene)
        if (handle !== undefined) this.pendingModuleSeekHandles.push({ instance, handle })
      }
    } catch (error) {
      abortPendingModuleSeek(this.pendingModuleSeekHandles)
      throw error
    }
  }

  /** Rebuilds one logical scene without replaying straps or render effects. */
  private reconstructScene(timeMs: number, includePersistOnly = true): SolvedScene {
    this.ensureStructuralTimeline(includePersistOnly)
    const structural = this.structuralTimeline?.resolveAt(timeMs)
    return this.reconstructBaseScene(timeMs, structural?.childrenByTarget, true, includePersistOnly)
  }

  /** Resolves the left side of one event boundary with the preceding structural order. */
  private reconstructSceneBeforeBoundary(timeMs: number, includePersistOnly = true): SolvedScene {
    this.ensureStructuralTimeline(includePersistOnly)
    const structural = this.structuralTimeline?.resolveBefore(timeMs)
    return this.reconstructBaseScene(timeMs, structural?.childrenByTarget, false, includePersistOnly)
  }

  /** Rebuilds the canonical structural timeline from compiled and runtime facts. */
  private rebuildStructuralTimeline(includePersistOnly = true): void {
    for (const instance of this.moduleServiceInstances.values()) instance.resetStructuralOrder?.()
    this.structuralTimeline = new StructuralTimeline(
      this.compiledScene,
      (timeMs) => this.reconstructBaseScene(timeMs, undefined, true, includePersistOnly),
      (timeMs) => this.reconstructBaseScene(timeMs, undefined, false, includePersistOnly),
      (previousOrder, scene, deltas) => resolveStructuralOrder(
        this.moduleServiceInstances,
        previousOrder,
        scene,
        deltas,
      ),
      this.trackJournal.getEventTimes(),
    )
    this.structuralTimelineRevision = this.trackJournal.getRevision()
    this.structuralTimelineIncludesPersistOnly = includePersistOnly
  }

  /** Rebuilds runtime structural boundaries lazily after a journal append. */
  private ensureStructuralTimeline(includePersistOnly = true): void {
    if (this.structuralTimeline === undefined
      || this.structuralTimelineRevision !== this.trackJournal.getRevision()
      || this.structuralTimelineIncludesPersistOnly !== includePersistOnly) {
      this.rebuildStructuralTimeline(includePersistOnly)
    }
  }

  /** Resolves one scene without consulting the structural timeline being built. */
  private reconstructBaseScene(
    timeMs: number,
    childrenByTarget?: Readonly<Record<string, readonly string[]>>,
    includeBoundary = true,
    includePersistOnly = true,
  ): SolvedScene {
    return reconstructPlayerScene({
      compiledScene: this.compiledScene,
      functions: this.functions,
      trackJournal: this.trackJournal,
      mountTargets: this.mountTargets,
      moduleServiceInstances: this.moduleServiceInstances,
    }, timeMs, childrenByTarget, includeBoundary, includePersistOnly)
  }

  /** Reconciles the mutable strap input snapshot from one solved evaluation. */
  private synchronizeStateStoreFromScene(scene: Pick<SolvedScene, 'sceneState' | 'storyStates'>): void {
    this.stateStore.replace(STRAP_SCOPE_SCENE, scene.sceneState)
    for (const [storyId, state] of Object.entries(scene.storyStates)) {
      this.stateStore.replace(STRAP_SCOPE_STORY, state, storyId)
    }
    this.reapplyLiveCaptureStateUpdates()
  }

  /** Reconciles the mutable strap input snapshot from the journal state. */
  private synchronizeStateStore(timeMs: number, includePersistOnly = true): void {
    const materialized = materializeScene(this.compiledScene, timeMs, this.trackJournal, { includePersistOnly })
    this.synchronizeStateStoreFromScene(materialized)
  }

  /** Reapplies non-journaled capture state so active straps see its live value. */
  private reapplyLiveCaptureStateUpdates(): void {
    reapplyLiveCaptureStateUpdates(this.stateStore, this.liveCaptureStateUpdates, this.captureSessions)
  }

  /** Applies one trackCommand state patch to its declared live scope only. */
  private applyCaptureStateUpdate(
    entry: Readonly<{
      storyId: string
      stateScope: 'scene' | 'story'
    }>,
    update: CompiledRecord,
  ): void {
    applyCaptureStateUpdate(this.stateStore, entry, update)
  }

  /** Allocates one player-scoped identity for every live event dispatch. */
  private createRuntimeEventId(): string {
    const index = this.nextRuntimeEventId
    this.nextRuntimeEventId += 1
    return `runtime-dispatch:${this.compiledScene.scene.id}:${index}`
  }
}

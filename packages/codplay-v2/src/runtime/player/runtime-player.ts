import type { DiagnosticReport } from '../../diagnostics'
import { DiagnosticCollector } from '../../diagnostics'
import type {
  CompiledFunctionCollection,
  CompiledRecord,
  CompiledScene,
  CompiledValue,
} from '../../scene/compiled'
import type { EngineFrame } from '../engine'
import {
  RuntimeEngine,
  type RuntimeModuleServiceInstance,
  type RuntimeModuleServiceSeekHandle,
  type RuntimeStructuralOrder,
} from '../engine'
import { diffSolvedScenes, type MoveStateDelta } from '../move'
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
  type RuntimeCaptureAction,
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
  materializeScene,
  materializeSceneBeforeBoundary,
  type MaterializeOptions,
  resolveLiveCaptureActionState,
  resolveScene,
  RuntimeStateStore,
  solveScene,
  validateStrapCollections,
  RuntimeEventDispatcher,
  type SolvedScene,
  type MountTargetDeclaration,
  type RuntimeEventDispatchResult,
  type RuntimeEventInput,
  type StrapCollections,
} from './pipeline'
import { RuntimeTrackJournal } from './pipeline'
import { applyStructuralDeltas, StructuralTimeline } from './structural-timeline'

export type { PlayerLifecycleState } from '../config/player-lifecycle'

type CaptureActionTarget = Readonly<{
  persoKey: string
  actionValue: CompiledValue
}>

type ActiveCaptureAction = Readonly<{
  action: RuntimeCaptureAction
  targets: readonly CaptureActionTarget[]
}>

type RuntimePlayerEmitInput = Omit<RuntimeEventInput, 'applyAtMs'> & Readonly<{
  applyAtMs?: number
}>

/** Resolves the compiled action-target index once when the player is created. */
function indexCompiledCaptureActionTargets(
  compiledScene: CompiledScene,
): ReadonlyMap<string, readonly CaptureActionTarget[]> {
  const index = new Map<string, readonly CaptureActionTarget[]>()
  for (const [actionName, targets] of Object.entries(compiledScene.actionTargetIndex)) {
    const resolvedTargets: CaptureActionTarget[] = []
    for (const target of targets) {
      const story = compiledScene.scene.stories[target.storyId]
      const perso = story?.persos.find((candidate) => candidate.id === target.persoId)
      const actionValue = perso?.actions[actionName]
      if (actionValue !== undefined) {
        resolvedTargets.push({
          persoKey: `${target.storyId}:${target.persoId}`,
          actionValue,
        })
      }
    }
    index.set(actionName, resolvedTargets)
  }
  return index
}

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
  private readonly captureSessions = new Map<string, Readonly<{
    storyId: string
    stateScope: 'scene' | 'story'
    session: RuntimeCaptureSession
  }>>()
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
        { getComponentById: (runtimeItemId) => this.componentRuntime?.getComponentById(runtimeItemId) },
      ))
    } catch (error) {
      diagnostics.error('RUNTIME_MODULE_INIT_FAILED', error instanceof Error ? error.message : 'Runtime module initialization failed.')
      return { ok: false, diagnostics: diagnostics.report() }
    }
    this.componentRuntime?.setModuleServices(this.moduleServiceInstances)
    const initialSolvedScene = this.reconstructBaseScene(0)
    this.componentRuntime?.sync(initialSolvedScene)
    const resolvedInitialScene = this.reconstructBaseScene(0)
    this.initializeModuleServices(resolvedInitialScene)
    this.notifyModuleRateChange(this.rate)
    this.rebuildStructuralTimeline()
    this.solvedScene = this.reconstructScene(0)
    this.synchronizeStateStore(0)
    this.materializeScene(this.solvedScene, { moveDeltas: [] })
    collectSolvedMoveDiagnostics(this.solvedScene, diagnostics)
    this.engine.registerInstance(this.id, (frame) => this.onEngineFrame(frame), {
      validateSeek: (timeMs) => this.validateSeek(timeMs),
      getSeekDiagnostics: () => this.pendingSeekDiagnostics,
      abortSeek: () => this.abortPendingModuleSeek(),
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
          this.notifyModuleMoveDeltas(previousSolvedScene, this.pendingSolvedScene, preparedInstances, moveDeltas)
          this.pendingModuleSeekHandles = []
        } else {
          this.notifyModuleMoveDeltas(previousSolvedScene, this.pendingSolvedScene, new Set(), moveDeltas)
        }
        this.solvedScene = this.pendingSolvedScene
        this.includePersistOnlyInCurrent = true
        this.synchronizeStateStore(timeMs, true)
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
    this.notifyModulePlaybackState('playing')
  }

  /** Pauses logical playback at the current engine-provided time. */
  pause(): void {
    this.requireState(PLAYER_LIFECYCLE_PLAYING)
    this.renderSync.pause()
    this.state = PLAYER_LIFECYCLE_PAUSED
    this.notifyModulePlaybackState('paused')
  }

  /** Changes the player rate without changing the current absolute timeline position. */
  setRate(rate: number): void {
    this.requireState(PLAYER_LIFECYCLE_READY, PLAYER_LIFECYCLE_PAUSED, PLAYER_LIFECYCLE_PLAYING)
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error('Player rate must be a finite positive number.')
    }
    this.rate = rate
    this.renderSync.rateChange(rate)
    this.notifyModuleRateChange(rate)
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
    this.notifyModuleMoveDeltas(previousSolvedScene, nextSolvedScene, new Set(), moveDeltas)
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
    this.cancelActiveCaptures()
    for (const instance of this.moduleServiceInstances.values()) instance.destroy?.()
    this.moduleServiceInstances.clear()
    this.abortPendingModuleSeek()
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
    this.currentTimeMs = this.resolveModuleTimeline(this.currentTimeMs)
    const nextSolvedScene = this.reconstructScene(this.currentTimeMs, this.includePersistOnlyInCurrent)
    this.synchronizeStateStore(this.currentTimeMs, this.includePersistOnlyInCurrent)
    const previousSolvedScene = this.solvedScene
    const moveDeltas = previousSolvedScene === undefined ? [] : diffSolvedScenes(previousSolvedScene, nextSolvedScene)
    this.notifyModuleMoveDeltas(previousSolvedScene, nextSolvedScene, new Set(), moveDeltas)
    this.solvedScene = nextSolvedScene
    this.materializeScene(this.solvedScene, { previousScene: previousSolvedScene, moveDeltas })
    this.renderSync.tick(frame.nowMs, this.currentTimeMs, this.rate)
  }

  /** Materializes one scene while keeping authored writes inside the render boundary. */
  private materializeScene(scene: SolvedScene, context: RuntimeMaterializerSceneContext): void {
    this.componentRuntime?.sync(scene)
    this.notifyModuleScenePresented(scene)
    this.applyLiveCaptureActions(scene)
    this.materializer?.materializeScene(scene, context)
  }

  /** Reapplies active capture actions through the normal component update path. */
  private applyLiveCaptureActions(scene = this.solvedScene): void {
    if (scene === undefined || this.componentRuntime === undefined) return

    const liveStates = new Map<string, CompiledRecord>()
    for (const active of this.activeCaptureActions.values()) {
      for (const target of active.targets) {
        const perso = scene.persos[target.persoKey]
        if (perso === undefined) continue
        const currentState = liveStates.get(target.persoKey) ?? perso.state
        const nextState = resolveLiveCaptureActionState(
          currentState,
          target.actionValue,
          active.action.data,
          this.functions,
        )
        if (nextState !== undefined) liveStates.set(target.persoKey, nextState)
      }
    }
    const affectedPersoKeys = new Set([...this.liveCapturePersoKeys, ...liveStates.keys()])
    for (const persoKey of affectedPersoKeys) {
      const perso = scene.persos[persoKey]
      if (perso === undefined) continue
      this.componentRuntime.updateLive(
        persoKey,
        liveStates.get(persoKey) ?? perso.state,
        scene.timeMs,
      )
    }
    this.liveCapturePersoKeys = new Set(liveStates.keys())
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
    this.cancelActiveCaptures()
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
      this.abortPendingModuleSeek()
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
      (previousOrder, scene, deltas) => this.resolveStructuralOrder(previousOrder, scene, deltas),
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
    const options: MaterializeOptions = { includePersistOnly }
    const materialized = includeBoundary
      ? materializeScene(this.compiledScene, timeMs, this.trackJournal, options)
      : materializeSceneBeforeBoundary(this.compiledScene, timeMs, this.trackJournal, options)
    return solveScene(resolveScene(materialized, this.functions), {
      mountTargets: [
        ...this.mountTargets,
        ...[...this.moduleServiceInstances.values()].flatMap((instance) => instance.getMountTargets?.() ?? []),
      ],
      ...(childrenByTarget === undefined ? {} : { childrenByTarget }),
    })
  }

  /** Reconciles the mutable strap input snapshot from the journal state. */
  private synchronizeStateStore(timeMs: number, includePersistOnly = true): void {
    const materialized = materializeScene(this.compiledScene, timeMs, this.trackJournal, { includePersistOnly })
    this.stateStore.replace(STRAP_SCOPE_SCENE, materialized.sceneState)
    for (const [storyId, state] of Object.entries(materialized.storyStates)) {
      this.stateStore.replace(STRAP_SCOPE_STORY, state, storyId)
    }
    this.reapplyLiveCaptureStateUpdates()
  }

  /** Reapplies non-journaled capture state so active straps see its live value. */
  private reapplyLiveCaptureStateUpdates(): void {
    for (const [captureId, update] of this.liveCaptureStateUpdates) {
      const entry = this.captureSessions.get(captureId)
      if (entry === undefined) continue
      this.applyCaptureStateUpdate(entry, update)
    }
  }

  /** Applies one trackCommand state patch to its declared live scope only. */
  private applyCaptureStateUpdate(
    entry: Readonly<{
      storyId: string
      stateScope: 'scene' | 'story'
    }>,
    update: CompiledRecord,
  ): void {
    this.stateStore.applyUpdate(
      entry.stateScope === 'scene' ? STRAP_SCOPE_SCENE : STRAP_SCOPE_STORY,
      update,
      entry.stateScope === 'story' ? entry.storyId : undefined,
    )
  }

  /** Initializes player-scoped module services from the first solved snapshot. */
  private initializeModuleServices(
    solved: SolvedScene,
    instances: ReadonlyMap<string, RuntimeModuleServiceInstance> = this.moduleServiceInstances,
  ): void {
    for (const instance of instances.values()) instance.initializeScene?.(solved)
  }

  /** Notifies player-scoped capabilities after one solved scene reaches components. */
  private notifyModuleScenePresented(scene: SolvedScene): void {
    const playbackState = this.state === PLAYER_LIFECYCLE_PLAYING ? 'playing' : 'paused'
    for (const instance of this.moduleServiceInstances.values()) {
      instance.onScenePresented?.(scene, playbackState)
    }
  }

  /** Notifies player-scoped capabilities when the player changes playback state. */
  private notifyModulePlaybackState(state: 'playing' | 'paused'): void {
    for (const instance of this.moduleServiceInstances.values()) {
      instance.onPlaybackStateChange?.(state, this.currentTimeMs)
    }
  }

  /** Notifies player-scoped capabilities that own native clocks of one rate change. */
  private notifyModuleRateChange(rate: number): void {
    for (const instance of this.moduleServiceInstances.values()) instance.onRateChange?.(rate)
  }

  /** Lets one player-scoped capability provide the active logical clock. */
  private resolveModuleTimeline(fallbackTimeMs: number): number {
    let timeMs = fallbackTimeMs
    for (const instance of this.moduleServiceInstances.values()) {
      const resolved = instance.resolveTimelineMs?.(timeMs)
      if (resolved !== undefined && Number.isFinite(resolved) && resolved >= 0) timeMs = resolved
    }
    return timeMs
  }

  /** Composes structural policies while preserving one canonical order timeline. */
  private resolveStructuralOrder(
    previousOrder: RuntimeStructuralOrder,
    scene: SolvedScene,
    deltas: readonly MoveStateDelta[],
  ): RuntimeStructuralOrder {
    let order = previousOrder
    let resolvedByModule = false
    for (const instance of this.moduleServiceInstances.values()) {
      const resolve = instance.resolveStructuralOrder
      if (resolve === undefined) continue
      order = resolve(order, scene, deltas)
      resolvedByModule = true
    }
    return resolvedByModule ? order : applyStructuralDeltas(order, scene, deltas)
  }

  /** Sends generic placement deltas to player-scoped module services. */
  private notifyModuleMoveDeltas(
    before: SolvedScene | undefined,
    after: SolvedScene,
    excludedInstances: ReadonlySet<RuntimeModuleServiceInstance> = new Set(),
    deltas = before === undefined ? [] : diffSolvedScenes(before, after),
    instances: ReadonlyMap<string, RuntimeModuleServiceInstance> = this.moduleServiceInstances,
  ): void {
    if (before === undefined) return
    for (const delta of deltas) {
      for (const instance of instances.values()) {
        if (!excludedInstances.has(instance)) instance.onMoveDelta?.(delta)
      }
    }
  }

  /** Aborts staged module-service seek state before a grouped commit can occur. */
  private abortPendingModuleSeek(): void {
    for (const { handle } of this.pendingModuleSeekHandles.reverse()) handle.abort?.()
    this.pendingModuleSeekHandles = []
  }

  /** Closes every active capture before seek or final player teardown. */
  private cancelActiveCaptures(): void {
    for (const entry of this.captureSessions.values()) entry.session.cancel()
    this.captureSessions.clear()
    this.activeCaptureActions.clear()
    this.liveCaptureStateUpdates.clear()
  }

  /** Allocates one player-scoped identity for every live event dispatch. */
  private createRuntimeEventId(): string {
    const index = this.nextRuntimeEventId
    this.nextRuntimeEventId += 1
    return `runtime-dispatch:${this.compiledScene.scene.id}:${index}`
  }
}

/** Converts pure move-policy issues into the public diagnostic report. */
function collectSolvedMoveDiagnostics(solved: SolvedScene, diagnostics: DiagnosticCollector): void {
  for (const issue of solved.moveIssues) {
    diagnostics.warning(issue.code, issue.message, {
      refs: { sceneId: solved.scene.scene.id },
    })
  }
}

/** Builds one detached diagnostic report for a reconstructed scene. */
function createSolvedMoveDiagnostics(solved: SolvedScene): DiagnosticReport {
  const diagnostics = new DiagnosticCollector({ output: () => undefined })
  collectSolvedMoveDiagnostics(solved, diagnostics)
  return diagnostics.report()
}

/** Creates an empty diagnostic report for a player before its first seek. */
function createEmptyDiagnosticReport(): DiagnosticReport {
  return { all: [], warnings: [], errors: [] }
}

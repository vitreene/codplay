import type { DiagnosticOutput, DiagnosticReport } from '../../diagnostics'
import { DiagnosticCollector } from '../../diagnostics'
import type {
  CompiledFunctionCollection,
  CompiledScene,
} from '../../scene/compiled'
import { qualifyStructuredLengthStyle } from '../../scene/compiled'
import type { SceneDoc, SceneLifecycleOptions } from '../../scene/types'
import { cloneRecord, isPlainRecord } from '../../shared'
import type { EngineFrame } from '../engine'
import {
  RuntimeEngine,
  type RuntimeModuleServiceInstance,
  type RuntimeExternalPresentationHandle,
} from '../engine'
import {
  resolveRuntimeIdleOptions,
  RuntimeIdleMonitor,
  type RuntimeIdleOptions,
} from '../idle'
import { diffSolvedScenes } from '../move'
import {
  PLAYER_LIFECYCLE_DESTROYED,
  PLAYER_LIFECYCLE_IDLE,
  PLAYER_LIFECYCLE_PAUSED,
  PLAYER_LIFECYCLE_PLAYING,
  PLAYER_LIFECYCLE_READY,
  type PlayerLifecycleState,
} from '../config/player-lifecycle'
import { EVENT_INSERT_MODE_PERSIST_ONLY } from '../config/event-insertion'
import { TRACK_GLOBAL_ID } from '../config/track'
import { RenderSync } from './render-sync'
import type { RuntimeMaterializer } from '../materializer'
import type { RuntimeComponentRuntime } from '../components'
import {
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
} from './diagnostics'
import {
  type RuntimePlayerEmitInput,
} from './capture'
import {
  resolveStoryTrackId,
  validateStrapCollections,
  RuntimeEventDispatcher,
  type SolvedScene,
  type MountTargetDeclaration,
  type RuntimeEventDispatchResult,
  type RuntimeTrackEvent,
  type StrapCollections,
  type RuntimeSnapshot,
  type RuntimeSnapshotContribution,
  type RuntimeSnapshotContributionPatch,
  type RuntimeSnapshotPatch,
  type RuntimeSnapshotSetResult,
  type RuntimeStateStore,
} from './pipeline'
import { RuntimeTrackJournal } from './pipeline'
import { collectCompiledEventStartTimes } from './structural-timeline'
import {
  type RuntimePlayerEventime,
  type RuntimePlayerEventimeTarget,
  type RuntimePlayerEventimeResult,
} from './eventime'
import {
  isImmediateTrackControlEvent,
  normalizeRuntimeEventime,
  resolveEventimeTarget,
  shouldDispatchImmediateStoryEventime,
} from './runtime-player/eventime-routing'
import {
  collectSequenceEndOccurrences,
  compareSequenceEndOccurrences,
  isSequenceEndInRange,
  RUNTIME_SEQUENCE_END_EVENT_NAME,
  type RuntimeSequenceEndOccurrence,
} from './runtime-player/sequence-end'
import {
  freezeSnapshotRecord,
  isSnapshotValueRecord,
} from './runtime-player/snapshot-values'
import {
  initializeModuleServices,
  notifyModuleMoveDeltas,
  notifyModulePlaybackState,
  notifyModuleRateChange,
  resolveModuleTimeline,
} from './modules'
import {
  RuntimePlayerSceneState,
  type RuntimePlayerSceneStateContext,
} from './runtime-player/scene-state'
import {
  RuntimePlayerPresentation,
} from './runtime-player/presentation'
import { RuntimePlayerCaptureController } from './runtime-player/capture-controller'
import { RuntimePlayerSeekController } from './runtime-player/seek-controller'
import {
  projectInputValue,
  type RuntimeInputProjectionResult,
  type RuntimeInputProjectionTarget,
} from './input-projection'

export type { PlayerLifecycleState } from '../config/player-lifecycle'

/** Controls whether a refresh re-emits the currently active move occurrences. */
export type RuntimePlayerRefreshOptions = Readonly<{
  emitMotionOccurrences?: boolean
}>

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
  private discoveredDurationMs = 0
  private rate = 1
  private skipNextDelta = false
  private solvedScene: SolvedScene | undefined
  private snapshotContribution: RuntimeSnapshotContribution | undefined
  private includePersistOnlyInCurrent = true
  private readonly sceneState: RuntimePlayerSceneState
  private readonly presentation: RuntimePlayerPresentation
  private readonly captureController: RuntimePlayerCaptureController
  private readonly seekController: RuntimePlayerSeekController
  private readonly moduleServiceInstances = new Map<string, RuntimeModuleServiceInstance>()
  private nextRuntimeEventId = 0
  private readonly diagnosticOutput: DiagnosticOutput | undefined
  private readonly publicEventListener: ((event: RuntimeTrackEvent) => void) | undefined
  private readonly traceEventListener: ((event: RuntimeTrackEvent) => void) | undefined
  private readonly journalChangeListener: (() => void) | undefined
  private readonly idleMonitor: RuntimeIdleMonitor
  private readonly observedPublicEventIds = new Set<string>()
  private readonly transportListeners = new Set<() => void>()
  private sequenceEnded = false
  private sequenceEndPending = false

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
    diagnosticOutput?: DiagnosticOutput,
    publicEventListener?: (event: RuntimeTrackEvent) => void,
    idle?: RuntimeIdleOptions,
    traceEventListener?: (event: RuntimeTrackEvent) => void,
    journalChangeListener?: () => void,
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
    this.captureController = new RuntimePlayerCaptureController({
      compiledScene,
      functions,
      getStateStore: () => this.stateStore,
      componentRuntime,
      getCurrentTimeMs: () => this.currentTimeMs,
      getSolvedScene: () => this.solvedScene,
      synchronizeState: () => this.sceneState.synchronize(
        this.currentTimeMs,
        this.includePersistOnlyInCurrent,
      ),
      requireCaptureState: () => this.requireState(
        PLAYER_LIFECYCLE_READY,
        PLAYER_LIFECYCLE_PLAYING,
        PLAYER_LIFECYCLE_PAUSED,
      ),
      emitEvent: (input, includePersistOnlyOverride) => this.emitEvent(
        input,
        includePersistOnlyOverride,
      ),
    })
    const sceneStateContext: RuntimePlayerSceneStateContext = {
      compiledScene,
      functions,
      trackJournal: this.trackJournal,
      mountTargets,
      moduleServiceInstances: this.moduleServiceInstances,
      liveCaptureStateUpdates: this.captureController.liveCaptureStateUpdates,
      captureSessions: this.captureController.captureSessions,
    }
    this.sceneState = new RuntimePlayerSceneState(sceneStateContext)
    this.stateStore = this.sceneState.stateStore
    this.presentation = new RuntimePlayerPresentation({
      componentRuntime,
      materializer,
      moduleServiceInstances: this.moduleServiceInstances,
      sceneState: this.sceneState,
      getLifecycleState: () => this.state,
      getIncludePersistOnly: () => this.includePersistOnlyInCurrent,
      getSnapshotContribution: () => this.snapshotContribution,
      applyLiveCaptureActions: (scene) => this.captureController.applyLiveCaptureActions(scene),
    })
    this.seekController = new RuntimePlayerSeekController({
      getLifecycleState: () => this.state,
      requireSequenceActive: (operation) => this.requireSequenceActive(operation),
      getCurrentTimeMs: () => this.currentTimeMs,
      setCurrentTimeMs: (timeMs) => { this.currentTimeMs = timeMs },
      getDiscoveredDurationMs: () => this.discoveredDurationMs,
      setDiscoveredDurationMs: (timeMs) => { this.discoveredDurationMs = timeMs },
      getIncludePersistOnly: () => this.includePersistOnlyInCurrent,
      setIncludePersistOnly: (includePersistOnly) => {
        this.includePersistOnlyInCurrent = includePersistOnly
      },
      getSkipNextDelta: () => this.skipNextDelta,
      setSkipNextDelta: (skip) => { this.skipNextDelta = skip },
      getSolvedScene: () => this.solvedScene,
      setSolvedScene: (scene) => { this.solvedScene = scene },
      getSnapshotContribution: () => this.snapshotContribution,
      trackJournal: this.trackJournal,
      sceneState: this.sceneState,
      moduleServiceInstances: this.moduleServiceInstances,
      presentation: this.presentation,
      renderSync: this.renderSync,
      engine: this.engine,
      cancelCaptures: () => this.captureController.cancelAll(),
      notifyTransportObservers: () => this.notifyTransportObservers(),
    })
    this.diagnosticOutput = diagnosticOutput
    this.publicEventListener = publicEventListener
    this.traceEventListener = traceEventListener
    this.journalChangeListener = journalChangeListener
    this.idleMonitor = new RuntimeIdleMonitor(
      idle === undefined ? engine.getIdleOptions() : resolveRuntimeIdleOptions(idle),
    )
  }

  /** Returns the current lifecycle state. */
  getLifecycleState(): PlayerLifecycleState {
    return this.state
  }

  /** Returns the logical time advanced by the engine or set by seek. */
  getCurrentTimeMs(): number {
    return this.currentTimeMs
  }

  /** Returns whether playback has reached the terminal sequence:end boundary. */
  hasSequenceEnded(): boolean {
    return this.sequenceEnded
  }

  /** Returns the largest open playback horizon discovered by the head or events. */
  getDiscoveredDurationMs(): number {
    let durationMs = Math.max(this.discoveredDurationMs, this.currentTimeMs)
    for (const timeMs of collectCompiledEventStartTimes(this.compiledScene)) {
      durationMs = Math.max(durationMs, timeMs)
    }
    for (const timeMs of this.trackJournal.getEventTimes()) {
      durationMs = Math.max(durationMs, timeMs)
    }
    this.discoveredDurationMs = durationMs
    return this.discoveredDurationMs
  }

  /** Subscribes to logical position updates produced by the shared engine circuit. */
  subscribeTransport(listener: () => void): () => void {
    this.transportListeners.add(listener)
    return () => { this.transportListeners.delete(listener) }
  }

  /** Returns the currently presented solved scene for a host transaction. */
  getSolvedScene(): SolvedScene | undefined {
    return this.solvedScene
  }

  /** Returns the resolved logical frame without any active preview contribution. */
  getSnapshot(): RuntimeSnapshot | undefined {
    if (this.state === PLAYER_LIFECYCLE_IDLE || this.state === PLAYER_LIFECYCLE_DESTROYED) return undefined
    const scene = this.sceneState.reconstruct(this.currentTimeMs, this.includePersistOnlyInCurrent)
    return {
      timeMs: scene.timeMs,
      states: Object.freeze(Object.values(scene.persos).map((perso) => Object.freeze({
        storyId: perso.storyId,
        persoId: perso.persoId,
        state: freezeSnapshotRecord(perso.state),
      }))),
    }
  }

  /** Projects one live input value without changing the journal or logical state. */
  projectInputValue(
    target: RuntimeInputProjectionTarget,
    value: string | number,
  ): RuntimeInputProjectionResult {
    if (this.state === PLAYER_LIFECYCLE_DESTROYED) {
      return { ok: false, code: 'TIME_NOT_PRESENTED' }
    }
    if (this.state === PLAYER_LIFECYCLE_IDLE || this.solvedScene === undefined) {
      return { ok: false, code: 'TIME_NOT_PRESENTED' }
    }
    return projectInputValue({
      scene: this.solvedScene,
      componentRuntime: this.componentRuntime,
      target,
      value,
    })
  }

  /** Validates, replaces, and presents one logical preview snapshot atomically. */
  setSnapshot(patches: readonly RuntimeSnapshotPatch[]): RuntimeSnapshotSetResult {
    if (this.state === PLAYER_LIFECYCLE_DESTROYED) return { ok: false, code: 'INSTANCE_DESTROYED' }
    if (this.state === PLAYER_LIFECYCLE_IDLE || this.solvedScene === undefined) {
      return { ok: false, code: 'TIME_NOT_PRESENTED' }
    }
    const baseScene = this.sceneState.reconstruct(this.currentTimeMs, this.includePersistOnlyInCurrent)
    const normalized: RuntimeSnapshotContributionPatch[] = []
    for (const patch of patches) {
      if (!Number.isFinite(patch.timeMs) || patch.timeMs !== this.currentTimeMs) {
        return { ok: false, code: 'TIME_NOT_PRESENTED' }
      }
      if (!isPlainRecord(patch.state) || !isPlainRecord(patch.state.style)) {
        return { ok: false, code: 'INVALID_PATCH' }
      }
      if (Object.keys(patch.state).some((key) => key !== 'style')
        || !isSnapshotValueRecord(patch.state.style)) {
        return { ok: false, code: 'INVALID_PATCH' }
      }
      const target = Object.values(baseScene.persos).find((perso) => (
        perso.storyId === patch.storyId && perso.persoId === patch.persoId
      ))
      if (target === undefined) return { ok: false, code: 'TARGET_NOT_PRESENT' }
      normalized.push({
        storyId: patch.storyId,
        persoId: patch.persoId,
        timeMs: patch.timeMs,
        state: { style: cloneRecord(qualifyStructuredLengthStyle(patch.state.style)) },
      })
    }

    const previousContribution = this.snapshotContribution
    const previousScene = this.solvedScene
    this.snapshotContribution = normalized.length === 0
      ? undefined
      : { timeMs: this.currentTimeMs, patches: Object.freeze(normalized) }
    try {
      const nextScene = this.sceneState.reconstruct(
        this.currentTimeMs,
        this.includePersistOnlyInCurrent,
        this.snapshotContribution,
      )
      this.solvedScene = nextScene
      this.presentation.present(nextScene, { previousScene, moveDeltas: [] })
      return { ok: true }
    } catch (error) {
      this.snapshotContribution = previousContribution
      this.solvedScene = previousScene
      throw error
    }
  }

  /** Clears the active logical preview and re-presents the base resolved frame. */
  clearSnapshot(): void {
    if (this.snapshotContribution === undefined) return
    const previousContribution = this.snapshotContribution
    const previousScene = this.solvedScene
    this.snapshotContribution = undefined
    try {
      const nextScene = this.sceneState.reconstruct(this.currentTimeMs, this.includePersistOnlyInCurrent)
      this.solvedScene = nextScene
      this.presentation.present(nextScene, { previousScene, moveDeltas: [] })
    } catch (error) {
      this.snapshotContribution = previousContribution
      this.solvedScene = previousScene
      throw error
    }
  }

  /** Reconstructs one solved scene for a historical host presentation. */
  resolveSceneAt(timeMs: number, includePersistOnly = true): SolvedScene {
    return this.sceneState.reconstruct(timeMs, includePersistOnly, this.snapshotContribution)
  }

  /** Reconstructs the exact logical state immediately before one event boundary. */
  resolveSceneBeforeBoundary(timeMs: number, includePersistOnly = true): SolvedScene {
    return this.sceneState.reconstructBeforeBoundary(timeMs, includePersistOnly)
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
    this.presentation.presentForGeometryCapture(scene)
  }

  /** Prepares a module-owned presentation around an external host operation. */
  prepareExternalPresentation(
    componentId: string,
    kind: string,
    options?: unknown,
  ): RuntimeExternalPresentationHandle | undefined {
    if (this.state === PLAYER_LIFECYCLE_IDLE || this.state === PLAYER_LIFECYCLE_DESTROYED) return undefined
    return this.componentRuntime?.prepareExternalPresentation({
      componentId,
      kind,
      ...(options === undefined ? {} : { options }),
      timeMs: this.currentTimeMs,
    })
  }

  /** Validates capabilities and attaches this player to the shared engine. */
  init(): PlayerInitResult {
    const diagnostics = new DiagnosticCollector({ output: this.diagnosticOutput })
    if (this.state !== PLAYER_LIFECYCLE_IDLE) {
      diagnostics.error('RUNTIME_PLAYER_STATE_INVALID', 'Player can only be initialized from idle state.', {
        context: { state: this.state },
      })
      return { ok: false, diagnostics: diagnostics.report() }
    }
    for (const issue of validateStrapCollections(this.compiledScene, this.strapCollections, this.functions)) {
      diagnostics.warning(issue.code, issue.message, {
        context: { scope: issue.scope, storyId: issue.storyId, strapName: issue.strapName },
      })
    }
    this.engine.validateRequirements(this.compiledScene.requirements, diagnostics)
    if (diagnostics.hasErrors()) return { ok: false, diagnostics: diagnostics.report() }
    try {
      const moduleServiceInstances = this.engine.createModuleServiceInstances(
        this.id,
        this.compiledScene,
        this.compiledScene.requirements.modules,
        { componentSurfaces: this.componentRuntime?.getComponentSurfaces() },
      )
      this.moduleServiceInstances.clear()
      for (const [id, instance] of moduleServiceInstances) this.moduleServiceInstances.set(id, instance)
    } catch (error) {
      diagnostics.error('RUNTIME_MODULE_INIT_FAILED', error instanceof Error ? error.message : 'Runtime module initialization failed.')
      return { ok: false, diagnostics: diagnostics.report() }
    }
    this.componentRuntime?.setModuleServices(this.moduleServiceInstances)
    if (!this.invokeSceneLifecycleHook('init', diagnostics)) {
      return { ok: false, diagnostics: diagnostics.report() }
    }
    const initialSolvedScene = this.sceneState.reconstructBase(0)
    this.componentRuntime?.sync(initialSolvedScene)
    initializeModuleServices(this.moduleServiceInstances, initialSolvedScene)
    notifyModuleRateChange(this.moduleServiceInstances, this.rate)
    this.solvedScene = this.sceneState.reconstruct(0)
    this.sceneState.synchronizeFromScene(this.solvedScene)
    this.presentation.present(this.solvedScene, { moveDeltas: [] })
    collectSolvedMoveDiagnostics(this.solvedScene, diagnostics)
    this.engine.registerInstance(this.id, (frame) => this.onEngineFrame(frame), {
      validateSeek: (timeMs) => this.seekController.validate(timeMs),
      getSeekDiagnostics: () => this.seekController.getDiagnostics(),
      abortSeek: () => this.seekController.abort(),
      prepareSeek: () => this.renderSync.prepareSeek(),
      commitSeek: (timeMs) => this.seekController.commit(timeMs),
      presentSeek: () => this.seekController.present(),
      rollbackSeek: () => this.seekController.rollback(),
    })
    this.state = PLAYER_LIFECYCLE_READY
    return { ok: true, diagnostics: diagnostics.report() }
  }

  /** Starts logical playback without creating a clock or rendering anything. */
  play(): void {
    if (this.sequenceEnded) this.resetToInitialState()
    this.requireState(PLAYER_LIFECYCLE_READY, PLAYER_LIFECYCLE_PAUSED)
    const wasReady = this.state === PLAYER_LIFECYCLE_READY
    if (wasReady && !this.invokeSceneLifecycleHook('onStart')) {
      throw new Error('RUNTIME_SCENE_LIFECYCLE_FAILED: scene onStart hook failed.')
    }
    this.idleMonitor.reset()
    if (this.state === PLAYER_LIFECYCLE_PAUSED) {
      this.skipNextDelta = true
      this.renderSync.resume()
    }
    this.state = PLAYER_LIFECYCLE_PLAYING
    notifyModulePlaybackState(this.moduleServiceInstances, 'playing', this.currentTimeMs)
    const sequenceEnd = this.findSequenceEndBetween(undefined, this.currentTimeMs)
    if (sequenceEnd !== undefined) {
      this.currentTimeMs = sequenceEnd.applyAtMs
      this.discoveredDurationMs = Math.max(this.discoveredDurationMs, this.currentTimeMs)
      void this.dispatchReachedSequenceEnd(sequenceEnd).catch((error) => {
        this.reportAutomaticSequenceEndFailure(error)
      })
    }
  }

  /** Resets the initialized occurrence to its initial logical state in place. */
  reset(): void {
    this.requireState(
      PLAYER_LIFECYCLE_READY,
      PLAYER_LIFECYCLE_PAUSED,
      PLAYER_LIFECYCLE_PLAYING,
    )
    if (this.state === PLAYER_LIFECYCLE_PLAYING) {
      this.renderSync.pause()
      this.state = PLAYER_LIFECYCLE_PAUSED
      notifyModulePlaybackState(this.moduleServiceInstances, 'paused', this.currentTimeMs)
    }
    this.resetToInitialState()
  }

  /** Reconstructs the initial presentation before a reset or terminal replay. */
  private resetToInitialState(): void {
    const previousSolvedScene = this.solvedScene
    this.captureController.cancelAll()
    this.sequenceEnded = false
    this.sequenceEndPending = false
    this.idleMonitor.reset()
    this.currentTimeMs = 0
    this.discoveredDurationMs = 0
    this.trackJournal.reset()
    this.trackJournal.reconcileStoryIsolationAt(0)
    this.includePersistOnlyInCurrent = true
    this.snapshotContribution = undefined
    this.skipNextDelta = true
    this.observedPublicEventIds.clear()
    if (!this.invokeSceneLifecycleHook('init')) {
      throw new Error('RUNTIME_SCENE_LIFECYCLE_FAILED: scene init hook failed during replay.')
    }

    const nextSolvedScene = this.sceneState.reconstruct(0)
    this.sceneState.synchronizeFromScene(nextSolvedScene)
    const moveDeltas = previousSolvedScene === undefined
      ? []
      : diffSolvedScenes(previousSolvedScene, nextSolvedScene)
    notifyModuleMoveDeltas(this.moduleServiceInstances, previousSolvedScene, nextSolvedScene, new Set(), moveDeltas)
    this.solvedScene = nextSolvedScene
    this.presentation.present(nextSolvedScene, {
      previousScene: previousSolvedScene,
      moveDeltas,
      componentPhase: 'seek',
    })
    this.renderSync.seek(this.engine.getCurrentNowMs(), this.currentTimeMs)
    this.state = PLAYER_LIFECYCLE_READY
    this.notifyTransportObservers()
  }

  /** Pauses logical playback at the current engine-provided time. */
  pause(): void {
    this.requireSequenceActive('pause')
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
      const engineResult = this.engine.seek([{ instanceId: this.id, timeMs }])
      this.idleMonitor.reset()
      return { ok: true, timeMs, diagnostics: engineResult.diagnostics[this.id] ?? diagnostics.report() }
    } catch (error) {
      diagnostics.error(
        'RUNTIME_SEEK_FAILED',
        error instanceof Error ? error.message : 'Runtime seek failed.',
      )
      return { ok: false, timeMs, diagnostics: diagnostics.report() }
    }
  }

  /** Reapplies the current solved scene after a materializer-context change. */
  refresh(options: RuntimePlayerRefreshOptions = {}): void {
    if (this.solvedScene === undefined) throw new Error('Player has not been initialized.')
    this.componentRuntime?.sync(this.solvedScene, true)
    this.presentation.present(this.solvedScene, {
      previousScene: this.solvedScene,
      moveDeltas: [],
      ...(options.emitMotionOccurrences === true ? { forceMotionOccurrences: true } : {}),
    })
  }

  /**
   * Appends and routes one live event through the same journal later consumed
   * by seek, then refreshes the current materialization from that journal.
   */
  async emit(input: RuntimePlayerEmitInput): Promise<RuntimeEventDispatchResult> {
    return this.emitEvent(input)
  }

  /** Integrates one external relative eventime into the same runtime journal. */
  async emitEventime(
    eventime: RuntimePlayerEventime,
    target: RuntimePlayerEventimeTarget,
  ): Promise<RuntimePlayerEventimeResult> {
    this.requireState(PLAYER_LIFECYCLE_READY, PLAYER_LIFECYCLE_PLAYING, PLAYER_LIFECYCLE_PAUSED)
    this.requireSequenceActive('emitEventime')
    const normalized = normalizeRuntimeEventime(eventime, true)
    const resolvedTarget = resolveEventimeTarget(this.compiledScene, target)
    if (shouldDispatchImmediateStoryEventime(this.compiledScene, eventime, target)
      || isImmediateTrackControlEvent(eventime)) {
      const dispatched = await this.emitEvent({
        name: eventime.name,
        applyAtMs: this.currentTimeMs,
        trackId: resolvedTarget.trackId,
        storyId: resolvedTarget.storyId,
        visibility: normalized.eventime.visibility,
        data: normalized.eventime.data,
        mode: normalized.mode,
      })
      if (!dispatched.ok) {
        throw new Error(dispatched.issues.map((issue) => issue.message).join(' '))
      }
      return { events: dispatched.events }
    }
    const appended = this.trackJournal.appendAnchoredEventimes({
      trackId: resolvedTarget.trackId,
      storyId: resolvedTarget.storyId,
      anchorMs: this.currentTimeMs,
      eventimes: [normalized.eventime],
      mode: normalized.mode,
    })
    if (!appended.ok) throw new Error(appended.message)
    this.idleMonitor.reset()
    this.includePersistOnlyInCurrent = normalized.mode !== EVENT_INSERT_MODE_PERSIST_ONLY
    if (normalized.mode === EVENT_INSERT_MODE_PERSIST_ONLY) {
      this.sceneState.synchronize(this.currentTimeMs, false)
    }
    this.notifyTraceEvents(appended.data.events)
    this.journalChangeListener?.()
    const resetStoryIds = normalized.mode === EVENT_INSERT_MODE_PERSIST_ONLY
      ? []
      : this.resolvePresentedResetStoryIds(appended.data.events)
    if (resetStoryIds.length > 0 && this.solvedScene !== undefined) {
      const previousSolvedScene = this.solvedScene
      const nextSolvedScene = this.sceneState.reconstruct(
        this.currentTimeMs,
        this.includePersistOnlyInCurrent,
        this.snapshotContribution,
      )
      const moveDeltas = diffSolvedScenes(previousSolvedScene, nextSolvedScene)
      this.sceneState.synchronizeFromScene(nextSolvedScene)
      notifyModuleMoveDeltas(this.moduleServiceInstances, previousSolvedScene, nextSolvedScene, new Set(), moveDeltas)
      this.solvedScene = nextSolvedScene
      this.presentation.present(nextSolvedScene, {
        previousScene: previousSolvedScene,
        moveDeltas,
        resetStoryIds,
      })
      this.notifyTransportObservers()
    }
    return appended.data
  }

  /** Routes one event with an optional internal presentation boundary policy. */
  private async emitEvent(
    input: RuntimePlayerEmitInput,
    includePersistOnlyOverride?: boolean,
    resetIdle = true,
    existingEvent?: RuntimeTrackEvent,
    frame?: EngineFrame,
    publicEventPreviousTimeMs?: number,
  ): Promise<RuntimeEventDispatchResult> {
    this.requireState(PLAYER_LIFECYCLE_READY, PLAYER_LIFECYCLE_PLAYING, PLAYER_LIFECYCLE_PAUSED)
    this.requireSequenceActive('emit')
    const dispatchInput = {
      ...input,
      applyAtMs: input.applyAtMs ?? this.currentTimeMs,
    }
    const waitsForTerminalDispatch = this.state === PLAYER_LIFECYCLE_PLAYING
      && dispatchInput.mode !== EVENT_INSERT_MODE_PERSIST_ONLY
      && dispatchInput.name === RUNTIME_SEQUENCE_END_EVENT_NAME
    if (waitsForTerminalDispatch) this.sequenceEndPending = true
    this.sceneState.synchronize(this.currentTimeMs, this.includePersistOnlyInCurrent)
    const dispatcher = new RuntimeEventDispatcher({
      scene: this.compiledScene,
      journal: this.trackJournal,
      strapCollections: this.strapCollections,
      functions: this.functions,
      stateStore: this.stateStore,
      eventIdFactory: () => this.createRuntimeEventId(),
    })
    try {
      const result = await dispatcher.dispatch(dispatchInput, existingEvent)
      this.notifyTraceEvents(existingEvent === undefined
        ? result.events
        : result.events.filter((event) => event.eventId !== existingEvent.eventId))
      if (resetIdle && result.events.length > 0) this.idleMonitor.reset()
      if (includePersistOnlyOverride !== undefined) {
        this.includePersistOnlyInCurrent = includePersistOnlyOverride
      } else if (dispatchInput.mode === EVENT_INSERT_MODE_PERSIST_ONLY) {
        this.includePersistOnlyInCurrent = false
      }
      this.sceneState.synchronize(this.currentTimeMs, this.includePersistOnlyInCurrent)
      // A persist-only event is recorded for later reconstruction, but it is
      // deliberately outside the current playback head. In particular, do not
      // reconstruct or materialize here: the source may still be presenting the
      // final live capture value until the next normal frame or seek.
      if (dispatchInput.mode === EVENT_INSERT_MODE_PERSIST_ONLY) {
        this.sequenceEndPending = false
        return result
      }
      const sequenceEndTime = this.resolveSequenceEndEventTime(result.events, this.currentTimeMs)
      if (this.state === PLAYER_LIFECYCLE_PLAYING && sequenceEndTime !== undefined) {
        this.currentTimeMs = Math.min(this.currentTimeMs, sequenceEndTime)
      }
      const nextSolvedScene = this.sceneState.reconstruct(
        this.currentTimeMs,
        this.includePersistOnlyInCurrent,
        this.snapshotContribution,
      )
      const previousSolvedScene = this.solvedScene
      const moveDeltas = previousSolvedScene === undefined
        ? []
        : diffSolvedScenes(previousSolvedScene, nextSolvedScene)
      const resetStoryIds = this.resolvePresentedResetStoryIds(result.events)
      const isolationClosedStoryIds = result.isolationClosedStoryIds ?? []
      notifyModuleMoveDeltas(this.moduleServiceInstances, previousSolvedScene, nextSolvedScene, new Set(), moveDeltas)
      this.solvedScene = nextSolvedScene
      this.presentation.present(nextSolvedScene, {
        previousScene: previousSolvedScene,
        moveDeltas,
        ...(resetStoryIds.length === 0
          ? {}
          : { resetStoryIds }),
        ...(isolationClosedStoryIds.length === 0 ? {} : { isolationClosedStoryIds }),
      })
      if (frame !== undefined) this.renderSync.tick(frame.nowMs, this.currentTimeMs, this.rate)
      this.notifyTransportObservers()
      if (this.state === PLAYER_LIFECYCLE_PLAYING && sequenceEndTime !== undefined) {
        this.notifyPublicEvents(publicEventPreviousTimeMs ?? this.currentTimeMs, this.currentTimeMs)
        this.finalizeSequenceEnd(sequenceEndTime)
      } else {
        this.sequenceEndPending = false
      }
      return result
    } catch (error) {
      this.sequenceEndPending = false
      throw error
    }
  }

  /** Opens one source-agnostic capture session against the current player state. */
  beginCapture(input: RuntimeCaptureBeginInput): RuntimeCaptureBeginResult {
    return this.captureController.begin(input)
  }

  /** Resolves a compiled capture declaration before opening the runtime session. */
  beginCompiledCapture(input: RuntimeCompiledCaptureBeginInput): RuntimeCaptureBeginResult {
    return this.captureController.beginCompiled(input)
  }

  /** Forwards one source sample to an existing capture without journal writes. */
  trackCapture(captureId: string, sample: RuntimeCaptureSample): RuntimeCaptureTrackResult {
    return this.captureController.track(captureId, sample)
  }

  /** Closes one capture and routes each declared end event through RuntimePlayer.emit(). */
  async endCapture(
    captureId: string,
    meta: Readonly<Record<string, unknown>> = {},
    captureStateOverride?: RuntimeCaptureState,
  ): Promise<RuntimeCapturePlayerEndResult | RuntimeCaptureFailure> {
    return this.captureController.end(captureId, meta, captureStateOverride)
  }

  /** Cancels one open capture without producing an event or state update. */
  cancelCapture(captureId: string): Readonly<{ ok: true } | RuntimeCaptureFailure> {
    return this.captureController.cancel(captureId)
  }

  /** Detaches the player from the engine and closes its lifecycle. */
  destroy(): void {
    if (this.state === PLAYER_LIFECYCLE_DESTROYED) return
    this.captureController.cancelAll()
    this.seekController.abort()
    for (const instance of this.moduleServiceInstances.values()) instance.destroy?.()
    this.moduleServiceInstances.clear()
    this.engine.unregisterInstance(this.id)
    this.renderSync.stop()
    this.materializer?.destroy?.()
    this.componentRuntime?.destroy()
    this.transportListeners.clear()
    this.state = PLAYER_LIFECYCLE_DESTROYED
  }

  /** Applies one engine frame to the logical clock while playing. */
  private onEngineFrame(frame: EngineFrame): void {
    if (this.state !== PLAYER_LIFECYCLE_PLAYING || this.sequenceEnded || this.sequenceEndPending) return
    if (this.skipNextDelta) {
      this.skipNextDelta = false
      this.renderSync.tick(frame.nowMs, this.currentTimeMs, this.rate)
      return
    }
    const previousTimeMs = this.currentTimeMs
    this.currentTimeMs += frame.deltaMs * this.rate
    if (this.idleMonitor.advance(frame.deltaMs)) this.dispatchIdleEvent()
    if (this.sequenceEndPending) return
    this.currentTimeMs = resolveModuleTimeline(this.moduleServiceInstances, this.currentTimeMs)
    this.discoveredDurationMs = Math.max(this.discoveredDurationMs, this.currentTimeMs)
    const sequenceEnd = this.findSequenceEndBetween(previousTimeMs, this.currentTimeMs)
    if (sequenceEnd !== undefined) {
      this.currentTimeMs = sequenceEnd.applyAtMs
      this.discoveredDurationMs = Math.max(this.discoveredDurationMs, this.currentTimeMs)
      void this.dispatchReachedSequenceEnd(sequenceEnd, frame, previousTimeMs).catch((error) => {
        this.reportAutomaticSequenceEndFailure(error)
      })
      return
    }
    const frameScene = this.sceneState.resolveFrame(
      previousTimeMs,
      this.currentTimeMs,
      this.includePersistOnlyInCurrent,
      this.solvedScene,
      this.snapshotContribution,
    )
    const nextSolvedScene = frameScene.scene
    const previousSolvedScene = this.solvedScene
    const moveDeltas = frameScene.reconstructed && previousSolvedScene !== undefined
      ? diffSolvedScenes(previousSolvedScene, nextSolvedScene)
      : []
    if (frameScene.reconstructed) {
      this.sceneState.synchronizeFromScene(nextSolvedScene)
      notifyModuleMoveDeltas(this.moduleServiceInstances, previousSolvedScene, nextSolvedScene, new Set(), moveDeltas)
    }
    this.solvedScene = nextSolvedScene
    this.presentation.present(this.solvedScene, { previousScene: previousSolvedScene, moveDeltas })
    this.notifyPublicEvents(previousSolvedScene?.timeMs ?? this.currentTimeMs, this.currentTimeMs)
    this.renderSync.tick(frame.nowMs, this.currentTimeMs, this.rate)
    this.notifyTransportObservers()
  }

  /** Emits the configured idle event through the ordinary player event circuit. */
  private dispatchIdleEvent(): void {
    const event = this.idleMonitor.getEvent()
    if (event === undefined) return
    void this.emitEvent({
      name: event.name,
      applyAtMs: this.currentTimeMs,
      data: event.data,
      visibility: event.visibility,
      storyId: event.storyId,
      context: { source: 'idle' },
    }, undefined, false).then((result) => {
      if (result.ok) return
      const diagnostics = new DiagnosticCollector({ output: this.diagnosticOutput })
      diagnostics.error(
        'RUNTIME_IDLE_EVENT_FAILED',
        result.issues.map((issue) => issue.message).join(' ') || 'Configured idle event was rejected.',
        { context: { eventName: event.name, source: 'idle' } },
      )
    }).catch((error: unknown) => {
      const diagnostics = new DiagnosticCollector({ output: this.diagnosticOutput })
      diagnostics.error(
        'RUNTIME_IDLE_EVENT_FAILED',
        error instanceof Error ? error.message : 'Configured idle event failed.',
        { context: { eventName: event.name, source: 'idle' } },
      )
    })
  }

  /** Sends one reached sequence:end through the ordinary event circuit. */
  private async dispatchReachedSequenceEnd(
    occurrence: RuntimeSequenceEndOccurrence,
    frame?: EngineFrame,
    publicEventPreviousTimeMs?: number,
  ): Promise<void> {
    const existingEvent = occurrence.kind === 'journal' ? occurrence.event : undefined
    const result = await this.emitEvent(
      occurrence.kind === 'journal'
        ? {
          name: occurrence.event.name,
          applyAtMs: occurrence.event.applyAtMs,
          eventId: occurrence.event.eventId,
          trackId: occurrence.event.trackId,
          storyId: occurrence.event.storyId,
          data: occurrence.event.data,
          visibility: occurrence.event.visibility,
          context: occurrence.event.context,
          meta: occurrence.event.meta,
          mode: occurrence.event.mode,
        }
        : {
          name: occurrence.event.name,
          applyAtMs: occurrence.applyAtMs,
          eventId: occurrence.eventId,
          trackId: occurrence.trackId,
          storyId: occurrence.storyId,
          data: occurrence.event.data,
          visibility: occurrence.event.visibility,
        },
      undefined,
      false,
      existingEvent,
      frame,
      publicEventPreviousTimeMs,
    )
    if (result.ok) return
    this.reportAutomaticSequenceEndFailure(
      new Error(result.issues.map((issue) => issue.message).join(' ') || 'Reached sequence:end was rejected.'),
    )
  }

  /** Reports a failure while consuming an automatic sequence:end occurrence. */
  private reportAutomaticSequenceEndFailure(error: unknown): void {
    const diagnostics = new DiagnosticCollector({ output: this.diagnosticOutput })
    diagnostics.error(
      'RUNTIME_SEQUENCE_END_FAILED',
      error instanceof Error ? error.message : 'Reached sequence:end failed.',
      { context: { eventName: RUNTIME_SEQUENCE_END_EVENT_NAME, source: 'playback' } },
    )
  }

  /** Publishes one logical position update without creating another frame loop. */
  private notifyTransportObservers(): void {
    for (const listener of [...this.transportListeners]) listener()
  }

  /** Forwards successfully journaled live events without affecting playback. */
  private notifyTraceEvents(events: readonly RuntimeTrackEvent[]): void {
    if (this.traceEventListener === undefined) return
    for (const event of events) {
      try {
        this.traceEventListener(event)
      } catch {
        // Trace observers are diagnostic context consumers and must not break the event circuit.
      }
    }
  }

  /** Selects reset boundaries that are effective at the current presentation head. */
  private resolvePresentedResetStoryIds(events: readonly RuntimeTrackEvent[]): readonly string[] {
    const storyIds = new Set<string>()
    for (const event of events) {
      if (event.applyAtMs > this.currentTimeMs
        || event.mode === EVENT_INSERT_MODE_PERSIST_ONLY
        || !this.trackJournal.isTrackActive(event.trackId)) continue
      for (const storyId of Object.keys(this.compiledScene.scene.stories)) {
        if (this.trackJournal.isStoryResetEvent(storyId, event)) storyIds.add(storyId)
      }
    }
    return [...storyIds]
  }

  /** Enforces one valid lifecycle transition. */
  private requireState(...allowed: PlayerLifecycleState[]): void {
    if (!allowed.includes(this.state)) {
      throw new Error(`Player cannot perform this operation from ${this.state} state.`)
    }
  }

  /** Rejects commands that V1 forbids after the terminal sequence boundary. */
  private requireSequenceActive(operation: string): void {
    if (this.sequenceEnded) {
      throw new Error(`PLAYER_SEQUENCE_ENDED: ${operation} is not allowed after sequence:end.`)
    }
  }

  /** Runs one extracted V1-compatible scene lifecycle callback. */
  private invokeSceneLifecycleHook(
    hookName: 'init' | 'onStart' | 'onSequenceEnd',
    diagnostics = new DiagnosticCollector({ output: this.diagnosticOutput }),
  ): boolean {
    const reference = this.compiledScene.scene[hookName]
    if (reference === undefined) return true
    const hook = this.functions[reference.ref]
    if (hook === undefined) {
      diagnostics.error(
        'RUNTIME_SCENE_LIFECYCLE_UNAVAILABLE',
        `Scene lifecycle function is unavailable: ${hookName}.`,
        { context: { sceneId: this.compiledScene.scene.id, hookName, functionRef: reference.ref } },
      )
      return false
    }
    try {
      const scene = this.compiledScene.scene as unknown as SceneDoc
      const options: SceneLifecycleOptions = { schedule: () => undefined }
      hook(scene, options)
      return true
    } catch (error) {
      diagnostics.error(
        'RUNTIME_SCENE_LIFECYCLE_FAILED',
        error instanceof Error ? error.message : `Scene lifecycle function failed: ${hookName}.`,
        { context: { sceneId: this.compiledScene.scene.id, hookName, functionRef: reference.ref } },
      )
      return false
    }
  }

  /** Finds the earliest active terminal event crossed by one playing frame. */
  private findSequenceEndBetween(
    previousTimeMs: number | undefined,
    currentTimeMs: number,
  ): RuntimeSequenceEndOccurrence | undefined {
    const candidates: RuntimeSequenceEndOccurrence[] = []
    if (this.trackJournal.isTrackActive(TRACK_GLOBAL_ID)) {
      for (const occurrence of collectSequenceEndOccurrences(
        this.compiledScene.scene.eventimes ?? [],
        'scene',
        TRACK_GLOBAL_ID,
        undefined,
      )) {
        if (occurrence.kind !== 'compiled') continue
        if (this.trackJournal.getEvents(occurrence.trackId)
          .some((event) => event.eventId === occurrence.eventId)) continue
        if (isSequenceEndInRange(occurrence.applyAtMs, previousTimeMs, currentTimeMs)) candidates.push(occurrence)
      }
    }
    for (const story of Object.values(this.compiledScene.scene.stories)) {
      const trackId = resolveStoryTrackId(story)
      if (!this.trackJournal.isTrackActive(trackId)) continue
      for (const occurrence of collectSequenceEndOccurrences(story.eventimes ?? [], 'story', trackId, story.id)) {
        if (occurrence.kind !== 'compiled') continue
        if (this.trackJournal.getEvents(occurrence.trackId)
          .some((event) => event.eventId === occurrence.eventId)) continue
        if (isSequenceEndInRange(occurrence.applyAtMs, previousTimeMs, currentTimeMs)) candidates.push(occurrence)
      }
    }
    for (const event of this.trackJournal.getAllEvents()) {
      if (event.name !== RUNTIME_SEQUENCE_END_EVENT_NAME
        || event.mode === EVENT_INSERT_MODE_PERSIST_ONLY
        || !this.trackJournal.isTrackActive(event.trackId)) continue
      if (isSequenceEndInRange(event.applyAtMs, previousTimeMs, currentTimeMs)) {
        candidates.push({ kind: 'journal', event, applyAtMs: event.applyAtMs })
      }
    }
    return candidates.length === 0
      ? undefined
      : candidates.sort(compareSequenceEndOccurrences)[0]
  }

  /** Finds a terminal event accepted by one live dispatch at or before the head. */
  private resolveSequenceEndEventTime(
    events: readonly RuntimeTrackEvent[],
    currentTimeMs: number,
  ): number | undefined {
    const candidates = events
      .filter((event) => event.name === RUNTIME_SEQUENCE_END_EVENT_NAME
        && event.mode !== EVENT_INSERT_MODE_PERSIST_ONLY
        && event.applyAtMs <= currentTimeMs
        && this.trackJournal.isTrackActive(event.trackId))
      .map((event) => event.applyAtMs)
    return candidates.length === 0 ? undefined : Math.min(...candidates)
  }

  /** Applies V1 terminal cleanup and invokes the scene hook after cleanup. */
  private finalizeSequenceEnd(sequenceEndMs: number): void {
    if (this.sequenceEnded) return
    this.sequenceEndPending = false
    this.sequenceEnded = true
    this.captureController.cancelAll()
    this.idleMonitor.reset()
    this.currentTimeMs = Math.max(0, Math.min(this.currentTimeMs, sequenceEndMs))
    this.discoveredDurationMs = Math.max(this.discoveredDurationMs, this.currentTimeMs)
    this.renderSync.pause()
    this.state = PLAYER_LIFECYCLE_PAUSED
    notifyModulePlaybackState(this.moduleServiceInstances, 'paused', this.currentTimeMs)
    this.invokeSceneLifecycleHook('onSequenceEnd')
    this.notifyTransportObservers()
  }

  /** Allocates one player-scoped identity for every live event dispatch. */
  private createRuntimeEventId(): string {
    const index = this.nextRuntimeEventId
    this.nextRuntimeEventId += 1
    return `runtime-dispatch:${this.compiledScene.scene.id}:${index}`
  }

  /** Publishes newly reached public eventime occurrences without replaying seeks. */
  private notifyPublicEvents(previousTimeMs: number, currentTimeMs: number): void {
    if (this.publicEventListener === undefined) return
    for (const event of this.trackJournal.getAllEvents()) {
      if (event.visibility !== 'public') continue
      if (event.applyAtMs > currentTimeMs || event.applyAtMs < previousTimeMs) continue
      if (this.observedPublicEventIds.has(event.eventId)) continue
      this.observedPublicEventIds.add(event.eventId)
      this.publicEventListener(event)
    }
  }

}

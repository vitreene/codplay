import type { DiagnosticOutput } from '../../../diagnostics'
import type {
  CompiledFunctionCollection,
  CompiledScene,
} from '../../../scene/compiled'
import type {
  RuntimeEngine,
  RuntimeExternalPresentationHandle,
  RuntimeModuleServiceInstance,
} from '../../engine'
import {
  resolveRuntimeIdleOptions,
  RuntimeIdleMonitor,
  type RuntimeIdleOptions,
} from '../../idle'
import {
  PLAYER_LIFECYCLE_DESTROYED,
  PLAYER_LIFECYCLE_IDLE,
  type PlayerLifecycleState,
} from '../../config/player-lifecycle'
import { RenderSync } from '../render-sync'
import type { RuntimeMaterializer } from '../../materializer'
import type { RuntimeComponentRuntime } from '../../components'
import type {
  RuntimeCaptureBeginInput,
  RuntimeCaptureBeginResult,
  RuntimeCaptureFailure,
  RuntimeCapturePlayerEndResult,
  RuntimeCaptureSample,
  RuntimeCaptureState,
  RuntimeCaptureTrackResult,
  RuntimeCompiledCaptureBeginInput,
} from '../../capture'
import type { RuntimePlayerEmitInput } from '../capture'
import {
  type MountTargetDeclaration,
  type RuntimeEventDispatchResult,
  type RuntimeSnapshot,
  type RuntimeSnapshotPatch,
  type RuntimeSnapshotSetResult,
  type RuntimeStateStore,
  type RuntimeTraceEvent,
  type RuntimeTrackEvent,
  type SolvedScene,
  type StrapCollections,
} from '../pipeline'
import { RuntimeTrackJournal } from '../pipeline'
import { collectCompiledEventStartTimes } from '../structural-timeline'
import type {
  RuntimePlayerEventime,
  RuntimePlayerEventimeResult,
  RuntimePlayerEventimeTarget,
} from '../eventime'
import { RuntimePlayerCaptureController } from './capture-controller'
import { RuntimePlayerEventController } from './event-controller'
import { RuntimePlayerLifecycleController } from './lifecycle-controller'
import { RuntimePlayerPresentation } from './presentation'
import { RuntimePlayerPresentationController } from './presentation-controller'
import { RuntimePlayerSceneState, type RuntimePlayerSceneStateContext } from './scene-state'
import { RuntimePlayerSeekController } from './seek-controller'
import { RuntimePlayerSnapshotController } from './snapshot-controller'
import { RuntimePlayerState } from './player-state'
import type {
  PlayerInitResult,
  PlayerSeekResult,
  RuntimePlayerRefreshOptions,
} from './player-types'

export type { PlayerLifecycleState } from '../../config/player-lifecycle'
export type {
  PlayerInitResult,
  PlayerSeekResult,
  RuntimePlayerRefreshOptions,
} from './player-types'

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

  private readonly state = new RuntimePlayerState()
  private readonly sceneState: RuntimePlayerSceneState
  private readonly presentation: RuntimePlayerPresentation
  private readonly captureController: RuntimePlayerCaptureController
  private readonly seekController: RuntimePlayerSeekController
  private readonly eventController: RuntimePlayerEventController
  private readonly lifecycleController: RuntimePlayerLifecycleController
  private readonly snapshotController: RuntimePlayerSnapshotController
  private readonly presentationController: RuntimePlayerPresentationController
  private readonly moduleServiceInstances = new Map<string, RuntimeModuleServiceInstance>()
  private readonly idleMonitor: RuntimeIdleMonitor
  private readonly transportListeners = new Set<() => void>()

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
    traceEventListener?: (event: RuntimeTraceEvent) => void,
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
    this.idleMonitor = new RuntimeIdleMonitor(
      idle === undefined ? engine.getIdleOptions() : resolveRuntimeIdleOptions(idle),
    )

    this.captureController = new RuntimePlayerCaptureController({
      compiledScene,
      functions,
      getStateStore: () => this.stateStore,
      componentRuntime,
      getCurrentTimeMs: () => this.state.currentTimeMs,
      getSolvedScene: () => this.state.solvedScene,
      synchronizeState: () => this.sceneState.synchronize(
        this.state.currentTimeMs,
        this.state.includePersistOnlyInCurrent,
      ),
      requireCaptureState: () => this.requireState('ready', 'playing', 'paused'),
      emitEvent: (input, includePersistOnlyOverride) => this.eventController.emitEvent(
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
      getLifecycleState: () => this.state.lifecycle,
      getIncludePersistOnly: () => this.state.includePersistOnlyInCurrent,
      getSnapshotContribution: () => this.state.snapshotContribution,
      applyLiveCaptureActions: (scene) => this.captureController.applyLiveCaptureActions(scene),
    })
    this.seekController = new RuntimePlayerSeekController({
      getLifecycleState: () => this.state.lifecycle,
      requireSequenceActive: (operation) => this.requireSequenceActive(operation),
      getCurrentTimeMs: () => this.state.currentTimeMs,
      setCurrentTimeMs: (timeMs) => { this.state.currentTimeMs = timeMs },
      getDiscoveredDurationMs: () => this.state.discoveredDurationMs,
      setDiscoveredDurationMs: (timeMs) => { this.state.discoveredDurationMs = timeMs },
      getIncludePersistOnly: () => this.state.includePersistOnlyInCurrent,
      setIncludePersistOnly: (includePersistOnly) => {
        this.state.includePersistOnlyInCurrent = includePersistOnly
      },
      getSkipNextDelta: () => this.state.skipNextDelta,
      setSkipNextDelta: (skip) => { this.state.skipNextDelta = skip },
      getSolvedScene: () => this.state.solvedScene,
      setSolvedScene: (scene) => { this.state.solvedScene = scene },
      getSnapshotContribution: () => this.state.snapshotContribution,
      trackJournal: this.trackJournal,
      sceneState: this.sceneState,
      moduleServiceInstances: this.moduleServiceInstances,
      presentation: this.presentation,
      renderSync: this.renderSync,
      engine: this.engine,
      cancelCaptures: () => this.captureController.cancelAll(),
      notifyTransportObservers: () => this.notifyTransportObservers(),
    })
    this.eventController = new RuntimePlayerEventController({
      state: this.state,
      compiledScene,
      strapCollections,
      trackJournal: this.trackJournal,
      functions,
      stateStore: this.stateStore,
      sceneState: this.sceneState,
      presentation: this.presentation,
      renderSync: this.renderSync,
      moduleServiceInstances: this.moduleServiceInstances,
      captureController: this.captureController,
      idleMonitor: this.idleMonitor,
      diagnosticOutput,
      publicEventListener,
      traceEventListener,
      journalChangeListener,
      notifyTransportObservers: () => this.notifyTransportObservers(),
      requireState: (...allowed) => this.requireState(...allowed),
      requireSequenceActive: (operation) => this.requireSequenceActive(operation),
      invokeSceneLifecycleHook: (hookName, diagnostics) => (
        this.lifecycleController.invokeSceneLifecycleHook(hookName, diagnostics)
      ),
    })
    this.lifecycleController = new RuntimePlayerLifecycleController({
      id,
      state: this.state,
      engine,
      compiledScene,
      strapCollections,
      trackJournal: this.trackJournal,
      functions,
      mountTargets,
      materializer,
      componentRuntime,
      stateStore: this.stateStore,
      sceneState: this.sceneState,
      presentation: this.presentation,
      captureController: this.captureController,
      seekController: this.seekController,
      eventController: this.eventController,
      moduleServiceInstances: this.moduleServiceInstances,
      renderSync,
      idleMonitor: this.idleMonitor,
      diagnosticOutput,
      notifyTransportObservers: () => this.notifyTransportObservers(),
      onEngineFrame: (frame) => this.eventController.onEngineFrame(frame),
    })
    this.snapshotController = new RuntimePlayerSnapshotController({
      state: this.state,
      sceneState: this.sceneState,
      presentation: this.presentation,
      componentRuntime,
      getLifecycleState: () => this.state.lifecycle,
    })
    this.presentationController = new RuntimePlayerPresentationController({
      state: this.state,
      componentRuntime,
      materializer,
      presentation: this.presentation,
      isReadyForPresentation: () => this.isReadyForPresentation(),
    })
  }

  /** Returns the current lifecycle state. */
  getLifecycleState(): PlayerLifecycleState {
    return this.state.lifecycle
  }

  /** Returns the logical time advanced by the engine or set by seek. */
  getCurrentTimeMs(): number {
    return this.state.currentTimeMs
  }

  /** Returns whether playback reached the terminal sequence boundary. */
  hasSequenceEnded(): boolean {
    return this.state.sequenceEnded
  }

  /** Returns the largest open playback horizon discovered by the head or events. */
  getDiscoveredDurationMs(): number {
    let durationMs = Math.max(
      this.state.discoveredDurationMs,
      this.state.currentTimeMs,
    )
    for (const timeMs of collectCompiledEventStartTimes(this.compiledScene)) {
      durationMs = Math.max(durationMs, timeMs)
    }
    for (const timeMs of this.trackJournal.getEventTimes()) {
      durationMs = Math.max(durationMs, timeMs)
    }
    this.state.discoveredDurationMs = durationMs
    return durationMs
  }

  /** Subscribes to logical position updates from the shared engine circuit. */
  subscribeTransport(listener: () => void): () => void {
    this.transportListeners.add(listener)
    return () => {
      this.transportListeners.delete(listener)
    }
  }

  /** Returns the currently presented solved scene for a host transaction. */
  getSolvedScene(): SolvedScene | undefined {
    return this.state.solvedScene
  }

  /** Returns the resolved logical frame without a preview contribution. */
  getSnapshot(): RuntimeSnapshot | undefined {
    return this.snapshotController.getSnapshot()
  }

  /** Projects one live input value without changing logical state. */
  projectInputValue(
    target: Parameters<RuntimePlayerSnapshotController['projectInputValue']>[0],
    value: string | number,
  ): ReturnType<RuntimePlayerSnapshotController['projectInputValue']> {
    return this.snapshotController.projectInputValue(target, value)
  }

  /** Validates, replaces and presents one logical preview snapshot atomically. */
  setSnapshot(patches: readonly RuntimeSnapshotPatch[]): RuntimeSnapshotSetResult {
    return this.snapshotController.setSnapshot(patches)
  }

  /** Clears the active logical preview and presents the base frame. */
  clearSnapshot(): void {
    this.snapshotController.clearSnapshot()
  }

  /** Reconstructs one solved scene for a historical host presentation. */
  resolveSceneAt(timeMs: number, includePersistOnly = true): SolvedScene {
    return this.snapshotController.resolveSceneAt(timeMs, includePersistOnly)
  }

  /** Reconstructs the state immediately before one event boundary. */
  resolveSceneBeforeBoundary(timeMs: number, includePersistOnly = true): SolvedScene {
    return this.snapshotController.resolveSceneBeforeBoundary(timeMs, includePersistOnly)
  }

  /** Returns whether the current presentation includes persisted-only facts. */
  includesPersistOnlyInCurrent(): boolean {
    return this.snapshotController.includesPersistOnlyInCurrent()
  }

  /** Presents one solved scene for runner-owned geometry capture. */
  presentSceneForGeometryCapture(scene: SolvedScene): void {
    this.presentationController.presentSceneForGeometryCapture(scene)
  }

  /** Prepares a module-owned presentation around an external host operation. */
  prepareExternalPresentation(
    componentId: string,
    kind: string,
    options?: unknown,
  ): RuntimeExternalPresentationHandle | undefined {
    return this.presentationController.prepareExternalPresentation(componentId, kind, options)
  }

  /** Validates capabilities and attaches this player to the shared engine. */
  init(): PlayerInitResult {
    return this.lifecycleController.init()
  }

  /** Starts logical playback without creating a clock. */
  play(): void {
    this.lifecycleController.play()
  }

  /** Resets the initialized occurrence to its initial logical state. */
  reset(): void {
    this.lifecycleController.reset()
  }

  /** Pauses logical playback at the current engine-provided time. */
  pause(): void {
    this.lifecycleController.pause()
  }

  /** Changes the player rate without changing the current timeline position. */
  setRate(rate: number): void {
    this.lifecycleController.setRate(rate)
  }

  /** Returns the currently configured player rate. */
  getRate(): number {
    return this.lifecycleController.getRate()
  }

  /** Positions logical time without replaying events or effects. */
  seek(timeMs: number): PlayerSeekResult {
    return this.lifecycleController.seek(timeMs)
  }

  /** Reapplies the current solved scene after a materializer-context change. */
  refresh(options: RuntimePlayerRefreshOptions = {}): void {
    this.presentationController.refresh(options)
  }

  /** Appends and routes one live event through the shared runtime journal. */
  async emit(input: RuntimePlayerEmitInput): Promise<RuntimeEventDispatchResult> {
    return this.eventController.emit(input)
  }

  /** Integrates one external relative eventime into the runtime journal. */
  async emitEventime(
    eventime: RuntimePlayerEventime,
    target: RuntimePlayerEventimeTarget,
  ): Promise<RuntimePlayerEventimeResult> {
    return this.eventController.emitEventime(eventime, target)
  }

  /** Opens one source-agnostic capture session against the current state. */
  beginCapture(input: RuntimeCaptureBeginInput): RuntimeCaptureBeginResult {
    return this.captureController.begin(input)
  }

  /** Resolves a compiled capture declaration before opening its session. */
  beginCompiledCapture(input: RuntimeCompiledCaptureBeginInput): RuntimeCaptureBeginResult {
    return this.captureController.beginCompiled(input)
  }

  /** Forwards one source sample to an existing capture. */
  trackCapture(captureId: string, sample: RuntimeCaptureSample): RuntimeCaptureTrackResult {
    return this.captureController.track(captureId, sample)
  }

  /** Closes one capture and routes each declared end event through emit. */
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
    this.lifecycleController.destroy()
    this.transportListeners.clear()
  }

  /** Returns whether presentation commands are valid for the current lifecycle. */
  private isReadyForPresentation(): boolean {
    return this.state.lifecycle !== PLAYER_LIFECYCLE_IDLE
      && this.state.lifecycle !== PLAYER_LIFECYCLE_DESTROYED
  }

  /** Enforces one valid lifecycle transition for dependent controllers. */
  private requireState(...allowed: PlayerLifecycleState[]): void {
    if (!allowed.includes(this.state.lifecycle)) {
      throw new Error(
        `Player cannot perform this operation from ${this.state.lifecycle} state.`,
      )
    }
  }

  /** Rejects commands after the terminal sequence boundary. */
  private requireSequenceActive(operation: string): void {
    if (this.state.sequenceEnded) {
      throw new Error(`PLAYER_SEQUENCE_ENDED: ${operation} is not allowed after sequence:end.`)
    }
  }

  /** Publishes one logical position update without creating another frame loop. */
  private notifyTransportObservers(): void {
    for (const listener of [...this.transportListeners]) {
      listener()
    }
  }
}

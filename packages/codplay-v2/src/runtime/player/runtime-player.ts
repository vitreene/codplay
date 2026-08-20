import type { DiagnosticReport } from '../../diagnostics'
import { DiagnosticCollector } from '../../diagnostics'
import type { CompiledFunctionCollection, CompiledScene } from '../../scene/compiled'
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
import { createTemporaryRenderSnapshotFromSolved, type TemporaryRenderSink } from './temporary-render-sink'
import { RenderSync } from './render-sync'
import type { RuntimeMaterializer, RuntimeMaterializerSceneContext } from '../materializer'
import type { RuntimeComponentRuntime } from '../components'
import {
  materializeScene,
  materializeSceneBeforeBoundary,
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
import { StructuralTimeline } from './structural-timeline'

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

/** One compiled-scene runtime instance with an optional materializer boundary. */
export class RuntimePlayer {
  readonly id: string
  readonly engine: RuntimeEngine
  readonly compiledScene: CompiledScene
  readonly renderSink: TemporaryRenderSink | undefined
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
  private skipNextDelta = false
  private solvedScene: SolvedScene | undefined
  private pendingSolvedScene: SolvedScene | undefined
  private pendingSeekDiagnostics: DiagnosticReport = createEmptyDiagnosticReport()
  private structuralTimeline: StructuralTimeline | undefined
  private moduleServiceInstances = new Map<string, RuntimeModuleServiceInstance>()
  private pendingModuleSeekHandles: Array<{
    instance: RuntimeModuleServiceInstance
    handle: RuntimeModuleServiceSeekHandle
  }> = []

  /** Creates one player bound to one engine and one immutable compiled scene. */
  constructor(
    id: string,
    engine: RuntimeEngine,
    compiledScene: CompiledScene,
    renderSink?: TemporaryRenderSink,
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
    this.renderSink = renderSink
    this.renderSync = renderSync
    this.strapCollections = strapCollections
    this.trackJournal = trackJournal ?? new RuntimeTrackJournal(compiledScene)
    this.functions = functions
    this.mountTargets = mountTargets
    this.materializer = materializer
    this.componentRuntime = componentRuntime
    this.stateStore = new RuntimeStateStore(compiledScene)
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
  resolveSceneAt(timeMs: number): SolvedScene {
    return this.reconstructScene(timeMs)
  }

  /** Reconstructs the exact logical state immediately before one event boundary. */
  resolveSceneBeforeBoundary(timeMs: number): SolvedScene {
    return this.reconstructSceneBeforeBoundary(timeMs)
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
    this.structuralTimeline = new StructuralTimeline(
      this.compiledScene,
      (timeMs) => this.reconstructBaseScene(timeMs),
      (timeMs) => this.reconstructBaseScene(timeMs, undefined, false),
    )
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
        const rawMoveDeltas = previousSolvedScene === undefined
          ? []
          : diffSolvedScenes(previousSolvedScene, this.pendingSolvedScene)
        const moveDeltas = rawMoveDeltas
        if (this.pendingModuleSeekHandles.length > 0) {
          const preparedInstances = new Set(this.pendingModuleSeekHandles.map((entry) => entry.instance))
          for (const { handle } of this.pendingModuleSeekHandles) handle.commit()
          this.notifyModuleMoveDeltas(previousSolvedScene, this.pendingSolvedScene, preparedInstances, moveDeltas)
          this.pendingModuleSeekHandles = []
        } else {
          this.notifyModuleMoveDeltas(previousSolvedScene, this.pendingSolvedScene, new Set(), moveDeltas)
        }
        this.solvedScene = this.pendingSolvedScene
        this.synchronizeStateStore(timeMs)
        this.materializeScene(this.solvedScene, { previousScene: previousSolvedScene, moveDeltas })
        this.pendingSolvedScene = undefined
        this.pendingSeekDiagnostics = createEmptyDiagnosticReport()
        this.currentTimeMs = timeMs
        this.skipNextDelta = true
      },
      presentSeek: () => {
        this.renderSync.seek(this.engine.getCurrentNowMs(), this.currentTimeMs)
        this.presentTemporarySnapshot()
      },
    })
    this.state = PLAYER_LIFECYCLE_READY
    this.presentTemporarySnapshot()
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
  }

  /** Pauses logical playback at the current engine-provided time. */
  pause(): void {
    this.requireState(PLAYER_LIFECYCLE_PLAYING)
    this.renderSync.pause()
    this.state = PLAYER_LIFECYCLE_PAUSED
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
    this.presentTemporarySnapshot()
  }

  /**
   * Appends and routes one live event through the same journal later consumed
   * by seek, then refreshes the current materialization from that journal.
   */
  async emit(input: Omit<RuntimeEventInput, 'applyAtMs'> & { applyAtMs?: number }): Promise<RuntimeEventDispatchResult> {
    this.requireState(PLAYER_LIFECYCLE_READY, PLAYER_LIFECYCLE_PLAYING, PLAYER_LIFECYCLE_PAUSED)
    this.synchronizeStateStore(this.currentTimeMs)
    const dispatcher = new RuntimeEventDispatcher({
      scene: this.compiledScene,
      journal: this.trackJournal,
      strapCollections: this.strapCollections,
      functions: this.functions,
      stateStore: this.stateStore,
    })
    const result = await dispatcher.dispatch({
      ...input,
      applyAtMs: input.applyAtMs ?? this.currentTimeMs,
    })
    this.synchronizeStateStore(this.currentTimeMs)
    const nextSolvedScene = this.reconstructScene(this.currentTimeMs)
    const previousSolvedScene = this.solvedScene
    const moveDeltas = previousSolvedScene === undefined
      ? []
      : diffSolvedScenes(previousSolvedScene, nextSolvedScene)
    this.notifyModuleMoveDeltas(previousSolvedScene, nextSolvedScene, new Set(), moveDeltas)
    this.solvedScene = nextSolvedScene
    this.materializeScene(nextSolvedScene, { previousScene: previousSolvedScene, moveDeltas })
    this.presentTemporarySnapshot()
    return result
  }

  /** Detaches the player from the engine and closes its lifecycle. */
  destroy(): void {
    if (this.state === PLAYER_LIFECYCLE_DESTROYED) return
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
      this.renderSync.tick(frame.nowMs, this.currentTimeMs, 1)
      this.presentTemporarySnapshot()
      return
    }
    this.currentTimeMs += frame.deltaMs
    const nextSolvedScene = this.reconstructScene(this.currentTimeMs)
    this.synchronizeStateStore(this.currentTimeMs)
    const previousSolvedScene = this.solvedScene
    const rawMoveDeltas = previousSolvedScene === undefined ? [] : diffSolvedScenes(previousSolvedScene, nextSolvedScene)
    const moveDeltas = rawMoveDeltas
    this.notifyModuleMoveDeltas(previousSolvedScene, nextSolvedScene, new Set(), moveDeltas)
    this.solvedScene = nextSolvedScene
    this.materializeScene(this.solvedScene, { previousScene: previousSolvedScene, moveDeltas })
    this.renderSync.tick(frame.nowMs, this.currentTimeMs, 1)
    this.presentTemporarySnapshot()
  }

  /** Presents the current solved perso data through the temporary render probe. */
  private presentTemporarySnapshot(): void {
    if (this.solvedScene === undefined) throw new Error('Player scene has not been reconstructed.')
    this.renderSink?.present(createTemporaryRenderSnapshotFromSolved(this.id, this.compiledScene, this.solvedScene))
  }

  /** Materializes one scene while keeping authored writes inside the render boundary. */
  private materializeScene(scene: SolvedScene, context: RuntimeMaterializerSceneContext): void {
    this.componentRuntime?.sync(scene)
    this.materializer?.materializeScene(scene, context)
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
  private reconstructScene(timeMs: number): SolvedScene {
    const structural = this.structuralTimeline?.resolveAt(timeMs)
    return this.reconstructBaseScene(timeMs, structural?.childrenByTarget)
  }

  /** Resolves the left side of one event boundary with the preceding structural order. */
  private reconstructSceneBeforeBoundary(timeMs: number): SolvedScene {
    const structural = this.structuralTimeline?.resolveBefore(timeMs)
    return this.reconstructBaseScene(timeMs, structural?.childrenByTarget, false)
  }

  /** Resolves one scene without consulting the structural timeline being built. */
  private reconstructBaseScene(
    timeMs: number,
    childrenByTarget?: Readonly<Record<string, readonly string[]>>,
    includeBoundary = true,
  ): SolvedScene {
    const materialized = includeBoundary
      ? materializeScene(this.compiledScene, timeMs, this.trackJournal)
      : materializeSceneBeforeBoundary(this.compiledScene, timeMs, this.trackJournal)
    return solveScene(resolveScene(materialized, this.functions), {
      mountTargets: [
        ...this.mountTargets,
        ...[...this.moduleServiceInstances.values()].flatMap((instance) => instance.getMountTargets?.() ?? []),
      ],
      ...(childrenByTarget === undefined ? {} : { childrenByTarget }),
    })
  }

  /** Reconciles the mutable strap input snapshot from the journal projection. */
  private synchronizeStateStore(timeMs: number): void {
    const materialized = materializeScene(this.compiledScene, timeMs, this.trackJournal)
    this.stateStore.replace(STRAP_SCOPE_SCENE, materialized.sceneState)
    for (const [storyId, state] of Object.entries(materialized.storyStates)) {
      this.stateStore.replace(STRAP_SCOPE_STORY, state, storyId)
    }
  }

  /** Initializes player-scoped module services from the first solved snapshot. */
  private initializeModuleServices(
    solved: SolvedScene,
    instances: ReadonlyMap<string, RuntimeModuleServiceInstance> = this.moduleServiceInstances,
  ): void {
    for (const instance of instances.values()) instance.initializeScene?.(solved)
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

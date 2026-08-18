import type { DiagnosticReport } from '../../diagnostics'
import { DiagnosticCollector } from '../../diagnostics'
import type { CompiledScene } from '../../scene/compiled'
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
import { createTemporaryRenderSnapshotFromSolved, type TemporaryRenderSink } from './temporary-render-sink'
import { RenderSync } from './render-sync'
import type { LayoutProjection } from './layout-projection'
import type { RuntimeComponentRuntime } from '../components'
import {
  materializeScene,
  resolveScene,
  RuntimeStateStore,
  solveScene,
  validateStrapCollections,
  type SolvedScene,
  type MountTargetDeclaration,
  type StrapCollections,
} from './pipeline'
import type { RuntimeTrackJournal } from './pipeline'

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

/** One compiled-scene runtime instance with an optional logical projection boundary. */
export class RuntimePlayer {
  readonly id: string
  readonly engine: RuntimeEngine
  readonly compiledScene: CompiledScene
  readonly renderSink: TemporaryRenderSink | undefined
  readonly renderSync: RenderSync
  readonly strapCollections: StrapCollections | undefined
  readonly trackJournal: RuntimeTrackJournal | undefined
  readonly stateStore: RuntimeStateStore
  readonly mountTargets: readonly MountTargetDeclaration[]
  readonly layoutProjection: LayoutProjection | undefined
  readonly componentRuntime: RuntimeComponentRuntime | undefined
  private state: PlayerLifecycleState = PLAYER_LIFECYCLE_IDLE
  private currentTimeMs = 0
  private skipNextDelta = false
  private solvedScene: SolvedScene | undefined
  private pendingSolvedScene: SolvedScene | undefined
  private pendingSeekDiagnostics: DiagnosticReport = createEmptyDiagnosticReport()
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
    layoutProjection?: LayoutProjection,
    componentRuntime?: RuntimeComponentRuntime,
  ) {
    this.id = id
    this.engine = engine
    this.compiledScene = compiledScene
    this.renderSink = renderSink
    this.renderSync = renderSync
    this.strapCollections = strapCollections
    this.trackJournal = trackJournal
    this.mountTargets = mountTargets
    this.layoutProjection = layoutProjection
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
    const initialSolvedScene = this.reconstructScene(0)
    this.initializeModuleServices(initialSolvedScene)
    this.solvedScene = this.reconstructScene(0)
    this.componentRuntime?.sync(this.solvedScene)
    if (this.componentRuntime !== undefined) {
      this.solvedScene = this.reconstructScene(0)
      this.componentRuntime.sync(this.solvedScene)
    }
    this.layoutProjection?.project(this.solvedScene, { phase: 'init', moveDeltas: [] })
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
        this.componentRuntime?.sync(this.solvedScene)
        this.layoutProjection?.project(this.solvedScene, { phase: 'seek', previousScene: previousSolvedScene, moveDeltas })
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

  /** Detaches the player from the engine and closes its lifecycle. */
  destroy(): void {
    if (this.state === PLAYER_LIFECYCLE_DESTROYED) return
    for (const instance of this.moduleServiceInstances.values()) instance.destroy?.()
    this.moduleServiceInstances.clear()
    this.abortPendingModuleSeek()
    this.engine.unregisterInstance(this.id)
    this.renderSync.stop()
    this.layoutProjection?.destroy?.()
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
    const previousSolvedScene = this.solvedScene
    const moveDeltas = previousSolvedScene === undefined ? [] : diffSolvedScenes(previousSolvedScene, nextSolvedScene)
    this.notifyModuleMoveDeltas(previousSolvedScene, nextSolvedScene, new Set(), moveDeltas)
    this.solvedScene = nextSolvedScene
    this.componentRuntime?.sync(this.solvedScene)
    this.layoutProjection?.project(this.solvedScene, { phase: 'frame', previousScene: previousSolvedScene, moveDeltas })
    this.layoutProjection?.advance?.(this.currentTimeMs)
    this.renderSync.tick(frame.nowMs, this.currentTimeMs, 1)
    this.presentTemporarySnapshot()
  }

  /** Presents the current solved perso data through the temporary render probe. */
  private presentTemporarySnapshot(): void {
    if (this.solvedScene === undefined) throw new Error('Player scene has not been reconstructed.')
    this.renderSink?.present(createTemporaryRenderSnapshotFromSolved(this.id, this.compiledScene, this.solvedScene))
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
    return solveScene(resolveScene(materializeScene(this.compiledScene, timeMs, this.trackJournal)), {
      mountTargets: [
        ...this.mountTargets,
        ...[...this.moduleServiceInstances.values()].flatMap((instance) => instance.getMountTargets?.() ?? []),
      ],
    })
  }

  /** Initializes player-scoped module services from the first solved snapshot. */
  private initializeModuleServices(solved: SolvedScene): void {
    for (const instance of this.moduleServiceInstances.values()) instance.initializeScene?.(solved)
  }

  /** Sends generic placement deltas to player-scoped module services. */
  private notifyModuleMoveDeltas(
    before: SolvedScene | undefined,
    after: SolvedScene,
    excludedInstances: ReadonlySet<RuntimeModuleServiceInstance> = new Set(),
    deltas = before === undefined ? [] : diffSolvedScenes(before, after),
  ): void {
    if (before === undefined) return
    for (const delta of deltas) {
      for (const instance of this.moduleServiceInstances.values()) {
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

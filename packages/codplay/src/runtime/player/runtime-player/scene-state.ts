import type { CompiledFunctionCollection, CompiledRecord, CompiledScene } from '../../../scene/compiled'
import type { RuntimeModuleServiceInstance } from '../../engine'
import { STRAP_SCOPE_SCENE, STRAP_SCOPE_STORY } from '../../config/strap-scope'
import {
  collectLogicalEvaluationBoundaries,
  hasActiveTimeDependentStateActions,
  hasEventBoundaryBetween,
  materializeScene,
  RuntimeStateStore,
  type MountTargetDeclaration,
  type SolvedScene,
} from '../pipeline'
import type { RuntimeCaptureSessionEntry } from '../capture'
import { reapplyLiveCaptureStateUpdates } from '../capture'
import { reconstructPlayerScene } from '../scene'
import { StructuralTimeline } from '../structural-timeline'
import { resolveStructuralOrder } from '../modules'
import type { RuntimeTrackJournal } from '../pipeline'
import type { RuntimeSnapshotContribution } from '../pipeline'

/** Dependencies owned by one player scene-state boundary. */
export type RuntimePlayerSceneStateContext = Readonly<{
  compiledScene: CompiledScene
  functions: CompiledFunctionCollection
  trackJournal: RuntimeTrackJournal
  mountTargets: readonly MountTargetDeclaration[]
  moduleServiceInstances: ReadonlyMap<string, RuntimeModuleServiceInstance>
  liveCaptureStateUpdates: ReadonlyMap<string, CompiledRecord>
  captureSessions: ReadonlyMap<string, RuntimeCaptureSessionEntry>
}>

/** Result of deciding whether the current frame needs a logical reconstruction. */
export type RuntimePlayerFrameScene = Readonly<{
  scene: SolvedScene
  reconstructed: boolean
}>

/** Owns scene reconstruction, structural order and mutable strap state. */
export class RuntimePlayerSceneState {
  readonly stateStore: RuntimeStateStore
  private readonly context: RuntimePlayerSceneStateContext
  private structuralTimeline: StructuralTimeline | undefined
  private structuralTimelineRevision = -1
  private structuralTimelineIncludesPersistOnly = true
  private logicalEvaluationBoundariesRevision = -1
  private logicalEvaluationBoundaries: readonly number[] = []

  /** Creates the scene-state boundary for one player. */
  constructor(context: RuntimePlayerSceneStateContext) {
    this.context = context
    this.stateStore = new RuntimeStateStore(context.compiledScene)
  }

  /** Reconstructs one scene without consulting the structural timeline. */
  reconstructBase(
    timeMs: number,
    includeBoundary = true,
    includePersistOnly = true,
    includeMoveOccurrences = true,
  ): SolvedScene {
    return this.reconstructBaseScene(
      timeMs,
      undefined,
      includeBoundary,
      includePersistOnly,
      undefined,
      includeMoveOccurrences,
    )
  }

  /** Reconstructs one solved scene at an absolute logical time. */
  reconstruct(
    timeMs: number,
    includePersistOnly = true,
    snapshotContribution?: RuntimeSnapshotContribution,
    includeMoveOccurrences = true,
  ): SolvedScene {
    this.ensureStructuralTimeline(includePersistOnly)
    const structural = this.structuralTimeline?.resolveAt(timeMs)
    return this.reconstructBaseScene(
      timeMs,
      structural?.childrenByTarget,
      true,
      includePersistOnly,
      snapshotContribution,
      includeMoveOccurrences,
    )
  }

  /** Reconstructs the exact logical state immediately before an event boundary. */
  reconstructBeforeBoundary(timeMs: number, includePersistOnly = true): SolvedScene {
    this.ensureStructuralTimeline(includePersistOnly)
    const structural = this.structuralTimeline?.resolveBefore(timeMs)
    return this.reconstructBaseScene(
      timeMs,
      structural?.childrenByTarget,
      false,
      includePersistOnly,
      undefined,
      true,
    )
  }

  /** Reuses the current logical scene when no state boundary was crossed. */
  resolveFrame(
    previousTimeMs: number,
    timeMs: number,
    includePersistOnly: boolean,
    currentScene: SolvedScene | undefined,
    snapshotContribution?: RuntimeSnapshotContribution,
  ): RuntimePlayerFrameScene {
    if (currentScene === undefined || this.shouldReconstructFrame(
      previousTimeMs,
      timeMs,
      currentScene,
      snapshotContribution,
    )) {
      return {
        scene: this.reconstruct(timeMs, includePersistOnly, snapshotContribution),
        reconstructed: true,
      }
    }
    return {
      scene: currentScene.timeMs === timeMs ? currentScene : { ...currentScene, timeMs },
      reconstructed: false,
    }
  }

  /** Returns cached logical boundaries and refreshes them after journal changes. */
  getLogicalEvaluationBoundaries(): readonly number[] {
    const revision = this.context.trackJournal.getRevision()
    if (this.logicalEvaluationBoundariesRevision !== revision) {
      this.logicalEvaluationBoundaries = collectLogicalEvaluationBoundaries(
        this.context.compiledScene,
        this.context.trackJournal,
      )
      this.logicalEvaluationBoundariesRevision = revision
    }
    return this.logicalEvaluationBoundaries
  }

  /** Replaces the mutable strap state with one solved scene snapshot. */
  synchronizeFromScene(scene: Pick<SolvedScene, 'sceneState' | 'storyStates'>): void {
    this.stateStore.replace(STRAP_SCOPE_SCENE, scene.sceneState)
    for (const [storyId, state] of Object.entries(scene.storyStates)) {
      this.stateStore.replace(STRAP_SCOPE_STORY, state, storyId)
    }
    reapplyLiveCaptureStateUpdates(
      this.stateStore,
      this.context.liveCaptureStateUpdates,
      this.context.captureSessions,
    )
  }

  /** Rebuilds mutable strap state from the journal at one logical time. */
  synchronize(timeMs: number, includePersistOnly = true): void {
    const scene = materializeScene(
      this.context.compiledScene,
      timeMs,
      this.context.trackJournal,
      { includePersistOnly },
    )
    this.synchronizeFromScene(scene)
  }

  /** Rebuilds the canonical structural timeline from compiled and runtime facts. */
  private rebuildStructuralTimeline(includePersistOnly: boolean): void {
    for (const instance of this.context.moduleServiceInstances.values()) instance.resetStructuralOrder?.()
    this.structuralTimeline = new StructuralTimeline(
      this.context.compiledScene,
      (timeMs) => this.reconstructBaseScene(timeMs, undefined, true, includePersistOnly, undefined, false),
      (timeMs) => this.reconstructBaseScene(timeMs, undefined, false, includePersistOnly, undefined, false),
      (previousOrder, scene, deltas) => resolveStructuralOrder(
        this.context.moduleServiceInstances,
        previousOrder,
        scene,
        deltas,
      ),
      this.context.trackJournal.getEventTimes(),
    )
    this.structuralTimelineRevision = this.context.trackJournal.getRevision()
    this.structuralTimelineIncludesPersistOnly = includePersistOnly
  }

  /** Rebuilds the structural timeline lazily after a journal or visibility change. */
  private ensureStructuralTimeline(includePersistOnly: boolean): void {
    if (this.structuralTimeline === undefined
      || this.structuralTimelineRevision !== this.context.trackJournal.getRevision()
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
    snapshotContribution?: RuntimeSnapshotContribution,
    includeMoveOccurrences = true,
  ): SolvedScene {
    return reconstructPlayerScene({
      compiledScene: this.context.compiledScene,
      functions: this.context.functions,
      trackJournal: this.context.trackJournal,
      mountTargets: this.context.mountTargets,
      moduleServiceInstances: this.context.moduleServiceInstances,
    }, timeMs, childrenByTarget, includeBoundary, includePersistOnly, snapshotContribution, includeMoveOccurrences)
  }

  /** Decides whether one advancing frame needs a fresh logical scene. */
  private shouldReconstructFrame(
    previousTimeMs: number,
    timeMs: number,
    currentScene: SolvedScene,
    snapshotContribution?: RuntimeSnapshotContribution,
  ): boolean {
    if (timeMs < currentScene.timeMs) return true
    if (snapshotContribution !== undefined && snapshotContribution.timeMs !== timeMs) return true
    if (this.structuralTimelineRevision !== this.context.trackJournal.getRevision()) return true
    if (hasActiveTimeDependentStateActions(currentScene)) return true
    return hasEventBoundaryBetween(this.getLogicalEvaluationBoundaries(), previousTimeMs, timeMs)
  }

}

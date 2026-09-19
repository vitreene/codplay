import type { DiagnosticReport } from '../../../diagnostics'
import type { RuntimeModuleServiceInstance, RuntimeModuleServiceSeekHandle } from '../../engine'
import {
  PLAYER_LIFECYCLE_DESTROYED,
  PLAYER_LIFECYCLE_IDLE,
  type PlayerLifecycleState,
} from '../../config/player-lifecycle'
import { diffSolvedScenes, type MoveStateDelta } from '../../move'
import type { RenderSync } from '../render-sync'
import type { RuntimeEngine } from '../../engine'
import type { RuntimeTrackJournal } from '../pipeline'
import type { RuntimeSnapshotContribution, SolvedScene } from '../pipeline'
import { createEmptyDiagnosticReport, createSolvedMoveDiagnostics } from '../diagnostics'
import { abortPendingModuleSeek, notifyModuleMoveDeltas } from '../modules'
import type { RuntimePlayerSceneState } from './scene-state'
import type { RuntimePlayerPresentation } from './presentation'

/** The reversible state retained while one player participates in a grouped seek. */
type RuntimePlayerSeekTransaction = {
  previousSolvedScene: SolvedScene | undefined
  previousTimeMs: number
  previousIncludePersistOnly: boolean
  previousSkipNextDelta: boolean
  moveDeltas: readonly MoveStateDelta[]
  preparedInstances: ReadonlySet<RuntimeModuleServiceInstance>
  committed: boolean
}

/** Dependencies used by one player-local seek transaction. */
export type RuntimePlayerSeekControllerContext = Readonly<{
  getLifecycleState: () => PlayerLifecycleState
  requireSequenceActive: (operation: string) => void
  getCurrentTimeMs: () => number
  setCurrentTimeMs: (timeMs: number) => void
  getDiscoveredDurationMs: () => number
  setDiscoveredDurationMs: (timeMs: number) => void
  getIncludePersistOnly: () => boolean
  setIncludePersistOnly: (includePersistOnly: boolean) => void
  getSkipNextDelta: () => boolean
  setSkipNextDelta: (skip: boolean) => void
  getSolvedScene: () => SolvedScene | undefined
  setSolvedScene: (scene: SolvedScene | undefined) => void
  getSnapshotContribution: () => RuntimeSnapshotContribution | undefined
  trackJournal: RuntimeTrackJournal
  sceneState: RuntimePlayerSceneState
  moduleServiceInstances: ReadonlyMap<string, RuntimeModuleServiceInstance>
  presentation: RuntimePlayerPresentation
  renderSync: RenderSync
  engine: RuntimeEngine
  cancelCaptures: () => void
  notifyTransportObservers: () => void
}>

/** Owns validation, preparation, commit and rollback for one player seek. */
export class RuntimePlayerSeekController {
  private readonly context: RuntimePlayerSeekControllerContext
  private pendingSolvedScene: SolvedScene | undefined
  private pendingDiagnostics: DiagnosticReport = createEmptyDiagnosticReport()
  private pendingModuleSeekHandles: Array<{
    instance: RuntimeModuleServiceInstance
    handle: RuntimeModuleServiceSeekHandle
  }> = []
  private transaction: RuntimePlayerSeekTransaction | undefined

  /** Creates the seek transaction boundary for one player instance. */
  constructor(context: RuntimePlayerSeekControllerContext) {
    this.context = context
  }

  /** Returns diagnostics produced while preparing the current seek. */
  getDiagnostics(): DiagnosticReport {
    return this.pendingDiagnostics
  }

  /** Validates and prepares one seek before the engine enters its group phases. */
  validate(timeMs: number): void {
    this.context.requireSequenceActive('seek')
    const state = this.context.getLifecycleState()
    if (state === PLAYER_LIFECYCLE_IDLE || state === PLAYER_LIFECYCLE_DESTROYED) {
      throw new Error(`Player cannot seek from ${state} state.`)
    }
    if (!Number.isFinite(timeMs) || timeMs < 0) {
      throw new Error('Player seek time must be a finite positive number.')
    }
    if (this.transaction !== undefined) {
      throw new Error('Player seek transaction is already active.')
    }

    const previousSolvedScene = this.context.getSolvedScene()
    this.transaction = {
      previousSolvedScene,
      previousTimeMs: this.context.getCurrentTimeMs(),
      previousIncludePersistOnly: this.context.getIncludePersistOnly(),
      previousSkipNextDelta: this.context.getSkipNextDelta(),
      moveDeltas: [],
      preparedInstances: new Set(),
      committed: false,
    }
    this.context.cancelCaptures()
    for (const instance of this.context.moduleServiceInstances.values()) {
      instance.beforeSeek?.(this.context.getCurrentTimeMs())
    }

    this.pendingSolvedScene = this.context.sceneState.reconstruct(
      timeMs,
      true,
      this.context.getSnapshotContribution(),
    )
    this.pendingDiagnostics = createSolvedMoveDiagnostics(this.pendingSolvedScene)
    this.pendingModuleSeekHandles = []
    try {
      for (const instance of this.context.moduleServiceInstances.values()) {
        const handle = instance.prepareSeek?.(this.pendingSolvedScene)
        if (handle !== undefined) this.pendingModuleSeekHandles.push({ instance, handle })
      }
    } catch (error) {
      abortPendingModuleSeek(this.pendingModuleSeekHandles)
      throw error
    }
  }

  /** Commits the prepared logical scene before presentation begins. */
  commit(timeMs: number): void {
    if (this.pendingSolvedScene === undefined || this.pendingSolvedScene.timeMs !== timeMs) {
      throw new Error('Player seek reconstruction is missing.')
    }
    const transaction = this.transaction
    if (transaction === undefined) throw new Error('Player seek transaction is missing.')
    const previousSolvedScene = transaction.previousSolvedScene
    const moveDeltas = previousSolvedScene === undefined
      ? []
      : diffSolvedScenes(previousSolvedScene, this.pendingSolvedScene)
    const preparedInstances = new Set(this.pendingModuleSeekHandles.map((entry) => entry.instance))
    for (const { handle } of this.pendingModuleSeekHandles) handle.commit()

    this.context.setSolvedScene(this.pendingSolvedScene)
    this.context.setIncludePersistOnly(true)
    this.context.sceneState.synchronizeFromScene(this.pendingSolvedScene)
    this.context.setCurrentTimeMs(timeMs)
    this.context.setDiscoveredDurationMs(Math.max(
      this.context.getDiscoveredDurationMs(),
      this.context.getCurrentTimeMs(),
    ))
    this.context.trackJournal.reconcileStoryIsolationAt(timeMs)
    this.context.setSkipNextDelta(true)
    transaction.moveDeltas = moveDeltas
    transaction.preparedInstances = preparedInstances
    transaction.committed = true
  }

  /** Presents the committed scene and closes the transaction. */
  present(): void {
    const transaction = this.transaction
    if (transaction === undefined || !transaction.committed) {
      throw new Error('Player seek commit is missing.')
    }
    const solvedScene = this.context.getSolvedScene()
    if (solvedScene === undefined) throw new Error('Player seek scene is missing.')
    notifyModuleMoveDeltas(
      this.context.moduleServiceInstances,
      transaction.previousSolvedScene,
      solvedScene,
      transaction.preparedInstances,
      transaction.moveDeltas,
    )
    this.context.presentation.replayForSeek(solvedScene)
    this.context.presentation.present(solvedScene, {
      previousScene: transaction.previousSolvedScene,
      moveDeltas: transaction.moveDeltas,
      componentPhase: 'seek',
    })
    this.context.renderSync.seek(
      this.context.engine.getCurrentNowMs(),
      this.context.getCurrentTimeMs(),
    )
    this.clearTransaction()
    this.context.notifyTransportObservers()
  }

  /** Aborts a seek before any participant has committed. */
  abort(): void {
    abortPendingModuleSeek(this.pendingModuleSeekHandles)
    this.restore(false)
  }

  /** Rolls back a seek after a participant has committed or presented. */
  rollback(): void {
    abortPendingModuleSeek(this.pendingModuleSeekHandles)
    this.restore(true)
  }

  /** Restores the previous player snapshot after a failed grouped seek. */
  private restore(represent: boolean): void {
    const transaction = this.transaction
    if (transaction === undefined) return
    const currentSolvedScene = this.context.getSolvedScene()
    try {
      this.context.setSolvedScene(transaction.previousSolvedScene)
      this.context.setCurrentTimeMs(transaction.previousTimeMs)
      this.context.trackJournal.reconcileStoryIsolationAt(transaction.previousTimeMs)
      this.context.setIncludePersistOnly(transaction.previousIncludePersistOnly)
      this.context.setSkipNextDelta(transaction.previousSkipNextDelta)
      if (transaction.previousSolvedScene !== undefined) {
        this.context.sceneState.synchronizeFromScene(transaction.previousSolvedScene)
      } else {
        this.context.sceneState.synchronize(
          transaction.previousTimeMs,
          transaction.previousIncludePersistOnly,
        )
      }
      if (represent && transaction.previousSolvedScene !== undefined) {
        const moveDeltas = currentSolvedScene === undefined
          ? []
          : diffSolvedScenes(currentSolvedScene, transaction.previousSolvedScene)
        this.context.presentation.present(transaction.previousSolvedScene, {
          previousScene: currentSolvedScene,
          moveDeltas,
          componentPhase: 'seek',
        })
        this.context.renderSync.seek(
          this.context.engine.getCurrentNowMs(),
          this.context.getCurrentTimeMs(),
        )
      }
    } finally {
      this.clearTransaction()
    }
  }

  /** Clears all transient data associated with the current transaction. */
  private clearTransaction(): void {
    this.pendingSolvedScene = undefined
    this.pendingDiagnostics = createEmptyDiagnosticReport()
    this.pendingModuleSeekHandles = []
    this.transaction = undefined
  }
}

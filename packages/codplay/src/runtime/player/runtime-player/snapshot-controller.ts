import { qualifyStructuredLengthStyle } from '../../../scene/compiled'
import { cloneRecord, isPlainRecord } from '../../../shared'
import {
  PLAYER_LIFECYCLE_DESTROYED,
  PLAYER_LIFECYCLE_IDLE,
  type PlayerLifecycleState,
} from '../../config/player-lifecycle'
import type { RuntimeComponentRuntime } from '../../components'
import type {
  RuntimeInputProjectionResult,
  RuntimeInputProjectionTarget,
} from '../input-projection'
import {
  projectInputValue,
} from '../input-projection'
import type {
  RuntimeSnapshot,
  RuntimeSnapshotContributionPatch,
  RuntimeSnapshotPatch,
  RuntimeSnapshotSetResult,
  SolvedScene,
} from '../pipeline'
import type { RuntimePlayerPresentation } from './presentation'
import type { RuntimePlayerSceneState } from './scene-state'
import {
  freezeSnapshotRecord,
  isSnapshotValueRecord,
} from './snapshot-values'
import type { RuntimePlayerState } from './player-state'

/** Dependencies used by the player snapshot and projection boundary. */
export type RuntimePlayerSnapshotControllerContext = Readonly<{
  state: RuntimePlayerState
  sceneState: RuntimePlayerSceneState
  presentation: RuntimePlayerPresentation
  componentRuntime: RuntimeComponentRuntime | undefined
  getLifecycleState: () => PlayerLifecycleState
}> 

/** Owns snapshot reconstruction, live projection and preview presentation. */
export class RuntimePlayerSnapshotController {
  private readonly context: RuntimePlayerSnapshotControllerContext

  /** Creates the snapshot boundary for one player instance. */
  constructor(context: RuntimePlayerSnapshotControllerContext) {
    this.context = context
  }

  /** Returns the resolved logical frame without any active preview contribution. */
  getSnapshot(): RuntimeSnapshot | undefined {
    const { state, sceneState } = this.context
    if (state.lifecycle === PLAYER_LIFECYCLE_IDLE
      || state.lifecycle === PLAYER_LIFECYCLE_DESTROYED) {
      return undefined
    }
    const scene = sceneState.reconstruct(
      state.currentTimeMs,
      state.includePersistOnlyInCurrent,
    )
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
    const { state } = this.context
    if (state.lifecycle === PLAYER_LIFECYCLE_DESTROYED
      || state.lifecycle === PLAYER_LIFECYCLE_IDLE
      || state.solvedScene === undefined) {
      return { ok: false, code: 'TIME_NOT_PRESENTED' }
    }
    return projectInputValue({
      scene: state.solvedScene,
      componentRuntime: this.context.componentRuntime,
      target,
      value,
    })
  }

  /** Validates, replaces and presents one logical preview snapshot atomically. */
  setSnapshot(patches: readonly RuntimeSnapshotPatch[]): RuntimeSnapshotSetResult {
    const { state, sceneState, presentation } = this.context
    if (state.lifecycle === PLAYER_LIFECYCLE_DESTROYED) {
      return { ok: false, code: 'INSTANCE_DESTROYED' }
    }
    if (state.lifecycle === PLAYER_LIFECYCLE_IDLE || state.solvedScene === undefined) {
      return { ok: false, code: 'TIME_NOT_PRESENTED' }
    }

    const baseScene = sceneState.reconstruct(
      state.currentTimeMs,
      state.includePersistOnlyInCurrent,
    )
    const normalized: RuntimeSnapshotContributionPatch[] = []
    for (const patch of patches) {
      if (!Number.isFinite(patch.timeMs) || patch.timeMs !== state.currentTimeMs) {
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
      if (target === undefined) {
        return { ok: false, code: 'TARGET_NOT_PRESENT' }
      }
      normalized.push({
        storyId: patch.storyId,
        persoId: patch.persoId,
        timeMs: patch.timeMs,
        state: { style: cloneRecord(qualifyStructuredLengthStyle(patch.state.style)) },
      })
    }

    const previousContribution = state.snapshotContribution
    const previousScene = state.solvedScene
    state.snapshotContribution = normalized.length === 0
      ? undefined
      : { timeMs: state.currentTimeMs, patches: Object.freeze(normalized) }
    try {
      const nextScene = sceneState.reconstruct(
        state.currentTimeMs,
        state.includePersistOnlyInCurrent,
        state.snapshotContribution,
      )
      state.solvedScene = nextScene
      presentation.present(nextScene, {
        previousScene,
        moveDeltas: [],
      })
      return { ok: true }
    } catch (error) {
      state.snapshotContribution = previousContribution
      state.solvedScene = previousScene
      throw error
    }
  }

  /** Clears the active logical preview and presents the base resolved frame. */
  clearSnapshot(): void {
    const { state, sceneState, presentation } = this.context
    if (state.snapshotContribution === undefined) {
      return
    }
    const previousContribution = state.snapshotContribution
    const previousScene = state.solvedScene
    state.snapshotContribution = undefined
    try {
      const nextScene = sceneState.reconstruct(
        state.currentTimeMs,
        state.includePersistOnlyInCurrent,
      )
      state.solvedScene = nextScene
      presentation.present(nextScene, {
        previousScene,
        moveDeltas: [],
      })
    } catch (error) {
      state.snapshotContribution = previousContribution
      state.solvedScene = previousScene
      throw error
    }
  }

  /** Reconstructs one solved scene for a historical host presentation. */
  resolveSceneAt(timeMs: number, includePersistOnly = true): SolvedScene {
    return this.context.sceneState.reconstruct(
      timeMs,
      includePersistOnly,
      this.context.state.snapshotContribution,
    )
  }

  /** Reconstructs the exact logical state immediately before one event boundary. */
  resolveSceneBeforeBoundary(timeMs: number, includePersistOnly = true): SolvedScene {
    return this.context.sceneState.reconstructBeforeBoundary(timeMs, includePersistOnly)
  }

  /** Returns whether the current presentation head includes persisted-only facts. */
  includesPersistOnlyInCurrent(): boolean {
    return this.context.state.includePersistOnlyInCurrent
  }
}

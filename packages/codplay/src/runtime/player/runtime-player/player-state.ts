import {
  PLAYER_LIFECYCLE_IDLE,
  type PlayerLifecycleState,
} from '../../config/player-lifecycle'
import type {
  RuntimeSnapshotContribution,
  SolvedScene,
} from '../pipeline'

/** Stores the mutable logical state shared by the player controllers. */
export class RuntimePlayerState {
  lifecycle: PlayerLifecycleState = PLAYER_LIFECYCLE_IDLE
  currentTimeMs = 0
  discoveredDurationMs = 0
  rate = 1
  skipNextDelta = false
  solvedScene: SolvedScene | undefined
  snapshotContribution: RuntimeSnapshotContribution | undefined
  includePersistOnlyInCurrent = true
  sequenceEnded = false
  sequenceEndPending = false
}


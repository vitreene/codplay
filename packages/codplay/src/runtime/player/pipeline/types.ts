import type { CompiledRecord, CompiledScene } from '../../../scene/compiled'
import type { MaterializedTrackRegistry } from './tracks'
import type { MountTarget } from './mount-targets'
import type { SolvedGraph } from './presentation-graph'
import type { MoveOrderMode, MovePolicyIssue } from '../../config/move'
import {
  MOUNT_PLACEMENT_INVALID,
  MOUNT_PLACEMENT_OFF,
  MOUNT_PLACEMENT_PARENT,
  MOUNT_PLACEMENT_ROOT,
  MOUNT_PLACEMENT_UNSPECIFIED,
  type MountPlacementKind,
  type MountPlacementSource,
} from '../../config/mount-placement'

/** Identifies one perso across one compiled scene evaluation. */
export type RuntimePersoIdentity = Readonly<{
  key: string
  storyId: string
  persoId: string
  type: string
}>

/** One discrete action active at a given timeline position. */
export type MaterializedAction = Readonly<{
  name: string
  startAt: number
  elapsedMs: number
  trackId: string
  trackOrder: number
  eventId?: string
  eventSeq?: number
  declarationPath: readonly number[]
  eventData?: CompiledRecord
  action: CompiledRecord
}>

/** Output of materialize: initial data plus active discrete occurrences. */
export type MaterializedPerso = RuntimePersoIdentity & Readonly<{
  initial: CompiledRecord
  actions: readonly MaterializedAction[]
}>

/** One move action emitted by materialization for the player presentation boundary. */
export type MaterializedMoveOccurrence = Readonly<{
  itemId: string
  action: MaterializedAction
}>

/** Scene data selected for one timeline position. */
export type MaterializedScene = Readonly<{
  scene: CompiledScene
  timeMs: number
  tracks: MaterializedTrackRegistry
  sceneState: CompiledRecord
  storyStates: Readonly<Record<string, CompiledRecord>>
  persos: Readonly<Record<string, MaterializedPerso>>
  /** Move actions already identified while the scene actions were materialized. */
  moveOccurrences?: readonly MaterializedMoveOccurrence[]
}>

/** Placement value selected from the authored initial state and active moves. */
export type ResolvedPlacement = Readonly<
  | { kind: typeof MOUNT_PLACEMENT_UNSPECIFIED; mode?: MoveOrderMode; reparent?: boolean; source?: MountPlacementSource }
  | { kind: typeof MOUNT_PLACEMENT_ROOT; mode?: MoveOrderMode; reparent?: boolean; source?: MountPlacementSource }
  | { kind: typeof MOUNT_PLACEMENT_OFF; mode?: MoveOrderMode; reparent?: boolean; source?: MountPlacementSource }
  | { kind: typeof MOUNT_PLACEMENT_PARENT; targetId: string; mode?: MoveOrderMode; reparent?: boolean; reorder?: boolean; source?: MountPlacementSource }
  | { kind: typeof MOUNT_PLACEMENT_INVALID; source?: MountPlacementSource }
>

/** Output of resolve before hierarchy and substrate materialization. */
export type ResolvedPerso = RuntimePersoIdentity & Readonly<{
  state: CompiledRecord
  /** Active action occurrences retained for player-scoped capabilities. */
  actions: readonly MaterializedAction[]
  placement: ResolvedPlacement
  moveIssues: readonly MovePolicyIssue[]
}>

/** Scene data after discrete patches and continuous values are resolved. */
export type ResolvedScene = Readonly<{
  scene: CompiledScene
  timeMs: number
  sceneState: CompiledRecord
  storyStates: Readonly<Record<string, CompiledRecord>>
  persos: Readonly<Record<string, ResolvedPerso>>
  /** Move actions carried from the canonical materialization boundary. */
  moveOccurrences?: readonly MaterializedMoveOccurrence[]
}>

/** Placement after resolving an opaque target through internal declarations. */
export type SolvedPlacement = Readonly<{
  kind: MountPlacementKind
  mounted: boolean
  targetId?: string
  target?: MountTarget
  parentKey?: string
  mode?: MoveOrderMode
  reparent?: boolean
  reorder?: boolean
  source?: MountPlacementSource
}>

/** Stable solve output consumed by the component and materializer boundary. */
export type SolvedPerso = RuntimePersoIdentity & Readonly<{
  state: CompiledRecord
  /** Active action occurrences retained for player-scoped capabilities. */
  actions?: readonly MaterializedAction[]
  placement: SolvedPlacement
  moveIssues: readonly MovePolicyIssue[]
}>

/** Scene data after the currently supported solve stage. */
export type SolvedScene = Readonly<{
  scene: CompiledScene
  timeMs: number
  sceneState: CompiledRecord
  storyStates: Readonly<Record<string, CompiledRecord>>
  persos: Readonly<Record<string, SolvedPerso>>
  graph: SolvedGraph
  moveIssues: readonly MovePolicyIssue[]
  /** Move actions carried from the canonical materialization boundary. */
  moveOccurrences?: readonly MaterializedMoveOccurrence[]
}>

import type { CompiledRecord, CompiledScene } from '../../../scene/compiled'
import type { MaterializedTrackRegistry } from './tracks'
import type { MountTarget } from './mount-targets'
import type { SolvedGraph } from './presentation-graph'
import type { MoveFlipMode, MoveOrderMode, MovePolicyIssue } from '../../config/move'
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

/** Scene data selected for one timeline position. */
export type MaterializedScene = Readonly<{
  scene: CompiledScene
  timeMs: number
  tracks: MaterializedTrackRegistry
  sceneState: CompiledRecord
  storyStates: Readonly<Record<string, CompiledRecord>>
  persos: Readonly<Record<string, MaterializedPerso>>
}>

/** Placement value selected from the authored initial state and active moves. */
export type ResolvedPlacement = Readonly<
  | { kind: typeof MOUNT_PLACEMENT_UNSPECIFIED; mode?: MoveOrderMode; flipMode?: MoveFlipMode; source?: MountPlacementSource }
  | { kind: typeof MOUNT_PLACEMENT_ROOT; mode?: MoveOrderMode; flipMode?: MoveFlipMode; source?: MountPlacementSource }
  | { kind: typeof MOUNT_PLACEMENT_OFF; mode?: MoveOrderMode; flipMode?: MoveFlipMode; source?: MountPlacementSource }
  | { kind: typeof MOUNT_PLACEMENT_PARENT; targetId: string; mode?: MoveOrderMode; flipMode?: MoveFlipMode; reorder?: boolean; source?: MountPlacementSource }
  | { kind: typeof MOUNT_PLACEMENT_INVALID; source?: MountPlacementSource }
>

/** Output of resolve before hierarchy and substrate materialization. */
export type ResolvedPerso = RuntimePersoIdentity & Readonly<{
  state: CompiledRecord
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
}>

/** Placement after resolving an opaque target through internal declarations. */
export type SolvedPlacement = Readonly<{
  kind: MountPlacementKind
  mounted: boolean
  targetId?: string
  target?: MountTarget
  parentKey?: string
  mode?: MoveOrderMode
  flipMode?: MoveFlipMode
  reorder?: boolean
  source?: MountPlacementSource
}>

/** Stable solve output consumed by the component and materializer boundary. */
export type SolvedPerso = RuntimePersoIdentity & Readonly<{
  state: CompiledRecord
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
}>

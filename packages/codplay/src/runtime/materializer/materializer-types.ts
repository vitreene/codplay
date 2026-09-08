import type { RuntimeModuleServiceInstance } from '../engine/module-service-types'
import type { BaseComponent } from '../components/base-component'
import type { RuntimeComponentHandle } from '../components/runtime-component-runtime'
import type { RuntimeComponentIdentity } from '../catalog'
import type { MoveStateDelta } from '../move'
import type { MaterializedAction, SolvedScene } from '../player/pipeline/types'

/** One resolved move occurrence that may require a presentation capture. */
export type RuntimeMoveOccurrence = Readonly<{
  itemId: string
  startAt: number
  eventId?: string
  eventSeq?: number
  declarationPath: readonly number[]
  /** Complete action after event-data resolution, including the move payload. */
  action: MaterializedAction
  /** Logical stories touched by the source and destination snapshots. */
  beforeStoryIds: readonly string[]
  afterStoryIds: readonly string[]
}>

/** Context supplied when one materializer applies a solved scene. */
export type RuntimeMaterializerSceneContext = Readonly<{
  previousScene?: SolvedScene
  moveDeltas: readonly MoveStateDelta[]
  /** Move actions that became visible at this materialization boundary. */
  motionOccurrences?: readonly RuntimeMoveOccurrence[]
  /**
   * Identifies an internal geometry-capture presentation. It must update the
   * persistent author materialization without triggering playback side effects.
   */
  phase?: 'normal' | 'geometry-capture'
  /** Stories whose event projection just crossed a reset boundary. */
  resetStoryIds?: readonly string[]
}>

/** Single materializer boundary consumed by the component runtime and player. */
export type RuntimeMaterializer = Readonly<{
  id: string
  context: unknown
  materializeComponent: (
    component: BaseComponent<Record<string, unknown>>,
    identity: RuntimeComponentIdentity,
    initial: Record<string, unknown>,
    mountablePartIds: readonly string[] | 'all',
    moduleServices: ReadonlyMap<string, RuntimeModuleServiceInstance>,
  ) => RuntimeComponentHandle
  materializeScene: (scene: SolvedScene, context?: RuntimeMaterializerSceneContext) => void
  /** Marks structure dirty after an external transient presentation releases nodes. */
  invalidateStructure?: () => void
  destroy?: () => void
}>

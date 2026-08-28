import type { RuntimeModuleServiceInstance } from '../engine/module-service-types'
import type { BaseComponent } from '../components/base-component'
import type { RuntimeComponentHandle } from '../components/runtime-component-runtime'
import type { RuntimeComponentIdentity } from '../catalog'
import type { MoveStateDelta } from '../move'
import type { SolvedScene } from '../player/pipeline/types'

/** Context supplied when one materializer applies a solved scene. */
export type RuntimeMaterializerSceneContext = Readonly<{
  previousScene?: SolvedScene
  moveDeltas: readonly MoveStateDelta[]
  /**
   * Identifies an internal geometry-capture presentation. It must update the
   * persistent author materialization without triggering playback side effects.
   */
  phase?: 'normal' | 'geometry-capture'
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

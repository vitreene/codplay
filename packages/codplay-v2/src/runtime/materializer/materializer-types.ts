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
}>

/** Single materializer boundary consumed by the component runtime and player. */
export type RuntimeMaterializer = Readonly<{
  id: string
  context: unknown
  materializeComponent: (
    component: BaseComponent<Record<string, unknown>>,
    identity: RuntimeComponentIdentity,
    initial: Record<string, unknown>,
    mountablePartIds: readonly string[],
    moduleServices: ReadonlyMap<string, RuntimeModuleServiceInstance>,
  ) => RuntimeComponentHandle
  materializeScene: (scene: SolvedScene, context?: RuntimeMaterializerSceneContext) => void
  destroy?: () => void
}>

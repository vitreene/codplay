import type { RuntimeMaterializer, RuntimeMaterializerSceneContext } from '../materializer'
import type { BaseComponent, RuntimeComponentHandle, RuntimeComponentIdentity } from '../components'
import type { RuntimeModuleServiceInstance } from '../engine'
import type { SolvedScene } from '../player/pipeline'

/** Applies component and scene materialization before one absolute-time motion frame. */
export class MotionMaterializer implements RuntimeMaterializer {
  readonly id: string
  readonly context: unknown
  private readonly base: RuntimeMaterializer
  private readonly presentMotion: (timeMs: number) => void

  /** Creates the single materialization boundary shared by Play and Seek. */
  constructor(base: RuntimeMaterializer, presentMotion: (timeMs: number) => void) {
    this.base = base
    this.id = base.id
    this.context = base.context
    this.presentMotion = presentMotion
  }

  /** Delegates one component render to the underlying materializer. */
  materializeComponent(
    component: BaseComponent<Record<string, unknown>>,
    identity: RuntimeComponentIdentity,
    initial: Record<string, unknown>,
    mountablePartIds: readonly string[] | 'all',
    moduleServices: ReadonlyMap<string, RuntimeModuleServiceInstance>,
  ): RuntimeComponentHandle {
    return this.base.materializeComponent(component, identity, initial, mountablePartIds, moduleServices)
  }

  /** Commits authored structure and resolves motion at the same absolute time. */
  materializeScene(scene: SolvedScene, context: RuntimeMaterializerSceneContext = { moveDeltas: [] }): void {
    this.base.materializeScene(scene, context)
    if (context.phase === 'geometry-capture') return
    this.presentMotion(scene.timeMs)
  }

  /** Forwards an external transient-structure invalidation to the base host. */
  invalidateStructure(): void {
    this.base.invalidateStructure?.()
  }

  /** Releases the underlying materialization. */
  destroy(): void {
    this.base.destroy?.()
  }
}

import type { SolvedScene } from '../player/pipeline'
import type { RuntimeModuleServiceInstance } from '../engine'
import type { BaseComponent } from './base-component'
import { RuntimeCapabilityCatalog, type RuntimeComponentIdentity } from '../catalog'
import type { RuntimeMaterializer } from '../materializer'

export type { RuntimeComponentIdentity } from '../catalog'

/** Final cleanup returned after one component has been materialized. */
export type RuntimeComponentHandle = Readonly<{
  destroy: () => void
}>

/** Host callbacks required to materialize and service one component instance. */
export type RuntimeComponentRuntimeOptions = Readonly<{
  catalog: RuntimeCapabilityCatalog
  materializer: RuntimeMaterializer
}>

type MountedComponent = Readonly<{
  component: BaseComponent<Record<string, unknown>>
  handle: RuntimeComponentHandle
}>

/** Synchronizes compiled solved persos with a player-local component host. */
export class RuntimeComponentRuntime {
  private readonly mounted = new Map<string, MountedComponent>()
  private readonly options: RuntimeComponentRuntimeOptions
  private moduleServices: ReadonlyMap<string, RuntimeModuleServiceInstance> = new Map()

  /** Creates the runtime host from its factory and materialization callbacks. */
  constructor(options: RuntimeComponentRuntimeOptions) {
    this.options = options
  }

  /** Binds the player-scoped module instances before component materialization. */
  setModuleServices(moduleServices: ReadonlyMap<string, RuntimeModuleServiceInstance>): void {
    this.moduleServices = moduleServices
  }

  /**
   * Synchronizes the logical scene without destroying persistent component instances.
   * Structural unmounting is handled by the materializer; final cleanup is handled by destroy().
   */
  sync(scene: SolvedScene): void {
    for (const perso of Object.values(scene.persos)) {
      const mounted = this.mounted.get(perso.key) ?? this.mountComponent(scene, perso.key)
      mounted.component.update({ state: perso.state, timeMs: scene.timeMs })
    }
  }

  /** Applies one transient live state through the same component update path. */
  updateLive(
    persoKey: string,
    state: Record<string, unknown>,
    timeMs: number,
  ): void {
    const mounted = this.mounted.get(persoKey)
    if (mounted === undefined) throw new Error(`Runtime component is not mounted: ${persoKey}`)
    mounted.component.update({ state, timeMs })
  }

  /** Destroys all materialized component instances. */
  destroy(): void {
    for (const mounted of this.mounted.values()) mounted.handle.destroy()
    this.mounted.clear()
  }

  /** Creates one component instance from its compiled scene declaration. */
  private mountComponent(scene: SolvedScene, persoKey: string): MountedComponent {
    const perso = scene.persos[persoKey]
    if (perso === undefined) throw new Error(`Runtime component perso is missing: ${persoKey}`)
    const compiledPerso = scene.scene.scene.stories[perso.storyId]?.persos.find((candidate) => candidate.id === perso.persoId)
    if (compiledPerso === undefined) throw new Error(`Compiled component perso is missing: ${persoKey}`)
    const identity: RuntimeComponentIdentity = {
      componentId: perso.key,
      storyId: perso.storyId,
      componentType: perso.type,
    }
    const component = this.options.catalog.createComponent(
      perso.type,
      {
        perso: {
          id: perso.persoId,
          storyId: perso.storyId,
          initial: compiledPerso.initial,
          actions: compiledPerso.actions,
        },
      },
      identity,
      this.options.materializer,
      this.moduleServices,
    )
    const mounted: MountedComponent = {
      component,
      handle: this.options.materializer.materializeComponent(
        component,
        identity,
        compiledPerso.initial,
        this.options.catalog.getMountablePartIds(perso.type),
        this.moduleServices,
      ),
    }
    this.mounted.set(perso.key, mounted)
    return mounted
  }
}

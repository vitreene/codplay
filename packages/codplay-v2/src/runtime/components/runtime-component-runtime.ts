import type { SolvedScene } from '../player/pipeline'
import type { RuntimeModuleServiceInstance } from '../engine'
import type { BaseComponent } from './base-component'
import { createComponentServices, RuntimeComponentServiceCatalog } from './component-services'
import { RuntimeComponentCatalog } from './runtime-component-catalog'

/** Identity passed to component services and materializers. */
export type RuntimeComponentIdentity = Readonly<{
  componentId: string
  storyId: string
  componentType: string
}>

/** Cleanup returned after one component has been materialized. */
export type RuntimeComponentHandle = Readonly<{
  destroy: () => void
}>

/** Host callbacks required to materialize and service one component instance. */
export type RuntimeComponentRuntimeOptions = Readonly<{
  catalog: RuntimeComponentCatalog
  serviceCatalog: RuntimeComponentServiceCatalog
  materialize: (
    component: BaseComponent<Record<string, unknown>>,
    identity: RuntimeComponentIdentity,
    initial: Record<string, unknown>,
    mountablePartIds: readonly string[],
    moduleServices: ReadonlyMap<string, RuntimeModuleServiceInstance>,
  ) => RuntimeComponentHandle
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

  /** Mounts new persos, updates existing components, and removes stale instances. */
  sync(scene: SolvedScene): void {
    const activeKeys = new Set(Object.keys(scene.persos))

    for (const [key, mounted] of this.mounted) {
      if (activeKeys.has(key)) continue
      mounted.handle.destroy()
      this.mounted.delete(key)
    }

    for (const perso of Object.values(scene.persos)) {
      const mounted = this.mounted.get(perso.key) ?? this.mountComponent(scene, perso.key)
      mounted.component.update({ state: perso.state, timeMs: scene.timeMs })
    }
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
    const component = this.options.catalog.create(perso.type, {
      perso: {
        id: perso.persoId,
        storyId: perso.storyId,
        initial: compiledPerso.initial,
      },
      services: createComponentServices(this.options.serviceCatalog, identity, this.moduleServices),
    })
    const mounted: MountedComponent = {
      component,
      handle: this.options.materialize(
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

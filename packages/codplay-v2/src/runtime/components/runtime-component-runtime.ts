import type { SolvedScene } from '../player/pipeline'
import type { RuntimeModuleServiceInstance } from '../engine'
import type { BaseComponent } from './base-component'
import { RuntimeCapabilityCatalog, type RuntimeComponentIdentity } from '../catalog'
import type { RuntimeMaterializer } from '../materializer'
import type { RuntimePreloadResourceMetadata } from '../preload'
import type {
  RuntimeComponentSurfaceId,
  RuntimeComponentSurfaceMap,
  RuntimeComponentSurfaceResolver,
} from './component-surface-types'

export type { RuntimeComponentIdentity } from '../catalog'

/** Final cleanup returned after one component has been materialized. */
export type RuntimeComponentHandle = Readonly<{
  destroy: () => void
}>

/** Host callbacks required to materialize and service one component instance. */
export type RuntimeComponentRuntimeOptions = Readonly<{
  catalog: RuntimeCapabilityCatalog
  materializer: RuntimeMaterializer
  resourceMetadata?: ReadonlyMap<string, RuntimePreloadResourceMetadata>
}>

type MountedComponent = Readonly<{
  component: BaseComponent<Record<string, unknown>>
  handle: RuntimeComponentHandle
  surfaces: Partial<RuntimeComponentSurfaceMap>
}>

/** Synchronizes compiled solved persos with a player-local component host. */
export class RuntimeComponentRuntime {
  private readonly mounted = new Map<string, MountedComponent>()
  private readonly stateRevisions = new Map<string, number>()
  private readonly lastStates = new Map<string, Readonly<Record<string, unknown>>>()
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

  /** Returns the typed surface registry for this player-local component host. */
  getComponentSurfaces(): RuntimeComponentSurfaceResolver {
    return {
      getSurface: <SurfaceId extends RuntimeComponentSurfaceId>(componentId: string, surfaceId: SurfaceId) =>
        this.mounted.get(componentId)?.surfaces[surfaceId],
    }
  }

  /** Returns the logical materialization revision last delivered to one component. */
  getStateRevision(componentId: string): number | undefined {
    return this.stateRevisions.get(componentId)
  }

  /**
   * Synchronizes the logical scene without destroying persistent component instances.
   * Structural unmounting is handled by the materializer; final cleanup is handled by destroy().
   */
  sync(scene: SolvedScene): void {
    for (const perso of Object.values(scene.persos)) {
      const mounted = this.mounted.get(perso.key) ?? this.mountComponent(scene, perso.key)
      mounted.component.update({ state: perso.state, timeMs: scene.timeMs })
      this.recordStateRevision(perso.key, perso.state)
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
    this.recordStateRevision(persoKey, state)
  }

  /** Destroys all materialized component instances. */
  destroy(): void {
    for (const mounted of this.mounted.values()) mounted.handle.destroy()
    this.mounted.clear()
    this.stateRevisions.clear()
    this.lastStates.clear()
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
        resourceMetadata: this.options.resourceMetadata,
      },
      identity,
      this.options.materializer,
      this.moduleServices,
    )
    const mounted: MountedComponent = {
      component,
      surfaces: this.options.catalog.getComponentSurfaces(perso.type, component),
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

  /** Advances the overlay template revision only when resolved state changed. */
  private recordStateRevision(componentId: string, state: Readonly<Record<string, unknown>>): void {
    const previous = this.lastStates.get(componentId)
    if (previous !== undefined && sameRuntimeValue(previous, state)) return
    this.lastStates.set(componentId, state)
    this.stateRevisions.set(componentId, (this.stateRevisions.get(componentId) ?? 0) + 1)
  }
}

/** Compares compiled component state without serializing it on every frame. */
function sameRuntimeValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false
    return left.every((value, index) => sameRuntimeValue(value, right[index]))
  }
  const leftRecord = left as Record<string, unknown>
  const rightRecord = right as Record<string, unknown>
  const leftKeys = Object.keys(leftRecord)
  const rightKeys = Object.keys(rightRecord)
  if (leftKeys.length !== rightKeys.length) return false
  return leftKeys.every((key) => Object.prototype.hasOwnProperty.call(rightRecord, key)
    && sameRuntimeValue(leftRecord[key], rightRecord[key]))
}

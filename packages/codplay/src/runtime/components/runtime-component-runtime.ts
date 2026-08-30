import type { SolvedScene } from '../player/pipeline'
import type { RuntimeModuleServiceInstance } from '../engine'
import type { BaseComponent } from './base-component'
import { RuntimeCapabilityCatalog, type RuntimeComponentIdentity } from '../catalog'
import type { RuntimeMaterializer } from '../materializer'
import type { RuntimePreloadResourceMetadata } from '../preload'
import type {
  ComponentActionOccurrence,
  ComponentAnimation,
  ComponentUpdateInput,
} from './component-types'
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

type StableComponentAction = Readonly<Omit<ComponentActionOccurrence, 'elapsedMs'>>

type ActiveComponentAnimation = {
  animation: ComponentAnimation
  hasValue: boolean
  lastValue: unknown
  lastTimeMs: number | undefined
}

/** Synchronizes compiled solved persos with a player-local component host. */
export class RuntimeComponentRuntime {
  private readonly mounted = new Map<string, MountedComponent>()
  private readonly stateRevisions = new Map<string, number>()
  private readonly lastStates = new Map<string, Readonly<Record<string, unknown>>>()
  private readonly lastActions = new Map<string, readonly StableComponentAction[]>()
  private readonly animations = new Map<string, ActiveComponentAnimation[]>()
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
   * An explicit force is reserved for commands such as refresh that must reapply
   * the current state despite its logical identity being unchanged.
   */
  sync(scene: SolvedScene, force = false): void {
    for (const perso of Object.values(scene.persos)) {
      const mounted = this.mounted.get(perso.key) ?? this.mountComponent(scene, perso.key)
      const actions = createStableActionSignature(perso.actions)
      if (force
        || this.hasStateChanged(perso.key, perso.state)
        || !sameRuntimeValue(this.lastActions.get(perso.key), actions)) {
        this.applyComponentUpdate(mounted, perso.key, {
          state: perso.state,
          timeMs: scene.timeMs,
          activeActions: perso.actions,
        })
        this.lastActions.set(perso.key, actions)
        this.recordStateRevision(perso.key, perso.state)
      }
    }
  }

  /** Presents component-owned animation samples at one player-clocked time. */
  presentAt(timeMs: number): void {
    for (const componentId of this.animations.keys()) this.presentAnimations(componentId, timeMs)
  }

  /** Applies one transient live state through the same component update path. */
  updateLive(
    persoKey: string,
    state: Record<string, unknown>,
    timeMs: number,
  ): void {
    const mounted = this.mounted.get(persoKey)
    if (mounted === undefined) throw new Error(`Runtime component is not mounted: ${persoKey}`)
    if (!this.hasStateChanged(persoKey, state)) return
    this.applyComponentUpdate(mounted, persoKey, { state, timeMs })
    this.recordStateRevision(persoKey, state)
  }

  /** Destroys all materialized component instances. */
  destroy(): void {
    for (const mounted of this.mounted.values()) mounted.handle.destroy()
    this.mounted.clear()
    this.stateRevisions.clear()
    this.lastStates.clear()
    this.lastActions.clear()
    this.animations.clear()
  }

  /** Delivers one logical state update and replaces its component-owned animations. */
  private applyComponentUpdate(
    mounted: MountedComponent,
    persoKey: string,
    input: Omit<ComponentUpdateInput<Record<string, unknown>>, 'registerAnimation'>,
  ): void {
    const registered: ComponentAnimation[] = []
    mounted.component.update({
      ...input,
      registerAnimation: (animation) => registered.push(animation),
    })
    if (registered.length === 0) {
      this.animations.delete(persoKey)
      return
    }
    this.animations.set(
      persoKey,
      registered.map((animation) => {
        const previous = this.animations.get(persoKey)?.find((entry) =>
          entry.animation.id === animation.id
          && entry.animation.startAt === animation.startAt
          && entry.animation.endAt === animation.endAt)
        return previous === undefined
          ? {
              animation,
              hasValue: false,
              lastValue: undefined,
              lastTimeMs: undefined,
            }
          : { ...previous, animation }
      }),
    )
  }

  /** Applies only changed samples from the player-clocked component streams. */
  private presentAnimations(componentId: string, timeMs: number): void {
    const active = this.animations.get(componentId)
    if (active === undefined) return
    for (const entry of active) {
      const movingForwardAfterEnd = entry.lastTimeMs !== undefined
        && entry.lastTimeMs >= entry.animation.endAt
        && timeMs >= entry.lastTimeMs
      if (movingForwardAfterEnd) {
        entry.lastTimeMs = timeMs
        continue
      }
      const frame = entry.animation.sample(timeMs)
      if (frame !== undefined
        && (!entry.hasValue || !sameRuntimeValue(entry.lastValue, frame.value))) {
        frame.apply()
        entry.lastValue = frame.value
        entry.hasValue = true
      }
      entry.lastTimeMs = timeMs
    }
  }

  /** Checks whether one state differs from the last state delivered to its component. */
  private hasStateChanged(
    componentId: string,
    state: Readonly<Record<string, unknown>>,
  ): boolean {
    const previous = this.lastStates.get(componentId)
    return previous === undefined || !sameRuntimeValue(previous, state)
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
        this.options.catalog.getMountablePartIds(perso.type, identity),
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

/** Removes per-frame elapsed time while retaining the action identity and payload. */
function createStableActionSignature(
  actions: readonly ComponentActionOccurrence[] | undefined,
): readonly StableComponentAction[] {
  return (actions ?? []).map(({ elapsedMs, ...stableAction }) => stableAction)
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

import type { SolvedScene } from '../player/pipeline'
import type { CompiledRel } from '../../scene/compiled'
import type {
  RuntimeComponentUpdateContext,
  RuntimeComponentUpdatePhase,
  RuntimeExternalPresentation,
  RuntimeExternalPresentationHandle,
  RuntimeExternalPresentationRequest,
  RuntimeModuleServiceInstance,
} from '../engine'
import type { BaseComponent } from './base-component'
import { RuntimeCapabilityCatalog, type RuntimeComponentIdentity } from '../catalog'
import type { RuntimeMaterializer } from '../materializer'
import type {
  RuntimePreloadMediaHandle,
  RuntimePreloadResourceMetadata,
} from '../preload'
import type {
  ComponentActionOccurrence,
  ComponentAnimation,
  ComponentUpdateInput,
} from './component-types'
import type { ComponentRuntimeContext } from './component-types'
import type {
  RuntimeComponentSurfaceId,
  RuntimeComponentSurfaceMap,
  RuntimeComponentSurfaceResolver,
} from './component-surface-types'
import { RuntimeTargetRegistry } from '../targets'
import type {
  RuntimeTargetIdentity,
  RuntimeTargetRegistration,
  RuntimeTargetScope,
} from '../targets'
import { BaseHTMLComponent } from './base-html-component'

export type { RuntimeComponentIdentity } from '../catalog'

/** Final cleanup returned when a component owns a materialized representation. */
export type RuntimeComponentHandle = Readonly<{
  destroy: () => void
}>

/** Host callbacks required to materialize and service one component instance. */
export type RuntimeComponentRuntimeOptions = Readonly<{
  catalog: RuntimeCapabilityCatalog
  materializer: RuntimeMaterializer
  /** Engine-prepared dependencies passed unchanged to component classes. */
  runtime?: ComponentRuntimeContext
  resourceMetadata?: ReadonlyMap<string, RuntimePreloadResourceMetadata>
  resourceMedia?: ReadonlyMap<string, RuntimePreloadMediaHandle>
}>

/** Optional presentation mode supplied by the player around one scene sync. */
export type RuntimeComponentSyncOptions = Readonly<{
  phase?: RuntimeComponentUpdatePhase
}>

type MountedComponent = Readonly<{
  identity: RuntimeComponentIdentity
  persoId: string
  relation?: CompiledRel
  component: BaseComponent<Record<string, unknown>>
  handle?: RuntimeComponentHandle
  surfaces: Partial<RuntimeComponentSurfaceMap>
  targetRegistration?: RuntimeTargetRegistration
}>

type StableComponentAction = Readonly<Omit<ComponentActionOccurrence, 'elapsedMs'>>

type ActiveComponentAnimation = {
  animation: ComponentAnimation
  hasValue: boolean
  lastValue: unknown
  lastTimeMs: number | undefined
}

type ActiveExternalComponentAnimation = ActiveComponentAnimation & Readonly<{
  presentation: RuntimeExternalPresentation
}>

type ActivePresentationEntry = Readonly<{
  componentId: string
  active: ActiveComponentAnimation
  external: boolean
  registrationOrder: number
}>

/** Synchronizes compiled solved persos with a player-local component host. */
export class RuntimeComponentRuntime {
  private readonly mounted = new Map<string, MountedComponent>()
  private readonly stateRevisions = new Map<string, number>()
  private readonly lastStates = new Map<string, Readonly<Record<string, unknown>>>()
  private readonly lastActions = new Map<string, readonly StableComponentAction[]>()
  private readonly lastTargets = new Map<string, unknown>()
  private readonly animations = new Map<string, ActiveComponentAnimation[]>()
  private readonly externalAnimations = new Map<string, ActiveExternalComponentAnimation>()
  private readonly targetRegistry = new RuntimeTargetRegistry()
  private readonly options: RuntimeComponentRuntimeOptions
  private moduleServices: ReadonlyMap<string, RuntimeModuleServiceInstance> = new Map()

  /** Creates the runtime host from its registered component class and materialization callbacks. */
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
      getInputSurface: (componentId) => this.mounted.get(componentId)?.surfaces.input,
      getForeignContentSurface: (componentId) => this.mounted.get(componentId)?.surfaces.foreignContent,
      getReplaceSurface: (componentId) => this.mounted.get(componentId)?.surfaces.replace,
    }
  }

  /** Prepares one module-owned presentation around an external runtime operation. */
  prepareExternalPresentation(
    request: RuntimeExternalPresentationRequest,
  ): RuntimeExternalPresentationHandle | undefined {
    this.cancelExternalPresentation(request.componentId)
    for (const service of this.moduleServices.values()) {
      const presentation = service.prepareExternalPresentation?.(request)
      if (presentation === undefined) continue
      this.externalAnimations.set(request.componentId, {
        animation: presentation.animation,
        hasValue: false,
        lastValue: undefined,
        lastTimeMs: undefined,
        presentation,
      })
      let started = false
      return {
        start: () => {
          if (started) return
          started = true
          try {
            presentation.start()
            this.presentExternalAnimations(request.componentId, request.timeMs)
          } catch (error) {
            this.cancelExternalPresentation(request.componentId, presentation)
            throw error
          }
        },
        cancel: () => this.cancelExternalPresentation(request.componentId, presentation),
      }
    }
    return undefined
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
  sync(scene: SolvedScene, force = false, options: RuntimeComponentSyncOptions = {}): void {
    const phase = options.phase ?? 'normal'
    if (phase !== 'normal') this.cancelAllExternalPresentations()
    const persos = Object.values(scene.persos)
    for (const perso of persos) {
      if (!this.mounted.has(perso.key)) this.mountComponent(scene, perso.key)
    }
    for (const perso of persos) {
      const mounted = this.mounted.get(perso.key)
      if (mounted === undefined) continue
      mounted.targetRegistration?.setAvailable(
        this.options.catalog.resolveComponentAvailability(perso.type, perso.placement.mounted),
      )
    }
    for (const perso of persos) {
      const mounted = this.mounted.get(perso.key)
      if (mounted === undefined) continue
      const actions = createStableActionSignature(perso.actions)
      const target = this.resolveTarget(mounted)
      const targetChanged = this.hasTargetChanged(perso.key, target)
      if (phase === 'geometry-capture'
        || force
        || this.hasStateChanged(perso.key, perso.state)
        || !sameRuntimeValue(this.lastActions.get(perso.key), actions)
        || targetChanged) {
        this.applyComponentUpdate(mounted, perso.key, {
          state: perso.state,
          timeMs: scene.timeMs,
          target,
          activeActions: perso.actions,
        }, phase)
        this.lastActions.set(perso.key, actions)
        this.recordStateRevision(perso.key, perso.state)
      }
      this.lastTargets.set(perso.key, target)
    }
  }

  /** Presents component-owned animation samples at one player-clocked time. */
  presentAt(timeMs: number): void {
    const entries: ActivePresentationEntry[] = []
    let registrationOrder = 0
    for (const [componentId, active] of this.animations) {
      for (const animation of active) {
        entries.push({ componentId, active: animation, external: false, registrationOrder })
        registrationOrder += 1
      }
    }
    for (const [componentId, active] of this.externalAnimations) {
      entries.push({ componentId, active, external: true, registrationOrder })
      registrationOrder += 1
    }

    entries.sort((left, right) => {
      const phaseOrder = presentationPhaseOrder(left.active.animation)
        - presentationPhaseOrder(right.active.animation)
      return phaseOrder === 0
        ? left.registrationOrder - right.registrationOrder
        : phaseOrder
    })

    for (const entry of entries) {
      this.presentAnimationEntries([entry.active], timeMs)
      if (entry.external) {
        const current = this.externalAnimations.get(entry.componentId)
        if (current === entry.active
          && current.lastTimeMs !== undefined
          && current.lastTimeMs >= current.animation.endAt) {
          this.externalAnimations.delete(entry.componentId)
        }
      }
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
    if (!this.hasStateChanged(persoKey, state)) return
    this.applyComponentUpdate(mounted, persoKey, {
      state,
      timeMs,
      target: this.lastTargets.get(persoKey),
    }, 'normal')
    this.recordStateRevision(persoKey, state)
  }

  /** Destroys all materialized component instances. */
  destroy(): void {
    this.cancelAllExternalPresentations()
    for (const mounted of this.mounted.values()) {
      mounted.targetRegistration?.release()
      mounted.component.destroy()
      mounted.handle?.destroy()
    }
    this.mounted.clear()
    this.stateRevisions.clear()
    this.lastStates.clear()
    this.lastActions.clear()
    this.lastTargets.clear()
    this.targetRegistry.clear()
    this.animations.clear()
    this.externalAnimations.clear()
  }

  /** Delivers one logical state update and replaces its component-owned animations. */
  private applyComponentUpdate(
    mounted: MountedComponent,
    persoKey: string,
    input: Omit<ComponentUpdateInput<Record<string, unknown>>, 'registerAnimation'>,
    phase: RuntimeComponentUpdatePhase,
  ): void {
    const registered: ComponentAnimation[] = []
    const context: RuntimeComponentUpdateContext = {
      ...mounted.identity,
      persoId: mounted.persoId,
      state: input.state,
      timeMs: input.timeMs,
      activeActions: input.activeActions ?? [],
      phase,
      registerAnimation: (animation) => registered.push(animation),
    }
    try {
      for (const instance of this.moduleServices.values()) instance.beforeComponentUpdate?.(context)
      mounted.component.update({
        ...input,
        registerAnimation: (animation) => registered.push(animation),
      })
      for (const instance of this.moduleServices.values()) instance.afterComponentUpdate?.(context)
    } catch (error) {
      for (const instance of this.moduleServices.values()) instance.onComponentUpdateError?.(context, error)
      throw error
    }
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

  /** Applies and retires one externally prepared presentation stream. */
  private presentExternalAnimations(componentId: string, timeMs: number): void {
    const active = this.externalAnimations.get(componentId)
    if (active === undefined) return
    this.presentAnimationEntries([active], timeMs)
    if (active.lastTimeMs !== undefined && active.lastTimeMs >= active.animation.endAt) {
      this.externalAnimations.delete(componentId)
    }
  }

  /** Applies only changed samples from one player-clocked animation collection. */
  private presentAnimationEntries(active: readonly ActiveComponentAnimation[], timeMs: number): void {
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

  /** Cancels one external presentation if it still belongs to the expected request. */
  private cancelExternalPresentation(
    componentId: string,
    expected?: RuntimeExternalPresentation,
  ): void {
    const active = this.externalAnimations.get(componentId)
    if (active === undefined) {
      expected?.cancel()
      return
    }
    if (expected !== undefined && active.presentation !== expected) {
      expected.cancel()
      return
    }
    this.externalAnimations.delete(componentId)
    active.presentation.cancel()
  }

  /** Cancels every externally prepared presentation before a seek or teardown. */
  private cancelAllExternalPresentations(): void {
    for (const [componentId, active] of this.externalAnimations) {
      this.externalAnimations.delete(componentId)
      active.presentation.cancel()
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

  /** Detects target availability or replacement without inspecting opaque values. */
  private hasTargetChanged(componentId: string, target: unknown): boolean {
    return !this.lastTargets.has(componentId) || !Object.is(this.lastTargets.get(componentId), target)
  }

  /** Resolves the relation of one mounted component through this player-local target registry. */
  private resolveTarget(mounted: MountedComponent): unknown | undefined {
    if (mounted.relation === undefined) return undefined
    return this.targetRegistry.resolve(mounted.relation)
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
        resourceMedia: this.options.resourceMedia,
        runtime: this.options.runtime,
      },
      identity,
      this.options.materializer,
      this.moduleServices,
    )
    let handle: RuntimeComponentHandle | undefined
    let surfaces: Partial<RuntimeComponentSurfaceMap>
    let targetRegistration: RuntimeTargetRegistration | undefined
    try {
      // Only HTML components own a representation in the global HTML
      // materializer. A substrate-neutral component keeps its own lifecycle
      // and must not cross this boundary through empty markup or a synthetic
      // handle.
      if (component instanceof BaseHTMLComponent) {
        handle = this.options.materializer.materializeComponent(
          component,
          identity,
          compiledPerso.initial,
          this.options.catalog.getMountablePartIds(perso.type, identity),
          this.moduleServices,
        )
      }
      component.initialize()
      const componentSurfaces = this.options.catalog.getComponentSurfaces(
        perso.type,
        component,
        identity,
        this.options.materializer,
      )
      const replaceSurface = component instanceof BaseHTMLComponent
        ? this.options.materializer.getReplaceSurface?.(perso.key)
        : undefined
      surfaces = replaceSurface === undefined
        ? componentSurfaces
        : { ...componentSurfaces, replace: replaceSurface }
      const targetPublication = this.options.catalog.getComponentTargetPublication(
        perso.type,
        component,
        identity,
        this.options.materializer,
      )
      if (targetPublication !== undefined) {
        const targetIdentity = resolvePublicationIdentity(
          compiledPerso.rel,
          perso.persoId,
          targetPublication.scope,
        )
        if (targetIdentity !== undefined) {
          targetRegistration = this.targetRegistry.publish(targetIdentity, targetPublication.value)
          targetRegistration.setAvailable(
            this.options.catalog.resolveComponentAvailability(perso.type, perso.placement.mounted),
          )
        }
      }
    } catch (error) {
      targetRegistration?.release()
      handle?.destroy()
      component.destroy()
      throw error
    }
    const mounted: MountedComponent = {
      identity,
      persoId: perso.persoId,
      relation: compiledPerso.rel,
      component,
      surfaces,
      handle,
      targetRegistration,
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

/** Maps one provider scope to the host/target identity used by the player registry. */
function resolvePublicationIdentity(
  relation: CompiledRel | undefined,
  componentId: string,
  scope: RuntimeTargetScope | undefined,
): RuntimeTargetIdentity | undefined {
  if ((scope ?? 'target') === 'host') {
    return { host: componentId }
  }
  if (relation?.host === undefined) return undefined
  return { host: relation.host, target: componentId }
}

/** Removes per-frame elapsed time while retaining the action identity and payload. */
function createStableActionSignature(
  actions: readonly ComponentActionOccurrence[] | undefined,
): readonly StableComponentAction[] {
  return (actions ?? []).map(({ elapsedMs, ...stableAction }) => stableAction)
}

/** Places the final host commit after component-owned content presentation. */
function presentationPhaseOrder(animation: ComponentAnimation): number {
  return animation.presentationPhase === 'commit' ? 1 : 0
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

import type { AnimationResolvedAction } from '../../animation/types'
import type { TransitionRequest } from '../../animation/types'
import type { CreateElementOptions } from '../create-element'
import type { RenderMutationResolver } from '../render-mutation-resolver'
import type { ItemDoc, MoveCommand } from '../types'
import type { ComponentServices, ServiceInstance } from './lib/component-services'
import type { ComponentModules } from './lib/component-modules'

export type { ComponentServices, ServiceInstance }
export type { ComponentModules }

/**
 * Describes one warning emitted by runtime component orchestration.
 */
export type RuntimeComponentWarning = {
  code: string
  message: string
  details?: Record<string, unknown>
}

/**
 * Reports one runtime component warning to the renderer/player channel.
 */
export type RuntimeComponentWarningReporter = (warning: RuntimeComponentWarning) => void

/**
 * Defines one input payload forwarded to component update.
 */
export type RuntimeComponentUpdateInput = {
  persoId: string
  eventId: string
  eventSeq: number
  action: Record<string, unknown>
}

/**
 * Defines shared constructor input used by all runtime components.
 */
export type RuntimeComponentClassInput = {
  perso: ItemDoc
  createElementOptions?: CreateElementOptions
  report: RuntimeComponentWarningReporter
  services: ComponentServices
  modules: ComponentModules
}

/**
 * Describes the result returned by one component render call.
 */
export type ComponentRenderResult = Node

/**
 * Defines the minimal component API expected by the renderer.
 */
export type RuntimeComponent = {
  node: unknown
  render: () => ComponentRenderResult
  init?: () => void
  _init: () => void
  update: (input: RuntimeComponentUpdateInput) => void
  getOutletsSnapshot?: () => RuntimeLayoutOutletSnapshot[]
  readonly modules: ComponentModules
}

/**
 * Defines constructor signature for runtime component classes.
 */
export type RuntimeComponentClass = {
  new (input: RuntimeComponentClassInput): RuntimeComponent
  renderMutationResolver?: RenderMutationResolver
}

/**
 * Defines one list component API required by the global move router.
 */
export type RuntimeListComponent = RuntimeComponent & {
  canAttachChild?: (input: {
    childNode: unknown
    mode: MoveCommand['mode']
  }) => boolean
  attachChild: (input: {
    childId: string
    childNode: unknown
    mode: MoveCommand['mode']
    reorder?: boolean
    eventId: string
    eventSeq: number
  }) => void
  detachChild: (input: {
    childId: string
    mode: MoveCommand['mode']
    reorder?: boolean
    eventId: string
    eventSeq: number
  }) => unknown | null
  repositionChild: (input: {
    childId: string
    mode: MoveCommand['mode']
    reorder?: boolean
    eventId: string
    eventSeq: number
  }) => void
  getPersoId: () => string
  getChildrenSnapshot: () => string[]
}

/**
 * Describes one runtime outlet entry exposed by a layout component.
 */
export type RuntimeLayoutOutletSnapshot = {
  outletId: string
  nodeRef: unknown
}

/**
 * Defines the runtime API exposed by a layout component.
 */
export type RuntimeLayoutComponent = RuntimeComponent & {
  getOutletsSnapshot: () => RuntimeLayoutOutletSnapshot[]
}

/**
 * Defines the registry snapshot returned by renderer/player APIs.
 */
export type RuntimeRegistrySnapshot = {
  getNodeById: (persoId: string) => unknown | null
  getComponentById: (persoId: string) => RuntimeComponent | null
  getListById: (persoId: string) => RuntimeListComponent | null
  getRenderMutationResolverById: (persoId: string) => RenderMutationResolver | null
  getParentListId: (persoId: string) => string | null
  setParentListId: (persoId: string, parentListId: string | null) => void
  isMounted: (persoId: string) => boolean
  setMounted: (persoId: string, mounted: boolean) => void
}

/**
 * Describes one registry operation error.
 */
export type RegistryError = {
  code: string
  message: string
  details?: Record<string, unknown>
}

/**
 * Describes the result of one registry register or override operation.
 */
export type RegistryResult =
  | { ok: true; status: 'registered' | 'overridden' }
  | { ok: false; error: RegistryError }

/**
 * Defines the input for one component register or override operation.
 */
export type ComponentRegisterInput = {
  type: string
  component: RuntimeComponentClass
}

/**
 * Defines the input for one service register or override operation.
 */
export type ServiceRegisterInput = {
  name: string
  service: ServiceInstance
}

/**
 * Defines the component registry API.
 */
export type ComponentRegistryApi = {
  register: (input: ComponentRegisterInput) => RegistryResult
  override: (input: ComponentRegisterInput) => RegistryResult
}

/**
 * Defines the service registry API.
 */
export type ServiceRegistryApi = {
  register: (input: ServiceRegisterInput) => RegistryResult
  override: (input: ServiceRegisterInput) => RegistryResult
}

/**
 * Defines one resolved update routed to component instances.
 */
export type RuntimeResolvedUpdate = {
  resolvedAction: AnimationResolvedAction
  eventSeq: number
}

/**
 * Defines one orchestrator result before animation derivation.
 */
export type RuntimeUpdateRoutingResult = {
  appliedActionsCount: number
  animatableActions: AnimationResolvedAction[]
  directTransitions: TransitionRequest[]
}

/**
 * Defines the phases at which a runtime module hook can be invoked.
 */
export type RuntimeModuleHookPhase =
  | 'onComponentMounted'
  | 'onComponentUnmounted'
  | 'onInitialPerso'
  | 'beforeUpdate'
  | 'afterUpdate'
  | 'onDestroy'

/**
 * Collects mutable outputs written by module hooks during one routing cycle.
 */
export type RuntimeModuleHookOutput = {
  directTransitions: TransitionRequest[]
}

/**
 * Defines the context passed to every module hook invocation.
 */
export type RuntimeModuleHookPayload = {
  perso?: DeepReadonly<ItemDoc>
  component?: RuntimeComponent
  rootNode?: unknown
  resolvedAction?: AnimationResolvedAction
  eventSeq?: number
  moveCommand?: MoveCommand | null
  output?: RuntimeModuleHookOutput
}

/**
 * Defines one module hook function invoked by the dispatcher.
 */
export type RuntimeModuleHook = (payload: RuntimeModuleHookPayload) => void

/**
 * Declares the conditions under which a module runtime binding is dispatched.
 */
export type RuntimeModuleMatch = {
  actionKeys?: readonly string[]
  componentCapabilities?: readonly string[]
}

/**
 * Defines the runtime face of an installed module.
 */
export type RuntimeModuleRuntimeBinding = {
  hooks?: Partial<Record<RuntimeModuleHookPhase, RuntimeModuleHook>>
  match?: RuntimeModuleMatch
}

/**
 * Defines the full binding returned by a module after installation.
 */
export type RuntimeModuleBinding = {
  runtime?: RuntimeModuleRuntimeBinding
}

/**
 * Provides read access to the node registry for module hooks.
 */
export type RuntimeNodeRegistryRead = {
  get(id: string): unknown | null
}

/**
 * Provides read and write access to the container and parent-tracking registries.
 */
export type RuntimeContainerRegistry = {
  get(id: string): RuntimeListComponent | null
  set(id: string, list: RuntimeListComponent): void
  delete(id: string): void
  getParentId(childId: string): string | null
  setParentId(childId: string, parentId: string | null): void
}

/**
 * Provides read and write access to the mounted state registry.
 */
export type RuntimeMountedRegistry = {
  get(id: string): boolean
  set(id: string, mounted: boolean): void
}

/**
 * Exposes the runtime registries and helpers injected into every module at install time.
 */
export type RuntimeModuleHost = {
  report: RuntimeComponentWarningReporter
  warnOnce(eventSeq: number, code: string, details: Record<string, unknown>, persoId: string): void
  registries: {
    node: RuntimeNodeRegistryRead
    component: { get(id: string): RuntimeComponent | null }
    container: RuntimeContainerRegistry
    mounted: RuntimeMountedRegistry
  }
  helpers: {
    getStoryId(persoId: string): string | null
    resolveTargetNode(parentId: string, storyId: string | null, childNode?: unknown): unknown | null
    canAttachChildToNode(parentNode: unknown, childNode: unknown): boolean
    detachNode(nodeRef: unknown): void
    appendNode(parentNode: unknown, childNode: unknown): void
  }
}

/**
 * Defines the contract of a runtime module registered via the module registry.
 */
export type RuntimeModule = {
  install(host: RuntimeModuleHost): RuntimeModuleBinding
}

/**
 * Defines the input for one module register or override operation.
 */
export type ModuleRegisterInput = {
  name: string
  module: RuntimeModule
}

/**
 * Defines the module registry API.
 */
export type ModuleRegistryApi = {
  register(input: ModuleRegisterInput): RegistryResult
  override(input: ModuleRegisterInput): RegistryResult
}

/**
 * Marks a deeply readonly value (shallow alias for type-level intent).
 */
type DeepReadonly<T> = Readonly<T>

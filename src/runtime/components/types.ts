import type { AnimationResolvedAction } from '../../animation/types'
import type { TransitionRequest } from '../../animation/types'
import type { CreateElementOptions } from '../create-element'
import type { RenderMutationResolver } from '../render-mutation-resolver'
import type { ItemDoc, MoveCommand } from '../types'
import type { ComponentServices, ServiceInstance } from './lib/component-services'

export type { ComponentServices, ServiceInstance }

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

import type { AnimationResolvedAction } from '../../animation/types'
import type { TransitionRequest } from '../../animation/types'
import type { CreateElementOptions } from '../create-element'
import type { ItemDoc, MoveCommand } from '../types'

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
  item: ItemDoc
  createElementOptions?: CreateElementOptions
  warn: RuntimeComponentWarningReporter
}

/**
 * Defines the minimal component API expected by the renderer.
 */
export type RuntimeComponent = {
  init: (initial: Record<string, unknown>) => void
  render: () => unknown
  update: (input: RuntimeComponentUpdateInput) => void
}

/**
 * Defines constructor signature for runtime component classes.
 */
export type RuntimeComponentClass = new (input: RuntimeComponentClassInput) => RuntimeComponent

/**
 * Defines one list component API required by the global move router.
 */
export type RuntimeListComponent = RuntimeComponent & {
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
 * Defines the registry snapshot returned by renderer/player APIs.
 */
export type RuntimeRegistrySnapshot = {
  getNodeById: (persoId: string) => unknown | null
  getComponentById: (persoId: string) => RuntimeComponent | null
  getListById: (persoId: string) => RuntimeListComponent | null
  getParentListId: (persoId: string) => string | null
  setParentListId: (persoId: string, parentListId: string | null) => void
  isMounted: (persoId: string) => boolean
  setMounted: (persoId: string, mounted: boolean) => void
}

/**
 * Defines one action to register or override a runtime component class.
 */
export type RuntimeRegistryCommandResult =
  | {
      ok: true
      status: 'registered' | 'overridden' | 'ignored'
      code?: string
    }
  | {
      ok: false
      code: string
      message: string
      details?: Record<string, unknown>
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

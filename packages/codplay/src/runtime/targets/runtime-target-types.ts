import type { BaseComponent } from '../components/base-component'
import type { RuntimeComponentIdentity } from '../catalog/runtime-capability-catalog'
import type { RuntimeMaterializer } from '../materializer/materializer-types'

/** Identifies one host and, optionally, one target published by that host. */
export type RuntimeTargetIdentity = Readonly<{
  host: string
  target?: string
}>

/** Selects whether a provider publishes its own host or a host-local target. */
export type RuntimeTargetScope = 'host' | 'target'

/** Opaque target published by one mounted component definition. */
export type RuntimeTargetPublication = Readonly<{
  value: unknown
  /** Defaults to `target`; hosts declare `host` explicitly. */
  scope?: RuntimeTargetScope
}>

/** Provides one opaque target after the component representation is materialized. */
export type RuntimeComponentTargetProvider = (
  component: BaseComponent<Record<string, unknown>>,
  identity: RuntimeComponentIdentity,
  materializer: RuntimeMaterializer,
) => RuntimeTargetPublication | undefined

/** Player-local lifecycle controls for one published target. */
export type RuntimeTargetRegistration = Readonly<{
  setAvailable: (available: boolean) => void
  release: () => void
}>

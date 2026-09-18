import type { BaseComponent } from '../components/base-component'
import type { RuntimeComponentIdentity } from '../catalog/runtime-capability-catalog'
import type { RuntimeMaterializer } from '../materializer/materializer-types'

/** Identifies one runtime target without describing its native representation. */
export type RuntimeTargetIdentity = Readonly<{
  scene: string
  perso?: string
}>

/** Selects the identity published by one component target provider. */
export type RuntimeTargetScope = 'scene' | 'perso'

/** Opaque target published by one mounted component definition. */
export type RuntimeTargetPublication = Readonly<{
  value: unknown
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

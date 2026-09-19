import type { ForeignContentSurface } from '../../runtime/components'
import type { Ticker } from '../../runtime/time'
import type {
  CodPlayComponents,
  CodPlayEngineOptions,
  CodPlayInstanceHostTarget,
  CodPlayLibraries,
  CodPlayModules,
  CodPlayServices,
} from '../facade-types'
import type { InstanceFacadeImpl } from '../instance-facade'

/** Configuration consumed by the internal engine facade adapter. */
export type EngineFacadeConfig = CodPlayEngineOptions & Readonly<{
  ticker?: Ticker
}>

/** Public capability registries created over one engine-owned catalog. */
export type CapabilityRegistries = Readonly<{
  components: CodPlayComponents
  services: CodPlayServices
  modules: CodPlayModules
  libraries: CodPlayLibraries
}>

/** Instance implementation retained by the owner registry. */
export type ManagedInstance = InstanceFacadeImpl

/** One foreign-content relation retained by the owner mount registry. */
export type ManagedInstanceMount = Readonly<{
  mountId: number
  host: CodPlayInstanceHostTarget
  hostKey: string
  childInstanceId: string
  child: ManagedInstance
  surface: ForeignContentSurface
}>

/** Identifies one supported catalog family and its public operation. */
export type CapabilityFamily = 'component' | 'service' | 'module' | 'library'

/** Identifies the two mutations accepted by a capability registry. */
export type RegistryOperation = 'register' | 'override'

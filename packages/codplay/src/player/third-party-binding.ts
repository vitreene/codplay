import type { RenderAdapter } from './render-adapter-types'
import type { RuntimeComponentClass, ServiceRegisterInput } from '../runtime/components/types'

export type ThirdPartyPreloadStrategy = {
  type: string
  load: (url: string, signal: AbortSignal) => Promise<void>
}

/**
 * Unified registration object returned by a third-party library factory.
 * Passed to CreatePlayerOptions.bindings; components and renderAdapter are
 * registered automatically by the player constructor.
 */
export type ThirdPartyBinding = {
  components: Record<string, RuntimeComponentClass>
  services?: ServiceRegisterInput[]
  renderAdapter?: RenderAdapter
  preload?: ThirdPartyPreloadStrategy[]
}

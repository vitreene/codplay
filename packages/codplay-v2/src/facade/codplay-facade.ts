import { createRuntimePreload } from '../runtime/preload'
import type { CodPlayFacade, CodPlayEngineConfig, CodPlayPreloadOptions } from './facade-types'
import { EngineFacadeImpl } from './engine-facade'

/** Public CodPlay namespace that creates independent engines and preload services. */
export const codplay: CodPlayFacade = {
  engine: {
    create: (config: CodPlayEngineConfig = {}) => new EngineFacadeImpl(config),
  },
  preload: {
    create: (options: CodPlayPreloadOptions = {}) => createRuntimePreload(options),
  },
}

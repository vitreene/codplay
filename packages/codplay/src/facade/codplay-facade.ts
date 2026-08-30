import { createRuntimePreload } from '../runtime/preload'
import { TimeTicker } from '../runtime/time'
import type {
  CodPlayApi,
  CodPlayBuildMethod,
  CodPlayComponents,
  CodPlayEngine,
  CodPlayEvents,
  CodPlayInstances,
  CodPlayModules,
  CodPlayOptions,
  CodPlayResources,
  CodPlayServices,
} from './facade-types'
import type { RuntimePreloadApi } from '../runtime/preload'
import { EngineFacadeImpl } from './engine-facade'

/** Public CodPlay owner that hides engine and ticker construction details. */
export class CodPlay implements CodPlayApi {
  #engineOwner: EngineFacadeImpl
  readonly build: CodPlayBuildMethod
  readonly components: CodPlayComponents
  readonly services: CodPlayServices
  readonly modules: CodPlayModules
  readonly resources: CodPlayResources
  readonly events: CodPlayEvents
  readonly engine: CodPlayEngine
  readonly instances: CodPlayInstances
  readonly preload: RuntimePreloadApi

  /** Creates one CodPlay owner with an optional host-provided frame scheduler. */
  constructor(options: CodPlayOptions = {}) {
    const ticker = new TimeTicker({
      scheduler: options.frameScheduler,
      pauseOnDocumentHidden: options.pauseOnDocumentHidden,
    })
    const engineOptions = options.engine ?? {}
    const engine = new EngineFacadeImpl({
      ...engineOptions,
      ticker,
    })
    this.#engineOwner = engine
    const capabilityRegistries = engine.createCapabilityRegistries()
    this.build = (input, buildOptions) => engine.buildScene(input, buildOptions)
    this.components = capabilityRegistries.components
    this.services = capabilityRegistries.services
    this.modules = capabilityRegistries.modules
    this.resources = engine.createResourceRegistry()
    this.events = engine.createEventRegistry()
    this.engine = {
      start: () => engine.start(),
      pause: () => engine.pause(),
      stop: () => engine.stop(),
      advance: (nowMs, marginMs) => engine.advance(nowMs, marginMs),
    }
    this.instances = engine.createInstanceRegistry()
    this.preload = createRuntimePreload(options.preload ?? {})
  }

  /** Destroys the engine and cancels any preload operation owned by CodPlay. */
  destroy(): void {
    // Keep the internal teardown primitive behind the public engine view.
    this.#engineOwner.destroy()
    this.preload.cancel()
    this.preload.css.clear()
  }
}

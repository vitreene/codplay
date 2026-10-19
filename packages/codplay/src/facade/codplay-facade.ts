import { createRuntimePreload } from '../runtime/preload'
import { TimeTicker } from '../runtime/time'
import type {
  CodPlayApi,
  CodPlayBuildMethod,
  CodPlayComponents,
  CodPlayEngine,
  CodPlayEvents,
  CodPlayInstances,
  CodPlayLoadMethod,
  CodPlayModules,
  CodPlayLibraries,
  CodPlayOptions,
  CodPlayResources,
  CodPlayServices,
} from './facade-types'
import type { RuntimePreloadApi } from '../runtime/preload'
import { EngineFacadeImpl } from './engine-facade'
import { loadScenePackage, releaseScenePackageContexts } from './scene-package-loader'

/** Public CodPlay owner that hides engine and ticker construction details. */
export class CodPlay implements CodPlayApi {
  #engineOwner: EngineFacadeImpl
  #loadQueue: Promise<void> = Promise.resolve()
  #loadCounter = 0
  #scenePackageCssSlots = new Map<string, string>()
  readonly build: CodPlayBuildMethod
  readonly load: CodPlayLoadMethod
  readonly components: CodPlayComponents
  readonly services: CodPlayServices
  readonly modules: CodPlayModules
  readonly libraries: CodPlayLibraries
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
      htmlHost: options.htmlHost,
    })
    this.#engineOwner = engine
    const capabilityRegistries = engine.createCapabilityRegistries()
    this.build = (input, buildOptions) => engine.buildScene(input, buildOptions)
    this.components = capabilityRegistries.components
    this.services = capabilityRegistries.services
    this.modules = capabilityRegistries.modules
    this.libraries = capabilityRegistries.libraries
    this.resources = engine.createResourceRegistry()
    this.events = engine.createEventRegistry()
    this.engine = {
      prepareScene: (scene) => engine.prepareScene(scene),
      start: () => engine.start(),
      pause: () => engine.pause(),
      stop: () => engine.stop(),
      advance: (nowMs, marginMs) => engine.advance(nowMs, marginMs),
    }
    const instanceRegistry = engine.createInstanceRegistry()
    this.instances = {
      ...instanceRegistry,
      destroy: (instanceId) => {
        instanceRegistry.destroy(instanceId)
        const cssSlot = this.#scenePackageCssSlots.get(instanceId)
        if (cssSlot === undefined) return
        this.preload.css.clear(cssSlot)
        this.#scenePackageCssSlots.delete(instanceId)
      },
    }
    this.preload = createRuntimePreload(options.preload ?? {})
    this.load = (scenePath, loadOptions) => {
      const instanceId = `codplay-load-${++this.#loadCounter}`
      const result = this.#loadQueue.then(async () => {
        const loaded = await loadScenePackage(this, scenePath, loadOptions.root, instanceId)
        if (loaded.cssSlot !== undefined) this.#scenePackageCssSlots.set(instanceId, loaded.cssSlot)
        return loaded.instance
      })
      this.#loadQueue = result.then(() => undefined, () => undefined)
      return result
    }
  }

  /** Destroys the engine and cancels any preload operation owned by CodPlay. */
  destroy(): void {
    // Keep the internal teardown primitive behind the public engine view.
    this.#engineOwner.destroy()
    releaseScenePackageContexts(this)
    this.preload.cancel()
    this.preload.css.clear()
    this.#scenePackageCssSlots.clear()
  }
}

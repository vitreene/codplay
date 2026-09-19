import {
  createCoreRuntimeCatalog,
  type RuntimeCapabilityCatalog,
} from '../../runtime/catalog'
import { RuntimeEngine } from '../../runtime/engine'
import type { CompiledScene } from '../../scene/compiled'
import { DiagnosticChannel } from '../diagnostic-channel'
import { publishFacadeError } from '../diagnostic-channel'
import { CapabilityRegistryController, applyConfiguredCapabilities } from './capability-registry'
import { EngineClockController } from './clock-controller'
import { EngineEventChannel } from './event-channel'
import type { EngineFacadeConfig } from './engine-types'
import { InstanceRegistry } from './instance-registry'
import { InstanceMountRegistry } from './mount-registry'
import { EngineResourceRegistry, resourceUrls } from './resource-registry'
import { EngineSceneController } from './scene-controller'
import type {
  CodPlayCompileInput,
  CodPlayCompileOptions,
  CodPlayCompileResult,
  CodPlayEngine,
  CodPlayEvents,
  CodPlayInstances,
  CodPlayResources,
} from '../facade-types'

/** Composes the internal engine controllers behind the public facade boundary. */
export class EngineFacadeImpl implements CodPlayEngine {
  private readonly catalog: RuntimeCapabilityCatalog
  private readonly runtimeEngine: RuntimeEngine
  private readonly diagnostics: DiagnosticChannel
  private readonly capabilities: CapabilityRegistryController
  private readonly resources: EngineResourceRegistry
  private readonly scene: EngineSceneController
  private readonly clock: EngineClockController
  private readonly events: EngineEventChannel
  private readonly mounts: InstanceMountRegistry
  private readonly instances: InstanceRegistry
  private destroyed = false

  /** Composes core and foreign capabilities while keeping the catalog internal. */
  constructor(config: EngineFacadeConfig = {}) {
    this.diagnostics = new DiagnosticChannel(config.diagnosticOutput)
    try {
      this.catalog = createCoreRuntimeCatalog()
      this.capabilities = new CapabilityRegistryController(
        this.catalog,
        this.diagnostics,
        () => this.destroyed,
      )
      applyConfiguredCapabilities(this.catalog, config)
      this.runtimeEngine = new RuntimeEngine(this.catalog, {
        resources: config.resources === undefined ? [] : resourceUrls(config.resources),
        idle: config.idle,
      })
      this.resources = new EngineResourceRegistry(
        this.runtimeEngine,
        this.diagnostics,
        () => this.destroyed,
      )
      this.resources.registerInitial(config.resources)
      this.scene = new EngineSceneController(
        this.catalog,
        this.runtimeEngine,
        this.diagnostics,
        () => this.capabilities.lock(),
        () => this.destroyed,
      )
      this.clock = new EngineClockController(
        this.runtimeEngine,
        config.ticker,
        this.diagnostics,
        () => this.destroyed,
      )
      this.events = new EngineEventChannel(this.diagnostics)

      let instanceRegistry: InstanceRegistry | undefined
      this.mounts = new InstanceMountRegistry({
        getInstance: (instanceId) => instanceRegistry?.getManaged(instanceId),
        diagnostics: this.diagnostics,
        isDestroyed: () => this.destroyed,
      })
      this.instances = new InstanceRegistry({
        catalog: this.catalog,
        runtimeEngine: this.runtimeEngine,
        resources: this.resources,
        diagnostics: this.diagnostics,
        lockCatalog: () => this.capabilities.lock(),
        isDestroyed: () => this.destroyed,
        mounts: this.mounts,
        onPublicEvent: (event) => this.events.forward(event),
        onPlaybackStateChange: (instanceId, state) => this.clock.syncPlayback(instanceId, state),
        onInstanceDestroyed: (instanceId) => this.clock.removeInstance(instanceId),
      })
      instanceRegistry = this.instances
    } catch (error) {
      publishFacadeError(this.diagnostics, 'CODPLAY_ENGINE_CONFIGURATION_FAILED', error)
      throw error
    }
  }

  /** Creates the direct capability registries over this engine catalog. */
  createCapabilityRegistries() {
    return this.capabilities.createRegistries()
  }

  /** Creates the direct resource transfer surface. */
  createResourceRegistry(): CodPlayResources {
    return this.resources.createPublicRegistry()
  }

  /** Creates the direct event surface shared by all instances. */
  createEventRegistry(): CodPlayEvents {
    return this.events.createPublicRegistry((input) => this.instances.emit(input))
  }

  /** Creates the instance registry exposed by the owning CodPlay facade. */
  createInstanceRegistry(): CodPlayInstances {
    return this.instances.createPublicRegistry()
  }

  /** Builds one authored scene against this engine's configured catalog. */
  buildScene(
    input: CodPlayCompileInput,
    options: CodPlayCompileOptions = {},
  ): CodPlayCompileResult {
    return this.scene.build(input, options)
  }

  /** Prepares every library required by one compiled scene before mounting. */
  prepareScene(scene: CompiledScene): Promise<void> {
    return this.scene.prepare(scene)
  }

  /** Starts the shared engine clock. */
  start(): void {
    this.clock.start()
  }

  /** Suspends shared frame propagation. */
  pause(): void {
    this.clock.pause()
  }

  /** Stops shared frame propagation. */
  stop(): void {
    this.clock.stop()
  }

  /** Accepts one host-supplied frame. */
  advance(nowMs: number, marginMs = 0): void {
    this.clock.advance(nowMs, marginMs)
  }

  /** Tears down mounts, instances, event listeners, runtime engine and resources. */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.mounts.detachAll()
    this.instances.destroyAll()
    this.events.destroy()
    this.clock.destroy()
    this.resources.destroy()
  }
}

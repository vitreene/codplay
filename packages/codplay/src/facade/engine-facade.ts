import {
  DiagnosticCollector,
  type Diagnostic,
  type DiagnosticReport,
} from '../diagnostics'
import {
  createCoreRuntimeCatalog,
  RuntimeCapabilityCatalog,
} from '../runtime/catalog'
import { RuntimeEngine } from '../runtime/engine'
import type { RuntimeTrackEvent } from '../runtime/player/pipeline'
import { SceneBuilder } from '../scene/compiled'
import type {
  CodPlayComponents,
  CodPlayCompileInput,
  CodPlayCompileOptions,
  CodPlayCompileResult,
  CodPlayEngine,
  CodPlayEngineOptions,
  CodPlayEvents,
  CodPlayEventListener,
  CodPlayEventInput,
  CodPlayInstances,
  CodPlayInstance,
  CodPlayInstanceOptions,
  CodPlayModules,
  CodPlayPublicEvent,
  CodPlayTraceListener,
  CodPlayRegistryError,
  CodPlayRegistryResult,
  CodPlayResourceRegistration,
  CodPlayResources,
  CodPlayServices,
} from './facade-types'
import { DiagnosticChannel, publishFacadeError, withDiagnosticRefs } from './diagnostic-channel'
import { InstanceFacadeImpl } from './instance-facade'
import { toPublicEvent } from './public-event'
import { toTraceEvent } from './trace-event'
import { createInstanceHost, type InstanceHost } from './instance-host'
import type { Ticker } from '../runtime/time'

type ManagedInstance = InstanceFacadeImpl
type EngineFacadeConfig = CodPlayEngineOptions & Readonly<{
  ticker?: Ticker
}>

type CapabilityRegistries = Readonly<{
  components: CodPlayComponents
  services: CodPlayServices
  modules: CodPlayModules
}>

type CapabilityFamily = 'component' | 'service' | 'module'
type RegistryOperation = 'register' | 'override'

/** Internal engine adapter that owns one catalog, clock, and instance registry. */
export class EngineFacadeImpl implements CodPlayEngine {
  private readonly catalog: RuntimeCapabilityCatalog
  private readonly runtimeEngine: RuntimeEngine
  private readonly diagnostics: DiagnosticChannel
  private readonly defaultTicker: Ticker | undefined
  private readonly managedInstances = new Map<string, ManagedInstance>()
  private readonly playingInstanceIds = new Set<string>()
  private readonly publicEventListeners = new Set<CodPlayEventListener>()
  private readonly resourceMetadata = new Map<string, import('../runtime/preload').RuntimePreloadResourceMetadata>()
  private readonly resourceMedia = new Map<string, import('../runtime/preload').RuntimePreloadMediaResources[string]>()
  private externalClockMode = false
  private destroyed = false

  /** Composes core and foreign capabilities while keeping the catalog open for direct registration. */
  constructor(config: EngineFacadeConfig = {}) {
    this.diagnostics = new DiagnosticChannel(config.diagnosticOutput)
    try {
      this.catalog = createCoreRuntimeCatalog()
      applyComponentCapabilities(this.catalog, config.components)
      applyServiceCapabilities(this.catalog, config.services)
      applyModuleCapabilities(this.catalog, config.modules)
      this.defaultTicker = config.ticker
      this.registerResourceData(config.resources)
      this.runtimeEngine = new RuntimeEngine(this.catalog, {
        resources: config.resources === undefined ? [] : resourceUrls(config.resources),
        idle: config.idle,
      })

    } catch (error) {
      publishFacadeError(this.diagnostics, 'CODPLAY_ENGINE_CONFIGURATION_FAILED', error)
      throw error
    }
  }

  /** Creates the three direct capability registries over this engine's catalog. */
  createCapabilityRegistries(): CapabilityRegistries {
    return {
      components: {
        register: (definition) => this.applyCapability(
          'component',
          'register',
          definition.type,
          () => this.catalog.registerComponent(definition, 'foreign'),
        ),
        override: (definition) => this.applyCapability(
          'component',
          'override',
          definition.type,
          () => this.catalog.overrideComponent(definition, 'foreign'),
        ),
      },
      services: {
        register: (definition) => this.applyCapability(
          'service',
          'register',
          definition.name,
          () => this.catalog.registerService(definition, 'foreign'),
        ),
        override: (definition) => this.applyCapability(
          'service',
          'override',
          definition.name,
          () => this.catalog.overrideService(definition, 'foreign'),
        ),
      },
      modules: {
        register: (definition) => this.applyCapability(
          'module',
          'register',
          definition.id,
          () => this.catalog.registerModule(definition, 'foreign'),
        ),
        override: (definition) => this.applyCapability(
          'module',
          'override',
          definition.id,
          () => this.catalog.overrideModule(definition, 'foreign'),
        ),
      },
    }
  }

  /** Creates the direct resource transfer surface while resource definitions remain preload-owned. */
  createResourceRegistry(): CodPlayResources {
    return {
      register: (resources) => this.registerResources(resources),
    }
  }

  /** Creates the direct event surface shared by all instances of this owner. */
  createEventRegistry(): CodPlayEvents {
    return {
      emit: (input) => this.emitEvent(input),
      onEvent: (listener) => {
        this.publicEventListeners.add(listener)
        return () => { this.publicEventListeners.delete(listener) }
      },
    }
  }

  /** Creates the instance registry exposed by the owning CodPlay facade. */
  createInstanceRegistry(): CodPlayInstances {
    return {
      create: (options) => this.createInstance(options),
      get: (instanceId) => this.managedInstances.get(instanceId),
      destroy: (instanceId) => this.destroyInstance(instanceId),
    }
  }

  /** Builds one authored scene against this engine's configured capability catalog. */
  buildScene(
    input: CodPlayCompileInput,
    options: CodPlayCompileOptions = {},
  ): CodPlayCompileResult {
    try {
      this.lockCatalog()
      const result = new SceneBuilder(this.catalog.validationSnapshot(), {
        ...options,
        diagnosticOutput: (diagnostic) => this.diagnostics.publish(withDiagnosticRefs(diagnostic, {
          sceneId: input.scene.id,
        })),
      }).build(input.scene)
      return {
        ...result,
        diagnostics: withDiagnosticReportRefs(result.diagnostics, { sceneId: input.scene.id }),
      }
    } catch (error) {
      const collector = new DiagnosticCollector({ output: () => undefined })
      collector.error(
        'CODPLAY_SCENE_COMPILE_FAILED',
        error instanceof Error ? error.message : String(error),
        { refs: { sceneId: input.scene.id } },
      )
      const diagnostics = collector.report()
      this.diagnostics.publishReport(diagnostics)
      return { ok: false, diagnostics }
    }
  }

  /** Applies one direct registry operation and converts catalog failures to public results. */
  private applyCapability(
    family: CapabilityFamily,
    operation: RegistryOperation,
    key: string,
    apply: () => void,
  ): CodPlayRegistryResult {
    const code = `CODPLAY_${family.toUpperCase()}_${operation.toUpperCase()}_FAILED`
    try {
      if (this.destroyed) throw new Error('CodPlay owner has been destroyed.')
      apply()
      return {
        ok: true,
        status: operation === 'register' ? 'registered' : 'overridden',
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const registryError: CodPlayRegistryError = {
        code,
        message,
        details: { family, operation, key },
      }
      this.diagnostics.publish({
        severity: 'error',
        code,
        message,
        details: { context: registryError.details },
      })
      return { ok: false, error: registryError }
    }
  }

  /** Closes capability composition at the first operation that consumes it. */
  private lockCatalog(): void {
    if (!this.catalog.isLocked()) this.catalog.lock()
  }

  /** Starts the CodPlay-owned ticker or resumes its external clock mode. */
  start(): void {
    this.runEngineOperation('CODPLAY_ENGINE_START_FAILED', () => {
      this.runtimeEngine.start(this.externalClockMode ? undefined : this.defaultTicker)
    })
  }

  /** Suspends frame propagation without changing instance positions. */
  pause(): void {
    this.runEngineOperation('CODPLAY_ENGINE_PAUSE_FAILED', () => this.runtimeEngine.pause())
  }

  /** Stops frame propagation without destroying managed instances. */
  stop(): void {
    this.runEngineOperation('CODPLAY_ENGINE_STOP_FAILED', () => this.runtimeEngine.stop())
  }

  /** Accepts one host-supplied frame through the single engine clock. */
  advance(nowMs: number, marginMs = 0): void {
    this.runEngineOperation('CODPLAY_ENGINE_ADVANCE_FAILED', () => {
      this.runtimeEngine.advance(nowMs, marginMs)
      this.externalClockMode = true
    })
  }

  /** Destroys every instance and then releases the shared engine resources. */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.playingInstanceIds.clear()
    for (const instance of this.managedInstances.values()) instance.destroyInternal()
    this.managedInstances.clear()
    this.publicEventListeners.clear()
    this.runtimeEngine.destroy()
    this.resourceMetadata.clear()
    for (const media of this.resourceMedia.values()) media.release()
    this.resourceMedia.clear()
  }

  /** Creates and initializes one instance against the locked engine catalog. */
  private createInstance(options: CodPlayInstanceOptions): CodPlayInstance {
    if (this.destroyed) {
      const error = new Error('CodPlay engine has been destroyed.')
      publishFacadeError(this.diagnostics, 'CODPLAY_INSTANCE_CREATE_FAILED', error, {
        instanceId: options.instanceId,
      })
      throw error
    }
    if (options.instanceId.trim().length === 0) {
      const error = new Error('CodPlay instanceId must not be empty.')
      publishFacadeError(this.diagnostics, 'CODPLAY_INSTANCE_ID_INVALID', error)
      throw error
    }
    if (this.managedInstances.has(options.instanceId)) {
      const error = new Error(`CodPlay instance already exists: ${options.instanceId}`)
      publishFacadeError(this.diagnostics, 'CODPLAY_INSTANCE_DUPLICATE', error, {
        instanceId: options.instanceId,
      })
      throw error
    }

    const diagnostics = new DiagnosticChannel(undefined, this.diagnostics)
    const eventListeners = new Set<CodPlayEventListener>()
    const traceListeners = new Set<CodPlayTraceListener>()
    let host: InstanceHost | undefined
    let reportPublished = false
    try {
      this.lockCatalog()
      host = createInstanceHost({
        catalog: this.catalog,
        engine: this.runtimeEngine,
        resourceMetadata: new Map(this.resourceMetadata),
        resourceMedia: new Map(this.resourceMedia),
        instance: options,
        onPublicEvent: (event) => this.forwardPublicEvent(options.instanceId, eventListeners, event),
        onTrace: (event) => this.forwardTraceEvent(options.instanceId, traceListeners, diagnostics, event),
        onEmitDiagnostic: (diagnostic: Diagnostic) => diagnostics.publish(withDiagnosticRefs(diagnostic, {
          instanceId: options.instanceId,
          sceneId: options.compiledScene.scene.id,
        })),
        onResizeError: (error) => publishFacadeError(
          diagnostics,
          'CODPLAY_INSTANCE_RESIZE_FAILED',
          error,
          { instanceId: options.instanceId },
        ),
      })
      const { player, runner, init } = host
      diagnostics.publishReport(init.diagnostics, { instanceId: options.instanceId })
      reportPublished = true
      if (!init.ok) {
        throw new Error(`CodPlay instance initialization failed: ${options.instanceId}`)
      }
      const instance = new InstanceFacadeImpl({
        instanceId: options.instanceId,
        player,
        runner,
        durationMs: options.durationMs,
        diagnostics,
        eventListeners,
        traceListeners,
        onPublicEvent: (event) => this.forwardEnginePublicEvent(event),
        onPlaybackStateChange: (state) => this.syncPlaybackClock(options.instanceId, state),
        destroy: host.destroy,
      })
      this.managedInstances.set(options.instanceId, instance)
      return instance
    } catch (error) {
      if (!reportPublished) publishFacadeError(diagnostics, 'CODPLAY_INSTANCE_CREATE_FAILED', error, { instanceId: options.instanceId })
      host?.destroy()
      eventListeners.clear()
      traceListeners.clear()
      throw error
    }
  }

  /** Registers one instance's preload result for subsequent instance creation. */
  private registerResources(resources: CodPlayResourceRegistration): void {
    this.runEngineOperation('CODPLAY_RESOURCE_REGISTER_FAILED', () => {
      this.registerResourceData(resources)
      this.runtimeEngine.registerResources(resourceUrls(resources))
    })
  }

  /** Stores resource metadata without changing the locked capability catalog. */
  private registerResourceData(resources: CodPlayResourceRegistration | undefined): void {
    if (resources === undefined) return
    for (const [url, metadata] of Object.entries(resources.metadata)) this.resourceMetadata.set(url, metadata)
    for (const [url, media] of Object.entries(resources.media ?? {})) {
      const previous = this.resourceMedia.get(url)
      if (previous === media) continue
      media.retain()
      previous?.release()
      this.resourceMedia.set(url, media)
    }
  }

  /** Routes one addressed public eventime to its selected instance. */
  private async emitEvent(input: CodPlayEventInput): Promise<void> {
    const instance = this.managedInstances.get(input.instanceId)
    if (instance === undefined) {
      publishFacadeError(this.diagnostics, 'CODPLAY_INSTANCE_UNKNOWN', new Error(`CodPlay instance is not registered: ${input.instanceId}`), {
        instanceId: input.instanceId,
      })
      return
    }
    await instance.events.emit(input.eventime, input.target)
  }

  /** Forwards one public event from the player to the instance listeners. */
  private forwardPublicEvent(
    instanceId: string,
    eventListeners: Set<CodPlayEventListener>,
    event: RuntimeTrackEvent,
  ): void {
    const instance = this.managedInstances.get(instanceId)
    if (instance !== undefined) {
      instance.handlePublicEvent(event)
      return
    }
    const publicEvent = toPublicEvent(instanceId, event)
    for (const listener of eventListeners) listener(publicEvent)
  }

  /** Forwards one already adapted event to the engine-level observers. */
  private forwardEnginePublicEvent(event: CodPlayPublicEvent): void {
    for (const listener of this.publicEventListeners) {
      try {
        listener(event)
      } catch (error) {
        publishFacadeError(this.diagnostics, 'CODPLAY_EVENT_LISTENER_FAILED', error, {
          instanceId: event.instanceId,
          eventId: event.eventId,
        })
      }
    }
  }

  /** Forwards one internal runtime event to the diagnostic trace observers. */
  private forwardTraceEvent(
    instanceId: string,
    traceListeners: Set<CodPlayTraceListener>,
    diagnostics: DiagnosticChannel,
    event: RuntimeTrackEvent,
  ): void {
    const traceEvent = toTraceEvent(instanceId, event)
    for (const listener of [...traceListeners]) {
      try {
        listener(traceEvent)
      } catch (error) {
        publishFacadeError(diagnostics, 'CODPLAY_TRACE_LISTENER_FAILED', error, {
          instanceId,
          eventId: event.eventId,
        })
      }
    }
  }

  /** Publishes one engine operation failure as a structured diagnostic. */
  private runEngineOperation(code: string, operation: () => void): void {
    if (this.destroyed) return
    try {
      operation()
    } catch (error) {
      publishFacadeError(this.diagnostics, code, error)
    }
  }

  /** Removes and tears down one managed instance. */
  private destroyInstance(instanceId: string): void {
    const instance = this.managedInstances.get(instanceId)
    if (instance === undefined) return
    this.playingInstanceIds.delete(instanceId)
    this.pausePlaybackClockWhenIdle()
    this.managedInstances.delete(instanceId)
    instance.destroyInternal()
  }

  /** Wakes or suspends the one CodPlay-owned clock from instance playback demand. */
  private syncPlaybackClock(instanceId: string, state: 'playing' | 'paused'): void {
    if (this.destroyed) return
    if (state === 'playing') this.playingInstanceIds.add(instanceId)
    else this.playingInstanceIds.delete(instanceId)

    if (this.playingInstanceIds.size > 0) {
      this.runEngineOperation('CODPLAY_ENGINE_AUTO_START_FAILED', () => {
        this.runtimeEngine.start(this.externalClockMode ? undefined : this.defaultTicker)
      })
      return
    }
    this.pausePlaybackClockWhenIdle()
  }

  /** Suspends the shared clock when no instance still requests playback. */
  private pausePlaybackClockWhenIdle(): void {
    if (this.playingInstanceIds.size > 0 || this.destroyed) return
    this.runEngineOperation('CODPLAY_ENGINE_AUTO_PAUSE_FAILED', () => this.runtimeEngine.pause())
  }
}

/** Registers component additions and overrides in one deterministic order. */
function applyComponentCapabilities(
  catalog: RuntimeCapabilityCatalog,
  group: EngineFacadeConfig['components'],
): void {
  for (const definition of group?.register ?? []) catalog.registerComponent(definition, 'foreign')
  for (const definition of group?.override ?? []) catalog.overrideComponent(definition, 'foreign')
}

/** Registers service additions and overrides in one deterministic order. */
function applyServiceCapabilities(
  catalog: RuntimeCapabilityCatalog,
  group: EngineFacadeConfig['services'],
): void {
  for (const definition of group?.register ?? []) catalog.registerService(definition, 'foreign')
  for (const definition of group?.override ?? []) catalog.overrideService(definition, 'foreign')
}

/** Registers module additions and overrides in one deterministic order. */
function applyModuleCapabilities(
  catalog: RuntimeCapabilityCatalog,
  group: EngineFacadeConfig['modules'],
): void {
  for (const definition of group?.register ?? []) catalog.registerModule(definition, 'foreign')
  for (const definition of group?.override ?? []) catalog.overrideModule(definition, 'foreign')
}

/** Extracts every URL available after one preload transfer. */
function resourceUrls(resources: CodPlayResourceRegistration): readonly string[] {
  return [...new Set([...resources.loaded, ...resources.skipped])]
}

/** Attaches the compiled scene reference to every diagnostic returned by the builder. */
function withDiagnosticReportRefs(
  report: DiagnosticReport,
  refs: Readonly<{ sceneId: string }>,
): DiagnosticReport {
  const all = report.all.map((diagnostic) => withDiagnosticRefs(diagnostic, refs))
  return {
    all,
    warnings: all.filter((diagnostic) => diagnostic.severity === 'warning'),
    errors: all.filter((diagnostic) => diagnostic.severity === 'error'),
  }
}

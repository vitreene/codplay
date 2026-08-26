import {
  DiagnosticCollector,
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
  CodPlayCompileInput,
  CodPlayCompileOptions,
  CodPlayCompileResult,
  CodPlayEngine,
  CodPlayEngineBuilder,
  CodPlayEngineConfig,
  CodPlayEngineEventInput,
  CodPlayEngineEvents,
  CodPlayEngineInstances,
  CodPlayEngineResources,
  CodPlayEventListener,
  CodPlayInstance,
  CodPlayInstanceOptions,
  CodPlayPublicEvent,
  CodPlayResourceRegistration,
} from './facade-types'
import { DiagnosticChannel, publishFacadeError, withDiagnosticRefs } from './diagnostic-channel'
import { InstanceFacadeImpl } from './instance-facade'
import { toPublicEvent } from './public-event'
import { createInstanceHost, type InstanceHost } from './instance-host'

type ManagedInstance = InstanceFacadeImpl

/** Public engine adapter that owns one catalog, clock, and instance registry. */
export class EngineFacadeImpl implements CodPlayEngine {
  readonly builder: CodPlayEngineBuilder
  readonly instances: CodPlayEngineInstances
  readonly resources: CodPlayEngineResources
  readonly events: CodPlayEngineEvents
  private readonly catalog: RuntimeCapabilityCatalog
  private readonly runtimeEngine: RuntimeEngine
  private readonly diagnostics: DiagnosticChannel
  private readonly defaultTicker: import('../runtime/time').Ticker | undefined
  private readonly managedInstances = new Map<string, ManagedInstance>()
  private readonly playingInstanceIds = new Set<string>()
  private readonly publicEventListeners = new Set<CodPlayEventListener>()
  private readonly resourceMetadata = new Map<string, import('../runtime/preload').RuntimePreloadResourceMetadata>()
  private destroyed = false

  /** Composes core and foreign capabilities, then locks the catalog. */
  constructor(config: CodPlayEngineConfig = {}) {
    this.diagnostics = new DiagnosticChannel(config.diagnosticOutput)
    try {
      this.catalog = createCoreRuntimeCatalog()
      applyComponentCapabilities(this.catalog, config.components)
      applyServiceCapabilities(this.catalog, config.services)
      applyModuleCapabilities(this.catalog, config.modules)
      this.catalog.lock()
      this.defaultTicker = config.ticker
      this.registerResourceData(config.resources)
      this.runtimeEngine = new RuntimeEngine(this.catalog, {
        resources: config.resources === undefined ? [] : resourceUrls(config.resources),
      })

      this.builder = {
        compile: (input, options) => this.compileScene(input, options),
      }
    } catch (error) {
      publishFacadeError(this.diagnostics, 'CODPLAY_ENGINE_CONFIGURATION_FAILED', error)
      throw error
    }

    this.instances = {
      create: (options) => this.createInstance(options),
      get: (instanceId) => this.managedInstances.get(instanceId),
      destroy: (instanceId) => this.destroyInstance(instanceId),
    }
    this.resources = {
      register: (resources) => this.registerResources(resources),
    }
    this.events = {
      emit: (input) => this.emitEvent(input),
      onEvent: (listener) => {
        this.publicEventListeners.add(listener)
        return () => { this.publicEventListeners.delete(listener) }
      },
    }
  }

  /** Compiles one authored scene against this engine's configured capability catalog. */
  private compileScene(
    input: CodPlayCompileInput,
    options: CodPlayCompileOptions = {},
  ): CodPlayCompileResult {
    try {
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

  /** Starts the engine-owned ticker or resumes its external clock mode. */
  start(ticker?: import('../runtime/time').Ticker): void {
    this.runEngineOperation('CODPLAY_ENGINE_START_FAILED', () => {
      this.runtimeEngine.start(ticker ?? this.defaultTicker)
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
    this.runEngineOperation('CODPLAY_ENGINE_ADVANCE_FAILED', () => this.runtimeEngine.advance(nowMs, marginMs))
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
    let host: InstanceHost | undefined
    let reportPublished = false
    try {
      host = createInstanceHost({
        catalog: this.catalog,
        engine: this.runtimeEngine,
        resourceMetadata: new Map(this.resourceMetadata),
        instance: options,
        onPublicEvent: (event) => this.forwardPublicEvent(options.instanceId, eventListeners, event),
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
  }

  /** Routes one addressed public eventime to its selected instance. */
  private async emitEvent(input: CodPlayEngineEventInput): Promise<void> {
    const instance = this.managedInstances.get(input.instanceId)
    if (instance === undefined) {
      publishFacadeError(this.diagnostics, 'CODPLAY_INSTANCE_UNKNOWN', new Error(`CodPlay instance is not registered: ${input.instanceId}`), {
        instanceId: input.instanceId,
      })
      return
    }
    await instance.events.emit(input.eventime, input.address)
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
        this.runtimeEngine.start(this.defaultTicker)
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
  group: CodPlayEngineConfig['components'],
): void {
  for (const definition of group?.register ?? []) catalog.registerComponent(definition, 'foreign')
  for (const definition of group?.override ?? []) catalog.overrideComponent(definition, 'foreign')
}

/** Registers service additions and overrides in one deterministic order. */
function applyServiceCapabilities(
  catalog: RuntimeCapabilityCatalog,
  group: CodPlayEngineConfig['services'],
): void {
  for (const definition of group?.register ?? []) catalog.registerService(definition, 'foreign')
  for (const definition of group?.override ?? []) catalog.overrideService(definition, 'foreign')
}

/** Registers module additions and overrides in one deterministic order. */
function applyModuleCapabilities(
  catalog: RuntimeCapabilityCatalog,
  group: CodPlayEngineConfig['modules'],
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

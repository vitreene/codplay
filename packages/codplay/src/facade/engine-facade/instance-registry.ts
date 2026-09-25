import type { Diagnostic } from '../../diagnostics'
import type { RuntimeCapabilityCatalog } from '../../runtime/catalog'
import type { RuntimeEngine } from '../../runtime/engine'
import type { RuntimeTraceEvent, RuntimeTrackEvent } from '../../runtime/player/pipeline'
import type {
  CodPlayEventInput,
  CodPlayEventListener,
  CodPlayInstance,
  CodPlayInstanceOptions,
  CodPlayInstances,
  CodPlayPublicEvent,
  CodPlayTraceListener,
} from '../facade-types'
import { DiagnosticChannel, publishFacadeError, withDiagnosticRefs } from '../diagnostic-channel'
import { InstanceFacadeImpl } from '../instance-facade'
import { createInstanceHost, type InstanceHost } from '../instance-host'
import { toPublicEvent } from '../public-event'
import { toTraceEvent } from '../trace-event'
import type { EngineResourceRegistry } from './resource-registry'
import type { InstanceMountRegistry } from './mount-registry'
import type { ManagedInstance } from './engine-types'
import type { HtmlSourceAdapterFactory } from '../../runtime/runner-html'

type InstanceRegistryOptions = Readonly<{
  catalog: RuntimeCapabilityCatalog
  runtimeEngine: RuntimeEngine
  resources: EngineResourceRegistry
  diagnostics: DiagnosticChannel
  lockCatalog: () => void
  isDestroyed: () => boolean
  mounts: InstanceMountRegistry
  onPublicEvent: (event: CodPlayPublicEvent) => void
  onPlaybackStateChange: (instanceId: string, state: 'playing' | 'paused') => void
  onInstanceDestroyed: (instanceId: string) => void
  sourceAdapterFactories?: readonly HtmlSourceAdapterFactory[]
}>

/** Owns public instance creation, addressing, event input and teardown. */
export class InstanceRegistry {
  private readonly instances = new Map<string, ManagedInstance>()
  private readonly options: InstanceRegistryOptions

  constructor(options: InstanceRegistryOptions) {
    this.options = options
  }

  /** Creates the public instance registry over this owner. */
  createPublicRegistry(): CodPlayInstances {
    return {
      create: (instanceOptions) => this.create(instanceOptions),
      mount: (request) => this.options.mounts.mount(request),
      get: (instanceId) => this.instances.get(instanceId),
      destroy: (instanceId) => this.destroy(instanceId),
    }
  }

  /** Returns an internal instance for mount and event routing. */
  getManaged(instanceId: string): ManagedInstance | undefined {
    return this.instances.get(instanceId)
  }

  /** Routes one addressed public eventime to its selected instance. */
  async emit(input: CodPlayEventInput): Promise<void> {
    const instance = this.instances.get(input.instanceId)
    if (instance === undefined) {
      publishFacadeError(
        this.options.diagnostics,
        'CODPLAY_INSTANCE_UNKNOWN',
        new Error(`CodPlay instance is not registered: ${input.instanceId}`),
        { instanceId: input.instanceId },
      )
      return
    }
    await instance.events.emit(input.eventime, input.target)
  }

  /** Creates and initializes one instance against the locked engine catalog. */
  create(instanceOptions: CodPlayInstanceOptions): CodPlayInstance {
    this.assertCreatable(instanceOptions)
    const diagnostics = new DiagnosticChannel(undefined, this.options.diagnostics)
    const eventListeners = new Set<CodPlayEventListener>()
    const traceListeners = new Set<CodPlayTraceListener>()
    let host: InstanceHost | undefined
    let reportPublished = false
    try {
      this.options.lockCatalog()
      host = createInstanceHost({
        catalog: this.options.catalog,
        engine: this.options.runtimeEngine,
        resourceMetadata: this.options.resources.metadataSnapshot(),
        resourceMedia: this.options.resources.mediaSnapshot(),
        sourceAdapterFactories: this.options.sourceAdapterFactories,
        instance: instanceOptions,
        onPublicEvent: (event) => this.forwardPublicEvent(instanceOptions.instanceId, eventListeners, event),
        onTrace: (event) => this.forwardTraceEvent(
          instanceOptions.instanceId,
          traceListeners,
          diagnostics,
          event,
        ),
        onEmitDiagnostic: (diagnostic: Diagnostic) => diagnostics.publish(withDiagnosticRefs(diagnostic, {
          instanceId: instanceOptions.instanceId,
          sceneId: instanceOptions.compiledScene.scene.id,
        })),
        onResizeError: (error) => publishFacadeError(
          diagnostics,
          'CODPLAY_INSTANCE_RESIZE_FAILED',
          error,
          { instanceId: instanceOptions.instanceId },
        ),
      })
      const { player, runner, init } = host
      diagnostics.publishReport(init.diagnostics, { instanceId: instanceOptions.instanceId })
      reportPublished = true
      if (!init.ok) {
        throw new Error(`CodPlay instance initialization failed: ${instanceOptions.instanceId}`)
      }
      const instance = new InstanceFacadeImpl({
        instanceId: instanceOptions.instanceId,
        root: host.root,
        player,
        runner,
        diagnostics,
        eventListeners,
        traceListeners,
        onPublicEvent: (event) => this.options.onPublicEvent(event),
        onPlaybackStateChange: (state) => this.options.onPlaybackStateChange(instanceOptions.instanceId, state),
        destroy: host.destroy,
      })
      this.instances.set(instanceOptions.instanceId, instance)
      return instance
    } catch (error) {
      if (!reportPublished) {
        publishFacadeError(
          diagnostics,
          'CODPLAY_INSTANCE_CREATE_FAILED',
          error,
          { instanceId: instanceOptions.instanceId },
        )
      }
      host?.destroy()
      eventListeners.clear()
      traceListeners.clear()
      throw error
    }
  }

  /** Destroys every instance after the owner has detached all mounts. */
  destroyAll(): void {
    for (const instanceId of [...this.instances.keys()]) this.destroy(instanceId)
  }

  /** Removes and tears down one managed instance. */
  private destroy(instanceId: string): void {
    const instance = this.instances.get(instanceId)
    if (instance === undefined) return
    this.options.mounts.detachForInstance(instanceId)
    this.options.onInstanceDestroyed(instanceId)
    this.instances.delete(instanceId)
    instance.destroyInternal()
  }

  /** Rejects invalid creation requests before assembling a host. */
  private assertCreatable(instanceOptions: CodPlayInstanceOptions): void {
    if (this.options.isDestroyed()) {
      const error = new Error('CodPlay engine has been destroyed.')
      publishFacadeError(this.options.diagnostics, 'CODPLAY_INSTANCE_CREATE_FAILED', error, {
        instanceId: instanceOptions.instanceId,
      })
      throw error
    }
    if (instanceOptions.instanceId.trim().length === 0) {
      const error = new Error('CodPlay instanceId must not be empty.')
      publishFacadeError(this.options.diagnostics, 'CODPLAY_INSTANCE_ID_INVALID', error)
      throw error
    }
    if (this.instances.has(instanceOptions.instanceId)) {
      const error = new Error(`CodPlay instance already exists: ${instanceOptions.instanceId}`)
      publishFacadeError(this.options.diagnostics, 'CODPLAY_INSTANCE_DUPLICATE', error, {
        instanceId: instanceOptions.instanceId,
      })
      throw error
    }
  }

  /** Forwards one runtime public event to local listeners or the live instance. */
  private forwardPublicEvent(
    instanceId: string,
    eventListeners: Set<CodPlayEventListener>,
    event: RuntimeTrackEvent,
  ): void {
    const instance = this.instances.get(instanceId)
    if (instance !== undefined) {
      instance.handlePublicEvent(event)
      return
    }
    const publicEvent = toPublicEvent(instanceId, event)
    for (const listener of eventListeners) listener(publicEvent)
  }

  /** Forwards one runtime trace event while isolating observer failures. */
  private forwardTraceEvent(
    instanceId: string,
    traceListeners: Set<CodPlayTraceListener>,
    diagnostics: DiagnosticChannel,
    event: RuntimeTraceEvent,
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
}

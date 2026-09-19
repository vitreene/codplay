import type { ForeignContentSurface } from '../../runtime/components'
import type {
  CodPlayInstanceHostTarget,
  CodPlayInstanceMountHandle,
  CodPlayInstanceMountRequest,
} from '../facade-types'
import { DiagnosticChannel, publishFacadeError } from '../diagnostic-channel'
import type { ManagedInstance, ManagedInstanceMount } from './engine-types'

type MountRegistryOptions = Readonly<{
  getInstance: (instanceId: string) => ManagedInstance | undefined
  diagnostics: DiagnosticChannel
  isDestroyed: () => boolean
}>

/** Owns foreign-content relations between two live public instances. */
export class InstanceMountRegistry {
  private readonly mounts = new Map<number, ManagedInstanceMount>()
  private readonly mountIdByHost = new Map<string, number>()
  private readonly mountIdByChild = new Map<string, number>()
  private nextMountId = 1
  private readonly options: MountRegistryOptions

  constructor(options: MountRegistryOptions) {
    this.options = options
  }

  /** Mounts one child instance into an addressed host slot. */
  mount(request: CodPlayInstanceMountRequest): CodPlayInstanceMountHandle {
    if (this.options.isDestroyed()) {
      return this.reject(request, new Error('CodPlay owner has been destroyed.'))
    }

    const hostInstance = this.options.getInstance(request.host.instanceId)
    if (hostInstance === undefined) {
      return this.reject(request, new Error(
        `CodPlay host instance is not registered: ${request.host.instanceId}`,
      ))
    }
    const childInstance = this.options.getInstance(request.childInstanceId)
    if (childInstance === undefined) {
      return this.reject(request, new Error(
        `CodPlay child instance is not registered: ${request.childInstanceId}`,
      ))
    }
    if (request.host.instanceId === request.childInstanceId) {
      return this.reject(request, new Error('CodPlay cannot mount an instance into itself.'))
    }

    const hostKey = createInstanceMountHostKey(request.host)
    const existingMount = this.getMountByHost(hostKey)
    if (existingMount !== undefined && request.replace === undefined) {
      return this.reject(request, new Error(`CodPlay host is already mounted: ${hostKey}`))
    }
    if (this.mountIdByChild.has(request.childInstanceId)) {
      return this.reject(request, new Error(
        `CodPlay child instance is already mounted: ${request.childInstanceId}`,
      ))
    }

    const surface = hostInstance.getForeignContentSurface(request.host)
    if (surface === undefined) {
      return this.reject(request, new Error(
        `CodPlay mount host is not a materialized slot: `
        + `${request.host.instanceId}/${request.host.storyId}/${request.host.persoId}`,
      ))
    }
    const hostRoot = hostInstance.getForeignContentHostRoot(request.host)
    if (hostRoot === undefined) {
      return this.reject(request, new Error(
        `CodPlay mount host is not a materialized HTML slot root: `
        + `${request.host.instanceId}/${request.host.storyId}/${request.host.persoId}`,
      ))
    }
    if (childInstance.getMaterializedRoots() === undefined) {
      return this.reject(request, new Error(`CodPlay child instance is destroyed: ${request.childInstanceId}`))
    }

    const replacement = existingMount === undefined || request.replace === undefined
      ? undefined
      : hostInstance.prepareForeignMountReplacement(request.host, request.replace)
    if (existingMount !== undefined && replacement === undefined) {
      return this.reject(request, new Error(
        `CodPlay mount host does not provide the requested replace transition: ${hostKey}`,
      ))
    }

    if (existingMount !== undefined) this.detach(existingMount.mountId)

    let mount: CodPlayInstanceMountHandle | undefined
    try {
      mount = this.attach({
        request,
        hostKey,
        hostRoot,
        childInstance,
        surface,
      })
      replacement?.start()
      return mount
    } catch (error) {
      mount?.detach()
      replacement?.cancel()
      if (existingMount !== undefined) {
        try {
          this.attach({
            request: {
              host: existingMount.host,
              childInstanceId: existingMount.childInstanceId,
            },
            hostKey: existingMount.hostKey,
            hostRoot,
            childInstance: existingMount.child,
            surface: existingMount.surface,
          })
        } catch {
          // Preserve the original replacement error; teardown remains owner-controlled.
        }
      }
      return this.reject(request, error)
    }
  }

  /** Detaches every relation involving one instance before its destruction. */
  detachForInstance(instanceId: string): void {
    for (const [mountId, mount] of this.mounts) {
      if (mount.host.instanceId === instanceId || mount.childInstanceId === instanceId) {
        this.detach(mountId)
      }
    }
  }

  /** Detaches all relations during owner teardown. */
  detachAll(): void {
    for (const mountId of [...this.mounts.keys()]) this.detach(mountId)
  }

  /** Attaches one validated child relation and records its idempotent handle. */
  private attach(options: Readonly<{
    request: Readonly<{
      host: CodPlayInstanceHostTarget
      childInstanceId: string
    }>
    hostKey: string
    hostRoot: HTMLElement
    childInstance: ManagedInstance
    surface: ForeignContentSurface
  }>): CodPlayInstanceMountHandle {
    try {
      const childRoots = options.childInstance.setMountContainer(options.hostRoot) ?? []
      options.surface.attach(childRoots)
    } catch (error) {
      try {
        options.childInstance.setMountContainer(undefined)
      } catch {
        // Preserve the original mount error; teardown remains owner-controlled.
      }
      throw error
    }
    const mountId = this.nextMountId++
    const mount: ManagedInstanceMount = {
      mountId,
      host: options.request.host,
      hostKey: options.hostKey,
      childInstanceId: options.request.childInstanceId,
      child: options.childInstance,
      surface: options.surface,
    }
    this.mounts.set(mountId, mount)
    this.mountIdByHost.set(options.hostKey, mountId)
    this.mountIdByChild.set(options.request.childInstanceId, mountId)
    return { detach: () => this.detach(mountId) }
  }

  /** Rejects one invalid mount through the owner diagnostic channel. */
  private reject(
    request: CodPlayInstanceMountRequest,
    error: unknown,
  ): never {
    publishFacadeError(
      this.options.diagnostics,
      'CODPLAY_INSTANCE_MOUNT_FAILED',
      error,
      {
        instanceId: request.host.instanceId,
        storyId: request.host.storyId,
        persoId: request.host.persoId,
      },
    )
    throw error instanceof Error ? error : new Error(String(error))
  }

  /** Detaches one relation exactly once while keeping both instances alive. */
  private detach(mountId: number): void {
    const mount = this.mounts.get(mountId)
    if (mount === undefined) return
    try {
      mount.surface.detach()
    } finally {
      try {
        mount.child.setMountContainer(undefined)
      } finally {
        this.mounts.delete(mountId)
        if (this.mountIdByHost.get(mount.hostKey) === mountId) this.mountIdByHost.delete(mount.hostKey)
        if (this.mountIdByChild.get(mount.childInstanceId) === mountId) {
          this.mountIdByChild.delete(mount.childInstanceId)
        }
      }
    }
  }

  /** Returns the relation currently occupying one logical host key. */
  private getMountByHost(hostKey: string): ManagedInstanceMount | undefined {
    const mountId = this.mountIdByHost.get(hostKey)
    return mountId === undefined ? undefined : this.mounts.get(mountId)
  }
}

/** Creates a stable key for one logical host address. */
function createInstanceMountHostKey(target: CodPlayInstanceHostTarget): string {
  return JSON.stringify([target.instanceId, target.storyId, target.persoId])
}

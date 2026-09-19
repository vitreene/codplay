import type { RuntimeEngine } from '../../runtime/engine'
import type {
  RuntimePreloadMediaResources,
  RuntimePreloadMetadata,
} from '../../runtime/preload'
import type {
  CodPlayResourceRegistration,
  CodPlayResources,
} from '../facade-types'
import { DiagnosticChannel, publishFacadeError } from '../diagnostic-channel'

/** Owns resource metadata and native media handles shared by future instances. */
export class EngineResourceRegistry {
  private readonly metadata = new Map<string, RuntimePreloadMetadata[string]>()
  private readonly media = new Map<string, RuntimePreloadMediaResources[string]>()
  private readonly runtimeEngine: RuntimeEngine
  private readonly diagnostics: DiagnosticChannel
  private readonly isDestroyed: () => boolean

  constructor(
    runtimeEngine: RuntimeEngine,
    diagnostics: DiagnosticChannel,
    isDestroyed: () => boolean,
  ) {
    this.runtimeEngine = runtimeEngine
    this.diagnostics = diagnostics
    this.isDestroyed = isDestroyed
  }

  /** Creates the public resource transfer surface. */
  createPublicRegistry(): CodPlayResources {
    return { register: (resources) => this.register(resources) }
  }

  /** Stores resources supplied during owner construction. */
  registerInitial(resources: CodPlayResourceRegistration | undefined): void {
    this.registerData(resources)
  }

  /** Transfers one preload result to the runtime and retains its handles. */
  register(resources: CodPlayResourceRegistration): void {
    if (this.isDestroyed()) return
    try {
      this.registerData(resources)
      this.runtimeEngine.registerResources(resourceUrls(resources))
    } catch (error) {
      publishFacadeError(this.diagnostics, 'CODPLAY_RESOURCE_REGISTER_FAILED', error)
    }
  }

  /** Returns an isolated metadata map for one new instance host. */
  metadataSnapshot(): ReadonlyMap<string, RuntimePreloadMetadata[string]> {
    return new Map(this.metadata)
  }

  /** Returns an isolated media map for one new instance host. */
  mediaSnapshot(): ReadonlyMap<string, RuntimePreloadMediaResources[string]> {
    return new Map(this.media)
  }

  /** Releases every media handle retained by this owner. */
  destroy(): void {
    this.metadata.clear()
    for (const handle of this.media.values()) handle.release()
    this.media.clear()
  }

  /** Retains metadata and media handles without touching the runtime engine. */
  private registerData(resources: CodPlayResourceRegistration | undefined): void {
    if (resources === undefined) return
    for (const [url, metadata] of Object.entries(resources.metadata)) {
      this.metadata.set(url, metadata)
    }
    for (const [url, media] of Object.entries(resources.media ?? {})) {
      const previous = this.media.get(url)
      if (previous === media) continue
      media.retain()
      previous?.release()
      this.media.set(url, media)
    }
  }
}

/** Extracts every URL available after one preload transfer. */
export function resourceUrls(resources: CodPlayResourceRegistration): readonly string[] {
  return [...new Set([...resources.loaded, ...resources.skipped])]
}

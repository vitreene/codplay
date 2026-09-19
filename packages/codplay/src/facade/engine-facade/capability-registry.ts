import type { RuntimeCapabilityCatalog } from '../../runtime/catalog'
import type {
  CodPlayCapabilityGroup,
  CodPlayComponents,
  CodPlayLibraries,
  CodPlayModules,
  CodPlayRegistryError,
  CodPlayRegistryResult,
  CodPlayServices,
} from '../facade-types'
import { DiagnosticChannel } from '../diagnostic-channel'
import type { EngineFacadeConfig, CapabilityFamily, CapabilityRegistries, RegistryOperation } from './engine-types'

/** Composes configured core and foreign capabilities before the catalog is used. */
export function applyConfiguredCapabilities(
  catalog: RuntimeCapabilityCatalog,
  config: EngineFacadeConfig,
): void {
  applyComponentCapabilities(catalog, config.components)
  applyServiceCapabilities(catalog, config.services)
  applyModuleCapabilities(catalog, config.modules)
  applyLibraryCapabilities(catalog, config.libraries)
}

/** Owns the public registry adapters over one engine catalog. */
export class CapabilityRegistryController {
  private readonly catalog: RuntimeCapabilityCatalog
  private readonly diagnostics: DiagnosticChannel
  private readonly isDestroyed: () => boolean

  constructor(
    catalog: RuntimeCapabilityCatalog,
    diagnostics: DiagnosticChannel,
    isDestroyed: () => boolean,
  ) {
    this.catalog = catalog
    this.diagnostics = diagnostics
    this.isDestroyed = isDestroyed
  }

  /** Creates all public capability registries over this catalog. */
  createRegistries(): CapabilityRegistries {
    return {
      components: this.createComponentRegistry(),
      services: this.createServiceRegistry(),
      modules: this.createModuleRegistry(),
      libraries: this.createLibraryRegistry(),
    }
  }

  /** Locks capability composition at the first consuming operation. */
  lock(): void {
    if (!this.catalog.isLocked()) this.catalog.lock()
  }

  /** Creates the component registry without duplicating its operation mapping. */
  private createComponentRegistry(): CodPlayComponents {
    return this.createRegistry(
      'component',
      definition => definition.type,
      definition => this.catalog.registerComponent(definition, 'foreign'),
      definition => this.catalog.overrideComponent(definition, 'foreign'),
    )
  }

  /** Creates the service registry without duplicating its operation mapping. */
  private createServiceRegistry(): CodPlayServices {
    return this.createRegistry(
      'service',
      definition => definition.name,
      definition => this.catalog.registerService(definition, 'foreign'),
      definition => this.catalog.overrideService(definition, 'foreign'),
    )
  }

  /** Creates the module registry without duplicating its operation mapping. */
  private createModuleRegistry(): CodPlayModules {
    return this.createRegistry(
      'module',
      definition => definition.id,
      definition => this.catalog.registerModule(definition, 'foreign'),
      definition => this.catalog.overrideModule(definition, 'foreign'),
    )
  }

  /** Creates the library registry without duplicating its operation mapping. */
  private createLibraryRegistry(): CodPlayLibraries {
    return this.createRegistry(
      'library',
      definition => definition.id,
      definition => this.catalog.registerLibrary(definition, 'foreign'),
      definition => this.catalog.overrideLibrary(definition, 'foreign'),
    )
  }

  /** Adapts one catalog family to the common public register/override contract. */
  private createRegistry<Definition>(
    family: CapabilityFamily,
    getKey: (definition: Definition) => string,
    register: (definition: Definition) => void,
    override: (definition: Definition) => void,
  ): Readonly<{
    register: (definition: Definition) => CodPlayRegistryResult
    override: (definition: Definition) => CodPlayRegistryResult
  }> {
    return {
      register: (definition) => this.apply(family, 'register', getKey(definition), () => register(definition)),
      override: (definition) => this.apply(family, 'override', getKey(definition), () => override(definition)),
    }
  }

  /** Converts one catalog mutation failure to the established public result. */
  private apply(
    family: CapabilityFamily,
    operation: RegistryOperation,
    key: string,
    apply: () => void,
  ): CodPlayRegistryResult {
    const code = `CODPLAY_${family.toUpperCase()}_${operation.toUpperCase()}_FAILED`
    try {
      if (this.isDestroyed()) throw new Error('CodPlay owner has been destroyed.')
      apply()
      return {
        ok: true,
        status: operation === 'register' ? 'registered' : 'overridden',
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const details = { family, operation, key }
      const registryError: CodPlayRegistryError = { code, message, details }
      this.diagnostics.publish({
        severity: 'error',
        code,
        message,
        details: { context: details },
      })
      return { ok: false, error: registryError }
    }
  }
}

/** Registers one optional capability group in declaration order. */
function registerGroup<Definition>(
  group: CodPlayCapabilityGroup<Definition> | undefined,
  register: (definition: Definition) => void,
  override: (definition: Definition) => void,
): void {
  for (const definition of group?.register ?? []) register(definition)
  for (const definition of group?.override ?? []) override(definition)
}

/** Registers component additions and overrides in one deterministic order. */
function applyComponentCapabilities(
  catalog: RuntimeCapabilityCatalog,
  group: EngineFacadeConfig['components'],
): void {
  registerGroup(
    group,
    definition => catalog.registerComponent(definition, 'foreign'),
    definition => catalog.overrideComponent(definition, 'foreign'),
  )
}

/** Registers service additions and overrides in one deterministic order. */
function applyServiceCapabilities(
  catalog: RuntimeCapabilityCatalog,
  group: EngineFacadeConfig['services'],
): void {
  registerGroup(
    group,
    definition => catalog.registerService(definition, 'foreign'),
    definition => catalog.overrideService(definition, 'foreign'),
  )
}

/** Registers module additions and overrides in one deterministic order. */
function applyModuleCapabilities(
  catalog: RuntimeCapabilityCatalog,
  group: EngineFacadeConfig['modules'],
): void {
  registerGroup(
    group,
    definition => catalog.registerModule(definition, 'foreign'),
    definition => catalog.overrideModule(definition, 'foreign'),
  )
}

/** Registers library additions and overrides before scene preparation. */
function applyLibraryCapabilities(
  catalog: RuntimeCapabilityCatalog,
  group: EngineFacadeConfig['libraries'],
): void {
  registerGroup(
    group,
    definition => catalog.registerLibrary(definition, 'foreign'),
    definition => catalog.overrideLibrary(definition, 'foreign'),
  )
}

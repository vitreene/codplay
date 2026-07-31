import type { DiagnosticCollector, DiagnosticRefs } from '../../diagnostics'
import { createCoreServiceDefinitions } from '../../services'
import { reportMissingValidator } from './validation-warnings'
import type {
  ComponentValidationDefinition,
  PersoValidationInput,
  ServiceValidationDefinition,
  ValidationCatalogSnapshot,
  ValidationContext,
  ValidationFunction,
  ValidationTarget,
} from './validation-types'

/** Mutable registration catalog built while CodPlay capabilities are declared. */
export class ValidationCatalog {
  private readonly components = new Map<string, ComponentValidationDefinition>()
  private readonly services = new Map<string, ServiceValidationDefinition>()

  /**
   * Creates a catalog preloaded with the common service validators.
   */
  constructor() {
    for (const definition of createCoreServiceDefinitions()) {
      this.registerService(definition)
    }
  }

  /**
   * Registers one component validation declaration before compilation starts.
   */
  registerComponent(definition: ComponentValidationDefinition): void {
    if (this.components.has(definition.type)) {
      throw new Error(`Validation component already registered: ${definition.type}`)
    }
    this.components.set(definition.type, definition)
  }

  /**
   * Registers one reusable service validation declaration.
   */
  registerService(definition: ServiceValidationDefinition): void {
    if (this.services.has(definition.name)) {
      throw new Error(`Validation service already registered: ${definition.name}`)
    }
    this.services.set(definition.name, definition)
  }

  /**
   * Freezes the registration boundary consumed by the build pipeline.
   */
  snapshot(): ValidationCatalogSnapshot {
    return {
      components: new Map(this.components),
      services: new Map(this.services),
    }
  }
}

/**
 * Validates one perso through component and declared service definitions.
 */
export function validatePersoWithCatalog(
  catalog: ValidationCatalogSnapshot,
  perso: PersoValidationInput,
  diagnostics: DiagnosticCollector,
): void {
  const component = catalog.components.get(perso.type)
  const refs: DiagnosticRefs = { persoId: perso.id }

  if (component === undefined) {
    diagnostics.error(
      'AUTHOR_COMPONENT_TYPE_UNKNOWN',
      `No component definition is registered for "${perso.type}".`,
      { refs, context: { type: perso.type, path: 'type' } },
    )
    return
  }

  if (component.validateInitial === undefined && component.validateAction === undefined) {
    reportMissingValidator({
      kind: 'component',
      name: component.type,
      refs,
      path: 'perso',
      diagnostics,
    })
  }

  validateComponentPayload(component.validateInitial, perso.initial, 'initial', refs, diagnostics)

  for (const [actionName, action] of Object.entries(perso.actions ?? {})) {
    validateComponentPayload(component.validateAction, action, 'action', refs, diagnostics, actionName)
  }

  for (const serviceName of component.services) {
    const service = catalog.services.get(serviceName)
    if (service === undefined) {
      diagnostics.error(
        'AUTHOR_SERVICE_UNKNOWN',
        `No service definition is registered for "${serviceName}".`,
        { refs, context: { service: serviceName, path: 'services' } },
      )
      continue
    }

    if (service.validate === undefined && service.properties === undefined) {
      reportMissingValidator({
        kind: 'service',
        name: serviceName,
        refs,
        path: `services.${serviceName}`,
        diagnostics,
      })
      continue
    }

    validateServicePayload(service, perso.initial, 'initial', refs, diagnostics)
    for (const [actionName, action] of Object.entries(perso.actions ?? {})) {
      validateServicePayload(service, action, 'action', refs, diagnostics, actionName)
    }
  }
}

/**
 * Runs one optional component validator for one initial or action payload.
 */
function validateComponentPayload(
  validator: ValidationFunction | undefined,
  value: unknown,
  target: ValidationTarget,
  refs: DiagnosticRefs,
  diagnostics: DiagnosticCollector,
  actionName?: string,
): void {
  if (validator === undefined) {
    return
  }

  validator(value, createValidationContext(target, `perso.${target}`, refs, diagnostics, actionName))
}

/**
 * Runs one optional service validator when its payload is present.
 */
function validateServicePayload(
  service: ServiceValidationDefinition,
  payload: unknown,
  target: ValidationTarget,
  refs: DiagnosticRefs,
  diagnostics: DiagnosticCollector,
  actionName?: string,
): void {
  if (!isPlainRecord(payload) || !(service.name in payload)) {
    return
  }

  const path = target === 'initial'
    ? `initial.${service.name}`
    : `actions.${actionName}.${service.name}`
  const value = payload[service.name]
  const context = createValidationContext(target, path, refs, diagnostics, actionName)
  service.validate?.(value, context)

  if (!isPlainRecord(value) || service.properties === undefined) {
    return
  }

  const propertyByName = new Map(service.properties.map((property) => [property.name, property]))
  for (const [propertyName, propertyValue] of Object.entries(value)) {
    const property = propertyByName.get(propertyName)
    if (property === undefined) {
      if (service.allowUnknownProperties === false) {
        diagnostics.error(
          'AUTHOR_PROPERTY_UNKNOWN',
          `Property "${propertyName}" is not declared in service "${service.name}".`,
          { refs, context: { path: `${path}.${propertyName}`, service: service.name } },
        )
      }
      continue
    }

    property.validate?.(
      propertyValue,
      createValidationContext(target, `${path}.${propertyName}`, refs, diagnostics, actionName),
    )
  }
}

/**
 * Builds one immutable context shared with a component or service validator.
 */
function createValidationContext(
  target: ValidationTarget,
  path: string,
  refs: DiagnosticRefs,
  diagnostics: DiagnosticCollector,
  actionName?: string,
): ValidationContext {
  return { target, path, refs, diagnostics, actionName }
}

/** Checks whether one payload can expose service keys. */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

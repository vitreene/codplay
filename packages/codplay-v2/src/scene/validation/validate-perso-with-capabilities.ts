import type { DiagnosticCollector, DiagnosticRefs } from '../../diagnostics'
import { isPlainRecord } from '../../shared'
import {
  createPersoValidationPayloads,
  joinPersoValidationPath,
  type PersoValidationPayload,
} from './perso-validation'
import { PERSO_VALIDATION_PATHS } from '../config/perso-validation'
import { VALIDATION_TARGET_INITIAL } from '../../services/service-validation-types'
import { reportMissingValidator } from './validation-warnings'
import type {
  CapabilityValidationSnapshot,
  PersoValidationInput,
  ServiceValidationDefinition,
  ValidationContext,
  ValidationFunction,
  ValidationTarget,
} from './validation-types'

/**
 * Validates one perso through component and declared service definitions.
 */
export function validatePersoWithCapabilities(
  catalog: CapabilityValidationSnapshot,
  perso: PersoValidationInput,
  diagnostics: DiagnosticCollector,
): void {
  const component = catalog.components.get(perso.type)
  const refs: DiagnosticRefs = { persoId: perso.id }

  if (component === undefined) {
    diagnostics.error(
      'AUTHOR_COMPONENT_TYPE_UNKNOWN',
      `No component definition is registered for "${perso.type}".`,
      { refs, context: { type: perso.type, path: joinPersoValidationPath(PERSO_VALIDATION_PATHS.type) } },
    )
    return
  }

  if (component.validateInitial === undefined && component.validateAction === undefined) {
    reportMissingValidator({
      kind: 'component',
      name: component.type,
      refs,
      path: joinPersoValidationPath(PERSO_VALIDATION_PATHS.type),
      diagnostics,
    })
  }

  const payloads = createPersoValidationPayloads(perso)
  for (const payload of payloads) {
    const validator = payload.target === VALIDATION_TARGET_INITIAL ? component.validateInitial : component.validateAction
    validateComponentPayload(validator, payload, refs, diagnostics)
  }

  for (const serviceName of component.services) {
    const service = catalog.services.get(serviceName)
    if (service === undefined) {
      diagnostics.error(
        'AUTHOR_SERVICE_UNKNOWN',
        `No service definition is registered for "${serviceName}".`,
        { refs, context: { service: serviceName, path: joinPersoValidationPath([...PERSO_VALIDATION_PATHS.services, serviceName]) } },
      )
      continue
    }

    if (service.validate === undefined && service.properties === undefined) {
      reportMissingValidator({
        kind: 'service',
        name: serviceName,
        refs,
        path: joinPersoValidationPath([...PERSO_VALIDATION_PATHS.services, serviceName]),
        diagnostics,
      })
      continue
    }

    for (const payload of payloads) {
      validateServicePayload(service, payload, refs, diagnostics)
    }
  }
}

/**
 * Runs one optional component validator for one initial or action payload.
 */
function validateComponentPayload(
  validator: ValidationFunction | undefined,
  payload: PersoValidationPayload,
  refs: DiagnosticRefs,
  diagnostics: DiagnosticCollector,
): void {
  if (validator === undefined) {
    return
  }

  validator(
    payload.value,
    createValidationContext(
      payload.target,
      joinPersoValidationPath(payload.path),
      refs,
      diagnostics,
      payload.actionName,
    ),
  )
}

/**
 * Runs one optional service validator when its payload is present.
 */
function validateServicePayload(
  service: ServiceValidationDefinition,
  payload: PersoValidationPayload,
  refs: DiagnosticRefs,
  diagnostics: DiagnosticCollector,
): void {
  if (!isPlainRecord(payload.value) || !(service.name in payload.value)) {
    return
  }

  const path = joinPersoValidationPath([...payload.path, service.name])
  const value = payload.value[service.name]
  const context = createValidationContext(payload.target, path, refs, diagnostics, payload.actionName)
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
          { refs, context: { path: joinPersoValidationPath([...payload.path, service.name, propertyName]), service: service.name } },
        )
      }
      continue
    }

    property.validate?.(
      propertyValue,
      createValidationContext(
        payload.target,
        joinPersoValidationPath([...payload.path, service.name, propertyName]),
        refs,
        diagnostics,
        payload.actionName,
      ),
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

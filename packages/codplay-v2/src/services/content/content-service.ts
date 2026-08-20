import type { ServiceValidationDefinition, ValidationFunction } from '../service-validation-types'
import { reportInvalidServiceValue } from '../service-validation-report'
import { HTML_MATERIALIZER_ID } from '../../runtime/materializer'
import type { RuntimeComponentServiceDefinition } from '../../runtime/catalog'
import { createHtmlContentService } from './html-content-service'

/** Runtime content accepted by the default content service. */
export type ContentValue = string | HTMLElement

/** Reports whether a value is an HTMLElement available in the current runtime. */
export function isContentElement(value: unknown): value is HTMLElement {
  return typeof HTMLElement !== 'undefined' && value instanceof HTMLElement
}

/** Validates the serializable content values accepted by CompiledScene. */
export const validateContent: ValidationFunction = (value, context) => {
  if (typeof value === 'string') return
  reportInvalidServiceValue(
    context.diagnostics,
    'AUTHOR_CONTENT_INVALID',
    'content must be a string in SceneDoc; HTMLElement values are runtime-only.',
    context,
  )
}

/** Declares the core content service consumed by tag components. */
export const CONTENT_SERVICE: ServiceValidationDefinition = {
  name: 'content',
  validate: validateContent,
}

/** Declares the core content service and its HTML materializer implementation. */
export const HTML_CONTENT_SERVICE: RuntimeComponentServiceDefinition = {
  ...CONTENT_SERVICE,
  materializers: [HTML_MATERIALIZER_ID],
  create: () => createHtmlContentService(),
}

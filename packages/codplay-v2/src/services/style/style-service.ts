import type { ServiceValidationDefinition, ValidationFunction } from '../service-validation-types'
import { reportInvalidServiceValue } from '../service-validation-report'
import { isPlainRecord } from '../../shared'
import { HTML_MATERIALIZER_ID } from '../../runtime/materializer'
import type {
  RuntimeComponentServiceContext,
  RuntimeComponentServiceDefinition,
} from '../../runtime/catalog'
import { createHtmlStyleService } from './html-style-service'
import type { HtmlMaterializerRuntimeContext } from '../html-materializer-service-types'

/** Open CSS declaration map accepted by the style service. */
export type StyleValue = Readonly<Record<string, unknown>>

/** Validates the shape shared by style service payloads. */
export const validateStyle: ValidationFunction = (value, context) => {
  if (!isPlainRecord(value)) {
    reportInvalidServiceValue(context.diagnostics, 'AUTHOR_STYLE_INVALID', 'style must be a plain object.', context)
  }
}

/** Declares the core style service consumed by components and compilation. */
export const STYLE_SERVICE: ServiceValidationDefinition = {
  name: 'style',
  validate: validateStyle,
  // Ordinary CSS properties remain open. The HTML adapter additionally consumes
  // the V2 transform channels without turning them into a global property matrix.
  allowUnknownProperties: true,
  /** Preserves modern CSS syntax; URL/resource policy belongs to preload. */
  sanitizeMarkupAttribute: ({ attributeName, value }) => attributeName === 'style' ? value : undefined,
}

/** Declares the core style service and its HTML materializer implementation. */
export const HTML_STYLE_SERVICE: RuntimeComponentServiceDefinition = {
  ...STYLE_SERVICE,
  materializers: [HTML_MATERIALIZER_ID],
  create: (context) => createHtmlStyleService(readHtmlMaterializerContext(context)),
}

/** Validates and narrows the context supplied to the HTML style adapter. */
function readHtmlMaterializerContext(context: RuntimeComponentServiceContext): HtmlMaterializerRuntimeContext {
  if (context.materializerId !== HTML_MATERIALIZER_ID) {
    throw new Error(`Style service received an unexpected materializer: ${context.materializerId}`)
  }
  if (!isHtmlMaterializerRuntimeContext(context.materializerContext)) {
    throw new Error('HTML materializer context is invalid.')
  }
  return context.materializerContext
}

/** Checks the mutable HTML runtime context used by style conversion. */
function isHtmlMaterializerRuntimeContext(value: unknown): value is HtmlMaterializerRuntimeContext {
  return typeof value === 'object'
    && value !== null
    && 'numericLengthScale' in value
    && typeof (value as { numericLengthScale?: unknown }).numericLengthScale === 'number'
}

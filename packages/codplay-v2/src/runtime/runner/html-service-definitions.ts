import { HTML_MATERIALIZER_ID } from '../materializer'
import type { ServiceRuntimeContext, ServiceRuntimeDefinition } from '../../services/service-runtime-types'
import { ATTR_SERVICE } from '../../services/attr/attr-service'
import { createHtmlAttrService } from '../../services/attr/html-attr-service'
import { CLASS_NAME_SERVICE } from '../../services/class-name/class-name-service'
import { createHtmlClassNameService } from '../../services/class-name/html-class-name-service'
import { CONTENT_SERVICE } from '../../services/content/content-service'
import { createHtmlContentService } from '../../services/content/html-content-service'
import { STYLE_SERVICE } from '../../services/style/style-service'
import { createHtmlStyleService } from '../../services/style/html-style-service'
import type { HtmlMaterializerRuntimeContext } from '../../services/html-materializer-service-types'

/** Declares the core attr service and its HTML materializer adapter. */
export const HTML_ATTR_SERVICE: ServiceRuntimeDefinition = {
  ...ATTR_SERVICE,
  materializers: [HTML_MATERIALIZER_ID],
  create: () => createHtmlAttrService(),
}

/** Declares the core className service and its HTML materializer adapter. */
export const HTML_CLASS_NAME_SERVICE: ServiceRuntimeDefinition = {
  ...CLASS_NAME_SERVICE,
  materializers: [HTML_MATERIALIZER_ID],
  create: () => createHtmlClassNameService(),
}

/** Declares the core content service and its HTML materializer adapter. */
export const HTML_CONTENT_SERVICE: ServiceRuntimeDefinition = {
  ...CONTENT_SERVICE,
  materializers: [HTML_MATERIALIZER_ID],
  create: () => createHtmlContentService(),
}

/** Declares the core style service and its HTML materializer adapter. */
export const HTML_STYLE_SERVICE: ServiceRuntimeDefinition = {
  ...STYLE_SERVICE,
  materializers: [HTML_MATERIALIZER_ID],
  create: (context) => createHtmlStyleService(readHtmlMaterializerContext(context)),
}

/** Validates and narrows the context supplied to the HTML style adapter. */
function readHtmlMaterializerContext(context: ServiceRuntimeContext): HtmlMaterializerRuntimeContext {
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

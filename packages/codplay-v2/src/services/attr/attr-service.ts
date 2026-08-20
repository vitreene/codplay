import type { ServiceValidationDefinition, ValidationFunction } from '../service-validation-types'
import { reportInvalidServiceValue } from '../service-validation-report'
import { isPlainRecord } from '../../shared'
import { HTML_MATERIALIZER_ID } from '../../runtime/materializer'
import type { RuntimeComponentServiceDefinition } from '../../runtime/catalog'
import { createHtmlAttrService } from './html-attr-service'

/** Attribute map accepted by the attr service. */
export type AttrValue = Readonly<Record<string, unknown>>

/** Validates the plain attribute map accepted by the attr service. */
export const validateAttr: ValidationFunction = (value, context) => {
  if (!isPlainRecord(value)) {
    reportInvalidServiceValue(context.diagnostics, 'AUTHOR_ATTR_INVALID', 'attr must be a plain object.', context)
  }
}

/** Declares the core attr service consumed by components and compilation. */
export const ATTR_SERVICE: ServiceValidationDefinition = {
  name: 'attr',
  validate: validateAttr,
}

/** Declares the core attr service and its HTML materializer implementation. */
export const HTML_ATTR_SERVICE: RuntimeComponentServiceDefinition = {
  ...ATTR_SERVICE,
  materializers: [HTML_MATERIALIZER_ID],
  create: () => createHtmlAttrService(),
}

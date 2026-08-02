import { ATTR_SERVICE } from './attr/attr-service'
import { CLASS_NAME_SERVICE } from './class-name/class-name-service'
import { CONTENT_SERVICE } from './content/content-service'
import { STYLE_SERVICE } from './style/style-service'
import type { ServiceValidationDefinition } from './service-validation-types'

/** Returns the mandatory core service definitions for a new CodPlay catalog. */
export function createCoreServiceDefinitions(): readonly ServiceValidationDefinition[] {
  return [STYLE_SERVICE, CLASS_NAME_SERVICE, ATTR_SERVICE, CONTENT_SERVICE]
}

export { ATTR_SERVICE, validateAttr } from './attr/attr-service'
export { CLASS_NAME_SERVICE, validateClassName } from './class-name/class-name-service'
export { CONTENT_SERVICE, validateContent } from './content/content-service'
export { STYLE_SERVICE, validateStyle } from './style/style-service'
export { VALIDATION_TARGET_ACTION, VALIDATION_TARGET_INITIAL } from './config/validation-targets'
export type {
  PropertyValidationDefinition,
  MarkupAttributeSanitizer,
  MarkupAttributeSanitizerContext,
  ServiceValidationDefinition,
  ValidationContext,
  ValidationFunction,
  ValidationTarget,
} from './service-validation-types'

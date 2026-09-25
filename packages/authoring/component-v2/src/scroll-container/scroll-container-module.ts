import type { RuntimeModuleServiceDefinition } from 'codplay/runtime/catalog'
import { SCROLL_CONTAINER_MODULE_SERVICE_ID } from './scroll-container-types'

/** Registers the optional scroll capability without coupling its module to HTML. */
export const SCROLL_CONTAINER_MODULE_DEFINITION: RuntimeModuleServiceDefinition = {
  id: SCROLL_CONTAINER_MODULE_SERVICE_ID,
  create: () => ({}),
}

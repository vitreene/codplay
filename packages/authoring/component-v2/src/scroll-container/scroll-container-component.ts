import { TagComponent, sanitizeTagInitial } from 'codplay/runtime/components'
import type { RuntimeComponentDefinition } from 'codplay/runtime/catalog'
import { SCROLL_CONTAINER_MODULE_SERVICE_ID } from './scroll-container-types'
import { validateScrollContainerInitial } from './scroll-container-validation'

/** Reuses the core one-tag projection for the scroll-container persona type. */
export class ScrollContainerComponent extends TagComponent {}

/** Registers the scrollport profile over the existing HTML tag materializer. */
export const SCROLL_CONTAINER_COMPONENT_DEFINITION: RuntimeComponentDefinition = {
  type: 'scroll-container',
  component: ScrollContainerComponent,
  modules: [SCROLL_CONTAINER_MODULE_SERVICE_ID],
  validateInitial: validateScrollContainerInitial,
  sanitizeInitial: sanitizeTagInitial,
}

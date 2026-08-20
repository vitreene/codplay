import { isHtmlElementNode } from '../html-materializer-service-types'
import type { RuntimeComponentServiceInstance } from '../../runtime/catalog'

/** Creates the component-scoped HTML adapter for the content service. */
export function createHtmlContentService(): RuntimeComponentServiceInstance {
  return {
    apply: (node, value) => {
      if (isHtmlElementNode(node)) node.textContent = String(value)
    },
  }
}

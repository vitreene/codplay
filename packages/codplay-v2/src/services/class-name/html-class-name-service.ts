import { isHtmlElementNode } from '../html-materializer-service-types'
import type { RuntimeComponentServiceInstance } from '../../runtime/catalog'

/** Creates the component-scoped HTML adapter for the className service. */
export function createHtmlClassNameService(): RuntimeComponentServiceInstance {
  return {
    apply: (node, value) => {
      if (!isHtmlElementNode(node) || typeof value !== 'string') return
      node.className = value
    },
  }
}

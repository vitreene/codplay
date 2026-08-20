import { isHtmlElementNode, isServiceRecord } from '../html-materializer-service-types'
import type { RuntimeComponentServiceInstance } from '../../runtime/catalog'

/** Creates the component-scoped HTML adapter for the attr service. */
export function createHtmlAttrService(): RuntimeComponentServiceInstance {
  const managedAttributes = new Set<string>()
  return {
    apply: (node, value) => {
      if (!isHtmlElementNode(node) || !isServiceRecord(value)) return
      for (const name of managedAttributes) {
        if (!(name in value)) node.removeAttribute(name)
      }
      managedAttributes.clear()
      for (const [name, rawValue] of Object.entries(value)) {
        if (rawValue === false || rawValue === null || rawValue === undefined) node.removeAttribute(name)
        else node.setAttribute(name, rawValue === true ? '' : String(rawValue))
        managedAttributes.add(name)
      }
    },
  }
}

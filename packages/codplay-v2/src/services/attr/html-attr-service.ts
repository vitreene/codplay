import { isHtmlElementNode, isServiceRecord } from '../html-materializer-service-types'
import type { ServiceRuntimeInstance } from '../service-runtime-types'

/** Creates the component-scoped HTML adapter for the attr service. */
export function createHtmlAttrService(): ServiceRuntimeInstance {
  const managedAttributesByNode = new WeakMap<object, Set<string>>()
  return {
    apply: (node, value) => {
      if (!isHtmlElementNode(node) || !isServiceRecord(value)) return
      const nodeKey = node as object
      const managedAttributes = managedAttributesByNode.get(nodeKey) ?? new Set<string>()
      for (const name of managedAttributes) {
        if (!(name in value)) node.removeAttribute(name)
      }
      managedAttributes.clear()
      for (const [name, rawValue] of Object.entries(value)) {
        if (rawValue === false || rawValue === null || rawValue === undefined) node.removeAttribute(name)
        else node.setAttribute(name, rawValue === true ? '' : String(rawValue))
        managedAttributes.add(name)
      }
      managedAttributesByNode.set(nodeKey, managedAttributes)
    },
  }
}

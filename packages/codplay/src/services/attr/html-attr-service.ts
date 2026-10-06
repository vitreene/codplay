import { isHtmlElementNode, isServiceRecord } from '../html-materializer-service-types'
import type {
  HtmlElementNode,
  HtmlMaterializerRuntimeContext,
} from '../html-materializer-service-types'
import type { ServiceRuntimeInstance } from '../service-runtime-types'

/** Creates the component-scoped HTML adapter for the attr service. */
export function createHtmlAttrService(
  context?: HtmlMaterializerRuntimeContext,
): ServiceRuntimeInstance {
  const managedAttributesByNode = new WeakMap<object, Set<string>>()
  return {
    apply: (node, value) => {
      if (!isHtmlElementNode(node) || !isServiceRecord(value)) return
      const nodeKey = node as object
      const managedAttributes = managedAttributesByNode.get(nodeKey) ?? new Set<string>()
      for (const name of managedAttributes) {
        if (!(name in value)) {
          deferAccessibilityAttribute(context, node, name, undefined)
          node.removeAttribute(name)
        }
      }
      managedAttributes.clear()
      for (const [name, rawValue] of Object.entries(value)) {
        const attributeValue = rawValue === false || rawValue === null || rawValue === undefined
          ? undefined
          : rawValue === true ? '' : String(rawValue)
        if (context?.deferredAccessibilityAttributes !== undefined
          && isDeferredAccessibilityAttributeValue(name, rawValue)) {
          deferAccessibilityAttribute(context, node, name, attributeValue)
        } else {
          deferAccessibilityAttribute(context, node, name, undefined)
          if (attributeValue === undefined) node.removeAttribute(name)
          else node.setAttribute(name, attributeValue)
        }
        managedAttributes.add(name)
      }
      managedAttributesByNode.set(nodeKey, managedAttributes)
    },
  }
}

/** Queues closing accessibility attributes for the materializer's synchronous boundary. */
function deferAccessibilityAttribute(
  context: HtmlMaterializerRuntimeContext | undefined,
  node: HtmlElementNode,
  name: string,
  value: string | undefined,
): void {
  if (!isDeferredAccessibilityAttribute(name)) return
  const pending = context?.deferredAccessibilityAttributes
  if (pending === undefined) return
  const attributes = pending.get(node) ?? new Map<string, string | undefined>()
  if (value === undefined) attributes.delete(name)
  else attributes.set(name, value)
  if (attributes.size === 0) pending.delete(node)
  else pending.set(node, attributes)
}

/** Identifies the two attributes whose closing writes follow focus restoration. */
function isDeferredAccessibilityAttribute(name: string): boolean {
  return name === 'aria-hidden' || name === 'inert'
}

/** Defers only the closed state; opening removals still precede focus. */
function isDeferredAccessibilityAttributeValue(name: string, value: unknown): boolean {
  return (name === 'aria-hidden' && (value === true || value === 'true'))
    || (name === 'inert' && (value === true || value === '' || value === 'true'))
}

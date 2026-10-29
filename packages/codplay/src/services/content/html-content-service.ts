import { isHtmlElementNode } from '../html-materializer-service-types'
import type { ServiceRuntimeInstance } from '../service-runtime-types'
import { isContentElement } from './content-service'

/** Creates the component-scoped HTML adapter for the content service. */
export function createHtmlContentService(): ServiceRuntimeInstance {
  const managedNodes = new WeakMap<object, readonly ChildNode[] | null>()
  return {
    apply: (node, value) => {
      if (!isHtmlElementNode(node)) return
      const nodeKey = node as object
      if (value === null) {
        const children = managedNodes.get(node)
        if (children === undefined) return
        if (children === null) node.textContent = ''
        for (const child of children ?? []) {
          if (child.parentNode === nodeKey) child.remove()
        }
        managedNodes.delete(node)
        return
      }
      if (typeof value === 'string' || typeof value === 'number') {
        const nextText = String(value)
        // Safari can lose hit-testing on a button when its direct text node is
        // replaced during a live sync. Keep the existing text node when the
        // rendered value is already correct, as the V1 remote does.
        const hasOnlyTextNode = node.childNodes?.length === 1 && node.firstChild?.nodeType === 3
        const previous = managedNodes.get(node)
        const keepsManagedText = previous?.length === 1 && previous[0]?.nodeType === 3
          && previous[0].parentNode === nodeKey && previous[0].textContent === nextText
        if (keepsManagedText) return
        if (!hasOnlyTextNode || node.textContent !== nextText) node.textContent = nextText
        managedNodes.set(node, node.childNodes === undefined ? null : Array.from(node.childNodes))
        return
      }
      if (!isContentElement(value) || (value as unknown) === node) return

      if (typeof node.replaceChildren === 'function') {
        node.replaceChildren(value)
        managedNodes.set(node, [value])
        return
      }
      node.textContent = ''
      node.appendChild?.(value)
      managedNodes.set(node, [value])
    },
  }
}

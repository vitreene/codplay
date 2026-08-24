import { isHtmlElementNode } from '../html-materializer-service-types'
import type { ServiceRuntimeInstance } from '../service-runtime-types'
import { isContentElement } from './content-service'

/** Creates the component-scoped HTML adapter for the content service. */
export function createHtmlContentService(): ServiceRuntimeInstance {
  return {
    apply: (node, value) => {
      if (!isHtmlElementNode(node)) return
      if (typeof value === 'string') {
        node.textContent = value
        return
      }
      if (!isContentElement(value) || (value as unknown) === node) return

      if (typeof node.replaceChildren === 'function') {
        node.replaceChildren(value)
        return
      }
      node.textContent = ''
      node.appendChild?.(value)
    },
  }
}

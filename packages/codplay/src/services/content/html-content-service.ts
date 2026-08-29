import { isHtmlElementNode } from '../html-materializer-service-types'
import type { ServiceRuntimeInstance } from '../service-runtime-types'
import { isContentElement } from './content-service'

/** Creates the component-scoped HTML adapter for the content service. */
export function createHtmlContentService(): ServiceRuntimeInstance {
  return {
    apply: (node, value) => {
      if (!isHtmlElementNode(node)) return
      if (typeof value === 'string' || typeof value === 'number') {
        const nextText = String(value)
        // Safari can lose hit-testing on a button when its direct text node is
        // replaced during a live sync. Keep the existing text node when the
        // rendered value is already correct, as the V1 remote does.
        const hasOnlyTextNode = node.childNodes?.length === 1 && node.firstChild?.nodeType === 3
        if (!hasOnlyTextNode || node.textContent !== nextText) node.textContent = nextText
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

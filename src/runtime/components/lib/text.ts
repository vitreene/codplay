import { applyTextContent } from '../dom-component-adapter'

/**
 * Applies one text content value on one node-like target.
 */
export function setTextContent(nodeRef: unknown, content: string): void {
  applyTextContent(nodeRef, content)
}

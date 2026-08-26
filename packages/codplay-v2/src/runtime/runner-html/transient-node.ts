/** Attribute used to protect a materializer-external HTML node during a frame. */
export const HTML_TRANSIENT_NODE_ATTRIBUTE = 'data-codplay-transient'

/** Marks one HTML node as owned by a transient presentation operation. */
export function markHtmlTransientNode(node: unknown): void {
  if (!isAttributeNode(node)) return
  node.setAttribute(HTML_TRANSIENT_NODE_ATTRIBUTE, '')
}

/** Removes the transient protection from one HTML node. */
export function clearHtmlTransientNode(node: unknown): void {
  if (!isAttributeNode(node)) return
  node.removeAttribute(HTML_TRANSIENT_NODE_ATTRIBUTE)
}

/** Tests whether a node must be left untouched by structural materialization. */
export function isHtmlTransientNode(node: unknown): boolean {
  return isAttributeNode(node)
    && node.getAttribute(HTML_TRANSIENT_NODE_ATTRIBUTE) !== null
}

/** Narrows a value to the minimal HTML attribute contract used by the marker. */
function isAttributeNode(value: unknown): value is {
  getAttribute: (name: string) => string | null
  setAttribute: (name: string, value: string) => void
  removeAttribute: (name: string) => void
} {
  return typeof value === 'object'
    && value !== null
    && 'getAttribute' in value
    && typeof value.getAttribute === 'function'
    && 'setAttribute' in value
    && typeof value.setAttribute === 'function'
    && 'removeAttribute' in value
    && typeof value.removeAttribute === 'function'
}

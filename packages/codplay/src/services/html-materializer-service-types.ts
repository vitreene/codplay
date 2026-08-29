/** Runtime values supplied by the HTML materializer and kept outside logical state. */
export type HtmlMaterializerRuntimeContext = {
  /** Scale applied to unitless numeric CSS lengths at the HTML boundary. */
  numericLengthScale: number
}

/** Minimal element contract required by the HTML service adapters. */
export type HtmlElementNode = {
  className?: unknown
  namespaceURI?: string | null
  style: Record<string, string> & { setProperty: (property: string, value: string) => void }
  textContent: string | null
  childNodes?: { length: number }
  firstChild?: { nodeType?: number } | null
  setAttribute: (name: string, value: string) => void
  removeAttribute: (name: string) => void
  getAttribute?: (name: string) => string | null
  appendChild?: (child: unknown) => unknown
  replaceChildren?: (...children: unknown[]) => void
}

/** Narrows one value to the DOM surface used by HTML service adapters. */
export function isHtmlElementNode(value: unknown): value is HtmlElementNode {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<HtmlElementNode>
  return candidate.style !== undefined
    && typeof candidate.style.setProperty === 'function'
    && typeof candidate.setAttribute === 'function'
    && typeof candidate.removeAttribute === 'function'
}

/** Narrows a value to a non-array record accepted by service adapters. */
export function isServiceRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Writes one CSS declaration through the browser style declaration contract. */
export function setHtmlStyleProperty(node: HtmlElementNode, property: string, value: string): void {
  const style = node.style as Record<string, string>
  const getPropertyValue = (node.style as unknown as {
    getPropertyValue?: (property: string) => string
  }).getPropertyValue
  const current = property.startsWith('--') || property.includes('-')
    ? getPropertyValue?.call(node.style, property)
    : style[property]
  if (current === value) return
  if (property.startsWith('--') || property.includes('-')) node.style.setProperty(property, value)
  else style[property] = value
}

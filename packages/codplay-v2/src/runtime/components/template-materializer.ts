import type { MaterializedPart } from './component-types'

/** Result of materializing one HTML template string. */
export type TemplateMaterialization = Readonly<{
  rootNode: Node
  parts: readonly MaterializedPart[]
}>

/** Materializes one HTML template string and consumes its data-part markers. */
export function materializeTemplateString(markup: string): TemplateMaterialization {
  if (markup.trim().length === 0) throw new Error('Component template must not be empty.')
  if (typeof globalThis.document === 'undefined') {
    throw new Error('Template-string materialization requires a DOM environment.')
  }

  const template = globalThis.document.createElement('template')
  template.innerHTML = markup
  const childNodes = Array.from(template.content.childNodes).filter((node) => {
    return !(node.nodeType === 3 && node.textContent?.trim().length === 0)
  })
  if (childNodes.length === 0) throw new Error('Component template produced no nodes.')

  const rootNode = childNodes.length === 1
    ? childNodes[0]
    : wrapTemplateChildren(childNodes)
  const parts = collectMaterializedParts(rootNode)

  return { rootNode, parts }
}

/** Wraps multiple authored roots without changing their order. */
function wrapTemplateChildren(childNodes: readonly ChildNode[]): HTMLElement {
  const wrapper = globalThis.document.createElement('div')
  for (const childNode of childNodes) wrapper.appendChild(childNode)
  return wrapper
}

/** Collects and consumes every public data-part marker in declaration order. */
function collectMaterializedParts(rootNode: Node): readonly MaterializedPart[] {
  const elements: Element[] = []
  if (rootNode instanceof Element && rootNode.hasAttribute('data-part')) elements.push(rootNode)
  if (rootNode instanceof Element || rootNode instanceof DocumentFragment) {
    elements.push(...Array.from(rootNode.querySelectorAll('[data-part]')))
  }

  const seen = new Set<string>()
  return elements.map((element) => {
    const partId = element.getAttribute('data-part')?.trim() ?? ''
    if (partId.length === 0) throw new Error('Component data-part must have a non-empty value.')
    if (seen.has(partId)) throw new Error(`Component data-part is duplicated: ${partId}`)
    seen.add(partId)
    element.removeAttribute('data-part')
    return { partId, nodeRef: element }
  })
}

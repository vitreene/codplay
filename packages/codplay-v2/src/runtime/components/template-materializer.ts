import type { MaterializedPart } from './component-types'

/** Result of materializing compiler-sanitized HTML markup. */
export type TemplateMaterialization = Readonly<{
  rootNode: Node
  parts: readonly MaterializedPart[]
}>

/** Materializes trusted compiled markup without performing sanitization. */
export function materializeTemplateString(markup: string): TemplateMaterialization {
  if (typeof globalThis.document === 'undefined') {
    throw new Error('Template materialization requires a DOM environment.')
  }

  const template = globalThis.document.createElement('template')
  template.innerHTML = markup
  const childNodes = Array.from(template.content.childNodes).filter((node) => {
    return !(node.nodeType === 3 && node.textContent?.trim().length === 0)
  })
  if (childNodes.length === 0) throw new Error('Compiled template produced no nodes.')

  const rootNode = childNodes.length === 1 ? childNodes[0] : wrapTemplateChildren(childNodes)
  return { rootNode, parts: collectMaterializedParts(rootNode) }
}

/** Wraps multiple compiled roots without changing their order. */
function wrapTemplateChildren(childNodes: readonly ChildNode[]): HTMLElement {
  const wrapper = globalThis.document.createElement('div')
  for (const childNode of childNodes) wrapper.appendChild(childNode)
  return wrapper
}

/** Collects trusted data-part markers without validating the compiled artifact again. */
function collectMaterializedParts(rootNode: Node): readonly MaterializedPart[] {
  const elements: Element[] = []
  if (rootNode instanceof Element && rootNode.hasAttribute('data-part')) elements.push(rootNode)
  if (rootNode instanceof Element || rootNode instanceof DocumentFragment) {
    elements.push(...Array.from(rootNode.querySelectorAll('[data-part]')))
  }
  return elements.map((element) => {
    const partId = element.getAttribute('data-part') ?? ''
    element.removeAttribute('data-part')
    return { partId, nodeRef: element }
  })
}

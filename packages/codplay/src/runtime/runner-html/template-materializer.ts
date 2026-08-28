import type { MaterializedPart } from '../components/component-types'

/** One retained HTML root, or the ordered roots of a rendered fragment. */
export type HtmlMaterializedRoot = Node | readonly Node[]

/** Result of materializing trusted HTML markup returned by a component. */
export type HtmlTemplateMaterialization = Readonly<{
  rootNode: HtmlMaterializedRoot
  parts: readonly MaterializedPart[]
}>

/** Materializes trusted compiled HTML and consumes its internal part markers. */
export function materializeTemplateString(markup: string): HtmlTemplateMaterialization {
  if (typeof globalThis.document === 'undefined') {
    throw new Error('Template materialization requires a DOM environment.')
  }

  const template = globalThis.document.createElement('template')
  template.innerHTML = markup
  const childNodes = Array.from(template.content.childNodes).filter((node) => {
    return !(node.nodeType === 3 && node.textContent?.trim().length === 0)
  })
  if (childNodes.length === 0) throw new Error('Compiled template produced no nodes.')

  const rootNode: HtmlMaterializedRoot = childNodes.length === 1 ? childNodes[0]! : childNodes
  return { rootNode, parts: collectMaterializedParts(rootNode) }
}

/** Collects trusted data-part markers and removes them from the rendered DOM. */
function collectMaterializedParts(rootNode: HtmlMaterializedRoot): readonly MaterializedPart[] {
  const roots = Array.isArray(rootNode) ? rootNode : [rootNode]
  const elements: Element[] = []
  for (const root of roots) {
    if (root instanceof Element && root.hasAttribute('data-part')) elements.push(root)
    if (root instanceof Element || root instanceof DocumentFragment) {
      elements.push(...Array.from(root.querySelectorAll('[data-part]')))
    }
  }
  return elements.map((element) => {
    const partId = element.getAttribute('data-part') ?? ''
    element.removeAttribute('data-part')
    return { partId, nodeRef: element }
  })
}

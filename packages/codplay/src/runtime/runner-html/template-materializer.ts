import type { MaterializedPart } from '../components/component-types'

/** One retained HTML root, or the ordered roots of a rendered fragment. */
export type HtmlMaterializedRoot = Node | readonly Node[]

/** Prefix used before the `part` token in comment-based author markers. */
export const DEFAULT_PART_MARKER_PREFIX = 'data-' as const

/** Options that configure the author marker syntax read from HTML comments. */
export type HtmlTemplateMaterializationOptions = Readonly<{
  /** Prefix before `part`; `data-` recognizes `<!-- data-part="..." -->`. */
  partMarkerPrefix?: string
}>

/** Result of materializing HTML markup returned by a component. */
export type HtmlTemplateMaterialization = Readonly<{
  rootNode: HtmlMaterializedRoot
  parts: readonly MaterializedPart[]
}>

/** Materializes compiled HTML and consumes element part attributes while retaining comment anchors. */
export function materializeTemplateString(
  markup: string,
  options: HtmlTemplateMaterializationOptions = {},
): HtmlTemplateMaterialization {
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
  return {
    rootNode,
    parts: collectMaterializedParts(rootNode, `${options.partMarkerPrefix ?? DEFAULT_PART_MARKER_PREFIX}part`),
  }
}

/** Collects element outlets and comment anchors in their template order. */
function collectMaterializedParts(
  rootNode: HtmlMaterializedRoot,
  commentMarkerName: string,
): readonly MaterializedPart[] {
  const roots = Array.isArray(rootNode) ? rootNode : [rootNode]
  const parts: MaterializedPart[] = []
  const visit = (current: Node): void => {
    if (current instanceof Element && current.hasAttribute('data-part')) {
      const partId = current.getAttribute('data-part') ?? ''
      current.removeAttribute('data-part')
      parts.push({ partId, nodeRef: current, kind: 'outlet' })
    }
    if (current.nodeType === 8) {
      const partId = parseCommentPartId(current.nodeValue ?? '', commentMarkerName)
      if (partId !== undefined) parts.push({ partId, nodeRef: current, kind: 'anchor' })
    }
    for (const child of Array.from(current.childNodes)) visit(child)
  }
  for (const root of roots) {
    visit(root)
  }
  return parts
}

/** Reads one quoted part identifier from an exact comment marker. */
function parseCommentPartId(commentData: string, markerName: string): string | undefined {
  const marker = commentData.trim()
  if (!marker.startsWith(markerName)) return undefined
  const assignment = marker.slice(markerName.length).trimStart()
  if (!assignment.startsWith('=')) return undefined
  const value = assignment.slice(1).trim()
  if (value.length < 2) return undefined
  const quote = value[0]
  if (quote !== '"' && quote !== "'") return undefined
  if (value[value.length - 1] !== quote) return undefined
  return value.slice(1, -1)
}

import type { AuthoredTextValue, RichTextNode } from './rich-text-types'

/** Counts text units and treats each inline atom as one authored character. */
export function countAuthoredTextCharacters(value: AuthoredTextValue): number {
  if (typeof value === 'string') return value.length
  return countNodes(value.content)
}

/** Checks whether an authored value contains visible text or an inline atom. */
export function isAuthoredTextBlank(value: AuthoredTextValue): boolean {
  if (typeof value === 'string') return value.trim().length === 0
  return countNodes(value.content) === 0
}

/** Flattens authored rich text for names and other non-editor comparisons. */
export function authoredTextToPlainText(value: AuthoredTextValue): string {
  return typeof value === 'string' ? value : plainTextFromNodes(value.content)
}

/** Counts text, breaks, and inline atoms while walking structured text nodes. */
function countNodes(nodes: readonly RichTextNode[]): number {
  return nodes.reduce((count, node) => {
    if (node.type === 'text') return count + (node.text?.length ?? 0)
    if (node.type === 'hardBreak') return count + 1
    if (node.content !== undefined) return count + countNodes(node.content)
    if (node.type === 'doc' || node.type === 'paragraph' || node.type === 'heading') return count
    return count + 1
  }, 0)
}

/** Reads visible text and fallback labels without interpreting feature behavior. */
function plainTextFromNodes(nodes: readonly RichTextNode[]): string {
  return nodes.map((node, index) => {
    const prior = nodes[index - 1]
    const separator = index > 0 && isBlockNode(node) && prior !== undefined && isBlockNode(prior) ? '\n' : ''
    return separator + plainTextFromNode(node)
  }).join('')
}

/** Flattens one text node or keeps its saved fallback for non-text atoms. */
function plainTextFromNode(node: RichTextNode): string {
  switch (node.type) {
    case 'text': return node.text ?? ''
    case 'hardBreak': return '\n'
    case 'pageLinkLabel': return String(node.attrs?.resolvedLabel ?? node.attrs?.label ?? node.attrs?.fallbackLabel ?? '')
    case 'profileLabel': return String(node.attrs?.label ?? node.attrs?.fallbackLabel ?? node.attrs?.profilePropertyId ?? '')
    case 'localDateLabel': return String(node.attrs?.label ?? node.attrs?.fallbackLabel ?? 'Date locale')
    default: return node.content === undefined ? '' : plainTextFromNodes(node.content)
  }
}

/** Identifies rich text blocks whose boundary should remain visible when flattened. */
function isBlockNode(node: RichTextNode): boolean {
  return node.type === 'paragraph' || node.type === 'heading'
}

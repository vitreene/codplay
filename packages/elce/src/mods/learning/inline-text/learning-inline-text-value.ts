import type { ElceTextValue, RichTextDocument, RichTextNode } from '../../../resources/document/rich-text-types'

export type PageLinkPresentation = 'text' | 'button'
export type LocalDateLabelKind = 'today' | 'time' | 'relative'

export interface PageLinkLabelAttributes {
  readonly pageId: string
  readonly label: string | null
  readonly fallbackLabel: string
  readonly presentation: PageLinkPresentation
}

export interface LocalDateLabelAttributes {
  readonly kind: LocalDateLabelKind
  readonly offsetDays: number
}

export interface InlineTextSelection {
  readonly from: number
  readonly to: number
  readonly mark?: 'bold' | 'italic'
}

const TOKEN_PATTERN = /\{\{profile:([^{}]+)\}\}|\{\{page-link:([^{}]+)\}\}|\{\{local-date:(today|time|relative:-?\d+)\}\}/g

/** Promotes legacy profile tokens and temporary insertions to one Tiptap document. */
export function parseInlineTextTokens(
  value: string,
  options: Readonly<{ allowPageLinks?: boolean }> = {},
): RichTextDocument | null {
  const content: RichTextNode[] = []
  let cursor = 0
  let recognizedToken = false

  for (const match of value.matchAll(TOKEN_PATTERN)) {
    const index = match.index
    if (index === undefined) continue
    appendPlainText(content, value.slice(cursor, index))
    const profilePropertyId = match[1]
    const pagePayload = match[2]
    const dateToken = match[3]
    if (profilePropertyId !== undefined) {
      content.push({ type: 'profileLabel', attrs: { profilePropertyId } })
      recognizedToken = true
    } else if (pagePayload !== undefined) {
      const pageAttributes = options.allowPageLinks === false ? null : decodePageLinkToken(pagePayload)
      if (pageAttributes === null) {
        appendPlainText(content, match[0])
      } else {
        content.push({ type: 'pageLinkLabel', attrs: { ...pageAttributes } })
        recognizedToken = true
      }
    } else if (dateToken !== undefined) {
      content.push({ type: 'localDateLabel', attrs: { ...dateAttributesFromToken(dateToken) } })
      recognizedToken = true
    }
    cursor = index + match[0].length
  }

  if (!recognizedToken) return null
  appendPlainText(content, value.slice(cursor))
  return { type: 'doc', content: [{ type: 'paragraph', content }] }
}

/** Converts native text, including line breaks, into the compact Tiptap shape. */
export function createRichTextDocumentFromPlainText(value: string): RichTextDocument {
  const content: RichTextNode[] = []
  appendPlainText(content, value)
  return { type: 'doc', content: [{ type: 'paragraph', ...(content.length === 0 ? {} : { content }) }] }
}

/** Encodes one page link as a transient token inserted into a native field. */
export function createPageLinkToken(attributes: PageLinkLabelAttributes): string {
  return `{{page-link:${encodeURIComponent(JSON.stringify(attributes))}}}`
}

/** Encodes one local date reference as a transient token inserted into a native field. */
export function createLocalDateToken(attributes: LocalDateLabelAttributes): string {
  const value = attributes.kind === 'relative'
    ? `relative:${Math.trunc(attributes.offsetDays)}`
    : attributes.kind
  return `{{local-date:${value}}}`
}

/** Returns a display-safe text approximation for a rich authored value. */
export function plainTextFromValue(value: ElceTextValue): string {
  if (typeof value === 'string') return value
  return plainTextFromNodes(value.content)
}

/** Counts visible author characters and one unit for each inline label atom. */
export function countRichTextCharacters(document: RichTextDocument): number {
  return countRichTextNodes(document.content)
}

/** Counts a plain field by code units and rich atoms as single units. */
export function countTextValueCharacters(value: ElceTextValue): number {
  return typeof value === 'string' ? value.length : countRichTextCharacters(value)
}

/** Narrows persisted unknown data to the supported Tiptap document shape. */
export function isRichTextDocument(value: unknown): value is RichTextDocument {
  return typeof value === 'object' && value !== null
    && 'type' in value && value.type === 'doc'
    && 'content' in value && Array.isArray(value.content)
}

/** Appends plain text and hard breaks without creating empty text nodes. */
function appendPlainText(target: RichTextNode[], value: string): void {
  if (value.length === 0) return
  const lines = value.split('\n')
  lines.forEach((line, index) => {
    if (line.length > 0) target.push({ type: 'text', text: line })
    if (index < lines.length - 1) target.push({ type: 'hardBreak' })
  })
}

/** Decodes one transient page-link payload without accepting malformed JSON. */
function decodePageLinkToken(payload: string): PageLinkLabelAttributes | null {
  try {
    const value: unknown = JSON.parse(decodeURIComponent(payload))
    if (typeof value !== 'object' || value === null) return null
    const attributes = value as Record<string, unknown>
    if (typeof attributes.pageId !== 'string'
      || typeof attributes.fallbackLabel !== 'string'
      || attributes.label !== null && typeof attributes.label !== 'string'
      || attributes.presentation !== 'text' && attributes.presentation !== 'button') return null
    return {
      pageId: attributes.pageId,
      label: attributes.label,
      fallbackLabel: attributes.fallbackLabel,
      presentation: attributes.presentation,
    }
  } catch {
    return null
  }
}

/** Converts a date token's compact suffix into explicit node attributes. */
function dateAttributesFromToken(value: string): LocalDateLabelAttributes {
  if (value === 'today') return { kind: 'today', offsetDays: 0 }
  if (value === 'time') return { kind: 'time', offsetDays: 0 }
  return { kind: 'relative', offsetDays: Number(value.slice('relative:'.length)) }
}

/** Flattens Tiptap nodes to a readable author-facing value. */
function plainTextFromNodes(nodes: readonly RichTextNode[]): string {
  return nodes.map((node, index) => {
    const previousNode = nodes[index - 1]
    const blockSeparator = index > 0 && isBlockTextNode(node) && previousNode !== undefined && isBlockTextNode(previousNode)
      ? '\n'
      : ''
    return blockSeparator + plainTextFromNode(node)
  }).join('')
}

/** Flattens one Tiptap node while retaining inline label identities. */
function plainTextFromNode(node: RichTextNode): string {
  switch (node.type) {
    case 'text':
      return node.text ?? ''
    case 'hardBreak':
      return '\n'
    case 'profileLabel':
      return `{{profile:${String(node.attrs?.profilePropertyId ?? '')}}}`
    case 'pageLinkLabel':
      return String(node.attrs?.resolvedLabel ?? node.attrs?.label ?? node.attrs?.fallbackLabel ?? '')
    case 'localDateLabel':
      return localDateAuthorLabel(node.attrs)
    default:
      return node.content === undefined ? '' : plainTextFromNodes(node.content)
  }
}

/** Counts text code units and treats each inline label as one character. */
function countRichTextNodes(nodes: readonly RichTextNode[]): number {
  return nodes.reduce((count, node, index) => {
    const previousNode = nodes[index - 1]
    const blockSeparator = index > 0 && isBlockTextNode(node) && previousNode !== undefined && isBlockTextNode(previousNode)
      ? 1
      : 0
    switch (node.type) {
      case 'text':
        return count + blockSeparator + (node.text?.length ?? 0)
      case 'profileLabel':
      case 'pageLinkLabel':
      case 'localDateLabel':
      case 'hardBreak':
        return count + blockSeparator + 1
      default:
        return count + blockSeparator + countRichTextNodes(node.content ?? [])
    }
  }, 0)
}

/** Identifies block nodes whose adjacent values create a visible line break. */
function isBlockTextNode(node: RichTextNode): boolean {
  return node.type === 'paragraph' || node.type === 'heading'
}

/** Returns the concise label shown for one date atom in the editor. */
function localDateAuthorLabel(attributes: Readonly<Record<string, string | number | boolean | null>> | undefined): string {
  const kind = attributes?.kind
  if (kind === 'today') return 'Date du jour'
  if (kind === 'time') return 'Heure locale'
  const offset = typeof attributes?.offsetDays === 'number' ? attributes.offsetDays : 0
  if (offset === 0) return 'Date relative'
  return offset > 0 ? `Dans ${offset} j` : `Il y a ${Math.abs(offset)} j`
}

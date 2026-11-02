import type { PersoDoc } from 'codplay/scene/types'
import { ELCE_EVENTS } from '../../config/document-config'
import type { RichTextDocument, RichTextNode } from '../../domain/document/document-types'

export interface InlineTextSceneParts {
  readonly markup: string
  readonly persos: readonly PersoDoc<string>[]
}

type InlineSegment =
  | Readonly<{ kind: 'text'; html: string }>
  | Readonly<{ kind: 'link'; pageId: string; label: string; presentation: 'text' | 'button'; marks: readonly string[] }>

/** Creates ordered CodPlay markers and safe inline persos for a promoted text value. */
export function createInlineTextSceneParts(
  document: RichTextDocument,
  idPrefix: string,
): InlineTextSceneParts {
  const segments = inlineSegments(document.content)
  const markers = segments.map((_segment, index) => `<!-- data-part="${escapeAttribute(`${idPrefix}:${index}`)}" -->`).join('')
  const persos = segments.flatMap((segment, index) => {
    const id = `${idPrefix}-segment-${index}`
    const move = { target: `${idPrefix}:${index}` }
    if (segment.kind === 'text') {
      return segment.html.length === 0 ? [] : [{
        id,
        type: 'text',
        initial: { tag: 'span', content: segment.html, move },
      } satisfies PersoDoc<string>]
    }
    if (segment.pageId.length === 0) return []
    const isTextLink = segment.presentation === 'text'
    return [{
      id,
      type: 'tag',
      initial: {
        tag: isTextLink ? 'a' : 'button',
        content: segment.label,
        attr: isTextLink
          ? { href: '#', 'aria-label': segment.label, 'data-page-id': segment.pageId }
          : { type: 'button', 'aria-label': segment.label, 'data-page-id': segment.pageId },
        className: [
          'elce-inline-link',
          `elce-inline-link--${segment.presentation}`,
          ...(segment.marks.includes('bold') ? ['elce-inline-link--bold'] : []),
          ...(segment.marks.includes('italic') ? ['elce-inline-link--italic'] : []),
        ].join(' '),
        move,
      },
      emit: {
        click: {
          ...(isTextLink ? { preventDefault: true } : {}),
          event: { name: `${ELCE_EVENTS.PAGE_LINK_PREFIX}${segment.pageId}`, visibility: 'public' },
        },
      },
    } satisfies PersoDoc<string>]
  })
  return { markup: markers, persos }
}

/** Wraps ordered segment markers in a semantic authored-content element. */
export function wrapInlineTextSceneParts(
  parts: InlineTextSceneParts,
  id: string,
  tag: string,
  className?: string,
): string {
  const classAttribute = className === undefined ? '' : ` class="${escapeAttribute(className)}"`
  return `<${tag} id="${escapeAttribute(id)}"${classAttribute}>${parts.markup}</${tag}>`
}

/** Encodes supported marks and stable page links as ordered player segments. */
function inlineSegments(nodes: readonly RichTextNode[]): readonly InlineSegment[] {
  const output: InlineSegment[] = []
  let hasBlock = false
  for (const node of nodes) {
    if (node.type === 'paragraph' || node.type === 'heading') {
      if (hasBlock) appendText(output, '<br>', [])
      output.push(...inlineSegments(node.content ?? []))
      hasBlock = true
      continue
    }
    if (node.type === 'pageLinkLabel') {
      const available = node.attrs?.targetAvailable === true
      const fallback = String(node.attrs?.fallbackLabel ?? '')
      const label = String(node.attrs?.resolvedLabel ?? node.attrs?.label ?? fallback)
      if (!available) {
        appendText(output, escapeHtml(label), [])
        continue
      }
      output.push({
        kind: 'link',
        pageId: String(node.attrs?.pageId ?? ''),
        label,
        presentation: node.attrs?.presentation === 'button' ? 'button' : 'text',
        marks: (node.marks ?? []).map((mark) => mark.type),
      })
      continue
    }
    if (node.type === 'text') {
      appendText(output, escapeHtml(node.text ?? ''), (node.marks ?? []).map((mark) => mark.type))
      continue
    }
    if (node.type === 'hardBreak') {
      appendText(output, '<br>', [])
      continue
    }
    if (node.content !== undefined) {
      output.push(...inlineSegments(node.content))
    }
  }
  return output
}

/** Coalesces adjacent text with the same permitted inline marks. */
function appendText(target: InlineSegment[], escapedText: string, marks: readonly string[]): void {
  if (escapedText.length === 0) return
  const supportedMarks = marks.filter((mark) => mark === 'bold' || mark === 'italic')
  target.push({ kind: 'text', html: textMarkup(escapedText, supportedMarks) })
}

/** Wraps escaped text in only the bold and italic marks supported by Elcé. */
function textMarkup(escapedText: string, marks: readonly string[]): string {
  return `${marks.includes('bold') ? '<strong>' : ''}${marks.includes('italic') ? '<em>' : ''}${escapedText}${closingMarkup(marks)}`
}

/** Closes supported mark wrappers in reverse nesting order. */
function closingMarkup(marks: readonly string[]): string {
  return `${marks.includes('italic') ? '</em>' : ''}${marks.includes('bold') ? '</strong>' : ''}`
}

/** Escapes authored values before placing them in generated HTML or attributes. */
function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

/** Escapes generated identity values used as HTML attributes. */
function escapeAttribute(value: string): string {
  return escapeHtml(value)
}

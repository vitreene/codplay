import type { PersoDoc } from 'codplay/scene/types'
import { ELCE_EVENTS } from '../reading/learning-reading-events'
import type { RichTextDocument, RichTextNode } from '../../../core/document/rich-text-types'
import {
  wrapResourceInlineTextSceneParts,
  type ResourceInlineTextSceneFeature,
  type ResourceSectionInlineLinkProjection,
} from '../../../resources/document/resource-inline-text-feature'

export interface InlineTextSceneParts {
  readonly markup: string
  readonly persos: readonly PersoDoc<string>[]
}

/** Creates the Learning renderer supplied to generic resource scene builders. */
export function createLearningInlineTextSceneFeature(): ResourceInlineTextSceneFeature {
  return {
    build: createInlineTextSceneParts,
    projectSectionLinks: createSectionPageLinkProjection,
  }
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
  return wrapResourceInlineTextSceneParts(parts, id, tag, className)
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

/** Replaces static Section link labels with the exact slots used by their interactive persos. */
function createSectionPageLinkProjection(
  markup: string,
  nodes: readonly RichTextNode[],
  bdcId: string,
): ResourceSectionInlineLinkProjection {
  const links = collectSectionPageLinkNodes(nodes)
  const persos: PersoDoc<string>[] = []
  let linkIndex = 0
  const projectedMarkup = markup.replace(
    /<span\b(?=[^>]*\bdata-elce-page-id\s*=)[^>]*>[\s\S]*?<\/span>/gi,
    (span) => {
      const index = linkIndex
      linkIndex += 1
      const node = links[index]
      if (node === undefined || node.attrs?.targetAvailable !== true) return markupSpanContent(span)
      const pageId = String(node.attrs.pageId ?? '')
      const label = String(node.attrs.resolvedLabel ?? node.attrs.fallbackLabel ?? pageId)
      const presentation = node.attrs.presentation === 'button' ? 'button' : 'text'
      const isTextLink = presentation === 'text'
      const marks = (node.marks ?? []).map((mark) => mark.type)
        .filter((mark) => mark === 'bold' || mark === 'italic')
        .map((mark) => `elce-inline-link--${mark}`)
      const target = `${bdcId}:inline-link:${index}:link`
      persos.push({
        id: `${bdcId}-inline-link-${index}`,
        type: 'tag',
        initial: {
          tag: isTextLink ? 'a' : 'button',
          content: label,
          attr: isTextLink ? { href: '#', 'aria-label': label, 'data-page-id': pageId } : { type: 'button', 'aria-label': label, 'data-page-id': pageId },
          className: ['elce-inline-link', `elce-inline-link--${presentation}`, ...marks].join(' '),
          move: { target },
        },
        emit: {
          click: {
            ...(isTextLink ? { preventDefault: true } : {}),
            event: { name: `${ELCE_EVENTS.PAGE_LINK_PREFIX}${pageId}`, visibility: 'public' },
          },
        },
      } satisfies PersoDoc<string>)
      return `<!-- data-part="${escapeAttribute(target)}" -->`
    },
  )
  return { markup: projectedMarkup, persos }
}

/** Recursively collects page-link nodes nested in Section blocks. */
function collectSectionPageLinkNodes(nodes: readonly RichTextNode[]): readonly RichTextNode[] {
  return nodes.flatMap((node) => [
    ...(node.type === 'pageLinkLabel' ? [node] : []),
    ...(node.content === undefined ? [] : collectSectionPageLinkNodes(node.content)),
  ])
}

/** Keeps the authored label visible without preserving its editor-only wrapper. */
function markupSpanContent(span: string): string {
  const openingEnd = span.indexOf('>')
  const closingStart = span.lastIndexOf('</span>')
  if (openingEnd < 0 || closingStart < openingEnd) return span
  return span.slice(openingEnd + 1, closingStart)
}

/** Escapes authored values before placing them in generated HTML or attributes. */
function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

/** Escapes generated identity values used as HTML attributes. */
function escapeAttribute(value: string): string {
  return escapeHtml(value)
}

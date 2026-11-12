import type { PersoDoc } from 'codplay/scene/types'
import type { RichTextDocument, RichTextNode } from '../../../core/document/rich-text-types'
import type {
  ResourceInlineTextSceneFeature,
  ResourceInlineTextSceneParts,
} from '../../../resources/document/resource-inline-text-feature'

type InlineTextSegment = Readonly<{ html: string }>

/** Renders authored rich text without adding Learning page links or Section anchors. */
export function createQuizHuntInlineTextSceneFeature(): ResourceInlineTextSceneFeature {
  return {
    build: buildInlineTextParts,
    projectSectionLinks: (markup) => ({ markup, persos: [] }),
  }
}

/** Creates CodPlay text persos from a rich-text document and stable part markers. */
function buildInlineTextParts(document: RichTextDocument, idPrefix: string): ResourceInlineTextSceneParts {
  const segments = inlineTextSegments(document.content)
  const markup = segments.map((_segment, index) => `<!-- data-part="${escapeAttribute(`${idPrefix}:${index}`)}" -->`).join('')
  const persos = segments.map((segment, index) => ({
    id: `${idPrefix}-segment-${index}`,
    type: 'text',
    initial: {
      tag: 'span',
      content: segment.html,
      move: { target: `${idPrefix}:${index}` },
    },
  } satisfies PersoDoc<string>))
  return { markup, persos }
}

/** Flattens rich-text blocks while retaining visible breaks and supported emphasis. */
function inlineTextSegments(nodes: readonly RichTextNode[]): readonly InlineTextSegment[] {
  const segments: InlineTextSegment[] = []
  let previousWasBlock = false
  for (const node of nodes) {
    const isBlock = node.type === 'paragraph' || node.type === 'heading'
    if (isBlock && previousWasBlock) appendMarkup(segments, '<br>')
    if (node.type === 'text') {
      const escapedText = escapeHtml(node.text ?? '')
      const marks = (node.marks ?? []).map((mark) => mark.type)
      appendMarkup(segments, `${marks.includes('bold') ? '<strong>' : ''}${marks.includes('italic') ? '<em>' : ''}${escapedText}${marks.includes('italic') ? '</em>' : ''}${marks.includes('bold') ? '</strong>' : ''}`)
    } else if (node.type === 'hardBreak') {
      appendMarkup(segments, '<br>')
    } else if (node.type === 'pageLinkLabel') {
      appendMarkup(segments, escapeHtml(String(node.attrs?.resolvedLabel ?? node.attrs?.label ?? node.attrs?.fallbackLabel ?? '')))
    } else if (node.type === 'profileLabel') {
      appendMarkup(segments, escapeHtml(String(node.attrs?.label ?? node.attrs?.fallbackLabel ?? node.attrs?.profilePropertyId ?? '')))
    } else if (node.type === 'localDateLabel') {
      appendMarkup(segments, escapeHtml(String(node.attrs?.label ?? node.attrs?.fallbackLabel ?? 'Date locale')))
    } else if (node.content !== undefined) {
      segments.push(...inlineTextSegments(node.content))
    }
    previousWasBlock = isBlock
  }
  return segments
}

/** Adds one non-empty markup segment to the ordered insertion sequence. */
function appendMarkup(segments: InlineTextSegment[], html: string): void {
  if (html.length > 0) segments.push({ html })
}

/** Escapes authored text before placing it in generated player markup. */
function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

/** Escapes authored ids before embedding them in generated comment targets. */
function escapeAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

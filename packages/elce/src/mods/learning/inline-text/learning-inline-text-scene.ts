import type { AuthorStrapCollection, PersoDoc, SceneListenRule } from 'codplay/scene/types'
import { ELCE_EVENTS } from '../reading/learning-reading-events'
import type { RichTextDocument, RichTextNode } from '../../../core/document/rich-text-types'
import type { ResourceBdc } from '../../../resources/document/resource-document-types'
import { ListSceneBuilder } from '../../../resources/list/reading/list-scene-builder'
import type { ListContent } from '../../../resources/list/domain/list-types'
import {
  wrapResourceInlineTextSceneParts,
  type ResourceInlineTextSceneBuildOptions,
  type ResourceInlineTextSceneFeature,
  type ResourceInlineTextSceneParts,
  type ResourceSectionInlineLinkProjectionOptions,
  type ResourceSectionInlineLinkProjection,
} from '../../../resources/document/resource-inline-text-feature'

export interface InlineTextSceneParts extends ResourceInlineTextSceneParts {}

const listSceneBuilder: ListSceneBuilder = new ListSceneBuilder()

/** Creates the Learning renderer supplied to generic resource scene builders. */
export function createLearningInlineTextSceneFeature(bdcs: readonly ResourceBdc[] = []): ResourceInlineTextSceneFeature {
  const listById = new Map(bdcs.flatMap((bdc) => bdc.type === 'list' && bdc.list != null ? [[bdc.id, bdc.list] as const] : []))
  return {
    build: (document, idPrefix, options) => createInlineTextSceneParts(document, idPrefix, options, listById),
    projectSectionLinks: (markup, nodes, bdcId, options) => createSectionPageLinkProjection(markup, nodes, bdcId, listById, options),
  }
}

type InlineSegment =
  | Readonly<{ kind: 'text'; html: string }>
  | Readonly<{ kind: 'link'; pageId: string; label: string; presentation: 'text' | 'button'; marks: readonly string[] }>
  | Readonly<{ kind: 'list'; bdcId: string }>

/** Creates ordered CodPlay markers and safe inline persos for a promoted text value. */
export function createInlineTextSceneParts(
  document: RichTextDocument,
  idPrefix: string,
  options?: ResourceInlineTextSceneBuildOptions,
  listById: ReadonlyMap<string, ListContent> = new Map(),
): InlineTextSceneParts {
  const segments = inlineSegments(document.content)
  const listBuilds = segments.flatMap((segment, index) => {
    if (segment.kind !== 'list') return []
    const list = listById.get(segment.bdcId)
    if (list === undefined) throw new Error(`La Liste ${segment.bdcId} du champ riche est introuvable.`)
    return [{ index, build: listSceneBuilder.build({
      list,
      idPrefix: `${idPrefix}-list-${segment.bdcId}`,
      partId: `${idPrefix}:${index}`,
      ...options,
    }) }]
  })
  const markers = segments.map((segment, index) => segment.kind === 'list'
    ? listBuilds.find((entry) => entry.index === index)?.build.markup ?? ''
    : `<!-- data-part="${escapeAttribute(`${idPrefix}:${index}`)}" -->`).join('')
  const persos = segments.flatMap((segment, index) => {
    const id = `${idPrefix}-segment-${index}`
    const move = { target: `${idPrefix}:${index}` }
    if (segment.kind === 'list') return []
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
  return {
    markup: markers,
    persos: [...persos, ...listBuilds.flatMap((entry) => entry.build.persos)],
    ...(listBuilds.length > 0 ? { hasBlockContent: true } : {}),
    straps: Object.assign({}, ...listBuilds.map((entry) => entry.build.straps)),
    listen: listBuilds.flatMap((entry) => entry.build.listen),
    revealEventimes: listBuilds.flatMap((entry) => entry.build.revealEventimes),
  }
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
      if (hasBlock && output.at(-1)?.kind !== 'list') appendText(output, '<br>', [])
      output.push(...inlineSegments(node.content ?? []))
      hasBlock = true
      continue
    }
    if (node.type === 'listBdc') {
      output.push({ kind: 'list', bdcId: String(node.attrs?.bdcId ?? '') })
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
  listById: ReadonlyMap<string, ListContent>,
  options?: ResourceSectionInlineLinkProjectionOptions,
): ResourceSectionInlineLinkProjection {
  const links = collectSectionPageLinkNodes(nodes)
  const persos: PersoDoc<string>[] = []
  const listPersos: PersoDoc<string>[] = []
  const listStraps: AuthorStrapCollection = {}
  const listListen: SceneListenRule[] = []
  let linkIndex = 0
  const projectedLinkMarkup = markup.replace(
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
  const projectedMarkup = projectedLinkMarkup.replace(
    /<div\b(?=[^>]*\bdata-elce-list-bdc\b)[^>]*>[\s\S]*?<\/div>/gi,
    (placeholder) => {
      const listBdcId = /\bbdcid\s*=\s*(["'])(.*?)\1/i.exec(placeholder)?.[2]
      if (listBdcId === undefined) return ''
      const list = listById.get(listBdcId)
      if (list === undefined) throw new Error(`La Liste ${listBdcId} du contenu de Section ${bdcId} est introuvable.`)
      const partId = `${bdcId}:section:list:${listBdcId}`
      const observerMountPartId = `${partId}:observer-mount`
      const entryEventName = `${partId}:enter`
      const exitEventName = `${partId}:leave`
      const build = listSceneBuilder.build({
        list,
        idPrefix: partId,
        partId,
        ...(options === undefined ? {} : { entryEventName, exitEventName }),
      })
      listPersos.push(...build.persos)
      Object.assign(listStraps, build.straps)
      listListen.push(...build.listen)
      if (options === undefined) return build.markup
      listPersos.push({
        id: `${partId}-observer`,
        type: 'layout',
        initial: {
          move: { target: observerMountPartId },
          markup: `<div id="${partId}-observer-root">${build.markup}</div>`,
        },
        emit: {
          observe: {
            root: options.scrollPortId,
            initial: 'enter',
            zone: options.observationZone,
            enter: [{ name: entryEventName }],
            leave: [{ name: exitEventName }],
          },
        },
      })
      return `<!-- data-part="${observerMountPartId}" -->`
    },
  )
  return {
    markup: projectedMarkup,
    persos,
    listPersos,
    listStraps,
    listListen,
  }
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

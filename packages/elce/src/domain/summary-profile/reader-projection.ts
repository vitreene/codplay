import { BDC_TYPE, SCENARIO_ENTRY_KIND } from '../../config/document-config'
import { ElceDocument } from '../document/document-model'
import type { Bdc, ElceTextValue, Page, RichTextNode } from '../document/document-types'
import type { ScenarioEntry } from '../scenario/scenario-entry-types'
import type { ProfileValue } from './summary-profile-types'
import { bdcMatchesProfile } from './profile-rules'
import { plainTextFromValue } from '../inline-text/inline-text-value'

/** Builds the immutable document projection consumed by the Elcé reader. */
export function projectReaderDocument(
  document: ElceDocument,
  profileValues: Readonly<Record<string, ProfileValue>>,
  profileEnabled: boolean,
): ElceDocument {
  const projectionInstant = new Date()
  const scenarioPageIds = new Set(document.scenarioPageIds)
  const pageTitles = new Map(document.pages.map((page) => {
    const value = typeof page.name === 'string'
      ? resolveProfileText(page.name, profileValues)
      : {
        ...page.name,
        content: projectRichTextNodes(page.name.content, new Set(), profileValues, projectionInstant),
      }
    return [page.id, plainTextFromValue(value)] as const
  }))
  const scenarioBdcIds = new Set(document.bdcs
    .filter((bdc) => {
      const pageId = rootPageId(document, bdc)
      return pageId !== null && scenarioPageIds.has(pageId)
    })
    .map((bdc) => bdc.id))
  const retainedBdcIds = new Set<string>()
  const projectedById = new Map<string, Bdc>()

  /** Projects one visible scenario BDC and its only authored child shapes. */
  const projectBdc = (bdcId: string): Bdc | undefined => {
    const bdc = document.bdcs.find((candidate) => candidate.id === bdcId)
    if (bdc === undefined || profileEnabled && !bdcMatchesProfile(document, bdcId, profileValues)) return undefined
    switch (bdc.type) {
      case BDC_TYPE.CAROUSEL: {
        const carousel = bdc.carousel
        if (carousel == null) return undefined
        const cards = carousel.cards.flatMap((entry) => {
          const child = projectBdc(entry.bdcId)
          return child === undefined ? [] : [{ ...entry, bdcId: child.id }]
        })
        if (cards.length === 0) return undefined
        const projected: Bdc = { ...bdc, carousel: { ...carousel, cards } }
        projectedById.set(bdcId, projected)
        retainedBdcIds.add(bdcId)
        return projected
      }
      case BDC_TYPE.SECTION: {
        const anchors = new Set<string>(collectAnchorIds(bdc.section?.content.content ?? []))
        const retainedAnchors = new Set<string>()
        for (const anchorId of anchors) {
          if (projectBdc(anchorId) !== undefined) retainedAnchors.add(anchorId)
        }
        const section = bdc.section === null ? null : {
          ...bdc.section,
          title: resolveTextValue(bdc.section.title, profileValues, projectionInstant, pageTitles, scenarioPageIds),
          content: {
            ...bdc.section.content,
            content: projectRichTextNodes(bdc.section.content.content, retainedAnchors, profileValues, projectionInstant, pageTitles, scenarioPageIds),
          },
          markup: projectAnchorMarkup(
            resolvePageLinkMarkup(
              resolveLocalDateMarkup(
                resolveProfileMarkup(resolveProfileTokens(bdc.section.markup, profileValues), profileValues),
                projectionInstant,
              ),
              bdc.id,
              pageTitles,
              scenarioPageIds,
            ),
            retainedAnchors,
          ),
        }
        const projected = { ...bdc, section }
        projectedById.set(bdcId, projected)
        retainedBdcIds.add(bdcId)
        return projected
      }
      default:
        retainedBdcIds.add(bdcId)
        projectedById.set(bdcId, resolveBdcText(bdc, profileValues, projectionInstant, pageTitles, scenarioPageIds))
        return projectedById.get(bdcId)
    }
  }

  const retainedPages = new Map<string, Page>()
  for (const pageId of scenarioPageIds) {
    const page = document.pages.find((candidate) => candidate.id === pageId)
    if (page === undefined) continue
    const bdcIds = page.bdcIds.flatMap((bdcId) => projectBdc(bdcId)?.id ?? [])
    if (bdcIds.length > 0) retainedPages.set(page.id, {
      ...page,
      name: resolveTextValue(page.name, profileValues, projectionInstant, pageTitles, scenarioPageIds),
      bdcIds,
    })
  }

  const chapters = document.chapters.flatMap((chapter) => {
    const pageIds = chapter.pageIds.filter((pageId) => retainedPages.has(pageId))
    return pageIds.length === 0 ? [] : [{
      ...chapter,
      name: resolveTextValue(chapter.name, profileValues, projectionInstant, pageTitles, scenarioPageIds),
      pageIds,
    }]
  })
  const retainedChapterIds = new Set(chapters.map((chapter) => chapter.id))
  const scenarioEntries: ScenarioEntry[] = []
  for (const entry of document.data.scenarioEntries) {
    switch (entry.kind) {
      case SCENARIO_ENTRY_KIND.PAGE:
        if (retainedPages.has(entry.pageId)) scenarioEntries.push(entry)
        break
      case SCENARIO_ENTRY_KIND.CHAPTER:
        if (retainedChapterIds.has(entry.chapterId)) scenarioEntries.push(entry)
        break
    }
  }
  if (profileEnabled) assertReadingTargetsRetained(document, retainedChapterIds)

  const pages = document.pages.flatMap((page) => {
    if (document.data.catalogPageIds.includes(page.id)) return [page]
    const projected = retainedPages.get(page.id)
    return projected === undefined ? [] : [projected]
  })
  const bdcs = document.bdcs.flatMap((bdc) => {
    if (!scenarioBdcIds.has(bdc.id)) return [bdc]
    if (!retainedBdcIds.has(bdc.id)) return []
    return [projectedById.get(bdc.id) ?? bdc]
  })
  const constraints = document.data.profile.constraints.filter((constraint) => {
    switch (constraint.target.kind) {
      case 'chapter': return retainedChapterIds.has(constraint.target.id)
      case 'page': return retainedPages.has(constraint.target.id)
      case 'bdc': return retainedBdcIds.has(constraint.target.id)
    }
  })
  const readingConstraints = document.data.profile.readingConstraints.filter((constraint) => retainedChapterIds.has(constraint.target.id))

  return new ElceDocument({
    ...document.data,
    summary: {
      ...document.data.summary,
      title: resolveTextValue(document.data.summary.title, profileValues, projectionInstant, pageTitles, scenarioPageIds),
      description: resolveTextValue(document.data.summary.description, profileValues, projectionInstant, pageTitles, scenarioPageIds),
    },
    chapters,
    pages,
    scenarioEntries,
    bdcs,
    profile: { ...document.data.profile, constraints, readingConstraints },
  })
}

/** Fails when a retained chapter requires an explicit chapter removed by profiling. */
function assertReadingTargetsRetained(
  document: ElceDocument,
  retainedChapterIds: ReadonlySet<string>,
): void {
  for (const constraint of document.data.profile.readingConstraints) {
    if (retainedChapterIds.has(constraint.target.id)
      && constraint.requirement.kind === 'chapters') {
      const excludedChapterId = constraint.requirement.chapterIds.find((chapterId) => !retainedChapterIds.has(chapterId))
      if (excludedChapterId !== undefined) {
        throw new Error(`Le prérequis du chapitre ${constraint.target.id} vise un chapitre exclu : ${excludedChapterId}`)
      }
    }
  }
}

/** Resolves profile references in every authored text field without changing IDs. */
function resolveBdcText(
  bdc: Bdc,
  values: Readonly<Record<string, ProfileValue>>,
  instant: Date,
  pageTitles: ReadonlyMap<string, string>,
  scenarioPageIds: ReadonlySet<string>,
): Bdc {
  const question = bdc.question
  const card = bdc.card
  const graph = bdc.statisticalGraph
  const result = bdc.evaluationResult
  return {
    ...bdc,
    ...(question == null ? {} : { question: {
      ...question,
      title: resolveTextValue(question.title, values, instant, pageTitles, scenarioPageIds),
      prompt: resolveTextValue(question.prompt, values, instant, pageTitles, scenarioPageIds),
      ...(question.validationLabel === undefined ? {} : { validationLabel: resolveTextValue(question.validationLabel, values, instant, pageTitles, scenarioPageIds) }),
      answers: question.answers.map((answer) => ({ ...answer, label: resolveTextValue(answer.label, values, instant, pageTitles, scenarioPageIds) })),
    } }),
    ...(card == null ? {} : { card: {
      ...card,
      overline: resolveTextValue(card.overline, values, instant, pageTitles, scenarioPageIds),
      title: resolveTextValue(card.title, values, instant, pageTitles, scenarioPageIds),
      description: resolveTextValue(card.description, values, instant, pageTitles, scenarioPageIds),
      message: resolveTextValue(card.message, values, instant, pageTitles, scenarioPageIds),
      note: resolveTextValue(card.note, values, instant, pageTitles, scenarioPageIds),
      caption: resolveTextValue(card.caption, values, instant, pageTitles, scenarioPageIds),
    } }),
    ...(graph == null ? {} : { statisticalGraph: {
      ...graph,
      overline: resolveTextValue(graph.overline, values, instant, pageTitles, scenarioPageIds),
      title: resolveTextValue(graph.title, values, instant, pageTitles, scenarioPageIds),
      categoryAxisLabel: resolveTextValue(graph.categoryAxisLabel, values, instant, pageTitles, scenarioPageIds),
      seriesAxisLabel: resolveTextValue(graph.seriesAxisLabel, values, instant, pageTitles, scenarioPageIds),
      editorialText: resolveTextValue(graph.editorialText, values, instant, pageTitles, scenarioPageIds),
      categories: graph.categories.map((item) => ({ ...item, label: resolveTextValue(item.label, values, instant, pageTitles, scenarioPageIds) })),
      series: graph.series.map((item) => ({ ...item, label: resolveTextValue(item.label, values, instant, pageTitles, scenarioPageIds) })),
    } }),
    ...(result == null ? {} : { evaluationResult: {
      success: { ...result.success, message: resolveTextValue(result.success.message, values, instant, pageTitles, scenarioPageIds) },
      failure: { ...result.failure, message: resolveTextValue(result.failure.message, values, instant, pageTitles, scenarioPageIds) },
    } }),
  }
}

/** Resolves profile and local-date atoms without mutating the source value. */
function resolveTextValue(
  value: ElceTextValue,
  values: Readonly<Record<string, ProfileValue>>,
  instant: Date,
  pageTitles: ReadonlyMap<string, string>,
  scenarioPageIds: ReadonlySet<string>,
): ElceTextValue {
  if (typeof value === 'string') return resolveProfileText(value, values)
  return {
    ...value,
    content: projectRichTextNodes(value.content, new Set(), values, instant, pageTitles, scenarioPageIds),
  }
}

/** Resolves profile tokens as plain text for downstream text-safe renderers. */
function resolveProfileText(value: string, values: Readonly<Record<string, ProfileValue>>): string {
  return value.replace(/\{\{profile:([^{}]+)\}\}/g, (_match, propertyId: string) => profileValueText(values[propertyId]))
}

/** Resolves `{{profile:property-id}}` tokens as escaped text. */
export function resolveProfileTokens(value: string, values: Readonly<Record<string, ProfileValue>>): string {
  return value.replace(/\{\{profile:([^{}]+)\}\}/g, (_match, propertyId: string) => escapeHtmlText(profileValueText(values[propertyId])))
}

/** Resolves static Tiptap label markers to escaped reader text. */
function resolveProfileMarkup(markup: string, values: Readonly<Record<string, ProfileValue>>): string {
  return markup.replace(/(<span\b[^>]*\bdata-elce-profile-property=["'])([^"']+)(["'][^>]*>)[\s\S]*?(<\/span>)/gi,
    (_match, before: string, propertyId: string, after: string, close: string) => `${before}${propertyId}${after}${escapeHtmlText(profileValueText(values[propertyId]))}${close}`)
}

/** Removes only anchor nodes whose corresponding media BDC was filtered out. */
function projectRichTextNodes(
  nodes: readonly RichTextNode[],
  retainedAnchors: ReadonlySet<string>,
  profileValues: Readonly<Record<string, ProfileValue>> = {},
  instant: Date = new Date(),
  pageTitles: ReadonlyMap<string, string> = new Map(),
  scenarioPageIds: ReadonlySet<string> = new Set(),
): readonly RichTextNode[] {
  return nodes.flatMap((node) => {
    if (node.type === 'elceAnchor' && typeof node.attrs?.bdcId === 'string' && !retainedAnchors.has(node.attrs.bdcId)) return []
    if (node.type === 'profileLabel') {
      return [{
        type: 'text',
        text: profileValueText(profileValues[String(node.attrs?.profilePropertyId ?? '')]),
        ...(node.marks === undefined ? {} : { marks: node.marks }),
      }]
    }
    if (node.type === 'localDateLabel') {
      return [{
        type: 'text',
        text: resolveLocalDateLabel(node.attrs, instant),
        ...(node.marks === undefined ? {} : { marks: node.marks }),
      }]
    }
    if (node.type === 'pageLinkLabel') {
      const pageId = String(node.attrs?.pageId ?? '')
      const pageTitle = pageTitles.get(pageId)
      const customLabel = typeof node.attrs?.label === 'string' ? node.attrs.label : null
      return [{
        ...node,
        attrs: {
          ...node.attrs,
          resolvedLabel: customLabel ?? pageTitle ?? String(node.attrs?.fallbackLabel ?? pageId),
          targetAvailable: pageTitle !== undefined && scenarioPageIds.has(pageId),
        },
      }]
    }
    return [{ ...node, ...(node.content === undefined ? {} : { content: projectRichTextNodes(node.content, retainedAnchors, profileValues, instant, pageTitles, scenarioPageIds) }) }]
  })
}

/** Replaces serialized date atoms in Section HTML with escaped local values. */
function resolveLocalDateMarkup(markup: string, instant: Date): string {
  return markup.replace(/<span\b(?=[^>]*\bdata-elce-date-kind\s*=\s*(["'])(.*?)\1)[^>]*>[\s\S]*?<\/span>/gi,
    (span, _quote: string, rawKind: string) => {
      const offset = /\bdata-elce-date-offset\s*=\s*(["'])(-?\d+)\1/i.exec(span)?.[2]
      const kind = rawKind === 'time' || rawKind === 'relative' ? rawKind : 'today'
      const text = resolveLocalDateLabel({ kind, offsetDays: Number(offset ?? 0) }, instant)
      return span.replace(/>([\s\S]*)<\/span>$/i, `>${escapeHtmlText(text)}</span>`)
    })
}

/** Replaces serialized page-link atoms with safe labels or stable CodPlay targets. */
function resolvePageLinkMarkup(
  markup: string,
  bdcId: string,
  pageTitles: ReadonlyMap<string, string>,
  scenarioPageIds: ReadonlySet<string>,
): string {
  let linkIndex = 0
  return markup.replace(/<span\b(?=[^>]*\bdata-elce-page-id\s*=\s*(["'])(.*?)\1)[^>]*>[\s\S]*?<\/span>/gi,
    (span, _quote: string, pageId: string) => {
      const currentIndex = linkIndex
      linkIndex += 1
      const fallback = textFromHtml(span.replace(/^<span\b[^>]*>/i, '').replace(/<\/span>$/i, ''))
      const customLabel = readHtmlAttribute(span, 'data-elce-page-label')
      const label = customLabel ?? pageTitles.get(pageId) ?? fallback
      if (!pageTitles.has(pageId) || !scenarioPageIds.has(pageId)) return escapeHtmlText(label)
      const partId = `${bdcId}:inline-link:${currentIndex}:link`
      return `<span id="${escapeHtmlText(partId)}-host"><!-- data-part="${escapeHtmlText(partId)}" --></span>`
    })
}

/** Reads and decodes one quoted generated HTML attribute. */
function readHtmlAttribute(markup: string, name: string): string | null {
  const match = markup.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'))
  return match?.[2] === undefined ? null : textFromHtml(match[2])
}

/** Decodes only standard text escapes used by Tiptap's generated markup. */
function textFromHtml(value: string): string {
  return value.replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&gt;', '>').replaceAll('&lt;', '<').replaceAll('&amp;', '&')
}

/** Removes matching serialized anchor spans without modifying the author document. */
function projectAnchorMarkup(markup: string, retainedAnchors: ReadonlySet<string>): string {
  return markup.replace(/<span\b(?=[^>]*\bdata-elce-anchor\s*=\s*["']true["'])[^>]*>[\s\S]*?<\/span>/gi, (anchor) => {
    const id = /\bdata-bdc-id\s*=\s*(["'])(.*?)\1/i.exec(anchor)?.[2]
    return id !== undefined && retainedAnchors.has(id) ? anchor : ''
  })
}

/** Collects stable BDC IDs from Elcé anchor nodes. */
function collectAnchorIds(nodes: readonly RichTextNode[]): string[] {
  return nodes.flatMap((node) => [
    ...(node.type === 'elceAnchor' && typeof node.attrs?.bdcId === 'string' ? [node.attrs.bdcId] : []),
    ...(node.content === undefined ? [] : collectAnchorIds(node.content)),
  ])
}

/** Finds the page root of a direct or nested BDC. */
function rootPageId(document: ElceDocument, bdc: Bdc): string | null {
  let current = bdc
  while (current.parentBdcId !== null) {
    const parent = document.bdcs.find((candidate) => candidate.id === current.parentBdcId)
    if (parent === undefined) return null
    current = parent
  }
  return current.pageId
}

/** Converts a value to text and escapes it for CodPlay's authored HTML content. */
function profileValueText(value: ProfileValue | undefined): string {
  return Array.isArray(value) ? value.join(', ') : value === undefined ? '' : String(value)
}

/** Formats one date atom from the stable instant shared by its projection. */
function resolveLocalDateLabel(
  attributes: Readonly<Record<string, string | number | boolean | null>> | undefined,
  instant: Date,
): string {
  const kind = attributes?.kind
  if (kind === 'time') return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(instant)
  const date = new Date(instant)
  if (kind === 'relative') {
    const offsetDays = typeof attributes?.offsetDays === 'number' ? Math.trunc(attributes.offsetDays) : 0
    date.setDate(date.getDate() + offsetDays)
  }
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'short' }).format(date)
}

/** Escapes user-authored profile values before they enter generated HTML. */
function escapeHtmlText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

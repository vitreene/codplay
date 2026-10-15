import { BDC_TYPE, SCENARIO_ENTRY_KIND } from '../../config/document-config'
import { ElceDocument } from '../document/document-model'
import type { Bdc, Page, RichTextNode } from '../document/document-types'
import type { ScenarioEntry } from '../scenario/scenario-entry-types'
import type { ProfileValue } from './summary-profile-types'
import { bdcMatchesProfile } from './profile-rules'

/** Builds the immutable document projection consumed by the Elcé reader. */
export function projectReaderDocument(
  document: ElceDocument,
  profileValues: Readonly<Record<string, ProfileValue>>,
  profileEnabled: boolean,
): ElceDocument {
  const scenarioPageIds = new Set(document.scenarioPageIds)
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
          title: resolveProfileTokens(bdc.section.title, profileValues),
          content: {
            ...bdc.section.content,
            content: projectRichTextNodes(bdc.section.content.content, retainedAnchors),
          },
          markup: projectAnchorMarkup(
            resolveProfileMarkup(resolveProfileTokens(bdc.section.markup, profileValues), profileValues),
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
        projectedById.set(bdcId, resolveBdcText(bdc, profileValues))
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
      name: resolveProfileTokens(page.name, profileValues),
      bdcIds,
    })
  }

  const chapters = document.chapters.flatMap((chapter) => {
    const pageIds = chapter.pageIds.filter((pageId) => retainedPages.has(pageId))
    return pageIds.length === 0 ? [] : [{
      ...chapter,
      name: resolveProfileTokens(chapter.name, profileValues),
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
      title: resolveProfileTokens(document.data.summary.title, profileValues),
      description: resolveProfileTokens(document.data.summary.description, profileValues),
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
function resolveBdcText(bdc: Bdc, values: Readonly<Record<string, ProfileValue>>): Bdc {
  const question = bdc.question
  const card = bdc.card
  const graph = bdc.statisticalGraph
  const result = bdc.evaluationResult
  return {
    ...bdc,
    ...(question == null ? {} : { question: {
      ...question,
      title: resolveProfileTokens(question.title, values),
      prompt: resolveProfileTokens(question.prompt, values),
      ...(question.validationLabel === undefined ? {} : { validationLabel: resolveProfileTokens(question.validationLabel, values) }),
      answers: question.answers.map((answer) => ({ ...answer, label: resolveProfileTokens(answer.label, values) })),
    } }),
    ...(card == null ? {} : { card: {
      ...card,
      overline: resolveProfileTokens(card.overline, values),
      title: resolveProfileTokens(card.title, values),
      description: resolveProfileTokens(card.description, values),
      message: resolveProfileTokens(card.message, values),
      note: resolveProfileTokens(card.note, values),
      caption: resolveProfileTokens(card.caption, values),
    } }),
    ...(graph == null ? {} : { statisticalGraph: {
      ...graph,
      overline: resolveProfileTokens(graph.overline, values),
      title: resolveProfileTokens(graph.title, values),
      categoryAxisLabel: resolveProfileTokens(graph.categoryAxisLabel, values),
      seriesAxisLabel: resolveProfileTokens(graph.seriesAxisLabel, values),
      editorialText: resolveProfileTokens(graph.editorialText, values),
      categories: graph.categories.map((item) => ({ ...item, label: resolveProfileTokens(item.label, values) })),
      series: graph.series.map((item) => ({ ...item, label: resolveProfileTokens(item.label, values) })),
    } }),
    ...(result == null ? {} : { evaluationResult: {
      success: { ...result.success, message: resolveProfileTokens(result.success.message, values) },
      failure: { ...result.failure, message: resolveProfileTokens(result.failure.message, values) },
    } }),
  }
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
function projectRichTextNodes(nodes: readonly RichTextNode[], retainedAnchors: ReadonlySet<string>): readonly RichTextNode[] {
  return nodes.flatMap((node) => {
    if (node.type === 'elceAnchor' && typeof node.attrs?.bdcId === 'string' && !retainedAnchors.has(node.attrs.bdcId)) return []
    return [{ ...node, ...(node.content === undefined ? {} : { content: projectRichTextNodes(node.content, retainedAnchors) }) }]
  })
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

/** Escapes user-authored profile values before they enter generated HTML. */
function escapeHtmlText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

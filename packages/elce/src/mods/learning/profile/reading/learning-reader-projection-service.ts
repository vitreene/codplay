import { BDC_TYPE } from '../../learning-definition'
import { SCENARIO_ENTRY_KIND } from '../../organization/learning-organization-config'
import { LearningDocument } from '../../document/learning-document'
import type { LearningBdc, LearningPage } from '../../document/learning-document-types'
import type { AuthoredTextValue, RichTextDocument, RichTextNode } from '../../../../resources/document/rich-text-types'
import type { ScenarioEntry } from '../../organization/learning-scenario-entry-types'
import type { ProfileProperty, ProfileValue } from '../domain/learning-profile-types'
import { learningProfileService } from '../domain/learning-profile-service'
import { parseInlineTextTokens } from '../../inline-text/learning-inline-text-value'

interface ReaderTextProjectionContext {
  readonly values: Readonly<Record<string, ProfileValue>>
  readonly properties: ReadonlyMap<string, ProfileProperty>
  readonly now: Date
  readonly pageTitles: ReadonlyMap<string, string>
  readonly retainedPageIds: ReadonlySet<string>
}

export class LearningReaderProjectionService {
  /** Builds the immutable document projection consumed by the Elcé reader. */
  public projectReaderDocument(
    document: LearningDocument,
    profileValues: Readonly<Record<string, ProfileValue>>,
    profileEnabled: boolean,
  ): LearningDocument {
    const scenarioPageIds = new Set(document.scenarioPageIds)
    const scenarioBdcIds = new Set(document.bdcs
      .filter((bdc) => {
        const pageId = this.rootPageId(document, bdc)
        return pageId !== null && scenarioPageIds.has(pageId)
      })
      .map((bdc) => bdc.id))
    const retainedBdcIds = new Set<string>()
    const projectedById = new Map<string, LearningBdc>()

    /** Projects one visible scenario BDC and its only authored child shapes. */
    const projectBdc = (bdcId: string): LearningBdc | undefined => {
      const bdc = document.bdcs.find((candidate) => candidate.id === bdcId)
      if (bdc === undefined || profileEnabled && !learningProfileService.bdcMatchesProfile(document, bdcId, profileValues)) return undefined
      switch (bdc.type) {
        case BDC_TYPE.CAROUSEL: {
          const carousel = bdc.carousel
          if (carousel == null) return undefined
          const cards = carousel.cards.flatMap((entry) => {
            const child = projectBdc(entry.bdcId)
            return child === undefined ? [] : [{ ...entry, bdcId: child.id }]
          })
          if (cards.length === 0) return undefined
          const projected: LearningBdc = { ...bdc, carousel: { ...carousel, cards } }
          projectedById.set(bdcId, projected)
          retainedBdcIds.add(bdcId)
          return projected
        }
        case BDC_TYPE.SECTION: {
          const anchors = new Set<string>(this.collectAnchorIds(bdc.section?.content.content ?? []))
          const retainedAnchors = new Set<string>()
          for (const anchorId of anchors) {
            if (projectBdc(anchorId) !== undefined) retainedAnchors.add(anchorId)
          }
          const section = bdc.section === null ? null : {
            ...bdc.section,
            title: bdc.section.title,
            content: {
              ...bdc.section.content,
              content: this.projectRichTextNodes(bdc.section.content.content, retainedAnchors),
            },
            markup: this.projectAnchorMarkup(bdc.section.markup, retainedAnchors),
          }
          const projected = { ...bdc, section }
          projectedById.set(bdcId, projected)
          retainedBdcIds.add(bdcId)
          return projected
        }
        default:
          retainedBdcIds.add(bdcId)
          projectedById.set(bdcId, bdc)
          return projectedById.get(bdcId)
      }
    }

    const retainedPages = new Map<string, LearningPage>()
    for (const pageId of scenarioPageIds) {
      const page = document.pages.find((candidate) => candidate.id === pageId)
      if (page === undefined) continue
      const bdcIds = page.bdcIds.flatMap((bdcId) => projectBdc(bdcId)?.id ?? [])
      if (bdcIds.length > 0) retainedPages.set(page.id, {
        ...page,
        bdcIds,
      })
    }

    const textContext = this.createTextProjectionContext(document, profileValues, new Set(retainedPages.keys()))
    for (const [pageId, page] of retainedPages) {
      retainedPages.set(pageId, { ...page, name: this.projectAuthoredText(page.name, textContext) })
    }
    for (const [bdcId, bdc] of projectedById) {
      projectedById.set(bdcId, this.projectBdcText(bdc, textContext))
    }

    const retainedEntriesByChapter = new Map<string, ScenarioEntry[]>()
    const projectScenarioEntries = (entries: readonly ScenarioEntry[]): ScenarioEntry[] => entries.flatMap<ScenarioEntry>((entry) => {
      if (entry.kind === SCENARIO_ENTRY_KIND.PAGE) return retainedPages.has(entry.pageId) ? [entry] : []
      const chapter = document.chapters.find((candidate) => candidate.id === entry.chapterId)
      if (chapter === undefined) return []
      const retainedEntries = projectScenarioEntries(chapter.entries)
      if (retainedEntries.length === 0) return []
      retainedEntriesByChapter.set(chapter.id, retainedEntries)
      return [entry]
    })
    const scenarioEntries = projectScenarioEntries(document.data.scenarioEntries)
    const chapters = document.chapters.flatMap((chapter) => {
      const entries = retainedEntriesByChapter.get(chapter.id)
      if (entries === undefined) return []
      const pageIds = entries.flatMap((entry) => entry.kind === SCENARIO_ENTRY_KIND.PAGE ? [entry.pageId] : [])
      return [{
        ...chapter,
        name: this.projectAuthoredText(chapter.name, textContext),
        entries,
        pageIds,
      }]
    })
    const retainedChapterIds = new Set(chapters.map((chapter) => chapter.id))
    if (profileEnabled) this.assertReadingTargetsRetained(document, retainedChapterIds)

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

    return new LearningDocument({
      ...document.data,
      summary: {
        ...document.data.summary,
        title: this.projectAuthoredText(document.data.summary.title, textContext),
        description: this.projectAuthoredText(document.data.summary.description, textContext),
      },
      chapters,
      pages,
      scenarioEntries,
      bdcs,
      profile: { ...document.data.profile, constraints, readingConstraints },
    })
  }

  /** Fails when a retained chapter requires an explicit chapter removed by profiling. */
  private assertReadingTargetsRetained(
    document: LearningDocument,
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

  /** Captures one clock and the labels used to project every reader text field. */
  private createTextProjectionContext(
    document: LearningDocument,
    values: Readonly<Record<string, ProfileValue>>,
    retainedPageIds: ReadonlySet<string>,
  ): ReaderTextProjectionContext {
    const now = new Date()
    const properties = new Map(document.data.profile.properties.map((property) => [property.id, property]))
    const pageTitles = new Map(document.pages.map((page) => [
      page.id,
      this.authoredValueToLabel(page.name, values, properties, now),
    ]))
    return { values, properties, now, pageTitles, retainedPageIds }
  }

  /** Resolves profile, date, and page-link labels in every authored BDC text field. */
  private projectBdcText(bdc: LearningBdc, context: ReaderTextProjectionContext): LearningBdc {
    const question = bdc.question
    const card = bdc.card
    const graph = bdc.statisticalGraph
    const result = bdc.evaluationResult
    const section = bdc.section
    return {
      ...bdc,
      ...(section == null ? {} : { section: {
        ...section,
        title: this.projectAuthoredText(section.title, context),
        content: {
          ...section.content,
          content: section.content.content.flatMap((node) => this.projectRichTextNode(node, context)),
        },
        markup: this.resolveInlineMarkup(section.markup, context),
      } }),
      ...(question == null ? {} : { question: {
        ...question,
        title: this.projectAuthoredText(question.title, context),
        prompt: this.projectAuthoredText(question.prompt, context),
        ...(question.validationLabel === undefined ? {} : { validationLabel: this.projectAuthoredText(question.validationLabel, context) }),
      } }),
      ...(card == null ? {} : { card: {
        ...card,
        overline: this.projectAuthoredText(card.overline, context),
        title: this.projectAuthoredText(card.title, context),
        description: this.projectAuthoredText(card.description, context),
        message: this.projectAuthoredText(card.message, context),
        note: this.projectAuthoredText(card.note, context),
        caption: this.projectAuthoredText(card.caption, context),
      } }),
      ...(graph == null ? {} : { statisticalGraph: {
        ...graph,
        overline: this.projectAuthoredText(graph.overline, context),
        title: this.projectAuthoredText(graph.title, context),
        categoryAxisLabel: this.projectAuthoredText(graph.categoryAxisLabel, context),
        seriesAxisLabel: this.projectAuthoredText(graph.seriesAxisLabel, context),
        editorialText: this.projectAuthoredText(graph.editorialText, context),
        categories: graph.categories.map((item) => ({ ...item, label: this.projectAuthoredText(item.label, context) })),
        series: graph.series.map((item) => ({ ...item, label: this.projectAuthoredText(item.label, context) })),
      } }),
      ...(result == null ? {} : { evaluationResult: {
        success: { ...result.success, message: this.projectAuthoredText(result.success.message, context) },
        failure: { ...result.failure, message: this.projectAuthoredText(result.failure.message, context) },
      } }),
    }
  }

  /** Resolves tokens in text fields while leaving HTML escaping to their rendering boundary. */
  private projectAuthoredText(value: AuthoredTextValue, context: ReaderTextProjectionContext): AuthoredTextValue {
    if (typeof value === 'string') {
      const parsed = parseInlineTextTokens(value)
      if (parsed !== null && parsed.content.some((node) => this.containsReaderAtom(node))) {
        return this.projectRichTextDocument(parsed, context)
      }
      return value.replace(/\{\{profile:([^{}]+)\}\}/g, (_match, propertyId: string) =>
        this.profileValueText(context.values[propertyId], context.properties.get(propertyId)))
    }
    return this.projectRichTextDocument(value, context)
  }

  /** Resolves the inline atoms in one structured text value without mutating its source. */
  private projectRichTextDocument(value: RichTextDocument, context: ReaderTextProjectionContext): RichTextDocument {
    return { ...value, content: value.content.flatMap((node) => this.projectRichTextNode(node, context)) }
  }

  /** Checks whether a parsed string contains a page or date atom that needs projection. */
  private containsReaderAtom(node: RichTextNode): boolean {
    return node.type === 'pageLinkLabel' || node.type === 'localDateLabel'
      || (node.content?.some((child) => this.containsReaderAtom(child)) ?? false)
  }

  /** Replaces profile and date atoms with text and annotates page links for scene builders. */
  private projectRichTextNode(node: RichTextNode, context: ReaderTextProjectionContext): readonly RichTextNode[] {
    if (node.type === 'profileLabel') {
      const propertyId = String(node.attrs?.profilePropertyId ?? '')
      const text = this.profileValueText(context.values[propertyId], context.properties.get(propertyId))
      return text.length === 0 ? [] : [{ type: 'text', text, ...(node.marks === undefined ? {} : { marks: node.marks }) }]
    }
    if (node.type === 'localDateLabel') {
      const text = this.localDateText(node.attrs, context.now)
      return [{ type: 'text', text, ...(node.marks === undefined ? {} : { marks: node.marks }) }]
    }
    if (node.type === 'pageLinkLabel') {
      const pageId = String(node.attrs?.pageId ?? '')
      const label = typeof node.attrs?.label === 'string'
        ? node.attrs.label
        : context.pageTitles.get(pageId) ?? String(node.attrs?.fallbackLabel ?? pageId)
      return [{
        ...node,
        attrs: {
          ...node.attrs,
          resolvedLabel: label,
          targetAvailable: context.retainedPageIds.has(pageId),
        },
      }]
    }
    if (node.content === undefined) return [node]
    return [{ ...node, content: node.content.flatMap((child) => this.projectRichTextNode(child, context)) }]
  }

  /** Flattens a page name for use as the default label of links to that page. */
  private authoredValueToLabel(
    value: AuthoredTextValue,
    values: Readonly<Record<string, ProfileValue>>,
    properties: ReadonlyMap<string, ProfileProperty>,
    now: Date,
  ): string {
    if (typeof value === 'string') {
      const richValue = parseInlineTextTokens(value)
      if (richValue !== null) return this.richTextLabel(richValue.content, values, properties, now)
      return value.replace(/\{\{profile:([^{}]+)\}\}/g, (_match, propertyId: string) =>
        this.profileValueText(values[propertyId], properties.get(propertyId)))
    }
    return this.richTextLabel(value.content, values, properties, now)
  }

  /** Converts existing inline atoms to their visible label text for page titles. */
  private richTextLabel(
    nodes: readonly RichTextNode[],
    values: Readonly<Record<string, ProfileValue>>,
    properties: ReadonlyMap<string, ProfileProperty>,
    now: Date,
  ): string {
    return nodes.map((node, index) => {
      const previous = nodes[index - 1]
      const blockSeparator = index > 0 && isTextBlock(node) && previous !== undefined && isTextBlock(previous) ? '\n' : ''
      switch (node.type) {
        case 'text': return blockSeparator + (node.text ?? '')
        case 'hardBreak': return blockSeparator + '\n'
        case 'profileLabel': {
          const id = String(node.attrs?.profilePropertyId ?? '')
          return blockSeparator + this.profileValueText(values[id], properties.get(id))
        }
        case 'localDateLabel': return blockSeparator + this.localDateText(node.attrs, now)
        case 'pageLinkLabel': return blockSeparator + String(node.attrs?.label ?? node.attrs?.fallbackLabel ?? node.attrs?.pageId ?? '')
        default: return blockSeparator + (node.content === undefined ? '' : this.richTextLabel(node.content, values, properties, now))
      }
    }).join('')
  }

  /** Resolves a date atom using the browser locale and the projection's one captured clock. */
  private localDateText(
    attributes: Readonly<Record<string, string | number | boolean | null>> | undefined,
    now: Date,
  ): string {
    const kind = attributes?.kind
    if (kind === 'time') return new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(now)
    const date = new Date(now.getTime())
    if (kind === 'relative' && attributes !== undefined) {
      const offset = typeof attributes.offsetDays === 'number' && Number.isSafeInteger(attributes.offsetDays)
        ? attributes.offsetDays
        : 0
      date.setDate(date.getDate() + offset)
    }
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(date)
  }

  /** Resolves a profile value with the human-readable labels of choice properties. */
  private profileValueText(value: ProfileValue | undefined, property?: ProfileProperty): string {
    if (Array.isArray(value)) {
      return value.map((choiceId) => property?.choices.find((choice) => choice.id === choiceId)?.label ?? choiceId).join(', ')
    }
    if (value === undefined) return ''
    const text = String(value)
    return property?.type === 'choice-one'
      ? property.choices.find((choice) => choice.id === text)?.label ?? text
      : text
  }

  /** Resolves serialized Section labels using the same captured reader values as Tiptap fields. */
  private resolveInlineMarkup(markup: string, context: ReaderTextProjectionContext): string {
    let output = markup.replace(/\{\{profile:([^{}]+)\}\}/g, (_match, propertyId: string) =>
      this.escapeHtmlText(this.profileValueText(context.values[propertyId], context.properties.get(propertyId))))
    output = output.replace(/<span\b(?=[^>]*\bdata-elce-profile-property\s*=)[^>]*>[\s\S]*?<\/span>/gi, (span) => {
      const propertyId = markupAttribute(span, 'data-elce-profile-property')
      if (propertyId === null) return span
      return this.replaceMarkupSpanText(span, this.profileValueText(context.values[propertyId], context.properties.get(propertyId)))
    })
    output = output.replace(/<span\b(?=[^>]*\bdata-elce-date-kind\s*=)[^>]*>[\s\S]*?<\/span>/gi, (span) => {
      const kind = markupAttribute(span, 'data-elce-date-kind')
      if (kind === null) return span
      const offset = Number(markupAttribute(span, 'data-elce-date-offset') ?? 0)
      const attrs = { kind, offsetDays: Number.isSafeInteger(offset) ? offset : 0 }
      return this.replaceMarkupSpanText(span, this.localDateText(attrs, context.now))
    })
    return output.replace(/<span\b(?=[^>]*\bdata-elce-page-id\s*=)[^>]*>[\s\S]*?<\/span>/gi, (span) => {
      const pageId = markupAttribute(span, 'data-elce-page-id')
      if (pageId === null) return span
      const authoredLabel = markupAttribute(span, 'data-elce-page-label')
      const fallbackLabel = markupAttribute(span, 'data-elce-page-fallback')
      const label = authoredLabel ?? context.pageTitles.get(pageId) ?? fallbackLabel ?? pageId
      return this.replaceMarkupSpanText(span, label)
    })
  }

  /** Replaces only the contents of one serialized inline label span. */
  private replaceMarkupSpanText(span: string, value: string): string {
    const openingEnd = span.indexOf('>')
    const closingStart = span.lastIndexOf('</span>')
    if (openingEnd < 0 || closingStart <= openingEnd) return span
    return `${span.slice(0, openingEnd + 1)}${this.escapeHtmlText(value)}${span.slice(closingStart)}`
  }

  /** Resolves `{{profile:property-id}}` tokens as escaped text. */
  public resolveProfileTokens(value: string, values: Readonly<Record<string, ProfileValue>>): string
  public resolveProfileTokens(value: RichTextDocument, values: Readonly<Record<string, ProfileValue>>): RichTextDocument
  public resolveProfileTokens(value: AuthoredTextValue, values: Readonly<Record<string, ProfileValue>>): AuthoredTextValue
  public resolveProfileTokens(value: AuthoredTextValue, values: Readonly<Record<string, ProfileValue>>): AuthoredTextValue {
    if (typeof value !== 'string') return value
    return value.replace(/\{\{profile:([^{}]+)\}\}/g, (_match, propertyId: string) => this.escapeHtmlText(this.profileValueText(values[propertyId])))
  }

  /** Removes only anchor nodes whose corresponding media BDC was filtered out. */
  private projectRichTextNodes(nodes: readonly RichTextNode[], retainedAnchors: ReadonlySet<string>): readonly RichTextNode[] {
    return nodes.flatMap((node) => {
      if (node.type === 'elceAnchor' && typeof node.attrs?.bdcId === 'string' && !retainedAnchors.has(node.attrs.bdcId)) return []
      return [{ ...node, ...(node.content === undefined ? {} : { content: this.projectRichTextNodes(node.content, retainedAnchors) }) }]
    })
  }

  /** Removes matching serialized anchor spans without modifying the author document. */
  private projectAnchorMarkup(markup: string, retainedAnchors: ReadonlySet<string>): string {
    return markup.replace(/<span\b(?=[^>]*\bdata-elce-anchor\s*=\s*["']true["'])[^>]*>[\s\S]*?<\/span>/gi, (anchor) => {
      const id = /\bdata-bdc-id\s*=\s*(["'])(.*?)\1/i.exec(anchor)?.[2]
      return id !== undefined && retainedAnchors.has(id) ? anchor : ''
    })
  }

  /** Collects stable BDC IDs from Elcé anchor nodes. */
  private collectAnchorIds(nodes: readonly RichTextNode[]): string[] {
    return nodes.flatMap((node) => [
      ...(node.type === 'elceAnchor' && typeof node.attrs?.bdcId === 'string' ? [node.attrs.bdcId] : []),
      ...(node.content === undefined ? [] : this.collectAnchorIds(node.content)),
    ])
  }

  /** Finds the page root of a direct or nested BDC. */
  private rootPageId(document: LearningDocument, bdc: LearningBdc): string | null {
    let current = bdc
    while (current.parentBdcId !== null) {
      const parent = document.bdcs.find((candidate) => candidate.id === current.parentBdcId)
      if (parent === undefined) return null
      current = parent
    }
    return current.pageId
  }

  /** Escapes user-authored profile values before they enter generated HTML. */
  private escapeHtmlText(value: string): string {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
  }

}

/** Reads one attribute from a serialized inline-label span. */
function markupAttribute(markup: string, name: string): string | null {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const value = new RegExp(`\\b${escapedName}\\s*=\\s*(["'])(.*?)\\1`, 'i').exec(markup)?.[2]
  if (value === undefined) return null
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
}

/** Identifies rich-text block nodes whose boundary becomes a line break in labels. */
function isTextBlock(node: RichTextNode): boolean {
  return node.type === 'paragraph' || node.type === 'heading'
}

export const learningReaderProjectionService = new LearningReaderProjectionService()

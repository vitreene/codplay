import { BDC_TYPE } from '../../learning-definition'
import { SCENARIO_ENTRY_KIND } from '../../organization/learning-organization-config'
import { LearningDocument } from '../../document/learning-document'
import type { LearningBdc, LearningPage } from '../../document/learning-document-types'
import type { RichTextNode } from '../../../../resources/bdcs/section/domain/section-types'
import type { ScenarioEntry } from '../../organization/learning-scenario-entry-types'
import type { ProfileValue } from '../domain/learning-profile-types'
import { learningProfileService } from '../domain/learning-profile-service'

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
            title: this.resolveProfileTokens(bdc.section.title, profileValues),
            content: {
              ...bdc.section.content,
              content: this.projectRichTextNodes(bdc.section.content.content, retainedAnchors),
            },
            markup: this.projectAnchorMarkup(
              this.resolveProfileMarkup(this.resolveProfileTokens(bdc.section.markup, profileValues), profileValues),
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
          projectedById.set(bdcId, this.resolveBdcText(bdc, profileValues))
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
        name: this.resolveProfileTokens(page.name, profileValues),
        bdcIds,
      })
    }

    const chapters = document.chapters.flatMap((chapter) => {
      const pageIds = chapter.pageIds.filter((pageId) => retainedPages.has(pageId))
      return pageIds.length === 0 ? [] : [{
        ...chapter,
        name: this.resolveProfileTokens(chapter.name, profileValues),
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
        title: this.resolveProfileTokens(document.data.summary.title, profileValues),
        description: this.resolveProfileTokens(document.data.summary.description, profileValues),
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

  /** Resolves profile references in every authored text field without changing IDs. */
  private resolveBdcText(bdc: LearningBdc, values: Readonly<Record<string, ProfileValue>>): LearningBdc {
    const question = bdc.question
    const card = bdc.card
    const graph = bdc.statisticalGraph
    const result = bdc.evaluationResult
    return {
      ...bdc,
      ...(question == null ? {} : { question: {
        ...question,
        title: this.resolveProfileTokens(question.title, values),
        prompt: this.resolveProfileTokens(question.prompt, values),
        ...(question.validationLabel === undefined ? {} : { validationLabel: this.resolveProfileTokens(question.validationLabel, values) }),
        answers: question.answers.map((answer) => ({ ...answer, label: this.resolveProfileTokens(answer.label, values) })),
      } }),
      ...(card == null ? {} : { card: {
        ...card,
        overline: this.resolveProfileTokens(card.overline, values),
        title: this.resolveProfileTokens(card.title, values),
        description: this.resolveProfileTokens(card.description, values),
        message: this.resolveProfileTokens(card.message, values),
        note: this.resolveProfileTokens(card.note, values),
        caption: this.resolveProfileTokens(card.caption, values),
      } }),
      ...(graph == null ? {} : { statisticalGraph: {
        ...graph,
        overline: this.resolveProfileTokens(graph.overline, values),
        title: this.resolveProfileTokens(graph.title, values),
        categoryAxisLabel: this.resolveProfileTokens(graph.categoryAxisLabel, values),
        seriesAxisLabel: this.resolveProfileTokens(graph.seriesAxisLabel, values),
        editorialText: this.resolveProfileTokens(graph.editorialText, values),
        categories: graph.categories.map((item) => ({ ...item, label: this.resolveProfileTokens(item.label, values) })),
        series: graph.series.map((item) => ({ ...item, label: this.resolveProfileTokens(item.label, values) })),
      } }),
      ...(result == null ? {} : { evaluationResult: {
        success: { ...result.success, message: this.resolveProfileTokens(result.success.message, values) },
        failure: { ...result.failure, message: this.resolveProfileTokens(result.failure.message, values) },
      } }),
    }
  }

  /** Resolves `{{profile:property-id}}` tokens as escaped text. */
  public resolveProfileTokens(value: string, values: Readonly<Record<string, ProfileValue>>): string {
    return value.replace(/\{\{profile:([^{}]+)\}\}/g, (_match, propertyId: string) => this.escapeHtmlText(this.profileValueText(values[propertyId])))
  }

  /** Resolves static Tiptap label markers to escaped reader text. */
  private resolveProfileMarkup(markup: string, values: Readonly<Record<string, ProfileValue>>): string {
    return markup.replace(/(<span\b[^>]*\bdata-elce-profile-property=["'])([^"']+)(["'][^>]*>)[\s\S]*?(<\/span>)/gi,
      (_match, before: string, propertyId: string, after: string, close: string) => `${before}${propertyId}${after}${this.escapeHtmlText(this.profileValueText(values[propertyId]))}${close}`)
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

  /** Converts a value to text and escapes it for CodPlay's authored HTML content. */
  private profileValueText(value: ProfileValue | undefined): string {
    return Array.isArray(value) ? value.join(', ') : value === undefined ? '' : String(value)
  }

  /** Escapes user-authored profile values before they enter generated HTML. */
  private escapeHtmlText(value: string): string {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
  }

}

export const learningReaderProjectionService = new LearningReaderProjectionService()

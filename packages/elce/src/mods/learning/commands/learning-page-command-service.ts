import { BDC_TYPE, DEFAULT_PRESET_ID, PAGE_TYPE } from '../learning-definition'
import { CHAPTER_TYPE, CHAPTER_TYPE_CONFIG, SCENARIO_ENTRY_KIND } from '../organization/learning-organization-config'
import { DEFAULT_EVALUATION_SETTINGS } from '../evaluation/learning-evaluation-config'
import { PAGE_LOCATION } from '../organization/learning-page-placement'
import type { PagePlacement } from '../organization/learning-page-placement'
import { BDC_LOCATION } from '../../../core/document/content-location'
import { indexAtEndOrRequested, insertAt, removeValue, replaceAt } from '../../../core/document/collection-operations'
import { findChapter, findPage } from '../../../core/document/content-placement-service'
import type { ChapterId, PageId } from '../../../core/document/content-document-types'
import type { LearningDocumentCommand } from './learning-document-command-types'
import { LearningDocument } from '../document/learning-document'
import type { LearningChapter, LearningPage } from '../document/learning-document-types'
import type { LearningDocumentService } from '../document/learning-document-service'
import type { LearningBdcCommandService } from './learning-bdc-command-service'
import { fail } from './operations/command-helpers'

/** Applies page and chapter commands to the Learning v7 aggregate. */
export class LearningPageCommandService {
  private readonly documentService: LearningDocumentService
  private readonly bdcCommands: LearningBdcCommandService

  public constructor(documentService: LearningDocumentService, bdcCommands: LearningBdcCommandService) {
    this.documentService = documentService
    this.bdcCommands = bdcCommands
  }

  /** Applies a page or chapter command when this service owns its event. */
  public apply(document: LearningDocument, command: LearningDocumentCommand): LearningDocument | null {
    switch (command.type) {
      case 'chapter.create':
        return this.createChapter(document, command)
      case 'chapter.rename':
        return this.renameChapter(document, command.chapterId, command.name)
      case 'chapter.evaluation.settings.update':
        return this.updateChapterEvaluationSettings(document, command)
      case 'chapter.move':
        return this.moveChapter(document, command.chapterId, command.index)
      case 'chapter.delete':
        return this.deleteChapter(document, command.chapterId)
      case 'page.create':
        return this.createPage(document, command)
      case 'page.rename':
        return this.renamePage(document, command.pageId, command.name)
      case 'page.move':
        return this.movePage(document, command.pageId, command.placement)
      case 'page.remove':
        return this.movePage(document, command.pageId, { kind: PAGE_LOCATION.CATALOG })
      case 'page.delete':
        return this.deletePage(document, command.pageId)
      default:
        return null
    }
  }

  /** Creates a chapter with its configured Evaluation settings. */
  private createChapter(document: LearningDocument, command: Extract<LearningDocumentCommand, { type: 'chapter.create' }>): LearningDocument {
    if (document.chapters.some((chapter) => chapter.id === command.chapterId)) fail(`Chapitre déjà présent : ${command.chapterId}`)
    const chapter: LearningChapter = {
      id: command.chapterId,
      name: command.name,
      type: command.chapterType ?? CHAPTER_TYPE.STANDARD,
      pageIds: [],
      ...(command.chapterType === CHAPTER_TYPE.EVALUATION ? {
        evaluationThreshold: DEFAULT_EVALUATION_SETTINGS.threshold,
        evaluationAttemptLimit: DEFAULT_EVALUATION_SETTINGS.attemptLimit,
        evaluationRetryScope: DEFAULT_EVALUATION_SETTINGS.retryScope,
      } : {}),
    }
    return new LearningDocument({
      ...document.data,
      chapters: [...document.chapters, chapter],
      scenarioEntries: [...document.data.scenarioEntries, { kind: SCENARIO_ENTRY_KIND.CHAPTER, chapterId: chapter.id }],
    })
  }

  /** Deletes an empty chapter and its root scenario entry. */
  private deleteChapter(document: LearningDocument, chapterId: ChapterId): LearningDocument {
    const chapter = findChapter(document.chapters, chapterId)
    if (chapter.pageIds.length > 0) fail(`Impossible de supprimer un chapitre non vide : ${chapterId}`)
    return this.withData({
      ...document.data,
      chapters: document.chapters.filter((candidate) => candidate.id !== chapter.id),
      scenarioEntries: document.data.scenarioEntries.filter((entry) => {
        switch (entry.kind) {
          case SCENARIO_ENTRY_KIND.PAGE:
            return true
          case SCENARIO_ENTRY_KIND.CHAPTER:
            return entry.chapterId !== chapter.id
        }
      }),
    })
  }

  /** Reorders one chapter entry without changing its pages. */
  private moveChapter(document: LearningDocument, chapterId: ChapterId, requestedIndex: number | undefined): LearningDocument {
    const chapter = findChapter(document.chapters, chapterId)
    const sourceIndex = this.scenarioEntryIndexForChapter(document, chapter.id)
    const targetIndex = indexAtEndOrRequested(document.data.scenarioEntries.length, requestedIndex)
    const insertionIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
    const scenarioEntries = document.data.scenarioEntries.filter((entry) => {
      switch (entry.kind) {
        case SCENARIO_ENTRY_KIND.PAGE:
          return true
        case SCENARIO_ENTRY_KIND.CHAPTER:
          return entry.chapterId !== chapter.id
      }
    })
    return this.withData({
      ...document.data,
      scenarioEntries: insertAt(scenarioEntries, { kind: SCENARIO_ENTRY_KIND.CHAPTER, chapterId: chapter.id }, insertionIndex),
    })
  }

  /** Creates a page and its configured initial BDCs at the requested placement. */
  private createPage(
    document: LearningDocument,
    command: Extract<LearningDocumentCommand, { type: 'page.create' }>,
  ): LearningDocument {
    if (document.pages.some((page) => page.id === command.pageId)) fail(`Page déjà présente : ${command.pageId}`)
    if (document.bdcs.some((bdc) => bdc.id === command.bdcId)) fail(`Bdc déjà présent : ${command.bdcId}`)
    const page: LearningPage = {
      id: command.pageId,
      name: command.name?.trim() || this.documentService.nextPageName(document),
      type: command.pageType ?? PAGE_TYPE.FLUX,
      chapterId: null,
      bdcIds: [],
    }
    const withPage = this.placePage(this.withData({ ...document.data, pages: [...document.pages, page] }), page, command.placement)
    switch (page.type) {
      case PAGE_TYPE.DIAPO:
        if (command.defaultBdcType !== undefined || command.initialCardBdcId === undefined) {
          fail('Une page Diapo reçoit un BDC Carousel initial et sa première carte identifiée.')
        }
        return this.bdcCommands.create(withPage, {
          type: 'bdc.create',
          bdcId: command.bdcId,
          bdcType: BDC_TYPE.CAROUSEL,
          presetId: DEFAULT_PRESET_ID.CAROUSEL,
          initialCardBdcId: command.initialCardBdcId,
          placement: { kind: BDC_LOCATION.PAGE, pageId: page.id },
        })
      case PAGE_TYPE.FLUX: {
        if (command.initialCardBdcId !== undefined) fail('Une page Flux ne reçoit pas de carte Carousel initiale.')
        const initialBdcType = command.defaultBdcType ?? CHAPTER_TYPE_CONFIG[CHAPTER_TYPE.STANDARD].defaultBdcType
        switch (initialBdcType) {
          case BDC_TYPE.SECTION:
            return this.bdcCommands.create(withPage, {
              type: 'bdc.create',
              bdcId: command.bdcId,
              bdcType: BDC_TYPE.SECTION,
              presetId: DEFAULT_PRESET_ID.SECTION,
              placement: { kind: BDC_LOCATION.PAGE, pageId: page.id },
            })
          case BDC_TYPE.QUESTION:
            return this.bdcCommands.create(withPage, {
              type: 'bdc.create',
              bdcId: command.bdcId,
              bdcType: BDC_TYPE.QUESTION,
              presetId: DEFAULT_PRESET_ID.QUESTION,
              placement: { kind: BDC_LOCATION.PAGE, pageId: page.id },
            })
        }
      }
      default:
        return fail(`Type de page non pris en charge : ${page.type}`)
    }
  }

  /** Moves a page to a chapter, root scenario position, or catalogue. */
  private movePage(document: LearningDocument, pageId: PageId, placement: PagePlacement): LearningDocument {
    return this.placePage(document, findPage(document.pages, pageId), placement)
  }

  /** Permanently deletes a page and its BDCs after detaching its placement. */
  private deletePage(document: LearningDocument, pageId: PageId): LearningDocument {
    const page = findPage(document.pages, pageId)
    let detached = this.movePage(document, pageId, { kind: PAGE_LOCATION.CATALOG })
    for (const bdcId of page.bdcIds) detached = this.bdcCommands.delete(detached, bdcId)
    return this.withData({
      ...detached.data,
      chapters: detached.chapters.map((chapter) => ({ ...chapter, pageIds: removeValue(chapter.pageIds, pageId) })),
      pages: detached.pages.filter((candidate) => candidate.id !== pageId),
      scenarioEntries: this.removeScenarioPageEntry(detached, pageId),
      catalogPageIds: removeValue(detached.data.catalogPageIds, pageId),
    })
  }

  /** Renames one page without changing its placement or content. */
  private renamePage(document: LearningDocument, pageId: PageId, requestedName: string): LearningDocument {
    const page = findPage(document.pages, pageId)
    const name = requestedName.trim()
    if (name.length === 0) fail(`Le nom de la page ne peut pas être vide : ${pageId}`)
    return this.withPage(document, { ...page, name })
  }

  /** Renames one chapter without changing its type or page order. */
  private renameChapter(document: LearningDocument, chapterId: ChapterId, requestedName: string): LearningDocument {
    const chapter = findChapter(document.chapters, chapterId)
    const name = requestedName.trim()
    if (name.length === 0) fail(`Le nom du chapitre ne peut pas être vide : ${chapterId}`)
    return this.withData({
      ...document.data,
      chapters: document.chapters.map((candidate) => candidate.id === chapter.id ? { ...chapter, name } : candidate),
    })
  }

  /** Stores editable Evaluation chapter options through the document command path. */
  private updateChapterEvaluationSettings(
    document: LearningDocument,
    command: Extract<LearningDocumentCommand, { type: 'chapter.evaluation.settings.update' }>,
  ): LearningDocument {
    const chapter = findChapter(document.chapters, command.chapterId)
    if (chapter.type !== CHAPTER_TYPE.EVALUATION) fail(`Les réglages d’évaluation ne s’appliquent pas au chapitre ${command.chapterId}`)
    if (command.attemptLimit !== null && (!Number.isInteger(command.attemptLimit) || command.attemptLimit < 1)) {
      fail('La limite de tentatives doit être un entier positif ou illimitée')
    }
    return this.withData({
      ...document.data,
      chapters: document.chapters.map((candidate) => candidate.id === chapter.id
        ? { ...chapter, evaluationAttemptLimit: command.attemptLimit, evaluationRetryScope: command.retryScope }
        : candidate),
    })
  }

  /** Removes one standalone page from the root scenario sequence. */
  private removeScenarioPageEntry(document: LearningDocument, pageId: PageId) {
    return document.data.scenarioEntries.filter((entry) => {
      switch (entry.kind) {
        case SCENARIO_ENTRY_KIND.PAGE:
          return entry.pageId !== pageId
        case SCENARIO_ENTRY_KIND.CHAPTER:
          return true
      }
    })
  }

  /** Finds a standalone page's root entry position when it already has one. */
  private scenarioEntryIndexForPage(document: LearningDocument, pageId: PageId): number | undefined {
    const index = document.data.scenarioEntries.findIndex((entry) => entry.kind === SCENARIO_ENTRY_KIND.PAGE && entry.pageId === pageId)
    return index < 0 ? undefined : index
  }

  /** Returns one chapter's root entry position. */
  private scenarioEntryIndexForChapter(document: LearningDocument, chapterId: ChapterId): number {
    const index = document.data.scenarioEntries.findIndex((entry) => entry.kind === SCENARIO_ENTRY_KIND.CHAPTER && entry.chapterId === chapterId)
    return index < 0 ? fail(`Entrée de chapitre absente : ${chapterId}`) : index
  }

  /** Finds the existing index when a page is reordered inside its current collection. */
  private sourceIndexForPlacement(document: LearningDocument, page: LearningPage, placement: PagePlacement): number | undefined {
    switch (placement.kind) {
      case PAGE_LOCATION.CATALOG:
        return undefined
      case PAGE_LOCATION.SCENARIO:
        return page.chapterId === null ? this.scenarioEntryIndexForPage(document, page.id) : undefined
      case PAGE_LOCATION.CHAPTER: {
        if (page.chapterId !== placement.chapterId) return undefined
        const chapter = document.chapters.find((candidate) => candidate.id === placement.chapterId)
        if (chapter === undefined) return undefined
        const sourceIndex = chapter.pageIds.indexOf(page.id)
        return sourceIndex < 0 ? undefined : sourceIndex
      }
    }
  }

  /** Adjusts the target index for removing the page before inserting it. */
  private indexAfterPageRemoval(document: LearningDocument, page: LearningPage, placement: PagePlacement): number | undefined {
    const requestedIndex = this.pageIndexForPlacement(placement)
    const sourceIndex = this.sourceIndexForPlacement(document, page, placement)
    if (requestedIndex === undefined || sourceIndex === undefined || sourceIndex >= requestedIndex) return requestedIndex
    return requestedIndex - 1
  }

  /** Reads the destination index for a page placement, if it has one. */
  private pageIndexForPlacement(placement: PagePlacement): number | undefined {
    switch (placement.kind) {
      case PAGE_LOCATION.CATALOG:
        return undefined
      case PAGE_LOCATION.SCENARIO:
      case PAGE_LOCATION.CHAPTER:
        return placement.index
    }
  }

  /** Removes the page's prior location and installs its Learning placement. */
  private placePage(document: LearningDocument, page: LearningPage, placement: PagePlacement): LearningDocument {
    const insertionIndex = this.indexAfterPageRemoval(document, page, placement)
    const withoutPage = this.withData({
      ...document.data,
      chapters: document.chapters.map((chapter) => ({ ...chapter, pageIds: removeValue(chapter.pageIds, page.id) })),
      scenarioEntries: this.removeScenarioPageEntry(document, page.id),
      catalogPageIds: removeValue(document.data.catalogPageIds, page.id),
    })
    switch (placement.kind) {
      case PAGE_LOCATION.CATALOG:
        return this.withPage(this.withData({ ...withoutPage.data, catalogPageIds: [...withoutPage.data.catalogPageIds, page.id] }), { ...page, chapterId: null })
      case PAGE_LOCATION.SCENARIO: {
        const scenarioEntries = insertAt(withoutPage.data.scenarioEntries, { kind: SCENARIO_ENTRY_KIND.PAGE, pageId: page.id }, insertionIndex)
        return this.withPage(this.withData({ ...withoutPage.data, scenarioEntries }), { ...page, chapterId: null })
      }
      case PAGE_LOCATION.CHAPTER: {
        const chapter = findChapter(withoutPage.chapters, placement.chapterId)
        const chapters = replaceAt(
          withoutPage.chapters,
          { ...chapter, pageIds: insertAt(chapter.pageIds, page.id, insertionIndex) },
          (candidate) => candidate.id === chapter.id,
        )
        return this.withPage(this.withData({ ...withoutPage.data, chapters }), { ...page, chapterId: chapter.id })
      }
    }
  }

  /** Replaces a page in the document aggregate. */
  private withPage(document: LearningDocument, page: LearningPage): LearningDocument {
    return this.withData({ ...document.data, pages: replaceAt(document.pages, page, (candidate) => candidate.id === page.id) })
  }

  /** Replaces document data while retaining the Learning document constructor. */
  private withData(data: LearningDocument['data']): LearningDocument {
    return new LearningDocument(data)
  }

  /** Reports whether a page is part of an Evaluation chapter. */
  public static pageBelongsToEvaluationChapter(document: LearningDocument, page: LearningPage): boolean {
    const chapter = page.chapterId === null ? undefined : document.chapters.find((candidate) => candidate.id === page.chapterId)
    return chapter?.type === CHAPTER_TYPE.EVALUATION
  }
}

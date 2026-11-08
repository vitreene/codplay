import { BDC_TYPE, DEFAULT_PRESET_ID, PAGE_TYPE } from '../learning-definition'
import { CHAPTER_TYPE, CHAPTER_TYPE_CONFIG, MAX_SCENARIO_CHAPTER_DEPTH, SCENARIO_ENTRY_KIND } from '../organization/learning-organization-config'
import { DEFAULT_EVALUATION_SETTINGS } from '../evaluation/learning-evaluation-config'
import { PAGE_LOCATION } from '../organization/learning-page-placement'
import { scenarioChapterDepth, scenarioEntriesForParent, scenarioParentChapterId } from '../organization/learning-scenario-tree'
import type { PagePlacement } from '../organization/learning-page-placement'
import { BDC_LOCATION } from '../../../core/document/content-location'
import { indexAtEndOrRequested, insertAt, removeValue, replaceAt } from '../../../core/document/collection-operations'
import { findChapter, findPage } from '../../../core/document/content-placement-service'
import type { ChapterId, PageId } from '../../../core/document/content-document-types'
import { authoredTextToPlainText } from '../../../core/document/rich-text-utils'
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
        return this.moveChapter(document, command.chapterId, command.parentChapterId ?? null, command.index)
      case 'chapter.delete':
        return this.deleteChapter(document, command.chapterId)
      case 'page.create':
        return this.createPage(document, command)
      case 'page.rename':
        return this.renamePage(document, command.pageId, command.name)
      case 'page.early-exit.set':
        return this.setPageEarlyExit(document, command.pageId, command.allowEarlyExit)
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

  /** Creates a root chapter or a standard child chapter at the requested depth. */
  private createChapter(document: LearningDocument, command: Extract<LearningDocumentCommand, { type: 'chapter.create' }>): LearningDocument {
    if (document.chapters.some((chapter) => chapter.id === command.chapterId)) fail(`Chapitre déjà présent : ${command.chapterId}`)
    const parentChapterId = command.parentChapterId ?? null
    const parent = parentChapterId === null ? undefined : findChapter(document.chapters, parentChapterId)
    if (parent?.type === CHAPTER_TYPE.EVALUATION) fail('Un chapitre Évaluation ne peut pas contenir de sous-chapitre.')
    if (parentChapterId !== null && command.chapterType === CHAPTER_TYPE.EVALUATION) fail('Un chapitre Évaluation ne peut pas être imbriqué.')
    if (parentChapterId !== null && scenarioChapterDepth(document.data, parentChapterId) >= MAX_SCENARIO_CHAPTER_DEPTH) {
      fail(`La profondeur maximale est de ${MAX_SCENARIO_CHAPTER_DEPTH} niveaux.`)
    }
    const chapter: LearningChapter = {
      id: command.chapterId,
      name: command.name,
      type: command.chapterType ?? CHAPTER_TYPE.STANDARD,
      pageIds: [],
      entries: [],
      ...(command.chapterType === CHAPTER_TYPE.EVALUATION ? {
        evaluationThreshold: DEFAULT_EVALUATION_SETTINGS.threshold,
        evaluationAttemptLimit: DEFAULT_EVALUATION_SETTINGS.attemptLimit,
        evaluationRetryScope: DEFAULT_EVALUATION_SETTINGS.retryScope,
      } : {}),
    }
    const withChapter = this.withData({ ...document.data, chapters: [...document.chapters, chapter] })
    const entries = scenarioEntriesForParent(withChapter.data, parentChapterId)
    return this.replaceEntriesAtParent(withChapter, parentChapterId, [...entries, { kind: SCENARIO_ENTRY_KIND.CHAPTER, chapterId: chapter.id }])
  }

  /** Deletes an empty chapter from its parent entry list. */
  private deleteChapter(document: LearningDocument, chapterId: ChapterId): LearningDocument {
    const chapter = findChapter(document.chapters, chapterId)
    if (chapter.entries.length > 0) fail(`Impossible de supprimer un chapitre non vide : ${chapterId}`)
    const parentChapterId = scenarioParentChapterId(document.data, chapter.id)
    const entries = scenarioEntriesForParent(document.data, parentChapterId)
      .filter((entry) => entry.kind !== SCENARIO_ENTRY_KIND.CHAPTER || entry.chapterId !== chapter.id)
    const withoutEntry = this.replaceEntriesAtParent(document, parentChapterId, entries)
    return this.withData({ ...withoutEntry.data, chapters: withoutEntry.chapters.filter((candidate) => candidate.id !== chapter.id) })
  }

  /** Moves one chapter within or between valid parent entry lists. */
  private moveChapter(
    document: LearningDocument,
    chapterId: ChapterId,
    targetParentChapterId: ChapterId | null,
    requestedIndex: number | undefined,
  ): LearningDocument {
    const chapter = findChapter(document.chapters, chapterId)
    const targetParent = targetParentChapterId === null ? undefined : findChapter(document.chapters, targetParentChapterId)
    if (targetParent?.type === CHAPTER_TYPE.EVALUATION) fail('Un chapitre Évaluation ne peut pas contenir de sous-chapitre.')
    if (chapter.type === CHAPTER_TYPE.EVALUATION && targetParentChapterId !== null) fail('Un chapitre Évaluation ne peut pas être imbriqué.')
    const subtreeChapterIds = this.chapterSubtreeIds(document, chapter.id)
    if (targetParentChapterId !== null && subtreeChapterIds.has(targetParentChapterId)) fail('Un chapitre ne peut pas être déplacé dans sa propre sous-arborescence.')
    const subtreeHeight = this.chapterSubtreeHeight(document, chapter.id)
    const targetDepth = targetParentChapterId === null ? 0 : scenarioChapterDepth(document.data, targetParentChapterId)
    if (targetDepth + subtreeHeight > MAX_SCENARIO_CHAPTER_DEPTH) fail(`La profondeur maximale est de ${MAX_SCENARIO_CHAPTER_DEPTH} niveaux.`)

    const sourceParentChapterId = scenarioParentChapterId(document.data, chapter.id)
    const sourceEntries = scenarioEntriesForParent(document.data, sourceParentChapterId)
    const targetEntries = scenarioEntriesForParent(document.data, targetParentChapterId)
    const sourceIndex = sourceEntries.findIndex((entry) => entry.kind === SCENARIO_ENTRY_KIND.CHAPTER && entry.chapterId === chapter.id)
    if (sourceIndex < 0) fail(`Entrée de chapitre absente : ${chapter.id}`)
    const targetIndex = indexAtEndOrRequested(targetEntries.length, requestedIndex)
    const insertionIndex = sourceParentChapterId === targetParentChapterId && sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
    const withoutChapter = this.replaceEntriesAtParent(
      document,
      sourceParentChapterId,
      sourceEntries.filter((entry) => entry.kind !== SCENARIO_ENTRY_KIND.CHAPTER || entry.chapterId !== chapter.id),
    )
    const destinationEntries = scenarioEntriesForParent(withoutChapter.data, targetParentChapterId)
    return this.replaceEntriesAtParent(
      withoutChapter,
      targetParentChapterId,
      insertAt(destinationEntries, { kind: SCENARIO_ENTRY_KIND.CHAPTER, chapterId: chapter.id }, insertionIndex),
    )
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
      catalogPageIds: removeValue(detached.data.catalogPageIds, pageId),
    })
  }

  /** Renames one page without changing its placement or content. */
  private renamePage(document: LearningDocument, pageId: PageId, requestedName: LearningPage['name']): LearningDocument {
    const page = findPage(document.pages, pageId)
    if (authoredTextToPlainText(requestedName).trim().length === 0) fail(`Le nom de la page ne peut pas être vide : ${pageId}`)
    return this.withPage(document, { ...page, name: requestedName })
  }

  /** Renames one chapter without changing its type or page order. */
  private renameChapter(document: LearningDocument, chapterId: ChapterId, requestedName: LearningChapter['name']): LearningDocument {
    const chapter = findChapter(document.chapters, chapterId)
    if (authoredTextToPlainText(requestedName).trim().length === 0) fail(`Le nom du chapitre ne peut pas être vide : ${chapterId}`)
    return this.withData({
      ...document.data,
      chapters: document.chapters.map((candidate) => candidate.id === chapter.id ? { ...chapter, name: requestedName } : candidate),
    })
  }

  /** Stores or clears the page's explicit early-exit override. */
  private setPageEarlyExit(document: LearningDocument, pageId: PageId, allowEarlyExit: boolean | null): LearningDocument {
    const page = findPage(document.pages, pageId)
    if (allowEarlyExit === null) {
      const { allowEarlyExit: _previous, ...pageWithoutOverride } = page
      return this.withPage(document, pageWithoutOverride)
    }
    return this.withPage(document, { ...page, allowEarlyExit })
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

  /** Finds the existing index when a page is reordered inside its current collection. */
  private sourceIndexForPlacement(document: LearningDocument, page: LearningPage, placement: PagePlacement): number | undefined {
    switch (placement.kind) {
      case PAGE_LOCATION.CATALOG:
        return undefined
      case PAGE_LOCATION.SCENARIO:
        return page.chapterId === null
          ? document.data.scenarioEntries.findIndex((entry) => entry.kind === SCENARIO_ENTRY_KIND.PAGE && entry.pageId === page.id)
          : undefined
      case PAGE_LOCATION.CHAPTER: {
        if (page.chapterId !== placement.chapterId) return undefined
        const chapter = document.chapters.find((candidate) => candidate.id === placement.chapterId)
        if (chapter === undefined) return undefined
        const sourceIndex = chapter.entries.findIndex((entry) => entry.kind === SCENARIO_ENTRY_KIND.PAGE && entry.pageId === page.id)
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
    const withoutPage = this.removePageFromScenario(document, page.id)
    const withoutCatalogPage = this.withData({
      ...withoutPage.data,
      catalogPageIds: removeValue(withoutPage.data.catalogPageIds, page.id),
    })
    switch (placement.kind) {
      case PAGE_LOCATION.CATALOG:
        return this.withPage(this.withData({ ...withoutCatalogPage.data, catalogPageIds: [...withoutCatalogPage.data.catalogPageIds, page.id] }), { ...page, chapterId: null })
      case PAGE_LOCATION.SCENARIO: {
        const scenarioEntries = insertAt(withoutCatalogPage.data.scenarioEntries, { kind: SCENARIO_ENTRY_KIND.PAGE, pageId: page.id }, insertionIndex)
        return this.withPage(this.withData({ ...withoutCatalogPage.data, scenarioEntries }), { ...page, chapterId: null })
      }
      case PAGE_LOCATION.CHAPTER: {
        const chapter = findChapter(withoutCatalogPage.chapters, placement.chapterId)
        const chapters = replaceAt(withoutCatalogPage.chapters, {
          ...chapter,
          pageIds: insertAt(chapter.pageIds, page.id, insertionIndex),
          entries: insertAt(chapter.entries, { kind: SCENARIO_ENTRY_KIND.PAGE, pageId: page.id }, insertionIndex),
        }, (candidate) => candidate.id === chapter.id)
        return this.withPage(this.withData({ ...withoutCatalogPage.data, chapters }), { ...page, chapterId: chapter.id })
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

  /** Replaces one parent's entries and keeps its direct page index synchronized. */
  private replaceEntriesAtParent(
    document: LearningDocument,
    parentChapterId: ChapterId | null,
    entries: LearningChapter['entries'],
  ): LearningDocument {
    if (parentChapterId === null) return this.withData({ ...document.data, scenarioEntries: entries })
    const parent = findChapter(document.chapters, parentChapterId)
    const chapter = { ...parent, entries, pageIds: entries.flatMap((entry) => entry.kind === SCENARIO_ENTRY_KIND.PAGE ? [entry.pageId] : []) }
    return this.withData({
      ...document.data,
      chapters: replaceAt(document.chapters, chapter, (candidate) => candidate.id === parent.id),
    })
  }

  /** Removes a page entry from every ordered scenario collection. */
  private removePageFromScenario(document: LearningDocument, pageId: PageId): LearningDocument {
    const chapters = document.chapters.map((chapter) => {
      const entries = chapter.entries.filter((entry) => entry.kind !== SCENARIO_ENTRY_KIND.PAGE || entry.pageId !== pageId)
      return {
        ...chapter,
        entries,
        pageIds: entries.flatMap((entry) => entry.kind === SCENARIO_ENTRY_KIND.PAGE ? [entry.pageId] : []),
      }
    })
    return this.withData({
      ...document.data,
      chapters,
      scenarioEntries: document.data.scenarioEntries.filter((entry) => entry.kind !== SCENARIO_ENTRY_KIND.PAGE || entry.pageId !== pageId),
    })
  }

  /** Collects a chapter and every nested chapter beneath it. */
  private chapterSubtreeIds(document: LearningDocument, chapterId: ChapterId): ReadonlySet<ChapterId> {
    const chaptersById = new Map(document.chapters.map((chapter) => [chapter.id, chapter]))
    const chapterIds = new Set<ChapterId>()
    const visit = (currentId: ChapterId): void => {
      if (chapterIds.has(currentId)) return
      chapterIds.add(currentId)
      chaptersById.get(currentId)?.entries.forEach((entry) => {
        if (entry.kind === SCENARIO_ENTRY_KIND.CHAPTER) visit(entry.chapterId)
      })
    }
    visit(chapterId)
    return chapterIds
  }

  /** Finds the deepest number of chapter levels contained by a chapter. */
  private chapterSubtreeHeight(document: LearningDocument, chapterId: ChapterId): number {
    const chaptersById = new Map(document.chapters.map((chapter) => [chapter.id, chapter]))
    const chapter = chaptersById.get(chapterId)
    if (chapter === undefined) return 0
    const childHeights = chapter.entries.flatMap((entry) => entry.kind === SCENARIO_ENTRY_KIND.CHAPTER
      ? [this.chapterSubtreeHeight(document, entry.chapterId)]
      : [])
    return 1 + Math.max(0, ...childHeights)
  }

  /** Reports whether a page is part of an Evaluation chapter. */
  public static pageBelongsToEvaluationChapter(document: LearningDocument, page: LearningPage): boolean {
    const chapter = page.chapterId === null ? undefined : document.chapters.find((candidate) => candidate.id === page.chapterId)
    return chapter?.type === CHAPTER_TYPE.EVALUATION
  }
}

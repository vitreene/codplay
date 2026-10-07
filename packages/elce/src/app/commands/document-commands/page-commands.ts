import { BDC_LOCATION, BDC_TYPE, CHAPTER_TYPE, CHAPTER_TYPE_CONFIG, DEFAULT_EVALUATION_SETTINGS, DEFAULT_PRESET_ID, PAGE_LOCATION, PAGE_TYPE, SCENARIO_ENTRY_KIND } from '../../../config/document-config'
import { ElceDocument, nextPageName } from '../../../domain/document/document-model'
import type { Bdc, Chapter, ChapterId, Page, PageId } from '../../../domain/document/document-types'
import type { DocumentCommand } from '../document-command-types'
import { fail, withPage, placePage, placeBdc, findChapter, scenarioEntryIndexForChapter, indexAtEndOrRequested, insertAt, findPage, removeValue, removeScenarioPageEntry } from './command-helpers'
import { createBdc, sectionForBdc, questionForBdc, deleteBdc } from './bdc-commands'

/** Creates a page and its configured initial BDCs at the requested placement. */
export function createPage(document: ElceDocument, command: Extract<DocumentCommand, { type: 'page.create' }>): ElceDocument {
  if (document.pages.some((page) => page.id === command.pageId)) fail(`Page déjà présente : ${command.pageId}`)
  if (document.bdcs.some((bdc) => bdc.id === command.bdcId)) fail(`Bdc déjà présent : ${command.bdcId}`)
  const page: Page = {
    id: command.pageId,
    name: command.name?.trim() || nextPageName(document),
    type: command.pageType ?? PAGE_TYPE.FLUX,
    chapterId: null,
    bdcIds: [],
  }
  const withPage = placePage(new ElceDocument({ ...document.data, pages: [...document.pages, page] }), page, command.placement)
  switch (page.type) {
    case PAGE_TYPE.DIAPO:
      if (command.defaultBdcType !== undefined || command.initialCardBdcId === undefined) {
        fail('Une page Diapo reçoit un BDC Carousel initial et sa première carte identifiée.')
      }
      return createBdc(withPage, {
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
      const initialBdc: Bdc = {
        id: command.bdcId,
        type: initialBdcType,
        presetId: initialPageBdcPreset(initialBdcType),
        pageId: page.id,
        parentBdcId: null,
        section: sectionForBdc(initialBdcType, command.bdcId),
        question: questionForBdc(initialBdcType),
        evaluationResult: null,
        carousel: null,
        card: null,
      }
      const withEntities = new ElceDocument({ ...withPage.data, bdcs: [...withPage.bdcs, initialBdc] })
      return placeBdc(withEntities, initialBdc, { kind: BDC_LOCATION.PAGE, pageId: page.id })
    }
    default:
      return fail(`Type de page non pris en charge : ${page.type}`)
  }
}

/** Returns the configured preset for the only BDC types used to seed new pages. */
function initialPageBdcPreset(type: typeof BDC_TYPE.SECTION | typeof BDC_TYPE.QUESTION): string {
  switch (type) {
    case BDC_TYPE.SECTION:
      return DEFAULT_PRESET_ID.SECTION
    case BDC_TYPE.QUESTION:
      return DEFAULT_PRESET_ID.QUESTION
  }
}

/** Creates a chapter entry with its default evaluation settings when needed. */
export function createChapter(document: ElceDocument, command: Extract<DocumentCommand, { type: 'chapter.create' }>): ElceDocument {
  if (document.chapters.some((chapter) => chapter.id === command.chapterId)) fail(`Chapitre déjà présent : ${command.chapterId}`)
  const chapter: Chapter = {
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
  return new ElceDocument({
    ...document.data,
    chapters: [...document.chapters, chapter],
    scenarioEntries: [...document.data.scenarioEntries, { kind: SCENARIO_ENTRY_KIND.CHAPTER, chapterId: chapter.id }],
  })
}

/** Deletes an empty chapter and its root scenario entry. */
export function deleteChapter(document: ElceDocument, chapterId: ChapterId): ElceDocument {
  const chapter = findChapter(document, chapterId)
  if (chapter.pageIds.length > 0) fail(`Impossible de supprimer un chapitre non vide : ${chapterId}`)
  return new ElceDocument({
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

/** Reorders one chapter entry without changing its pages or document identity. */
export function moveChapter(document: ElceDocument, chapterId: ChapterId, requestedIndex: number | undefined): ElceDocument {
  const chapter = findChapter(document, chapterId)
  const sourceIndex = scenarioEntryIndexForChapter(document, chapter.id)
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
  return new ElceDocument({
    ...document.data,
    scenarioEntries: insertAt(scenarioEntries, { kind: SCENARIO_ENTRY_KIND.CHAPTER, chapterId: chapter.id }, insertionIndex),
  })
}

/** Applies a page's requested chapter, root, or catalogue placement. */
export function movePage(document: ElceDocument, command: Extract<DocumentCommand, { type: 'page.move' }>): ElceDocument {
  return placePage(document, findPage(document, command.pageId), command.placement)
}

/** Permanently deletes a page and its BDCs after detaching its placement. */
export function deletePage(document: ElceDocument, pageId: PageId): ElceDocument {
  const page = findPage(document, pageId)
  let detached = movePage(document, { type: 'page.move', pageId, placement: { kind: PAGE_LOCATION.CATALOG } })
  for (const bdcId of page.bdcIds) detached = deleteBdc(detached, bdcId)
  return new ElceDocument({
    ...detached.data,
    chapters: detached.chapters.map((chapter) => ({ ...chapter, pageIds: removeValue(chapter.pageIds, pageId) })),
    pages: detached.pages.filter((candidate) => candidate.id !== pageId),
    scenarioEntries: removeScenarioPageEntry(detached, pageId),
    catalogPageIds: removeValue(detached.data.catalogPageIds, pageId),
  })
}

/** Renames one page without changing its placement or content. */
export function renamePage(document: ElceDocument, pageId: PageId, requestedName: string): ElceDocument {
  const page = findPage(document, pageId)
  const name = requestedName.trim()
  if (name.length === 0) fail(`Le nom de la page ne peut pas être vide : ${pageId}`)
  return withPage(document, { ...page, name })
}

/** Renames one chapter without changing its type or page order. */
export function renameChapter(document: ElceDocument, chapterId: ChapterId, requestedName: string): ElceDocument {
  const chapter = findChapter(document, chapterId)
  const name = requestedName.trim()
  if (name.length === 0) fail(`Le nom du chapitre ne peut pas être vide : ${chapterId}`)
  return new ElceDocument({
    ...document.data,
    chapters: document.chapters.map((candidate) => candidate.id === chapter.id
      ? { ...chapter, name }
      : candidate),
  })
}

/** Stores editable Evaluation chapter options through the document command path. */
export function updateChapterEvaluationSettings(
  document: ElceDocument,
  command: Extract<DocumentCommand, { type: 'chapter.evaluation.settings.update' }>,
): ElceDocument {
  const chapter = findChapter(document, command.chapterId)
  if (chapter.type !== CHAPTER_TYPE.EVALUATION) fail(`Les réglages d’évaluation ne s’appliquent pas au chapitre ${command.chapterId}`)
  if (command.attemptLimit !== null && (!Number.isInteger(command.attemptLimit) || command.attemptLimit < 1)) {
    fail('La limite de tentatives doit être un entier positif ou illimitée')
  }
  return new ElceDocument({
    ...document.data,
    chapters: document.chapters.map((candidate) => candidate.id === chapter.id
      ? {
          ...chapter,
          evaluationAttemptLimit: command.attemptLimit,
          evaluationRetryScope: command.retryScope,
        }
      : candidate),
  })
}

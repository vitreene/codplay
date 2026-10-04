import {
  BDC_LOCATION,
  BDC_TYPE,
  CHAPTER_TYPE,
  CHAPTER_TYPE_CONFIG,
  DEFAULT_EVALUATION_SETTINGS,
  DEFAULT_PRESET_ID,
  MEDIA_TYPE,
  PAGE_LOCATION,
  PAGE_TYPE,
  SCENARIO_ENTRY_KIND,
} from '../../config/document-config'
import type { BdcType, MediaType } from '../../config/document-config-types'
import {
  createEmptyRichTextDocument,
  ElceDocument,
  nextChapterName,
  nextPageName,
  createStableId,
} from '../../domain/document-model'
import { ElceAnchorReferenceService } from '../../domain/anchor-reference-service'
import { ElceQuestionService } from '../../domain/question-service'
import { ElceEvaluationResultService } from '../../domain/evaluation/evaluation-result-service'
import { ElceCarouselService } from '../../domain/carousel-service'
import type { EvaluationResultContent } from '../../domain/evaluation/evaluation-result-types'
import type { CarouselContent } from '../../domain/carousel-types'
import type { Bdc, BdcId, Chapter, ChapterId, MediaId, MediaMetadata, Page, PageId, RichTextDocument } from '../../domain/document-types'
import type { BdcPlacement, CreatePageCommandInput, DocumentCommand, PagePlacement } from './document-command-types'

const anchorReferenceService = new ElceAnchorReferenceService()
const questionService = new ElceQuestionService()
const evaluationResultService = new ElceEvaluationResultService()
const carouselService = new ElceCarouselService()

/** Creates a page command while keeping identifier generation outside rendering. */
export function createPageCommand(input: CreatePageCommandInput): Extract<DocumentCommand, { type: 'page.create' }> {
  return { type: 'page.create', ...input }
}

/** Creates a default Flux page command at the requested document location. */
export function createDefaultPageCommand(
  document: ElceDocument,
  placement: PagePlacement,
  name?: string,
): Extract<DocumentCommand, { type: 'page.create' }> {
  return createPageCommand({
    pageId: createStableId('page'),
    bdcId: createStableId('bdc'),
    defaultBdcType: defaultBdcTypeForPlacement(document, placement),
    name,
    placement,
  })
}

/** Selects the initial page-content BDC from the explicitly requested chapter. */
function defaultBdcTypeForPlacement(document: ElceDocument, placement: PagePlacement) {
  switch (placement.kind) {
    case PAGE_LOCATION.CHAPTER:
      return CHAPTER_TYPE_CONFIG[findChapter(document, placement.chapterId).type].defaultBdcType
    case PAGE_LOCATION.SCENARIO:
    case PAGE_LOCATION.CATALOG:
      return CHAPTER_TYPE_CONFIG[CHAPTER_TYPE.STANDARD].defaultBdcType
  }
}

/** Creates a chapter command with a stable generated identifier and a readable fallback name. */
export function createChapterCommand(
  document: ElceDocument,
  name?: string,
  chapterType: Chapter['type'] = CHAPTER_TYPE.STANDARD,
): Extract<DocumentCommand, { type: 'chapter.create' }> {
  return {
    type: 'chapter.create',
    chapterId: createStableId('chapter'),
    name: name?.trim() || nextChapterName(document, chapterType),
    chapterType,
  }
}

/** Creates the command that moves a chapter among root scenario entries. */
export function createChapterMoveCommand(
  chapterId: ChapterId,
  index?: number,
): Extract<DocumentCommand, { type: 'chapter.move' }> {
  return { type: 'chapter.move', chapterId, index }
}

/** Creates the command used to move a page between the document's page collections. */
export function createPageMoveCommand(
  pageId: PageId,
  placement: PagePlacement,
): Extract<DocumentCommand, { type: 'page.move' }> {
  return { type: 'page.move', pageId, placement }
}

/** Creates the command that sends a page to the catalogue without deleting it. */
export function createPageRemoveCommand(pageId: PageId): Extract<DocumentCommand, { type: 'page.remove' }> {
  return { type: 'page.remove', pageId }
}

/** Creates the command that permanently deletes a page and its bdc. */
export function createPageDeleteCommand(pageId: PageId): Extract<DocumentCommand, { type: 'page.delete' }> {
  return { type: 'page.delete', pageId }
}

/** Creates the single Question block at an explicit position in one page flow. */
export function createQuestionBdcCommand(
  bdcId: BdcId,
  pageId: PageId,
  index: number,
): Extract<DocumentCommand, { type: 'bdc.create' }> {
  return {
    type: 'bdc.create',
    bdcId,
    bdcType: BDC_TYPE.QUESTION,
    presetId: DEFAULT_PRESET_ID.QUESTION,
    placement: { kind: BDC_LOCATION.PAGE, pageId, index },
  }
}

/** Creates a default text BDC at its requested position in a Flux page. */
export function createSectionBdcCommand(
  bdcId: BdcId,
  pageId: PageId,
  index: number,
): Extract<DocumentCommand, { type: 'bdc.create' }> {
  return {
    type: 'bdc.create',
    bdcId,
    bdcType: BDC_TYPE.SECTION,
    presetId: DEFAULT_PRESET_ID.SECTION,
    placement: { kind: BDC_LOCATION.PAGE, pageId, index },
  }
}

/** Creates the single BDC type that contains both evaluation outcome branches. */
export function createEvaluationResultBdcCommand(
  bdcId: BdcId,
  pageId: PageId,
  index: number,
): Extract<DocumentCommand, { type: 'bdc.create' }> {
  return {
    type: 'bdc.create',
    bdcId,
    bdcType: BDC_TYPE.EVALUATION_RESULT,
    presetId: DEFAULT_PRESET_ID.EVALUATION_RESULT,
    placement: { kind: BDC_LOCATION.PAGE, pageId, index },
  }
}

/** Creates one Carousel BDC at its explicit position in a Flux page. */
export function createCarouselBdcCommand(
  bdcId: BdcId,
  pageId: PageId,
  index: number,
): Extract<DocumentCommand, { type: 'bdc.create' }> {
  return {
    type: 'bdc.create',
    bdcId,
    bdcType: BDC_TYPE.CAROUSEL,
    presetId: DEFAULT_PRESET_ID.CAROUSEL,
    placement: { kind: BDC_LOCATION.PAGE, pageId, index },
  }
}

function fail(message: string): never {
  throw new Error(message)
}

function indexAtEndOrRequested(length: number, index: number | undefined): number {
  return Math.max(0, Math.min(index ?? length, length))
}

function insertAt<T>(values: readonly T[], value: T, index: number | undefined): readonly T[] {
  const result = [...values]
  result.splice(indexAtEndOrRequested(result.length, index), 0, value)
  return result
}

function removeValue<T>(values: readonly T[], value: T): readonly T[] {
  return values.filter((candidate) => candidate !== value)
}

/** Removes one standalone page from the root scenario sequence. */
function removeScenarioPageEntry(document: ElceDocument, pageId: PageId) {
  return document.data.scenarioEntries.filter((entry) => {
    switch (entry.kind) {
      case SCENARIO_ENTRY_KIND.PAGE:
        return entry.pageId !== pageId
      case SCENARIO_ENTRY_KIND.CHAPTER:
        return true
    }
  })
}

/** Returns a standalone page's root entry position when it already has one. */
function scenarioEntryIndexForPage(document: ElceDocument, pageId: PageId): number | undefined {
  const index = document.data.scenarioEntries.findIndex((entry) => {
    switch (entry.kind) {
      case SCENARIO_ENTRY_KIND.PAGE:
        return entry.pageId === pageId
      case SCENARIO_ENTRY_KIND.CHAPTER:
        return false
    }
  })
  return index < 0 ? undefined : index
}

/** Returns one chapter's root entry position. */
function scenarioEntryIndexForChapter(document: ElceDocument, chapterId: ChapterId): number {
  const index = document.data.scenarioEntries.findIndex((entry) => {
    switch (entry.kind) {
      case SCENARIO_ENTRY_KIND.PAGE:
        return false
      case SCENARIO_ENTRY_KIND.CHAPTER:
        return entry.chapterId === chapterId
    }
  })
  return index < 0 ? fail(`Entrée de chapitre absente : ${chapterId}`) : index
}

function sourceIndexForPlacement(
  document: ElceDocument,
  page: Page,
  placement: PagePlacement,
): number | undefined {
  switch (placement.kind) {
    case PAGE_LOCATION.CATALOG:
      return undefined
    case PAGE_LOCATION.SCENARIO: {
      switch (page.chapterId) {
        case null:
          return scenarioEntryIndexForPage(document, page.id)
        default:
          return undefined
      }
    }
    case PAGE_LOCATION.CHAPTER: {
      if (page.chapterId !== placement.chapterId) return undefined
      const chapter = document.chapters.find((candidate) => candidate.id === placement.chapterId)
      if (chapter === undefined) return undefined
      const sourceIndex = chapter.pageIds.indexOf(page.id)
      return sourceIndex < 0 ? undefined : sourceIndex
    }
  }
}

function indexAfterPageRemoval(
  document: ElceDocument,
  page: Page,
  placement: PagePlacement,
): number | undefined {
  const requestedIndex = pageIndexForPlacement(placement)
  const sourceIndex = sourceIndexForPlacement(document, page, placement)
  if (requestedIndex === undefined || sourceIndex === undefined || sourceIndex >= requestedIndex) return requestedIndex
  return requestedIndex - 1
}

function pageIndexForPlacement(placement: PagePlacement): number | undefined {
  switch (placement.kind) {
    case PAGE_LOCATION.CATALOG:
      return undefined
    case PAGE_LOCATION.SCENARIO:
    case PAGE_LOCATION.CHAPTER:
      return placement.index
  }
}

function replaceAt<T>(values: readonly T[], value: T, predicate: (candidate: T) => boolean): readonly T[] {
  return values.map((candidate) => (predicate(candidate) ? value : candidate))
}

function findPage(document: ElceDocument, pageId: PageId): Page {
  return document.pages.find((page) => page.id === pageId) ?? fail(`Page inconnue : ${pageId}`)
}

/** Finds a Flux page, which is the only page type that can own anchored text. */
function findFluxPage(document: ElceDocument, pageId: PageId): Page {
  const page = findPage(document, pageId)
  switch (page.type) {
    case PAGE_TYPE.FLUX:
      return page
    default:
      fail(`La page ${pageId} ne peut pas accueillir une ancre de texte.`)
  }
}

function findBdc(document: ElceDocument, bdcId: BdcId): Bdc {
  return document.bdcs.find((bdc) => bdc.id === bdcId) ?? fail(`Bdc inconnu : ${bdcId}`)
}

function findChapter(document: ElceDocument, chapterId: ChapterId): Chapter {
  return document.chapters.find((chapter) => chapter.id === chapterId) ?? fail(`Chapitre inconnu : ${chapterId}`)
}

function sectionForBdc(type: BdcType, bdcId: BdcId): Bdc['section'] {
  switch (type) {
    case BDC_TYPE.SECTION:
      return { title: '', markup: `<p id="${bdcId}-text"></p>`, content: createEmptyRichTextDocument() }
    default:
      return null
  }
}

/** Creates the configured authored Question value for a new Question BDC. */
function questionForBdc(type: BdcType): Bdc['question'] {
  switch (type) {
    case BDC_TYPE.QUESTION:
      return questionService.createDefault()
    default:
      return null
  }
}

/** Creates the two empty outcome branches for a new result BDC. */
function evaluationResultForBdc(type: BdcType): NonNullable<Bdc['evaluationResult']> | null {
  switch (type) {
    case BDC_TYPE.EVALUATION_RESULT:
      return evaluationResultService.createDefault()
    default:
      return null
  }
}

/** Creates the initial Carousel payload only for a Carousel BDC. */
function carouselForBdc(type: BdcType): CarouselContent | null {
  switch (type) {
    case BDC_TYPE.CAROUSEL:
      return carouselService.createDefault()
    default:
      return null
  }
}

function withPage(document: ElceDocument, page: Page): ElceDocument {
  return new ElceDocument({ ...document.data, pages: replaceAt(document.pages, page, (candidate) => candidate.id === page.id) })
}

function withBdc(document: ElceDocument, bdc: Bdc): ElceDocument {
  return new ElceDocument({ ...document.data, bdcs: replaceAt(document.bdcs, bdc, (candidate) => candidate.id === bdc.id) })
}

function placePage(document: ElceDocument, page: Page, placement: PagePlacement): ElceDocument {
  const insertionIndex = indexAfterPageRemoval(document, page, placement)
  const withoutPage = new ElceDocument({
    ...document.data,
    chapters: document.chapters.map((chapter) => ({ ...chapter, pageIds: removeValue(chapter.pageIds, page.id) })),
    scenarioEntries: removeScenarioPageEntry(document, page.id),
    catalogPageIds: removeValue(document.data.catalogPageIds, page.id),
  })
  switch (placement.kind) {
    case PAGE_LOCATION.CATALOG:
      return withPage(
        new ElceDocument({ ...withoutPage.data, catalogPageIds: [...withoutPage.data.catalogPageIds, page.id] }),
        { ...page, chapterId: null },
      )
    case PAGE_LOCATION.SCENARIO: {
      const scenarioEntries = insertAt(
        withoutPage.data.scenarioEntries,
        { kind: SCENARIO_ENTRY_KIND.PAGE, pageId: page.id },
        insertionIndex,
      )
      return withPage(new ElceDocument({ ...withoutPage.data, scenarioEntries }), { ...page, chapterId: null })
    }
    case PAGE_LOCATION.CHAPTER: {
      const chapter = findChapter(withoutPage, placement.chapterId)
      const chapters = replaceAt(
        withoutPage.chapters,
        { ...chapter, pageIds: insertAt(chapter.pageIds, page.id, insertionIndex) },
        (candidate) => candidate.id === chapter.id,
      )
      return withPage(new ElceDocument({ ...withoutPage.data, chapters }), { ...page, chapterId: chapter.id })
    }
  }
}

function placeBdc(document: ElceDocument, bdc: Bdc, placement: BdcPlacement): ElceDocument {
  const withoutBdc = new ElceDocument({
    ...document.data,
    pages: document.pages.map((page) => ({ ...page, bdcIds: removeValue(page.bdcIds, bdc.id) })),
    catalogBdcIds: removeValue(document.data.catalogBdcIds, bdc.id),
  })
  switch (placement.kind) {
    case BDC_LOCATION.CATALOG:
      return withBdc(new ElceDocument({ ...withoutBdc.data, catalogBdcIds: [...withoutBdc.data.catalogBdcIds, bdc.id] }), {
        ...bdc,
        pageId: null,
      })
    case BDC_LOCATION.PAGE: {
      const page = findPage(withoutBdc, placement.pageId)
      const pages = replaceAt(
        withoutBdc.pages,
        { ...page, bdcIds: insertAt(page.bdcIds, bdc.id, placement.index) },
        (candidate) => candidate.id === page.id,
      )
      return withBdc(new ElceDocument({ ...withoutBdc.data, pages }), { ...bdc, pageId: page.id })
    }
  }
}

/** Deletes the unique bdc for a removed anchor and preserves its separate media resource. */
function deleteBdc(document: ElceDocument, bdcId: BdcId): ElceDocument {
  const bdc = findBdc(document, bdcId)
  return new ElceDocument({
    ...document.data,
    pages: document.pages.map((page) => ({ ...page, bdcIds: removeValue(page.bdcIds, bdc.id) })),
    bdcs: document.bdcs.filter((candidate) => candidate.id !== bdc.id),
    catalogBdcIds: removeValue(document.data.catalogBdcIds, bdc.id),
  })
}

/** Permanently deletes an unused catalog bdc while retaining its media resource. */
function deleteCatalogBdc(document: ElceDocument, bdcId: BdcId): ElceDocument {
  const bdc = findBdc(document, bdcId)
  switch (bdc.pageId) {
    case null:
      break
    default:
      fail(`Le bdc ${bdcId} est utilisé par une page et ne peut pas être supprimé du catalogue.`)
  }
  switch (document.data.catalogBdcIds.includes(bdc.id)) {
    case true:
      return deleteBdc(document, bdc.id)
    case false:
      fail(`Le bdc ${bdcId} n’est pas disponible dans le catalogue.`)
  }
}

function createPage(document: ElceDocument, command: Extract<DocumentCommand, { type: 'page.create' }>): ElceDocument {
  if (document.pages.some((page) => page.id === command.pageId)) fail(`Page déjà présente : ${command.pageId}`)
  if (document.bdcs.some((bdc) => bdc.id === command.bdcId)) fail(`Bdc déjà présent : ${command.bdcId}`)
  const initialBdcType = command.defaultBdcType ?? CHAPTER_TYPE_CONFIG[CHAPTER_TYPE.STANDARD].defaultBdcType
  const page: Page = {
    id: command.pageId,
    name: command.name?.trim() || nextPageName(document),
    type: command.pageType ?? PAGE_TYPE.FLUX,
    chapterId: null,
    bdcIds: [],
  }
  const initialBdc: Bdc = {
    id: command.bdcId,
    type: initialBdcType,
    presetId: initialPageBdcPreset(initialBdcType),
    pageId: page.id,
    mediaId: null,
    section: sectionForBdc(initialBdcType, command.bdcId),
    question: questionForBdc(initialBdcType),
    evaluationResult: null,
    carousel: carouselForBdc(initialBdcType),
  }
  const withEntities = new ElceDocument({ ...document.data, pages: [...document.pages, page], bdcs: [...document.bdcs, initialBdc] })
  return placeBdc(
    placePage(withEntities, page, command.placement),
    initialBdc,
    { kind: BDC_LOCATION.PAGE, pageId: page.id },
  )
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

function createChapter(document: ElceDocument, command: Extract<DocumentCommand, { type: 'chapter.create' }>): ElceDocument {
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

function deleteChapter(document: ElceDocument, chapterId: ChapterId): ElceDocument {
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
function moveChapter(document: ElceDocument, chapterId: ChapterId, requestedIndex: number | undefined): ElceDocument {
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

function createBdc(document: ElceDocument, command: Extract<DocumentCommand, { type: 'bdc.create' }>): ElceDocument {
  if (document.bdcs.some((bdc) => bdc.id === command.bdcId)) fail(`Bdc déjà présent : ${command.bdcId}`)
  switch (command.bdcType) {
    case BDC_TYPE.CAROUSEL:
      if (command.presetId !== DEFAULT_PRESET_ID.CAROUSEL || command.mediaId !== undefined) {
        fail('Un BDC Carousel utilise son preset configuré et référence les médias depuis ses vues.')
      }
      switch (command.placement.kind) {
        case BDC_LOCATION.PAGE: {
          const page = findPage(document, command.placement.pageId)
          switch (page.type) {
            case PAGE_TYPE.FLUX:
              break
            case PAGE_TYPE.DIAPO:
              fail('Un BDC Carousel est créé dans une page Flux pendant cette tranche.')
          }
          break
        }
        case BDC_LOCATION.CATALOG:
          fail('Un BDC Carousel est créé directement dans une page Flux.')
      }
      break
    case BDC_TYPE.EVALUATION_RESULT:
      if (command.presetId !== DEFAULT_PRESET_ID.EVALUATION_RESULT || command.mediaId !== undefined) {
        fail('Un BDC Résultat utilise son preset configuré et ne reçoit pas de média direct.')
      }
      switch (command.placement.kind) {
        case BDC_LOCATION.PAGE: {
          const page = findPage(document, command.placement.pageId)
          switch (page.type) {
            case PAGE_TYPE.FLUX:
              break
            case PAGE_TYPE.DIAPO:
              fail('Un BDC Résultat ne peut être créé que dans une page Flux.')
          }
          break
        }
        case BDC_LOCATION.CATALOG:
          fail('Un BDC Résultat est créé directement dans une page Flux.')
      }
      break
    case BDC_TYPE.QUESTION: {
      if (command.presetId !== DEFAULT_PRESET_ID.QUESTION || command.mediaId !== undefined) {
        fail('Une Question utilise son preset configuré et reçoit un média par sa zone Illustration.')
      }
      switch (command.placement.kind) {
        case BDC_LOCATION.PAGE: {
          const page = findPage(document, command.placement.pageId)
          switch (page.type) {
            case PAGE_TYPE.FLUX:
              break
            case PAGE_TYPE.DIAPO:
              fail('Une Question ne peut être créée que dans une page Flux.')
          }
          break
        }
        case BDC_LOCATION.CATALOG:
          fail('Un bdc Question est créé directement dans une page Flux.')
      }
      break
    }
    default:
      break
  }
  const bdc: Bdc = {
    id: command.bdcId,
    type: command.bdcType,
    presetId: command.presetId,
    pageId: null,
    mediaId: command.mediaId ?? null,
    section: sectionForBdc(command.bdcType, command.bdcId),
    question: questionForBdc(command.bdcType),
    evaluationResult: evaluationResultForBdc(command.bdcType),
    carousel: carouselForBdc(command.bdcType),
  }
  return placeBdc(new ElceDocument({ ...document.data, bdcs: [...document.bdcs, bdc] }), bdc, command.placement)
}

/** Updates Question text and response definitions through a single command. */
function updateQuestion(document: ElceDocument, bdcId: BdcId, question: NonNullable<Bdc['question']>): ElceDocument {
  const bdc = findBdc(document, bdcId)
  switch (bdc.type) {
    case BDC_TYPE.QUESTION:
      if (bdc.question === null) fail(`Bdc Question incomplet : ${bdcId}`)
      break
    default:
      fail(`Le bdc ${bdcId} n’est pas une Question.`)
  }
  questionService.assertValid(question)
  return withBdc(document, { ...bdc, question })
}

/** Updates both outcome branches through the document command path. */
function updateEvaluationResult(document: ElceDocument, bdcId: BdcId, evaluationResult: EvaluationResultContent): ElceDocument {
  const bdc = findBdc(document, bdcId)
  switch (bdc.type) {
    case BDC_TYPE.EVALUATION_RESULT:
      if (bdc.evaluationResult === null || bdc.evaluationResult === undefined) {
        fail(`Bdc Résultat incomplet : ${bdcId}`)
      }
      break
    default:
      fail(`Le bdc ${bdcId} n’est pas un Résultat d’évaluation.`)
  }
  evaluationResultService.assertValid(evaluationResult)
  return withBdc(document, { ...bdc, evaluationResult })
}

/** Updates one unique Carousel BDC through the document command boundary. */
function updateCarousel(document: ElceDocument, bdcId: BdcId, carousel: CarouselContent): ElceDocument {
  const bdc = findBdc(document, bdcId)
  switch (bdc.type) {
    case BDC_TYPE.CAROUSEL:
      if (bdc.carousel === null || bdc.carousel === undefined) fail(`Bdc Carousel incomplet : ${bdcId}`)
      break
    default:
      fail(`Le bdc ${bdcId} n’est pas un Carousel.`)
  }
  const normalizedCarousel = normalizeTextShortMediaReferences(document, carousel)
  carouselService.assertValid(normalizedCarousel)
  const updatedBdc = { ...bdc, carousel: normalizedCarousel }
  assertCarouselMediaReferences(document, updatedBdc)
  return withBdc(document, updatedBdc)
}

/** Keeps hidden image references on Text-short views but drops unsupported video references. */
function normalizeTextShortMediaReferences(document: ElceDocument, carousel: CarouselContent): CarouselContent {
  return {
    ...carousel,
    views: carousel.views.map((view) => {
      switch (view.presetId) {
        case DEFAULT_PRESET_ID.TEXT_SHORT:
          switch (view.mediaId === null ? null : document.medias.find((media) => media.id === view.mediaId)?.type) {
            case MEDIA_TYPE.VIDEO:
              return { ...view, mediaId: null }
            default:
              return view
          }
        case DEFAULT_PRESET_ID.PHOTO:
        case DEFAULT_PRESET_ID.IMAGE_CAPTION:
        case DEFAULT_PRESET_ID.TEXT_IMAGE:
          return view
      }
    }),
  }
}

/** Attaches one existing reusable media resource to a Carousel view. */
function setCarouselMedia(document: ElceDocument, bdcId: BdcId, viewId: string, mediaId: MediaId | null): ElceDocument {
  const bdc = findBdc(document, bdcId)
  switch (bdc.type) {
    case BDC_TYPE.CAROUSEL:
      if (bdc.carousel === null || bdc.carousel === undefined) fail(`Bdc Carousel incomplet : ${bdcId}`)
      break
    default:
      fail(`Le bdc ${bdcId} n’est pas un Carousel.`)
  }
  const carousel = carouselService.setMedia(bdc.carousel, viewId, mediaId)
  assertCarouselMediaReferences(document, { ...bdc, carousel })
  return withBdc(document, { ...bdc, carousel })
}

/** Stores imported media and its Carousel-view reference in one document command. */
function attachCarouselMedia(document: ElceDocument, bdcId: BdcId, viewId: string, media: MediaMetadata): ElceDocument {
  if (document.medias.some((candidate) => candidate.id === media.id)) fail(`Média déjà présent : ${media.id}`)
  const withMedia = new ElceDocument({ ...document.data, medias: [...document.medias, media] })
  return setCarouselMedia(withMedia, bdcId, viewId, media.id)
}

/** Checks that every Carousel media reference targets an allowed catalogue resource. */
function assertCarouselMediaReferences(document: ElceDocument, bdc: Bdc): void {
  if (bdc.carousel === null || bdc.carousel === undefined) fail(`Bdc Carousel incomplet : ${bdc.id}`)
  for (const view of bdc.carousel.views) {
    if (view.mediaId === null) continue
    const media = document.medias.find((candidate) => candidate.id === view.mediaId)
    switch (media?.type) {
      case MEDIA_TYPE.IMAGE:
        break
      case MEDIA_TYPE.VIDEO:
        if (view.presetId !== DEFAULT_PRESET_ID.PHOTO) {
          fail(`La vue ${view.id} de type ${view.presetId} accepte seulement une image.`)
        }
        break
      default:
        fail(`Le média ${view.mediaId} ne peut pas être placé dans la vue ${view.id}.`)
    }
  }
}

/** Permanently removes one Carousel BDC while keeping its reusable media resources. */
function deleteCarousel(document: ElceDocument, bdcId: BdcId): ElceDocument {
  const bdc = findBdc(document, bdcId)
  switch (bdc.type) {
    case BDC_TYPE.CAROUSEL:
      return deleteBdc(document, bdc.id)
    default:
      fail(`Seul un bdc Carousel peut être supprimé par cette commande : ${bdcId}`)
  }
}

/** Assigns a reusable image or video resource to the Question illustration. */
function setQuestionMedia(document: ElceDocument, bdcId: BdcId, mediaId: MediaId | null): ElceDocument {
  const bdc = findBdc(document, bdcId)
  switch (bdc.type) {
    case BDC_TYPE.QUESTION:
      if (bdc.question === null) fail(`Bdc Question incomplet : ${bdcId}`)
      break
    default:
      fail(`Le bdc ${bdcId} n’est pas une Question.`)
  }
  if (mediaId !== null) {
    assertQuestionMediaAllowed(document, mediaId)
  }
  return withBdc(document, { ...bdc, mediaId })
}

/** Adds an imported media resource and attaches it to one Question atomically. */
function attachQuestionMedia(document: ElceDocument, bdcId: BdcId, media: MediaMetadata): ElceDocument {
  if (document.medias.some((candidate) => candidate.id === media.id)) fail(`Média déjà présent : ${media.id}`)
  const withMedia = new ElceDocument({ ...document.data, medias: [...document.medias, media] })
  return setQuestionMedia(withMedia, bdcId, media.id)
}

/** Permanently removes one Question BDC and preserves its reusable illustration. */
function deleteQuestion(document: ElceDocument, bdcId: BdcId): ElceDocument {
  const bdc = findBdc(document, bdcId)
  switch (bdc.type) {
    case BDC_TYPE.QUESTION:
      return deleteBdc(document, bdc.id)
    default:
      fail(`Seul un bdc Question peut être supprimé par cette commande : ${bdcId}`)
  }
}

/** Permanently removes one Result BDC from its page. */
function deleteEvaluationResult(document: ElceDocument, bdcId: BdcId): ElceDocument {
  const bdc = findBdc(document, bdcId)
  switch (bdc.type) {
    case BDC_TYPE.EVALUATION_RESULT:
      return deleteBdc(document, bdc.id)
    default:
      fail(`Seul un bdc Résultat peut être supprimé par cette commande : ${bdcId}`)
  }
}

/** Permanently deletes a Section and its anchored bdcs while retaining media. */
function deleteSection(document: ElceDocument, bdcId: BdcId): ElceDocument {
  const section = findBdc(document, bdcId)
  switch (section.type) {
    case BDC_TYPE.SECTION:
      break
    default:
      fail(`Seul un bdc texte peut être supprimé par cette commande : ${bdcId}`)
  }
  const sectionData = requireSectionData(section)
  switch (section.pageId) {
    case null:
      fail(`La Section ${bdcId} n’est pas affectée à une page.`)
    default:
      break
  }

  let updated = document
  for (const anchorBdcId of new Set(anchorReferenceService.bdcIdsIn(sectionData.content))) {
    const anchorBdc = findBdc(updated, anchorBdcId)
    switch (anchorBdc.type) {
      case BDC_TYPE.IMAGE:
      case BDC_TYPE.VIDEO:
        switch (anchorBdc.pageId) {
          case section.pageId:
            updated = deleteBdc(updated, anchorBdc.id)
            break
          default:
            fail(`Le bdc ancré ${anchorBdcId} doit rester sur la page de sa Section.`)
        }
        break
      default:
        fail(`Seuls les bdcs image et vidéo peuvent être ancrés : ${anchorBdcId}`)
    }
  }
  return deleteBdc(updated, section.id)
}

/** Keeps Question illustrations inside the media types supported by its card. */
function assertQuestionMediaAllowed(document: ElceDocument, mediaId: MediaId): void {
  const media = document.medias.find((candidate) => candidate.id === mediaId)
  if (media === undefined) fail(`Le média ${mediaId} ne peut pas illustrer une Question.`)
  switch (media.type) {
    case MEDIA_TYPE.IMAGE:
    case MEDIA_TYPE.VIDEO:
      return
    case MEDIA_TYPE.AUDIO:
      fail(`Le média ${mediaId} ne peut pas illustrer une Question.`)
  }
}

/** Rebinds each BDC from duplicate media records to one canonical record. */
function mergeMedia(
  document: ElceDocument,
  canonicalMediaId: MediaId,
  duplicateMediaIds: readonly MediaId[],
): ElceDocument {
  const canonicalMedia = document.medias.find((media) => media.id === canonicalMediaId)
  switch (canonicalMedia) {
    case undefined:
      fail(`Média canonique inconnu : ${canonicalMediaId}`)
    default:
      break
  }
  switch (duplicateMediaIds.length) {
    case 0:
      fail('La fusion doit retirer au moins un média.')
    default:
      break
  }
  switch (new Set(duplicateMediaIds).size === duplicateMediaIds.length) {
    case true:
      break
    default:
      fail('La liste des médias à fusionner contient un doublon.')
  }
  switch (duplicateMediaIds.includes(canonicalMediaId)) {
    case false:
      break
    default:
      fail('Le média canonique ne peut pas être fusionné avec lui-même.')
  }

  const duplicateIds = new Set(duplicateMediaIds)
  for (const mediaId of duplicateMediaIds) {
    const media = document.medias.find((candidate) => candidate.id === mediaId)
    switch (media) {
      case undefined:
        fail(`Média à fusionner inconnu : ${mediaId}`)
      default:
        switch (media.type === canonicalMedia.type && media.mimeType === canonicalMedia.mimeType && media.size === canonicalMedia.size) {
          case true:
            break
          default:
            fail(`Média incompatible avec la ressource canonique : ${mediaId}`)
        }
        break
    }
  }

  return new ElceDocument({
    ...document.data,
    bdcs: document.bdcs.map((bdc) => {
      const withDirectMedia = duplicateIds.has(bdc.mediaId ?? '')
        ? { ...bdc, mediaId: canonicalMediaId }
        : bdc
      switch (bdc.type) {
        case BDC_TYPE.CAROUSEL: {
          const carousel = bdc.carousel ?? null
          if (carousel === null) return withDirectMedia
          const reboundCarousel = [...duplicateIds].reduce(
            (current, duplicateMediaId) => carouselService.replaceMediaReference(current, duplicateMediaId, canonicalMediaId),
            carousel,
          )
          return { ...withDirectMedia, carousel: reboundCarousel }
        }
        default:
          return withDirectMedia
      }
    }),
    medias: document.medias.filter((media) => !duplicateIds.has(media.id)),
  })
}

/** Returns the Section that owns an anchor edit and checks its page boundary. */
function findAnchorSection(document: ElceDocument, sectionBdcId: BdcId, pageId: PageId): Bdc {
  const section = findBdc(document, sectionBdcId)
  if (section.type !== BDC_TYPE.SECTION || section.pageId !== pageId || section.section === null) {
    fail(`La Section ${sectionBdcId} ne porte pas la page ${pageId}.`)
  }
  return section
}

/** Returns a Section payload after checking the bdc's discriminated type. */
function requireSectionData(bdc: Bdc): NonNullable<Bdc['section']> {
  switch (bdc.type) {
    case BDC_TYPE.SECTION:
      switch (bdc.section) {
        case null:
          fail(`Bdc Section incomplet : ${bdc.id}`)
        default:
          return bdc.section
      }
    default:
      fail(`Bdc non textuel : ${bdc.id}`)
  }
}

/** Updates a Section and deletes each unique bdc whose anchor leaves its text. */
function updateSectionContent(
  document: ElceDocument,
  sectionBdcId: BdcId,
  title: string | undefined,
  markup: string,
  content: RichTextDocument,
  keepUnreferencedBdcIds: readonly BdcId[] = [],
): ElceDocument {
  const section = findBdc(document, sectionBdcId)
  const sectionData = requireSectionData(section)

  const nextAnchorIds = anchorReferenceService.bdcIdsIn(content)
  if (new Set(nextAnchorIds).size !== nextAnchorIds.length) fail('Un même bdc ne peut apparaître qu’une fois dans une Section.')
  for (const anchorBdcId of nextAnchorIds) {
    switch (section.pageId) {
      case null:
        fail(`Une Section hors page ne peut pas porter l’ancre ${anchorBdcId}.`)
      default:
        break
    }
    const anchorBdc = findBdc(document, anchorBdcId)
    switch (anchorBdc.type) {
      case BDC_TYPE.IMAGE:
      case BDC_TYPE.VIDEO:
        switch (anchorBdc.pageId) {
          case section.pageId:
            break
          default:
            fail(`Le bdc ancré ${anchorBdcId} doit rester sur la page de sa Section.`)
        }
        break
      default:
        fail(`Seuls les bdcs image et vidéo peuvent être ancrés : ${anchorBdcId}`)
    }
  }

  let updated = document
  const retainedBdcIds = new Set(keepUnreferencedBdcIds)
  const deletedAnchorBdcIds = anchorReferenceService
    .removedBdcIds(sectionData.content, content)
    .filter((bdcId) => !retainedBdcIds.has(bdcId))
  for (const removedBdcId of deletedAnchorBdcIds) {
    const removedBdc = findBdc(updated, removedBdcId)
    switch (removedBdc.pageId) {
      case section.pageId:
        updated = deleteBdc(updated, removedBdc.id)
        break
      default:
        fail(`Le bdc retiré de l’ancre ${removedBdcId} n’est pas affecté à la page de sa Section.`)
    }
  }

  const updatedSection = findBdc(updated, sectionBdcId)
  const updatedSectionData = requireSectionData(updatedSection)
  return withBdc(updated, {
    ...updatedSection,
    section: { ...updatedSectionData, title: title ?? updatedSectionData.title, markup, content },
  })
}

/** Applies the one-command file/catalogue drop that creates and anchors a media bdc. */
function createAnchoredBdc(
  document: ElceDocument,
  command: Extract<DocumentCommand, { type: 'bdc.anchor.create' }>,
): ElceDocument {
  const page = findFluxPage(document, command.pageId)
  findAnchorSection(document, command.sectionBdcId, command.pageId)
  if (document.bdcs.some((bdc) => bdc.id === command.bdcId)) fail(`Bdc déjà présent : ${command.bdcId}`)
  if (!anchorReferenceService.bdcIdsIn(command.content).includes(command.bdcId)) fail(`L’ancre du bdc ${command.bdcId} manque dans la Section.`)

  const existingMedia = document.medias.find((media) => media.id === command.media.id)
  const media = existingMedia ?? command.media
  assertAnchorMediaType(command.bdcType, media.type)
  const withMedia = existingMedia === undefined
    ? new ElceDocument({ ...document.data, medias: [...document.medias, media] })
    : document
  const bdc: Bdc = {
    id: command.bdcId,
    type: command.bdcType,
    presetId: command.presetId,
    pageId: page.id,
    mediaId: command.media.id,
    section: null,
    question: null,
    evaluationResult: null,
  }
  const pageWithBdc = replaceAt(
    withMedia.pages,
    { ...page, bdcIds: [...page.bdcIds, bdc.id] },
    (candidate) => candidate.id === page.id,
  )
  const withEntities = new ElceDocument({
    ...withMedia.data,
    pages: pageWithBdc,
    bdcs: [...withMedia.bdcs, bdc],
  })
  return updateSectionContent(withEntities, command.sectionBdcId, undefined, command.markup, command.content)
}

/** Verifies the type relationship before an image or video is attached to a bdc. */
function assertAnchorMediaType(bdcType: BdcType, mediaType: MediaType): void {
  switch (bdcType) {
    case BDC_TYPE.IMAGE:
      switch (mediaType) {
        case MEDIA_TYPE.IMAGE:
          return
        default:
          fail('Un bdc image doit référencer un média image.')
      }
    case BDC_TYPE.VIDEO:
      switch (mediaType) {
        case MEDIA_TYPE.VIDEO:
          return
        default:
          fail('Un bdc vidéo doit référencer un média vidéo.')
      }
    default:
      fail(`Type de bdc média non accepté : ${bdcType}`)
  }
}

/** Moves one unused unique media bdc from the catalogue into a Flux anchor. */
function attachCatalogBdc(
  document: ElceDocument,
  command: Extract<DocumentCommand, { type: 'bdc.anchor.attach' }>,
): ElceDocument {
  const page = findFluxPage(document, command.pageId)
  const section = findAnchorSection(document, command.sectionBdcId, page.id)
  const bdc = findBdc(document, command.bdcId)
  switch (bdc.pageId) {
    case null:
      break
    default:
      fail(`Le bdc ${bdc.id} n’est plus disponible dans le catalogue.`)
  }
  switch (document.data.catalogBdcIds.includes(bdc.id)) {
    case true:
      break
    default:
      fail(`Le bdc ${bdc.id} n’est pas dans le catalogue.`)
  }
  switch (bdc.type) {
    case BDC_TYPE.IMAGE:
    case BDC_TYPE.VIDEO:
      break
    default:
      fail(`Le bdc ${bdc.id} ne peut pas être inséré dans le texte.`)
  }
  switch (bdc.mediaId) {
    case null:
      fail(`Le bdc ${bdc.id} ne référence aucun média.`)
    default:
      break
  }
  const media = document.medias.find((candidate) => candidate.id === bdc.mediaId)
  switch (media) {
    case undefined:
      fail(`Le média du bdc ${bdc.id} est introuvable.`)
    default:
      assertAnchorMediaType(bdc.type, media.type)
  }
  switch (anchorReferenceService.bdcIdsIn(command.content).includes(bdc.id)) {
    case true:
      break
    default:
      fail(`L’ancre du bdc ${bdc.id} manque dans la Section.`)
  }
  switch (anchorReferenceService.bdcIdsIn(requireSectionData(section).content).includes(bdc.id)) {
    case false:
      break
    default:
      fail(`Le bdc ${bdc.id} est déjà ancré dans cette Section.`)
  }
  const placed = placeBdc(document, bdc, { kind: BDC_LOCATION.PAGE, pageId: page.id })
  return updateSectionContent(placed, command.sectionBdcId, undefined, command.markup, command.content)
}

/** Applies an anchor repositioning while keeping its bdc assignment unchanged. */
function moveAnchoredBdc(
  document: ElceDocument,
  command: Extract<DocumentCommand, { type: 'bdc.anchor.move' }>,
): ElceDocument {
  const anchorBdc = findBdc(document, command.anchorBdcId)
  if (anchorBdc.pageId === null) fail(`Le bdc ancré est hors page : ${command.anchorBdcId}`)
  findAnchorSection(document, command.sectionBdcId, anchorBdc.pageId)
  if (!anchorReferenceService.bdcIdsIn(command.content).includes(command.anchorBdcId)) fail(`Le déplacement a perdu l’ancre ${command.anchorBdcId}.`)
  return updateSectionContent(document, command.sectionBdcId, undefined, command.markup, command.content)
}

/** Removes an anchor and deletes its unique bdc while preserving its media. */
function removeAnchoredBdc(
  document: ElceDocument,
  command: Extract<DocumentCommand, { type: 'bdc.anchor.remove' }>,
): ElceDocument {
  const anchorBdc = findBdc(document, command.anchorBdcId)
  if (anchorBdc.pageId === null) fail(`Le bdc ancré est hors page : ${command.anchorBdcId}`)
  const section = findAnchorSection(document, command.sectionBdcId, anchorBdc.pageId)
  if (!anchorReferenceService.bdcIdsIn(requireSectionData(section).content).includes(command.anchorBdcId)) {
    fail(`L’ancre ${command.anchorBdcId} est introuvable dans sa Section.`)
  }
  if (anchorReferenceService.bdcIdsIn(command.content).includes(command.anchorBdcId)) fail(`La nouvelle Section conserve l’ancre ${command.anchorBdcId}.`)
  return updateSectionContent(document, command.sectionBdcId, undefined, command.markup, command.content)
}

/** Returns an anchored bdc to the catalogue while removing its unique anchor. */
function returnAnchoredBdc(
  document: ElceDocument,
  command: Extract<DocumentCommand, { type: 'bdc.anchor.return' }>,
): ElceDocument {
  const anchorBdc = findBdc(document, command.anchorBdcId)
  const pageId = anchorBdc.pageId ?? fail(`Le bdc ancré est hors page : ${command.anchorBdcId}`)
  const section = findAnchorSection(document, command.sectionBdcId, pageId)
  if (!anchorReferenceService.bdcIdsIn(requireSectionData(section).content).includes(anchorBdc.id)) {
    fail(`L’ancre ${anchorBdc.id} est introuvable dans sa Section.`)
  }
  if (anchorReferenceService.bdcIdsIn(command.content).includes(anchorBdc.id)) {
    fail(`La nouvelle Section conserve l’ancre ${anchorBdc.id}.`)
  }

  const withoutAnchor = updateSectionContent(
    document,
    command.sectionBdcId,
    undefined,
    command.markup,
    command.content,
    [anchorBdc.id],
  )
  return placeBdc(withoutAnchor, findBdc(withoutAnchor, anchorBdc.id), { kind: BDC_LOCATION.CATALOG })
}

function movePage(document: ElceDocument, command: Extract<DocumentCommand, { type: 'page.move' }>): ElceDocument {
  return placePage(document, findPage(document, command.pageId), command.placement)
}

function moveBdc(document: ElceDocument, command: Extract<DocumentCommand, { type: 'bdc.move' }>): ElceDocument {
  const bdc = findBdc(document, command.bdcId)
  if (anchorReferenceService.isReferenced(document, bdc.id)) {
    switch (command.placement.kind) {
      case BDC_LOCATION.CATALOG:
        fail(`Le retour au catalogue du bdc ancré ${bdc.id} exige le retrait de son ancre.`)
      case BDC_LOCATION.PAGE:
        switch (command.placement.pageId) {
          case bdc.pageId:
            break
          default:
            fail(`Déplacer le bdc ancré ${bdc.id} exige de déplacer aussi son ancre.`)
        }
        break
    }
  }
  return placeBdc(document, bdc, command.placement)
}

function deletePage(document: ElceDocument, pageId: PageId): ElceDocument {
  const page = findPage(document, pageId)
  const bdcIds = new Set(page.bdcIds)
  const detached = movePage(document, { type: 'page.move', pageId, placement: { kind: PAGE_LOCATION.CATALOG } })
  return new ElceDocument({
    ...detached.data,
    chapters: detached.chapters.map((chapter) => ({ ...chapter, pageIds: removeValue(chapter.pageIds, pageId) })),
    pages: detached.pages.filter((candidate) => candidate.id !== pageId),
    scenarioEntries: removeScenarioPageEntry(detached, pageId),
    catalogPageIds: removeValue(detached.data.catalogPageIds, pageId),
    bdcs: detached.bdcs.filter((bdc) => !bdcIds.has(bdc.id)),
    catalogBdcIds: detached.data.catalogBdcIds.filter((bdcId) => !bdcIds.has(bdcId)),
  })
}

/** Renames one page without changing its placement or content. */
function renamePage(document: ElceDocument, pageId: PageId, requestedName: string): ElceDocument {
  const page = findPage(document, pageId)
  const name = requestedName.trim()
  if (name.length === 0) fail(`Le nom de la page ne peut pas être vide : ${pageId}`)
  return withPage(document, { ...page, name })
}

/** Renames one chapter without changing its type or page order. */
function renameChapter(document: ElceDocument, chapterId: ChapterId, requestedName: string): ElceDocument {
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
function updateChapterEvaluationSettings(
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

/** Applies one document command and returns a new immutable model value. */
function applyCommand(document: ElceDocument, command: DocumentCommand): ElceDocument {
  switch (command.type) {
    case 'chapter.create':
      return createChapter(document, command)
    case 'chapter.rename':
      return renameChapter(document, command.chapterId, command.name)
    case 'chapter.evaluation.settings.update':
      return updateChapterEvaluationSettings(document, command)
    case 'chapter.move':
      return moveChapter(document, command.chapterId, command.index)
    case 'chapter.delete':
      return deleteChapter(document, command.chapterId)
    case 'page.create':
      return createPage(document, command)
    case 'page.rename':
      return renamePage(document, command.pageId, command.name)
    case 'page.move':
      return movePage(document, command)
    case 'page.remove':
      return movePage(document, { type: 'page.move', pageId: command.pageId, placement: { kind: PAGE_LOCATION.CATALOG } })
    case 'page.delete':
      return deletePage(document, command.pageId)
    case 'bdc.create':
      return createBdc(document, command)
    case 'bdc.move':
      return moveBdc(document, command)
    case 'bdc.remove':
      return moveBdc(document, { type: 'bdc.move', bdcId: command.bdcId, placement: { kind: BDC_LOCATION.CATALOG } })
    case 'bdc.delete':
      return deleteCatalogBdc(document, command.bdcId)
    case 'bdc.section.update': {
      const bdc = findBdc(document, command.bdcId)
      switch (bdc.type) {
        case BDC_TYPE.SECTION:
          return updateSectionContent(document, command.bdcId, command.title, command.markup, command.content)
        default:
          fail(`Bdc non textuel : ${command.bdcId}`)
      }
    }
    case 'bdc.question.update':
      return updateQuestion(document, command.bdcId, command.question)
    case 'bdc.evaluation-result.update':
      return updateEvaluationResult(document, command.bdcId, command.evaluationResult)
    case 'bdc.carousel.update':
      return updateCarousel(document, command.bdcId, command.carousel)
    case 'bdc.carousel.media.set':
      return setCarouselMedia(document, command.bdcId, command.viewId, command.mediaId)
    case 'bdc.carousel.media.attach':
      return attachCarouselMedia(document, command.bdcId, command.viewId, command.media)
    case 'bdc.question.media.set':
      return setQuestionMedia(document, command.bdcId, command.mediaId)
    case 'bdc.question.media.attach':
      return attachQuestionMedia(document, command.bdcId, command.media)
    case 'bdc.question.delete':
      return deleteQuestion(document, command.bdcId)
    case 'bdc.section.delete':
      return deleteSection(document, command.bdcId)
    case 'bdc.evaluation-result.delete':
      return deleteEvaluationResult(document, command.bdcId)
    case 'bdc.carousel.delete':
      return deleteCarousel(document, command.bdcId)
    case 'bdc.anchor.create':
      return createAnchoredBdc(document, command)
    case 'bdc.anchor.attach':
      return attachCatalogBdc(document, command)
    case 'bdc.anchor.move':
      return moveAnchoredBdc(document, command)
    case 'bdc.anchor.remove':
      return removeAnchoredBdc(document, command)
    case 'bdc.anchor.return':
      return returnAnchoredBdc(document, command)
    case 'media.add':
      if (document.medias.some((media) => media.id === command.media.id)) fail(`Média déjà présent : ${command.media.id}`)
      return new ElceDocument({ ...document.data, medias: [...document.medias, command.media] })
    case 'media.merge':
      return mergeMedia(document, command.canonicalMediaId, command.duplicateMediaIds)
    case 'document.rename':
      return new ElceDocument({ ...document.data, name: command.name })
  }
}

/** Applies a document command and verifies its cross-entity invariants before returning. */
export function applyDocumentCommand(document: ElceDocument, command: DocumentCommand): ElceDocument {
  const updated = applyCommand(document, command)
  assertDocumentInvariants(updated)
  return updated
}

/** Checks placement and anchor-reference invariants for a document value. */
export function assertDocumentInvariants(document: ElceDocument): void {
  const pageIds = new Set<PageId>()
  const bdcIds = new Set<BdcId>()
  const knownBdcIds = new Set(document.bdcs.map((bdc) => bdc.id))
  for (const page of document.pages) {
    if (pageIds.has(page.id)) fail(`Page dupliquée : ${page.id}`)
    pageIds.add(page.id)
    for (const bdcId of page.bdcIds) {
      if (!knownBdcIds.has(bdcId)) fail(`Bdc inconnu dans la page ${page.id} : ${bdcId}`)
      if (bdcIds.has(bdcId)) fail(`Bdc placé deux fois dans la page ${page.id}`)
      bdcIds.add(bdcId)
      if (document.bdcs.find((bdc) => bdc.id === bdcId)?.pageId !== page.id) fail(`Affectation de bdc incohérente : ${bdcId}`)
    }
  }
  const scenarioEntryChapterIds = document.data.scenarioEntries.flatMap((entry) => {
    switch (entry.kind) {
      case SCENARIO_ENTRY_KIND.PAGE: {
        const page = document.pages.find((candidate) => candidate.id === entry.pageId)
        switch (page) {
          case undefined:
            fail(`Page racine inconnue : ${entry.pageId}`)
          default:
            switch (page.chapterId) {
              case null:
                break
              default:
                fail(`Une page racine ne peut pas appartenir au chapitre ${page.chapterId} : ${page.id}`)
            }
        }
        return []
      }
      case SCENARIO_ENTRY_KIND.CHAPTER:
        return [entry.chapterId]
    }
  })
  const uniqueScenarioChapterIds = new Set(scenarioEntryChapterIds)
  if (scenarioEntryChapterIds.length !== document.chapters.length
    || uniqueScenarioChapterIds.size !== scenarioEntryChapterIds.length) {
    fail('Chaque chapitre doit avoir une entrée racine unique')
  }
  for (const chapterId of scenarioEntryChapterIds) {
    switch (document.chapters.find((chapter) => chapter.id === chapterId)) {
      case undefined:
        fail(`Entrée de chapitre inconnue : ${chapterId}`)
      default:
        break
    }
  }
  const scenarioPageIds = document.scenarioPageIds
  const placedPageIds = new Set([...scenarioPageIds, ...document.data.catalogPageIds])
  if (placedPageIds.size !== scenarioPageIds.length + document.data.catalogPageIds.length
    || placedPageIds.size !== document.pages.length) {
    fail('Chaque page doit avoir un emplacement unique')
  }
  for (const pageId of scenarioPageIds) {
    if (!pageIds.has(pageId)) fail(`Page de scénario inconnue : ${pageId}`)
  }
  for (const bdc of document.bdcs) {
    if (bdcIds.has(bdc.id)) continue
    if (!document.data.catalogBdcIds.includes(bdc.id) || bdc.pageId !== null) fail(`Bdc sans emplacement : ${bdc.id}`)
    bdcIds.add(bdc.id)
  }
  if (bdcIds.size !== document.bdcs.length) fail('Chaque bdc doit avoir un emplacement unique')
  for (const chapter of document.chapters) {
    for (const pageId of chapter.pageIds) {
      if (document.pages.find((page) => page.id === pageId)?.chapterId !== chapter.id) fail(`Affectation de chapitre incohérente : ${pageId}`)
    }
  }
  for (const page of document.pages) {
    if (page.chapterId === null && document.chapters.some((chapter) => chapter.pageIds.includes(page.id))) fail(`Page affectée à un chapitre sans référence : ${page.id}`)
    if (page.chapterId !== null && !document.chapters.some((chapter) => chapter.id === page.chapterId && chapter.pageIds.includes(page.id))) fail(`Page hors chapitre incohérente : ${page.id}`)
  }

  for (const page of document.pages) {
    const questions = page.bdcIds.flatMap((bdcId) => {
      const bdc = document.bdcs.find((candidate) => candidate.id === bdcId)
      switch (bdc?.type) {
        case BDC_TYPE.QUESTION:
          return [bdc]
        default:
          return []
      }
    })
    if (questions.length > 1) fail(`Une page ne peut contenir qu’une Question : ${page.id}`)
    switch (page.type) {
      case PAGE_TYPE.FLUX:
        break
      case PAGE_TYPE.DIAPO:
        if (questions.length > 0) fail(`Une Question ne peut pas être placée sur une page Diapo : ${page.id}`)
        continue
    }
    for (const bdc of questions) {
      if (bdc.question === null) fail(`Bdc Question incomplet : ${bdc.id}`)
      questionService.assertValid(bdc.question)
      if (bdc.mediaId !== null) assertQuestionMediaAllowed(document, bdc.mediaId)
    }
  }

  for (const bdc of document.bdcs) {
    switch (bdc.type) {
      case BDC_TYPE.QUESTION: {
        if (bdc.question === null || bdc.section !== null) fail(`Bdc Question incomplet : ${bdc.id}`)
        questionService.assertValid(bdc.question)
        if (bdc.pageId === null) fail(`Un bdc Question doit rester affecté à une page : ${bdc.id}`)
        if (bdc.mediaId !== null) assertQuestionMediaAllowed(document, bdc.mediaId)
        break
      }
      case BDC_TYPE.CAROUSEL: {
        if (bdc.carousel === null || bdc.carousel === undefined || bdc.section !== null || bdc.question !== null) {
          fail(`Bdc Carousel incomplet : ${bdc.id}`)
        }
        carouselService.assertValid(bdc.carousel)
        if (bdc.pageId === null) fail(`Un bdc Carousel doit rester affecté à une page : ${bdc.id}`)
        break
      }
      default:
        if (bdc.question !== null) fail(`Un bdc ${bdc.type} ne peut pas porter de Question : ${bdc.id}`)
        if (bdc.carousel != null) fail(`Un bdc ${bdc.type} ne peut pas porter un Carousel : ${bdc.id}`)
    }
  }

  const referencedAnchorBdcIds = new Set<BdcId>()
  for (const sectionBdc of document.bdcs) {
    switch (sectionBdc.type) {
      case BDC_TYPE.SECTION: {
        const section = requireSectionData(sectionBdc)
        const anchorBdcIds = anchorReferenceService.bdcIdsIn(section.content)
        if (new Set(anchorBdcIds).size !== anchorBdcIds.length) fail(`Une ancre est dupliquée dans la Section ${sectionBdc.id}.`)
        for (const anchorBdcId of anchorBdcIds) {
          if (referencedAnchorBdcIds.has(anchorBdcId)) fail(`Le bdc ancré ${anchorBdcId} est référencé plusieurs fois.`)
          const anchorBdc = document.bdcs.find((bdc) => bdc.id === anchorBdcId)
          switch (anchorBdc) {
            case undefined:
              fail(`Ancre sans bdc associé : ${anchorBdcId}`)
            default:
              switch (anchorBdc.type) {
                case BDC_TYPE.IMAGE:
                case BDC_TYPE.VIDEO:
                  switch (sectionBdc.pageId) {
                    case null:
                      fail(`Une Section hors page ne peut pas porter l’ancre ${anchorBdcId}.`)
                    default:
                      break
                  }
                  switch (anchorBdc.pageId) {
                    case sectionBdc.pageId:
                      break
                    default:
                      fail(`Le bdc ancré ${anchorBdcId} doit rester sur la page de sa Section.`)
                  }
                  break
                default:
                  fail(`Seuls les bdcs image et vidéo peuvent être ancrés : ${anchorBdcId}`)
              }
          }
          referencedAnchorBdcIds.add(anchorBdcId)
        }
        break
      }
      default:
        break
    }
  }
}

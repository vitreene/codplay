import { BDC_LOCATION, BDC_TYPE, CAROUSEL_CONFIG, CHAPTER_TYPE, CHAPTER_TYPE_CONFIG, DEFAULT_PRESET_ID, PAGE_LOCATION, PAGE_TYPE } from '../../../config/document-config'
import type { CardLayoutId, PageType } from '../../../config/document-config-types'
import { ElceDocument, nextChapterName, createStableId } from '../../../domain/document/document-model'
import type { CardPresentationOptions } from '../../../domain/card/card-types'
import type { BdcId, Chapter, ChapterId, PageId } from '../../../domain/document/document-types'
import type { CreatePageCommandInput, DocumentCommand, PagePlacement } from '../document-command-types'
import { findChapter } from './command-helpers'

/** Creates a page command while keeping identifier generation outside rendering. */
export function createPageCommand(input: CreatePageCommandInput): Extract<DocumentCommand, { type: 'page.create' }> {
  return { type: 'page.create', ...input }
}

/** Creates a default Page or Diapo command at the requested document location. */
export function createDefaultPageCommand(
  document: ElceDocument,
  placement: PagePlacement,
  name?: string,
  pageType: PageType = PAGE_TYPE.FLUX,
): Extract<DocumentCommand, { type: 'page.create' }> {
  const pageId = createStableId('page')
  const bdcId = createStableId('bdc')
  if (pageType === PAGE_TYPE.DIAPO) {
    return createPageCommand({
      pageId,
      bdcId,
      initialCardBdcId: createStableId('bdc-card'),
      pageType,
      name,
      placement,
    })
  }
  return createPageCommand({
    pageId,
    bdcId,
    defaultBdcType: defaultBdcTypeForPlacement(document, placement),
    pageType,
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
  initialCardBdcId: BdcId = createStableId('bdc-card'),
): Extract<DocumentCommand, { type: 'bdc.create' }> {
  return {
    type: 'bdc.create',
    bdcId,
    bdcType: BDC_TYPE.CAROUSEL,
    presetId: DEFAULT_PRESET_ID.CAROUSEL,
    placement: { kind: BDC_LOCATION.PAGE, pageId, index },
    initialCardBdcId,
  }
}

/** Creates a Card BDC as an ordered child of a container that accepts Cards. */
export function createCardBdcCommand(
  bdcId: BdcId,
  parentBdcId: BdcId,
  index: number,
  layoutId: CardLayoutId,
  initialCardOptions?: CardPresentationOptions,
): Extract<DocumentCommand, { type: 'bdc.create' }> {
  return {
    type: 'bdc.create',
    bdcId,
    bdcType: BDC_TYPE.CARD,
    presetId: layoutId,
    placement: { kind: BDC_LOCATION.PARENT, parentBdcId, index },
    ...(initialCardOptions === undefined ? {} : { initialCardOptions }),
  }
}

/** Creates a unique Card BDC directly in a page. */
export function createStandaloneCardBdcCommand(
  bdcId: BdcId,
  pageId: PageId,
  layoutId: CardLayoutId = CAROUSEL_CONFIG.initialCardLayoutId,
  initialCardOptions?: CardPresentationOptions,
): Extract<DocumentCommand, { type: 'bdc.create' }> {
  return {
    type: 'bdc.create',
    bdcId,
    bdcType: BDC_TYPE.CARD,
    presetId: layoutId,
    placement: { kind: BDC_LOCATION.PAGE, pageId },
    ...(initialCardOptions === undefined ? {} : { initialCardOptions }),
  }
}

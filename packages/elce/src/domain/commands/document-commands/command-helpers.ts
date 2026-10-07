import { BDC_LOCATION, BDC_TYPE, CHAPTER_TYPE, PAGE_LOCATION, PAGE_TYPE, SCENARIO_ENTRY_KIND } from '../../../config/document-config'
import { ElceDocument } from '../../../domain/document/document-model'
import type { Bdc, BdcId, Chapter, ChapterId, Page, PageId } from '../../../domain/document/document-types'
import type { BdcPlacement, PagePlacement } from '../document-command-types'

/** Raises a domain validation error from a command transformation. */
export function fail(message: string): never {
  throw new Error(message)
}

/** Bounds an optional insertion index to the current collection. */
export function indexAtEndOrRequested(length: number, index: number | undefined): number {
  return Math.max(0, Math.min(index ?? length, length))
}

/** Returns a collection with one item inserted at its bounded index. */
export function insertAt<T>(values: readonly T[], value: T, index: number | undefined): readonly T[] {
  const result = [...values]
  result.splice(indexAtEndOrRequested(result.length, index), 0, value)
  return result
}

/** Returns a collection without entries equal to the supplied value. */
export function removeValue<T>(values: readonly T[], value: T): readonly T[] {
  return values.filter((candidate) => candidate !== value)
}

/** Removes one standalone page from the root scenario sequence. */
export function removeScenarioPageEntry(document: ElceDocument, pageId: PageId) {
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
export function scenarioEntryIndexForChapter(document: ElceDocument, chapterId: ChapterId): number {
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

/** Finds the existing index when a page is reordered within its current collection. */
export function sourceIndexForPlacement(
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

/** Adjusts a page's target index for removing it before insertion. */
export function indexAfterPageRemoval(
  document: ElceDocument,
  page: Page,
  placement: PagePlacement,
): number | undefined {
  const requestedIndex = pageIndexForPlacement(placement)
  const sourceIndex = sourceIndexForPlacement(document, page, placement)
  if (requestedIndex === undefined || sourceIndex === undefined || sourceIndex >= requestedIndex) return requestedIndex
  return requestedIndex - 1
}

/** Reads the destination index for a page placement, if it has one. */
export function pageIndexForPlacement(placement: PagePlacement): number | undefined {
  switch (placement.kind) {
    case PAGE_LOCATION.CATALOG:
      return undefined
    case PAGE_LOCATION.SCENARIO:
    case PAGE_LOCATION.CHAPTER:
      return placement.index
  }
}

/** Replaces matching values without mutating the original collection. */
export function replaceAt<T>(values: readonly T[], value: T, predicate: (candidate: T) => boolean): readonly T[] {
  return values.map((candidate) => (predicate(candidate) ? value : candidate))
}

/** Finds a page by its document identifier. */
export function findPage(document: ElceDocument, pageId: PageId): Page {
  return document.pages.find((page) => page.id === pageId) ?? fail(`Page inconnue : ${pageId}`)
}

/** Finds a Flux page, which is the only page type that can own anchored text. */
export function findFluxPage(document: ElceDocument, pageId: PageId): Page {
  const page = findPage(document, pageId)
  switch (page.type) {
    case PAGE_TYPE.FLUX:
      return page
    default:
      fail(`La page ${pageId} ne peut pas accueillir une ancre de texte.`)
  }
}

/** Finds a BDC by its document identifier. */
export function findBdc(document: ElceDocument, bdcId: BdcId): Bdc {
  return document.bdcs.find((bdc) => bdc.id === bdcId) ?? fail(`Bdc inconnu : ${bdcId}`)
}

/** Finds a chapter by its document identifier. */
export function findChapter(document: ElceDocument, chapterId: ChapterId): Chapter {
  return document.chapters.find((chapter) => chapter.id === chapterId) ?? fail(`Chapitre inconnu : ${chapterId}`)
}

/** Returns whether a page belongs to an Evaluation chapter. */
export function pageBelongsToEvaluationChapter(document: ElceDocument, page: Page): boolean {
  const chapter = page.chapterId === null
    ? undefined
    : document.chapters.find((candidate) => candidate.id === page.chapterId)
  switch (chapter?.type) {
    case CHAPTER_TYPE.EVALUATION:
      return true
    case CHAPTER_TYPE.STANDARD:
    case undefined:
      return false
  }
}

/** Returns a document with one existing page replaced. */
export function withPage(document: ElceDocument, page: Page): ElceDocument {
  return new ElceDocument({ ...document.data, pages: replaceAt(document.pages, page, (candidate) => candidate.id === page.id) })
}

/** Returns a document with one existing BDC replaced. */
export function withBdc(document: ElceDocument, bdc: Bdc): ElceDocument {
  return new ElceDocument({ ...document.data, bdcs: replaceAt(document.bdcs, bdc, (candidate) => candidate.id === bdc.id) })
}

/** Removes a page from its current collection and applies its new placement. */
export function placePage(document: ElceDocument, page: Page, placement: PagePlacement): ElceDocument {
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

/** Removes a BDC from its current collection and applies its new placement. */
export function placeBdc(document: ElceDocument, bdc: Bdc, placement: BdcPlacement): ElceDocument {
  const withoutBdc = new ElceDocument({
    ...document.data,
    pages: document.pages.map((page) => ({ ...page, bdcIds: removeValue(page.bdcIds, bdc.id) })),
    bdcs: document.bdcs.map((candidate) => candidate.type === BDC_TYPE.CAROUSEL && candidate.carousel != null
      ? { ...candidate, carousel: { ...candidate.carousel, cards: candidate.carousel.cards.filter((entry) => entry.bdcId !== bdc.id) } }
      : candidate),
    catalogBdcIds: removeValue(document.data.catalogBdcIds, bdc.id),
  })
  switch (placement.kind) {
    case BDC_LOCATION.CATALOG:
      return withBdc(new ElceDocument({ ...withoutBdc.data, catalogBdcIds: [...withoutBdc.data.catalogBdcIds, bdc.id] }), {
        ...bdc,
        pageId: null,
        parentBdcId: null,
      })
    case BDC_LOCATION.PAGE: {
      const page = findPage(withoutBdc, placement.pageId)
      const pages = replaceAt(
        withoutBdc.pages,
        { ...page, bdcIds: insertAt(page.bdcIds, bdc.id, placement.index) },
        (candidate) => candidate.id === page.id,
      )
      return withBdc(new ElceDocument({ ...withoutBdc.data, pages }), { ...bdc, pageId: page.id, parentBdcId: null })
    }
    case BDC_LOCATION.PARENT: {
      const parent = findBdc(withoutBdc, placement.parentBdcId)
      if (bdc.type !== BDC_TYPE.CARD || parent.type !== BDC_TYPE.CAROUSEL || parent.carousel == null) {
        fail('Un BDC Carousel accepte uniquement des BDC Carte comme enfants.')
      }
      const carousel = {
        ...parent.carousel,
        cards: insertAt(parent.carousel.cards, {
          bdcId: bdc.id,
          durationMs: null,
          introTransitionRef: null,
          outroTransitionRef: null,
        }, placement.index),
      }
      const withParent = withBdc(withoutBdc, { ...parent, carousel })
      return withBdc(withParent, { ...bdc, pageId: null, parentBdcId: parent.id })
    }
  }
}

/** Places one Card as an anchored child of a Section without altering its text. */
export function placeCardInSection(document: ElceDocument, bdc: Bdc, sectionBdcId: BdcId): ElceDocument {
  const section = findBdc(document, sectionBdcId)
  if (bdc.type !== BDC_TYPE.CARD || section.type !== BDC_TYPE.SECTION || section.section === null) {
    fail('Seule une Carte peut être ancrée dans un BDC Texte.')
  }
  const withoutBdc = new ElceDocument({
    ...document.data,
    pages: document.pages.map((page) => ({ ...page, bdcIds: removeValue(page.bdcIds, bdc.id) })),
    bdcs: document.bdcs.map((candidate) => candidate.type === BDC_TYPE.CAROUSEL && candidate.carousel != null
      ? { ...candidate, carousel: { ...candidate.carousel, cards: candidate.carousel.cards.filter((entry) => entry.bdcId !== bdc.id) } }
      : candidate),
    catalogBdcIds: removeValue(document.data.catalogBdcIds, bdc.id),
  })
  return withBdc(withoutBdc, { ...bdc, pageId: null, parentBdcId: section.id })
}

/** Returns a Section payload after checking the bdc's discriminated type. */
export function requireSectionData(bdc: Bdc): NonNullable<Bdc['section']> {
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

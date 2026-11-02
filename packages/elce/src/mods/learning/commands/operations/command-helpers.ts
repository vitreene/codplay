import { BDC_TYPE } from '../../learning-definition'
import { BDC_LOCATION } from '../../../../core/document/content-location'
import { insertAt, removeValue, replaceAt } from '../../../../core/document/collection-operations'
import { findBdc, findPage } from '../../../../core/document/content-placement-service'
import { LearningDocument } from '../../document/learning-document'
import type { LearningBdc } from '../../document/learning-document-types'
import type { BdcId } from '../../../../core/document/content-document-types'
import type { BdcPlacement } from '../../../../core/document/content-location'

/** Raises a domain validation error from a command transformation. */
export function fail(message: string): never {
  throw new Error(message)
}

/** Returns a document with one existing BDC replaced. */
export function withBdc(document: LearningDocument, bdc: LearningBdc): LearningDocument {
  return new LearningDocument({ ...document.data, bdcs: replaceAt(document.bdcs, bdc, (candidate) => candidate.id === bdc.id) })
}

/** Removes a BDC from its current collection and applies its new placement. */
export function placeBdc(document: LearningDocument, bdc: LearningBdc, placement: BdcPlacement): LearningDocument {
  const withoutBdc = new LearningDocument({
    ...document.data,
    pages: document.pages.map((page) => ({ ...page, bdcIds: removeValue(page.bdcIds, bdc.id) })),
    bdcs: document.bdcs.map((candidate) => candidate.type === BDC_TYPE.CAROUSEL && candidate.carousel != null
      ? { ...candidate, carousel: { ...candidate.carousel, cards: candidate.carousel.cards.filter((entry) => entry.bdcId !== bdc.id) } }
      : candidate),
    catalogBdcIds: removeValue(document.data.catalogBdcIds, bdc.id),
  })
  switch (placement.kind) {
    case BDC_LOCATION.CATALOG:
      return withBdc(new LearningDocument({ ...withoutBdc.data, catalogBdcIds: [...withoutBdc.data.catalogBdcIds, bdc.id] }), {
        ...bdc,
        pageId: null,
        parentBdcId: null,
      })
    case BDC_LOCATION.PAGE: {
      const page = findPage(withoutBdc.pages, placement.pageId)
      const pages = replaceAt(
        withoutBdc.pages,
        { ...page, bdcIds: insertAt(page.bdcIds, bdc.id, placement.index) },
        (candidate) => candidate.id === page.id,
      )
      return withBdc(new LearningDocument({ ...withoutBdc.data, pages }), { ...bdc, pageId: page.id, parentBdcId: null })
    }
    case BDC_LOCATION.PARENT: {
      const parent = findBdc(withoutBdc.bdcs, placement.parentBdcId)
      if ((bdc.type !== BDC_TYPE.CARD && bdc.type !== BDC_TYPE.STATISTICAL_GRAPH)
        || parent.type !== BDC_TYPE.CAROUSEL || parent.carousel == null) {
        fail('Un BDC Carousel accepte des Cartes et des Graphes statistiques comme enfants.')
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

/** Places one illustration BDC as an anchored child of a Section. */
export function placeIllustrationInSection(document: LearningDocument, bdc: LearningBdc, sectionBdcId: BdcId): LearningDocument {
  const section = findBdc(document.bdcs, sectionBdcId)
  if ((bdc.type !== BDC_TYPE.CARD && bdc.type !== BDC_TYPE.STATISTICAL_GRAPH)
    || section.type !== BDC_TYPE.SECTION || section.section === null) {
    fail('Une Section accepte les illustrations Carte et Graphe.')
  }
  const withoutBdc = new LearningDocument({
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
export function requireSectionData(bdc: LearningBdc): NonNullable<LearningBdc['section']> {
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

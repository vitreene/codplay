import { BDC_TYPE } from '../../../config/document-config'
import { ElceDocument } from '../../../domain/document/document-model'
import type { Bdc, BdcId, PageId, RichTextDocument } from '../../../domain/document/document-types'
import { findBdc, fail, requireSectionData, withBdc } from './command-helpers'
import { deleteBdc } from './bdc-commands'
import { assertTransitionOverride } from './revelation-commands'
import { anchorReferenceService } from './services'

/** Returns the Section that owns an anchor edit and checks its page boundary. */
export function findAnchorSection(document: ElceDocument, sectionBdcId: BdcId, pageId: PageId): Bdc {
  const section = findBdc(document, sectionBdcId)
  if (section.type !== BDC_TYPE.SECTION || section.pageId !== pageId || section.section === null) {
    fail(`La Section ${sectionBdcId} ne porte pas la page ${pageId}.`)
  }
  return section
}

/** Resolves the page of the Section that currently owns an anchored Card. */
export function findAnchorSectionForCard(document: ElceDocument, bdc: Bdc, sectionBdcId: BdcId): PageId {
  if (bdc.type !== BDC_TYPE.CARD || bdc.parentBdcId !== sectionBdcId || bdc.pageId !== null) {
    fail(`La Carte ${bdc.id} n’est pas ancrée dans la Section ${sectionBdcId}.`)
  }
  const section = findBdc(document, sectionBdcId)
  if (section.type !== BDC_TYPE.SECTION || section.pageId === null || section.section === null) {
    fail(`La Section ${sectionBdcId} ne peut pas porter d’ancre.`)
  }
  return section.pageId
}

/** Updates a Section and deletes each unique bdc whose anchor leaves its text. */
export function updateSectionContent(
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
      case BDC_TYPE.CARD:
        switch (anchorBdc.parentBdcId) {
          case sectionBdcId:
            break
          default:
            fail(`La Carte ancrée ${anchorBdcId} doit appartenir à la Section ${sectionBdcId}.`)
        }
        if (anchorBdc.pageId !== null) fail(`La Carte ancrée ${anchorBdcId} ne peut pas être placée directement dans une page.`)
        break
      default:
        fail(`Seules les Cartes peuvent être ancrées : ${anchorBdcId}`)
    }
  }

  let updated = document
  const retainedBdcIds = new Set(keepUnreferencedBdcIds)
  const deletedAnchorBdcIds = anchorReferenceService
    .removedBdcIds(sectionData.content, content)
    .filter((bdcId) => !retainedBdcIds.has(bdcId))
  for (const removedBdcId of deletedAnchorBdcIds) {
    const removedBdc = findBdc(updated, removedBdcId)
    switch (removedBdc.parentBdcId) {
      case sectionBdcId:
        updated = deleteBdc(updated, removedBdc.id)
        break
      default:
        fail(`Le bdc retiré de l’ancre ${removedBdcId} n’est pas enfant de sa Section.`)
    }
  }

  const updatedSection = findBdc(updated, sectionBdcId)
  const updatedSectionData = requireSectionData(updatedSection)
  return withBdc(updated, {
    ...updatedSection,
    section: { ...updatedSectionData, title: title ?? updatedSectionData.title, markup, content },
  })
}

/** Updates the optional entry and exit transition overrides of a Section. */
export function updateSectionRevelation(
  document: ElceDocument,
  bdcId: BdcId,
  revelation: NonNullable<Bdc['section']>['revelation'],
): ElceDocument {
  const bdc = findBdc(document, bdcId)
  const section = requireSectionData(bdc)
  assertTransitionOverride(revelation.intro)
  assertTransitionOverride(revelation.outro)
  return withBdc(document, { ...bdc, section: { ...section, revelation } })
}

/** Permanently deletes a Section and its anchored bdcs while retaining media. */
export function deleteSection(document: ElceDocument, bdcId: BdcId): ElceDocument {
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
      case BDC_TYPE.CARD:
        switch (anchorBdc.parentBdcId) {
          case section.id:
            updated = deleteBdc(updated, anchorBdc.id)
            break
          default:
            fail(`La Carte ancrée ${anchorBdcId} doit rester enfant de sa Section.`)
        }
        break
      default:
        fail(`Seules les Cartes peuvent être ancrées : ${anchorBdcId}`)
    }
  }
  return deleteBdc(updated, section.id)
}

import { BDC_TYPE } from '../../learning-definition'
import { LearningDocument } from '../../document/learning-document'
import type { LearningBdc } from '../../document/learning-document-types'
import type { BdcId, PageId } from '../../../../core/document/content-document-types'
import type { RichTextDocument } from '../../../../resources/bdcs/section/domain/section-types'
import { findBdc } from '../../../../core/document/content-placement-service'
import { fail, requireSectionData, withBdc } from './command-helpers'
import { deleteBdc } from './bdc-commands'
import { assertTransitionOverride } from './revelation-commands'
import type { LearningCommandResourceServices } from '../learning-command-resource-services'

/** Returns the Section that owns an anchor edit and checks its page boundary. */
export function findAnchorSection(document: LearningDocument, sectionBdcId: BdcId, pageId: PageId): LearningBdc {
  const section = findBdc(document.bdcs, sectionBdcId)
  if (section.type !== BDC_TYPE.SECTION || section.pageId !== pageId || section.section === null) {
    fail(`La Section ${sectionBdcId} ne porte pas la page ${pageId}.`)
  }
  return section
}

/** Resolves the page of the Section that currently owns an anchored illustration. */
export function findAnchorSectionForIllustration(document: LearningDocument, bdc: LearningBdc, sectionBdcId: BdcId): PageId {
  if ((bdc.type !== BDC_TYPE.CARD && bdc.type !== BDC_TYPE.STATISTICAL_GRAPH)
    || bdc.parentBdcId !== sectionBdcId || bdc.pageId !== null) {
    fail(`Le BDC illustratif ${bdc.id} n’est pas ancré dans la Section ${sectionBdcId}.`)
  }
  const section = findBdc(document.bdcs, sectionBdcId)
  if (section.type !== BDC_TYPE.SECTION || section.pageId === null || section.section === null) {
    fail(`La Section ${sectionBdcId} ne peut pas porter d’ancre.`)
  }
  return section.pageId
}

/** Updates a Section and deletes each unique bdc whose anchor leaves its text. */
export function updateSectionContent(
  document: LearningDocument,
  sectionBdcId: BdcId,
  title: string | undefined,
  markup: string,
  content: RichTextDocument,
  keepUnreferencedBdcIds: readonly BdcId[],
  resources: LearningCommandResourceServices,
): LearningDocument {
  const section = findBdc(document.bdcs, sectionBdcId)
  const sectionData = requireSectionData(section)

  const nextAnchorIds = resources.anchorReferenceService.bdcIdsIn(content)
  if (new Set(nextAnchorIds).size !== nextAnchorIds.length) fail('Un même bdc ne peut apparaître qu’une fois dans une Section.')
  for (const anchorBdcId of nextAnchorIds) {
    switch (section.pageId) {
      case null:
        fail(`Une Section hors page ne peut pas porter l’ancre ${anchorBdcId}.`)
      default:
        break
    }
    const anchorBdc = findBdc(document.bdcs, anchorBdcId)
    switch (anchorBdc.type) {
      case BDC_TYPE.CARD:
      case BDC_TYPE.STATISTICAL_GRAPH:
        switch (anchorBdc.parentBdcId) {
          case sectionBdcId:
            break
          default:
            fail(`Le BDC illustratif ancré ${anchorBdcId} doit appartenir à la Section ${sectionBdcId}.`)
        }
        if (anchorBdc.pageId !== null) fail(`Le BDC illustratif ancré ${anchorBdcId} ne peut pas être placé directement dans une page.`)
        break
      default:
        fail(`Seules les Cartes et les Graphes statistiques peuvent être ancrés : ${anchorBdcId}`)
    }
  }

  let updated = document
  const retainedBdcIds = new Set(keepUnreferencedBdcIds)
  const deletedAnchorBdcIds = resources.anchorReferenceService
    .removedBdcIds(sectionData.content, content)
    .filter((bdcId) => !retainedBdcIds.has(bdcId))
  for (const removedBdcId of deletedAnchorBdcIds) {
    const removedBdc = findBdc(updated.bdcs, removedBdcId)
    switch (removedBdc.parentBdcId) {
      case sectionBdcId:
        updated = deleteBdc(updated, removedBdc.id)
        break
      default:
        fail(`Le bdc retiré de l’ancre ${removedBdcId} n’est pas enfant de sa Section.`)
    }
  }

  const updatedSection = findBdc(updated.bdcs, sectionBdcId)
  const updatedSectionData = requireSectionData(updatedSection)
  return withBdc(updated, {
    ...updatedSection,
    section: { ...updatedSectionData, title: title ?? updatedSectionData.title, markup, content },
  })
}

/** Updates the optional entry and exit transition overrides of a Section. */
export function updateSectionRevelation(
  document: LearningDocument,
  bdcId: BdcId,
  revelation: NonNullable<LearningBdc['section']>['revelation'],
): LearningDocument {
  const bdc = findBdc(document.bdcs, bdcId)
  const section = requireSectionData(bdc)
  assertTransitionOverride(revelation.intro)
  assertTransitionOverride(revelation.outro)
  return withBdc(document, { ...bdc, section: { ...section, revelation } })
}

/** Permanently deletes a Section and its anchored bdcs while retaining media. */
export function deleteSection(document: LearningDocument, bdcId: BdcId, resources: LearningCommandResourceServices): LearningDocument {
  const section = findBdc(document.bdcs, bdcId)
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
  for (const anchorBdcId of new Set(resources.anchorReferenceService.bdcIdsIn(sectionData.content))) {
    const anchorBdc = findBdc(updated.bdcs, anchorBdcId)
    switch (anchorBdc.type) {
      case BDC_TYPE.CARD:
      case BDC_TYPE.STATISTICAL_GRAPH:
        switch (anchorBdc.parentBdcId) {
          case section.id:
            updated = deleteBdc(updated, anchorBdc.id)
            break
          default:
            fail(`Le BDC illustratif ancré ${anchorBdcId} doit rester enfant de sa Section.`)
        }
        break
      default:
        fail(`Seules les Cartes et les Graphes statistiques peuvent être ancrés : ${anchorBdcId}`)
    }
  }
  return deleteBdc(updated, section.id)
}

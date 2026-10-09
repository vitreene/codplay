import { BDC_LOCATION, BDC_TYPE, CAROUSEL_CONFIG, DEFAULT_PRESET_ID, MEDIA_TYPE } from '../../../config/document-config'
import { ElceDocument } from '../../../domain/document/document-model'
import { mediaTypeFromMimeType } from '../../../domain/media/media-resource-service'
import type { Bdc } from '../../../domain/document/document-types'
import type { DocumentCommand } from '../document-command-types'
import { fail, findFluxPage, placeCardInSection, findBdc, requireSectionData, placeBdc } from './command-helpers'
import { findAnchorSection, updateSectionContent, findAnchorSectionForCard } from './section-commands'
import { anchorReferenceService, cardService } from './services'

/** Verifies the Card type and media category before a drop is attached. */
function assertSupportedAnchorMediaType(mediaType: ReturnType<typeof mediaTypeFromMimeType>): void {
  switch (mediaType) {
    case MEDIA_TYPE.IMAGE:
    case MEDIA_TYPE.VIDEO:
      return
    default:
      fail('Une Carte média doit référencer une image ou une vidéo.')
  }
}

/** Applies the one-command file/catalogue drop that creates and anchors a Card. */
export function createAnchoredBdc(
  document: ElceDocument,
  command: Extract<DocumentCommand, { type: 'bdc.anchor.create' }>,
): ElceDocument {
  findFluxPage(document, command.pageId)
  findAnchorSection(document, command.sectionBdcId, command.pageId)
  if (document.bdcs.some((bdc) => bdc.id === command.bdcId)) fail(`Bdc déjà présent : ${command.bdcId}`)
  if (!anchorReferenceService.bdcIdsIn(command.content).includes(command.bdcId)) fail(`L’ancre du bdc ${command.bdcId} manque dans la Section.`)

  const existingMedia = document.medias.find((media) => media.id === command.media.id)
  const media = existingMedia ?? command.media
  assertSupportedAnchorMediaType(mediaTypeFromMimeType(media.mimeType))
  switch (command.presetId) {
    case DEFAULT_PRESET_ID.PHOTO:
      break
    default:
      fail('Un dépôt média crée une Carte Photo ou vidéo plein cadre.')
  }
  const withMedia = existingMedia === undefined
    ? new ElceDocument({ ...document.data, medias: [...document.medias, media] })
    : document
  const bdc: Bdc = {
    id: command.bdcId,
    type: BDC_TYPE.CARD,
    presetId: command.presetId,
    pageId: null,
    parentBdcId: command.sectionBdcId,
    section: null,
    question: null,
    evaluationResult: null,
    carousel: null,
    card: { ...cardService.createDefault(CAROUSEL_CONFIG.defaultImagePosition), mediaId: media.id },
  }
  const withEntities = new ElceDocument({ ...withMedia.data, bdcs: [...withMedia.bdcs, bdc] })
  const withPlacement = placeCardInSection(withEntities, bdc, command.sectionBdcId)
  return updateSectionContent(withPlacement, command.sectionBdcId, undefined, command.markup, command.content)
}

/** Moves one unused unique media bdc from the catalogue into a Flux anchor. */
export function attachCatalogBdc(
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
    case BDC_TYPE.CARD:
      break
    default:
      fail(`Seule une Carte peut être insérée dans le texte : ${bdc.id}`)
  }
  if (bdc.card === null || bdc.card === undefined) fail(`La Carte ${bdc.id} est incomplète.`)
  if (bdc.presetId === DEFAULT_PRESET_ID.PHOTO) {
    if (bdc.card.mediaId === null) fail(`La Carte Photo ${bdc.id} ne référence aucun média.`)
    const media = document.medias.find((candidate) => candidate.id === bdc.card?.mediaId)
    if (media === undefined) fail(`Le média de la Carte ${bdc.id} est introuvable.`)
    assertSupportedAnchorMediaType(mediaTypeFromMimeType(media.mimeType))
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
  const placed = placeCardInSection(document, bdc, section.id)
  return updateSectionContent(placed, command.sectionBdcId, undefined, command.markup, command.content)
}

/** Applies an anchor repositioning while keeping its bdc assignment unchanged. */
export function moveAnchoredBdc(
  document: ElceDocument,
  command: Extract<DocumentCommand, { type: 'bdc.anchor.move' }>,
): ElceDocument {
  const anchorBdc = findBdc(document, command.anchorBdcId)
  const pageId = findAnchorSectionForCard(document, anchorBdc, command.sectionBdcId)
  findAnchorSection(document, command.sectionBdcId, pageId)
  if (!anchorReferenceService.bdcIdsIn(command.content).includes(command.anchorBdcId)) fail(`Le déplacement a perdu l’ancre ${command.anchorBdcId}.`)
  return updateSectionContent(document, command.sectionBdcId, undefined, command.markup, command.content)
}

/** Removes an anchor and deletes its unique bdc while preserving its media. */
export function removeAnchoredBdc(
  document: ElceDocument,
  command: Extract<DocumentCommand, { type: 'bdc.anchor.remove' }>,
): ElceDocument {
  const anchorBdc = findBdc(document, command.anchorBdcId)
  const pageId = findAnchorSectionForCard(document, anchorBdc, command.sectionBdcId)
  const section = findAnchorSection(document, command.sectionBdcId, pageId)
  if (!anchorReferenceService.bdcIdsIn(requireSectionData(section).content).includes(command.anchorBdcId)) {
    fail(`L’ancre ${command.anchorBdcId} est introuvable dans sa Section.`)
  }
  if (anchorReferenceService.bdcIdsIn(command.content).includes(command.anchorBdcId)) fail(`La nouvelle Section conserve l’ancre ${command.anchorBdcId}.`)
  return updateSectionContent(document, command.sectionBdcId, undefined, command.markup, command.content)
}

/** Returns an anchored bdc to the catalogue while removing its unique anchor. */
export function returnAnchoredBdc(
  document: ElceDocument,
  command: Extract<DocumentCommand, { type: 'bdc.anchor.return' }>,
): ElceDocument {
  const anchorBdc = findBdc(document, command.anchorBdcId)
  const pageId = findAnchorSectionForCard(document, anchorBdc, command.sectionBdcId)
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

/** Moves a BDC while preserving the ownership rules of an anchored Card. */
export function moveBdc(document: ElceDocument, command: Extract<DocumentCommand, { type: 'bdc.move' }>): ElceDocument {
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
      case BDC_LOCATION.PARENT:
        fail(`Le bdc ancré ${bdc.id} ne peut pas être placé dans un autre BDC.`)
    }
  }
  return placeBdc(document, bdc, command.placement)
}

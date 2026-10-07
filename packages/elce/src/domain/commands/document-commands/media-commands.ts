import { BDC_TYPE } from '../../../config/document-config'
import { ElceDocument } from '../../../domain/document/document-model'
import { mediaTypeFromMimeType } from '../../../domain/media/media-resource-service'
import type { BdcId, MediaId, MediaMetadata } from '../../../domain/document/document-types'
import { findBdc, fail, withBdc } from './command-helpers'

/** Attaches one reusable image or video resource to a Card BDC. */
export function setCardMedia(document: ElceDocument, bdcId: BdcId, mediaId: MediaId | null): ElceDocument {
  const bdc = findBdc(document, bdcId)
  if (bdc.type !== BDC_TYPE.CARD || bdc.card == null) fail(`Le bdc ${bdcId} n’est pas une Carte.`)
  if (mediaId !== null) assertCardMediaAllowed(document, mediaId)
  return withBdc(document, { ...bdc, card: { ...bdc.card, mediaId } })
}

/** Stores imported media and its Card BDC reference atomically. */
export function attachCardMedia(document: ElceDocument, bdcId: BdcId, media: MediaMetadata): ElceDocument {
  if (document.medias.some((candidate) => candidate.id === media.id)) fail(`Média déjà présent : ${media.id}`)
  const withMedia = new ElceDocument({ ...document.data, medias: [...document.medias, media] })
  return setCardMedia(withMedia, bdcId, media.id)
}

/** Validates Card media references independently of which layout projects them. */
export function assertCardMediaAllowed(document: ElceDocument, mediaId: MediaId): void {
  const media = document.medias.find((candidate) => candidate.id === mediaId)
  if (media === undefined || mediaTypeFromMimeType(media.mimeType) === null) {
    fail(`Le média ${mediaId} ne peut pas être rattaché à une Carte.`)
  }
}

/** Assigns a reusable image or video resource to the Question illustration. */
export function setQuestionMedia(document: ElceDocument, bdcId: BdcId, mediaId: MediaId | null): ElceDocument {
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
  if (bdc.question === null) fail(`Bdc Question incomplet : ${bdcId}`)
  return withBdc(document, { ...bdc, question: { ...bdc.question, mediaId } })
}

/** Adds an imported media resource and attaches it to one Question atomically. */
export function attachQuestionMedia(document: ElceDocument, bdcId: BdcId, media: MediaMetadata): ElceDocument {
  if (document.medias.some((candidate) => candidate.id === media.id)) fail(`Média déjà présent : ${media.id}`)
  const withMedia = new ElceDocument({ ...document.data, medias: [...document.medias, media] })
  return setQuestionMedia(withMedia, bdcId, media.id)
}

/** Keeps Question illustrations inside the media types supported by its card. */
export function assertQuestionMediaAllowed(document: ElceDocument, mediaId: MediaId): void {
  const media = document.medias.find((candidate) => candidate.id === mediaId)
  if (media === undefined) fail(`Le média ${mediaId} ne peut pas illustrer une Question.`)
  if (mediaTypeFromMimeType(media.mimeType) === null) fail(`Le média ${mediaId} ne peut pas illustrer une Question.`)
}

/** Rebinds each BDC from duplicate media records to one canonical record. */
export function mergeMedia(
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
        switch (media.mimeType === canonicalMedia.mimeType && media.size === canonicalMedia.size) {
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
      switch (bdc.type) {
        case BDC_TYPE.CARD:
          return bdc.card != null && duplicateIds.has(bdc.card.mediaId ?? '')
            ? { ...bdc, card: { ...bdc.card, mediaId: canonicalMediaId } }
            : bdc
        case BDC_TYPE.QUESTION:
          return bdc.question !== null && duplicateIds.has(bdc.question.mediaId ?? '')
            ? { ...bdc, question: { ...bdc.question, mediaId: canonicalMediaId } }
            : bdc
        default:
          return bdc
      }
    }),
    medias: document.medias.filter((media) => !duplicateIds.has(media.id)),
  })
}

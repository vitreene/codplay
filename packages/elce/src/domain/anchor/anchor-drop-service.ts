import {
  ANCHOR,
  ANCHOR_MEDIA_PRESETS,
  BDC_TYPE,
  CATALOG_REFERENCE,
  DEFAULT_PRESET_ID,
  MEDIA_TYPE,
  PAGE_TYPE,
} from '../../config/document-config'
import type { DocumentCommand } from '../commands/document-command-types'
import { createStableId, type ElceDocument } from '../document/document-model'
import { ElceMediaResourceService, mediaTypeFromMimeType } from '../media/media-resource-service'
import type {
  ElceCatalogBdcEntry,
  ElceCatalogContents,
  ElceCatalogDropTarget,
  ElceCatalogMediaEntry,
  ElceCatalogReference,
} from '../catalog/catalog-types'
import type { ElceAnchorDropTarget, ElceSectionChange } from './anchor-types'
import type { Bdc, MediaMetadata, PageId } from '../document/document-types'

const mediaResourceService = new ElceMediaResourceService()

/** Builds métier targets and commands for file and catalogue anchor drops. */
export class ElceAnchorDropService {
  /** Lists every top-level BDC in the catalogue and its reusable media. */
  public catalogContents(document: ElceDocument): ElceCatalogContents {
    const bdcs: ElceCatalogBdcEntry[] = []
    const mediaEntries: ElceCatalogMediaEntry[] = []
    for (const bdcId of document.data.catalogBdcIds) {
      const bdc = document.bdcs.find((candidate) => candidate.id === bdcId)
      if (bdc === undefined || bdc.pageId !== null || bdc.parentBdcId !== null) continue
      bdcs.push({
        key: `${CATALOG_REFERENCE.BDC}:${bdc.id}`,
        name: catalogBdcName(document, bdc),
        bdcType: bdc.type,
        reference: { kind: CATALOG_REFERENCE.BDC, bdcId: bdc.id },
      })
    }
    for (const media of document.medias) {
      switch (mediaTypeFromMimeType(media.mimeType)) {
        case MEDIA_TYPE.IMAGE:
          mediaEntries.push({
            key: `${CATALOG_REFERENCE.MEDIA}:${media.id}`,
            name: media.name,
            mediaType: MEDIA_TYPE.IMAGE,
            reference: { kind: CATALOG_REFERENCE.MEDIA, mediaId: media.id },
          })
          break
        case MEDIA_TYPE.VIDEO:
          mediaEntries.push({
            key: `${CATALOG_REFERENCE.MEDIA}:${media.id}`,
            name: media.name,
            mediaType: MEDIA_TYPE.VIDEO,
            reference: { kind: CATALOG_REFERENCE.MEDIA, mediaId: media.id },
          })
          break
        default:
          break
      }
    }
    return { bdcs, media: mediaEntries }
  }

  /** Creates a typed, stable target for one accepted file drop. */
  public createFileDropTarget(file: File, pageId: PageId): ElceAnchorDropTarget | null {
    const mediaImport = mediaResourceService.createImport(file)
    switch (mediaImport) {
      case null:
        return null
      default:
        return createMediaDropTarget(mediaImport.media, pageId)
    }
  }

  /** Resolves a catalogue reference only for the current Flux Section editor. */
  public createCatalogDropTarget(
    document: ElceDocument,
    reference: ElceCatalogReference,
    pageId: PageId | null,
    sectionBdcId: string,
  ): ElceCatalogDropTarget | null {
    switch (pageId) {
      case null:
        return null
      default:
        switch (isFluxSection(document, pageId, sectionBdcId)) {
          case false:
            return null
          case true:
            switch (reference.kind) {
              case CATALOG_REFERENCE.BDC:
                return createCatalogBdcDropTarget(document, reference, pageId)
              case CATALOG_REFERENCE.MEDIA:
                return createReusableMediaDropTarget(document, reference, pageId)
            }
        }
    }
  }

  /** Builds the document command emitted after XState has accepted the change. */
  public createDocumentCommand(sectionBdcId: string, change: ElceSectionChange): DocumentCommand {
    switch (change.kind) {
      case 'file-drop':
        return {
          type: 'bdc.anchor.create',
          sectionBdcId,
          pageId: change.target.pageId,
          bdcId: change.target.bdcId,
          presetId: change.target.presetId,
          media: change.target.media,
          partId: change.target.partId,
          content: change.content,
          markup: change.markup,
        }
      case 'catalog-drop':
        switch (change.target.source) {
          case CATALOG_REFERENCE.BDC:
            return {
              type: 'bdc.anchor.attach',
              sectionBdcId,
              pageId: change.target.pageId,
              bdcId: change.target.bdcId,
              content: change.content,
              markup: change.markup,
            }
          case CATALOG_REFERENCE.MEDIA:
            return {
              type: 'bdc.anchor.create',
              sectionBdcId,
              pageId: change.target.pageId,
              bdcId: change.target.bdcId,
              presetId: change.target.presetId,
              media: change.target.media,
              partId: change.target.partId,
              content: change.content,
              markup: change.markup,
            }
        }
      case 'anchor-move':
        return {
          type: 'bdc.anchor.move',
          sectionBdcId,
          anchorBdcId: change.anchorBdcId,
          content: change.content,
          markup: change.markup,
        }
      case 'anchor-remove':
        return {
          type: 'bdc.anchor.remove',
          sectionBdcId,
          anchorBdcId: change.anchorBdcId,
          content: change.content,
          markup: change.markup,
        }
      case 'anchor-return':
        return {
          type: 'bdc.anchor.return',
          sectionBdcId,
          anchorBdcId: change.anchorBdcId,
          content: change.content,
          markup: change.markup,
        }
      case 'content':
        return {
          type: 'bdc.section.update',
          bdcId: sectionBdcId,
          title: change.title,
          content: change.content,
          markup: change.markup,
        }
    }
  }
}

/** Maps supported file MIME types to their configured media categories. */
/** Checks that a catalogue reference still belongs to this Flux Section. */
function isFluxSection(document: ElceDocument, pageId: PageId, sectionBdcId: string): boolean {
  const page = document.pages.find((candidate) => candidate.id === pageId)
  switch (page?.type) {
    case PAGE_TYPE.FLUX:
      break
    default:
      return false
  }
  const section = document.bdcs.find((candidate) => candidate.id === sectionBdcId)
  switch (section?.type) {
    case BDC_TYPE.SECTION:
      switch (section.pageId) {
        case pageId:
          return section.section !== null
        default:
          return false
      }
    default:
      return false
  }
}

/** Finds one available Card and derives the reservation for its selected layout. */
function readCatalogCard(document: ElceDocument, bdcId: string): Readonly<{ bdc: Bdc; paddingBottom: string }> | null {
  if (!document.data.catalogBdcIds.includes(bdcId)) return null
  const bdc = document.bdcs.find((candidate) => candidate.id === bdcId)
  if (bdc?.type !== BDC_TYPE.CARD || bdc.card == null || bdc.pageId !== null || bdc.parentBdcId !== null) return null
  if (bdc.presetId !== DEFAULT_PRESET_ID.PHOTO) {
    return { bdc, paddingBottom: ANCHOR.DEFAULT_PADDING_BOTTOM }
  }
  const media = bdc.card.mediaId === null
    ? undefined
    : document.medias.find((candidate) => candidate.id === bdc.card?.mediaId)
  const mediaType = media === undefined ? null : mediaTypeFromMimeType(media.mimeType)
  if (mediaType !== MEDIA_TYPE.IMAGE && mediaType !== MEDIA_TYPE.VIDEO) return null
  return { bdc, paddingBottom: ANCHOR_MEDIA_PRESETS[mediaType].blockSize }
}

/** Builds a target that moves one available bdc into this page's text. */
function createCatalogBdcDropTarget(
  document: ElceDocument,
  reference: Extract<ElceCatalogReference, { kind: typeof CATALOG_REFERENCE.BDC }>,
  pageId: PageId,
): ElceCatalogDropTarget | null {
  const item = readCatalogCard(document, reference.bdcId)
  switch (item) {
    case null:
      return null
    default:
      return {
        source: CATALOG_REFERENCE.BDC,
        reference,
        pageId,
        bdcId: item.bdc.id,
        presetId: item.bdc.presetId,
        partId: `${pageId}:${item.bdc.id}:anchor`,
        paddingBottom: item.paddingBottom,
      }
  }
}

/** Chooses a readable catalogue name from the BDC's authored content. */
function catalogBdcName(document: ElceDocument, bdc: Bdc): string {
  switch (bdc.type) {
    case BDC_TYPE.SECTION:
      return bdc.section?.title.trim() || 'Texte'
    case BDC_TYPE.CARD: {
      const cardText = [bdc.card?.title, bdc.card?.overline, bdc.card?.message, bdc.card?.description, bdc.card?.caption, bdc.card?.note]
        .find((value) => value?.trim().length)
      if (cardText !== undefined) return cardText.trim()
      const media = bdc.card?.mediaId === null || bdc.card?.mediaId === undefined
        ? undefined
        : document.medias.find((candidate) => candidate.id === bdc.card?.mediaId)
      return media?.name ?? 'Carte'
    }
    case BDC_TYPE.QUESTION:
      return bdc.question?.title.trim() || 'Question'
    case BDC_TYPE.EVALUATION_RESULT:
      return 'Résultat d’évaluation'
    case BDC_TYPE.CAROUSEL:
      return 'Carousel'
    default:
      return assertNeverBdcType(bdc.type)
  }
}

/** Keeps catalogue naming exhaustive when a BDC type is added. */
function assertNeverBdcType(value: never): never {
  throw new Error(`Type de BDC non pris en charge : ${String(value)}`)
}

/** Builds a unique Card target while retaining the referenced media resource. */
function createReusableMediaDropTarget(
  document: ElceDocument,
  reference: Extract<ElceCatalogReference, { kind: typeof CATALOG_REFERENCE.MEDIA }>,
  pageId: PageId,
): ElceCatalogDropTarget | null {
  const media = document.medias.find((candidate) => candidate.id === reference.mediaId)
  if (media === undefined) return null
  const mediaType = mediaTypeFromMimeType(media.mimeType)
  switch (mediaType) {
    case MEDIA_TYPE.IMAGE:
    case MEDIA_TYPE.VIDEO: {
      const preset = ANCHOR_MEDIA_PRESETS[mediaType]
      const bdcId = createStableId('bdc-card')
      return {
        source: CATALOG_REFERENCE.MEDIA,
        reference,
        pageId,
        bdcId,
        media,
        presetId: preset.presetId,
        partId: `${pageId}:${bdcId}:anchor`,
        paddingBottom: preset.blockSize,
      }
    }
    default:
      return null
  }
}

/** Builds the stable Card reference created by one accepted file drop. */
function createMediaDropTarget(media: MediaMetadata, pageId: PageId): ElceAnchorDropTarget {
  const mediaType = mediaTypeFromMimeType(media.mimeType)
  if (mediaType === null) throw new Error(`Type média non pris en charge : ${media.mimeType}`)
  const preset = ANCHOR_MEDIA_PRESETS[mediaType]
  const bdcId = createStableId('bdc-card')
  return {
    pageId,
    bdcId,
    media,
    presetId: preset.presetId,
    partId: `${pageId}:${bdcId}:anchor`,
    paddingBottom: preset.blockSize,
  }
}

import {
  ANCHOR_MEDIA_PRESETS,
  BDC_TYPE,
  CATALOG_REFERENCE,
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
  ElceCatalogMediaType,
  ElceCatalogReference,
} from '../catalog/catalog-types'
import type { ElceAnchorDropTarget, ElceSectionChange } from './anchor-types'
import type { Bdc, MediaMetadata, PageId } from '../document/document-types'

type AnchorMediaPreset = typeof ANCHOR_MEDIA_PRESETS[typeof MEDIA_TYPE.IMAGE]
  | typeof ANCHOR_MEDIA_PRESETS[typeof MEDIA_TYPE.VIDEO]

type CatalogBdcContent = Readonly<{
  bdc: Bdc
  media: MediaMetadata
  mediaType: ElceCatalogMediaType
  preset: AnchorMediaPreset
}>

const mediaResourceService = new ElceMediaResourceService()

/** Builds métier targets and commands for file and catalogue anchor drops. */
export class ElceAnchorDropService {
  /** Lists the unused media blocks and reusable media allowed by the editor. */
  public catalogContents(document: ElceDocument): ElceCatalogContents {
    const bdcs: ElceCatalogBdcEntry[] = []
    const mediaEntries: ElceCatalogMediaEntry[] = []
    for (const bdcId of document.data.catalogBdcIds) {
      const item = readCatalogBdcContent(document, bdcId)
      switch (item) {
        case null:
          break
        default:
          bdcs.push({
            key: `${CATALOG_REFERENCE.BDC}:${item.bdc.id}`,
            name: item.media.name,
            mediaType: item.mediaType,
            reference: { kind: CATALOG_REFERENCE.BDC, bdcId: item.bdc.id },
          })
      }
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

/** Finds an available Photo Card together with its reusable media. */
function readCatalogBdcContent(document: ElceDocument, bdcId: string): CatalogBdcContent | null {
  switch (document.data.catalogBdcIds.includes(bdcId)) {
    case false:
      return null
    case true:
      break
  }
  const bdc = document.bdcs.find((candidate) => candidate.id === bdcId)
  switch (bdc) {
    case undefined:
      return null
    default:
      switch (bdc.pageId) {
        case null:
          break
        default:
          return null
      }
  }
  switch (bdc) {
    case undefined:
      return null
    default:
      switch (bdc.type) {
        case BDC_TYPE.CARD:
          switch (bdc.presetId === ANCHOR_MEDIA_PRESETS[MEDIA_TYPE.IMAGE].presetId) {
            case false:
              return null
            case true:
              break
          }
          switch (bdc.card?.mediaId) {
            case null:
              return null
            default: {
              const media = document.medias.find((candidate) => candidate.id === bdc.card?.mediaId)
              if (media === undefined) return null
              const mediaType = mediaTypeFromMimeType(media.mimeType)
              switch (mediaType) {
                case MEDIA_TYPE.IMAGE:
                case MEDIA_TYPE.VIDEO:
                  return readMatchingCatalogMedia(document, bdc, mediaType, ANCHOR_MEDIA_PRESETS[mediaType])
                default:
                  return null
              }
            }
          }
        default:
          return null
      }
  }
}

/** Matches a catalogue Card to the media and preset that can be anchored. */
function readMatchingCatalogMedia(
  document: ElceDocument,
  bdc: Bdc,
  mediaType: ElceCatalogMediaType,
  preset: AnchorMediaPreset,
): CatalogBdcContent | null {
  switch (bdc.card?.mediaId) {
    case null:
      return null
    default: {
      const media = document.medias.find((candidate) => candidate.id === bdc.card?.mediaId)
      switch (media) {
        case undefined:
          return null
        default:
          switch (mediaTypeFromMimeType(media.mimeType)) {
            case mediaType:
              switch (bdc.type) {
                case BDC_TYPE.CARD:
                  switch (bdc.presetId === preset.presetId) {
                    case true:
                      return { bdc, media, mediaType, preset }
                    case false:
                      return null
                  }
                default:
                  return null
              }
            default:
              return null
          }
      }
    }
  }
}

/** Builds a target that moves one available bdc into this page's text. */
function createCatalogBdcDropTarget(
  document: ElceDocument,
  reference: Extract<ElceCatalogReference, { kind: typeof CATALOG_REFERENCE.BDC }>,
  pageId: PageId,
): ElceCatalogDropTarget | null {
  const item = readCatalogBdcContent(document, reference.bdcId)
  switch (item) {
    case null:
      return null
    default:
      return {
        source: CATALOG_REFERENCE.BDC,
        reference,
        pageId,
        bdcId: item.bdc.id,
        presetId: item.preset.presetId,
        partId: `${pageId}:${item.bdc.id}:anchor`,
        paddingBottom: item.preset.blockSize,
      }
  }
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

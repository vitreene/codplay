import {
  ANCHOR_MEDIA_PRESETS,
  BDC_TYPE,
  CATALOG_REFERENCE,
  MEDIA_TYPE,
  PAGE_TYPE,
} from '../config/document-config'
import type { DocumentCommand } from '../app/commands/document-command-types'
import { createStableId, type ElceDocument } from './document-model'
import { ElceMediaResourceService } from './media-resource-service'
import type {
  ElceCatalogBdcEntry,
  ElceCatalogContents,
  ElceCatalogDropTarget,
  ElceCatalogMediaEntry,
  ElceCatalogMediaType,
  ElceCatalogReference,
} from './catalog-types'
import type { ElceAnchorDropTarget, ElceSectionChange } from './anchor-types'
import type { Bdc, MediaMetadata, PageId } from './document-types'

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
      switch (media.type) {
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
        case MEDIA_TYPE.AUDIO:
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
        switch (mediaImport.media.type) {
          case MEDIA_TYPE.IMAGE:
          case MEDIA_TYPE.VIDEO:
            return createMediaDropTarget(mediaImport.media, pageId, mediaImport.media.type)
          case MEDIA_TYPE.AUDIO:
            return null
        }
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
          bdcType: change.target.bdcType,
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
              bdcType: change.target.bdcType,
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

/** Finds an available image or video bdc together with its reusable media. */
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
        case BDC_TYPE.IMAGE:
          return readMatchingCatalogMedia(document, bdc, MEDIA_TYPE.IMAGE, ANCHOR_MEDIA_PRESETS[MEDIA_TYPE.IMAGE])
        case BDC_TYPE.VIDEO:
          return readMatchingCatalogMedia(document, bdc, MEDIA_TYPE.VIDEO, ANCHOR_MEDIA_PRESETS[MEDIA_TYPE.VIDEO])
        default:
          return null
      }
  }
}

/** Matches a catalogue bdc to the media and preset that can be anchored. */
function readMatchingCatalogMedia(
  document: ElceDocument,
  bdc: Bdc,
  mediaType: ElceCatalogMediaType,
  preset: AnchorMediaPreset,
): CatalogBdcContent | null {
  switch (bdc.mediaId) {
    case null:
      return null
    default: {
      const media = document.medias.find((candidate) => candidate.id === bdc.mediaId)
      switch (media) {
        case undefined:
          return null
        default:
          switch (media.type) {
            case mediaType:
              switch (bdc.type) {
                case preset.bdcType:
                  return { bdc, media, mediaType, preset }
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
        mediaId: item.media.id,
        bdcType: item.preset.bdcType,
        presetId: item.preset.presetId,
        partId: `${pageId}:${item.bdc.id}:anchor`,
        paddingBottom: item.preset.blockSize,
      }
  }
}

/** Builds a new bdc target while retaining the referenced media resource. */
function createReusableMediaDropTarget(
  document: ElceDocument,
  reference: Extract<ElceCatalogReference, { kind: typeof CATALOG_REFERENCE.MEDIA }>,
  pageId: PageId,
): ElceCatalogDropTarget | null {
  const media = document.medias.find((candidate) => candidate.id === reference.mediaId)
  switch (media?.type) {
    case MEDIA_TYPE.IMAGE:
    case MEDIA_TYPE.VIDEO: {
      const preset = ANCHOR_MEDIA_PRESETS[media.type]
      const bdcId = createStableId(`bdc-${media.type}`)
      return {
        source: CATALOG_REFERENCE.MEDIA,
        reference,
        pageId,
        bdcId,
        mediaId: media.id,
        media,
        bdcType: preset.bdcType,
        presetId: preset.presetId,
        partId: `${pageId}:${bdcId}:anchor`,
        paddingBottom: preset.blockSize,
      }
    }
    default:
      return null
  }
}

/** Builds the stable document references created by one accepted file drop. */
function createMediaDropTarget(media: MediaMetadata, pageId: PageId, mediaType: ElceCatalogMediaType): ElceAnchorDropTarget {
  const preset = ANCHOR_MEDIA_PRESETS[mediaType]
  const bdcId = createStableId(`bdc-${mediaType}`)
  return {
    pageId,
    bdcId,
    mediaId: media.id,
    media,
    bdcType: preset.bdcType,
    presetId: preset.presetId,
    partId: `${pageId}:${bdcId}:anchor`,
    paddingBottom: preset.blockSize,
  }
}

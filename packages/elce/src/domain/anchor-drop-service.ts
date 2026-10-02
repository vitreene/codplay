import { DEFAULT_PRESET_ID } from '../config/document-config'
import type { DocumentCommand } from '../app/commands/document-command-types'
import { createStableId } from './document-model'
import type { ElceAnchorDropTarget, ElceSectionChange } from './anchor-types'
import type { PageId } from './document-types'

/** Builds the métier data and document commands for an anchor transaction. */
export class ElceAnchorDropService {
  /** Creates a typed, stable target for an accepted file drop. */
  public createFileDropTarget(file: File, pageId: PageId): ElceAnchorDropTarget | null {
    const mediaType = mediaTypeFor(file.type)
    switch (mediaType) {
      case 'image':
        return createMediaDropTarget(file, pageId, mediaType, DEFAULT_PRESET_ID.IMAGE, '75%')
      case 'video':
        return createMediaDropTarget(file, pageId, mediaType, DEFAULT_PRESET_ID.VIDEO, '56.25%')
      default:
        return null
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

/** Keeps the accepted media kinds explicit at the business boundary. */
function mediaTypeFor(mimeType: string): 'image' | 'video' | null {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  return null
}

/** Builds the stable document references created by one accepted file drop. */
function createMediaDropTarget(
  file: File,
  pageId: PageId,
  mediaType: 'image' | 'video',
  presetId: string,
  paddingBottom: string,
): ElceAnchorDropTarget {
  const mediaId = createStableId(`media-${mediaType}`)
  const bdcId = createStableId(`bdc-${mediaType}`)
  return {
    pageId,
    bdcId,
    mediaId,
    media: {
      id: mediaId,
      type: mediaType,
      name: file.name,
      mimeType: file.type || `${mediaType}/*`,
      size: file.size,
      caption: '',
    },
    bdcType: mediaType,
    presetId,
    partId: `${pageId}:${bdcId}:anchor`,
    paddingBottom,
  }
}

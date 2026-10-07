import { MEDIA_MIME_PREFIX, MEDIA_TYPE } from '../../config/document-config'
import { createStableId } from '../document/document-model'
import type { MediaId, MediaMetadata } from '../document/document-types'
import type { ElceMediaImport } from './media-resource-types'

export type SupportedMediaType = typeof MEDIA_TYPE.IMAGE | typeof MEDIA_TYPE.VIDEO

/** Derives the supported render category from a resource's persisted MIME type. */
export function mediaTypeFromMimeType(mimeType: string): SupportedMediaType | null {
  switch (true) {
    case mimeType.startsWith(MEDIA_MIME_PREFIX.IMAGE):
      return MEDIA_TYPE.IMAGE
    case mimeType.startsWith(MEDIA_MIME_PREFIX.VIDEO):
      return MEDIA_TYPE.VIDEO
    default:
      return null
  }
}

/** Creates reusable image and video resources without creating a BDC. */
export class ElceMediaResourceService {
  /** Converts a supported desktop file into catalogue metadata and its binary. */
  public createImport(file: File): ElceMediaImport | null {
    const mediaType = mediaTypeFromMimeType(file.type)
    switch (mediaType) {
      case null:
        return null
      default: {
        const mediaId = createStableId(`media-${mediaType}`)
        return {
          file,
          media: {
            id: mediaId,
            name: file.name,
            mimeType: file.type || `${mediaType}/*`,
            size: file.size,
            caption: '',
          },
        }
      }
    }
  }

  /** Finds an existing resource with the same size and exact file bytes. */
  public async findDuplicate(
    file: File,
    existingMedia: readonly MediaMetadata[],
    loadMedia: (mediaId: MediaId) => Promise<Blob | null>,
  ): Promise<MediaMetadata | null> {
    const fingerprint = await this.sha256(file)
    for (const candidate of existingMedia) {
      switch (candidate.size === file.size) {
        case false:
          continue
        case true:
          break
      }
      const blob = await loadMedia(candidate.id)
      switch (blob) {
        case null:
          continue
        default:
          break
      }
      switch (blob.size === file.size) {
        case false:
          continue
        case true:
          break
      }
      switch (await this.sha256(blob) === fingerprint) {
        case true:
          return candidate
        case false:
          break
      }
    }
    return null
  }

  /** Returns a SHA-256 fingerprint for exact binary equality checks. */
  private async sha256(blob: Blob): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  }
}

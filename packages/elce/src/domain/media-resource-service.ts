import { MEDIA_MIME_PREFIX, MEDIA_TYPE } from '../config/document-config'
import { createStableId } from './document-model'
import type { MediaId, MediaMetadata } from './document-types'
import type { ElceMediaImport } from './media-resource-types'

/** Creates reusable image and video resources without creating a BDC. */
export class ElceMediaResourceService {
  /** Converts a supported desktop file into catalogue metadata and its binary. */
  public createImport(file: File): ElceMediaImport | null {
    const mediaType = this.mediaTypeFor(file.type)
    switch (mediaType) {
      case null:
        return null
      default: {
        const mediaId = createStableId(`media-${mediaType}`)
        return {
          file,
          media: {
            id: mediaId,
            type: mediaType,
            name: file.name,
            mimeType: file.type || `${mediaType}/*`,
            size: file.size,
            caption: '',
          },
        }
      }
    }
  }

  /** Finds an existing resource with the same media type and exact file bytes. */
  public async findDuplicate(
    file: File,
    media: MediaMetadata,
    existingMedia: readonly MediaMetadata[],
    loadMedia: (mediaId: MediaId) => Promise<Blob | null>,
  ): Promise<MediaMetadata | null> {
    const fingerprint = await this.sha256(file)
    for (const candidate of existingMedia) {
      switch (candidate.type === media.type && candidate.size === file.size) {
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

  /** Applies the configured image/video import whitelist to a MIME type. */
  private mediaTypeFor(mimeType: string): typeof MEDIA_TYPE.IMAGE | typeof MEDIA_TYPE.VIDEO | null {
    switch (true) {
      case mimeType.startsWith(MEDIA_MIME_PREFIX.IMAGE):
        return MEDIA_TYPE.IMAGE
      case mimeType.startsWith(MEDIA_MIME_PREFIX.VIDEO):
        return MEDIA_TYPE.VIDEO
      default:
        return null
    }
  }

  /** Returns a SHA-256 fingerprint for exact binary equality checks. */
  private async sha256(blob: Blob): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  }
}

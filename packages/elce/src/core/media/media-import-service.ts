import type { MediaId, MediaMetadata } from '../document/content-document-types'
import { ElceMediaResourceService } from '../../domain/media/media-resource-service'

export interface MediaImportStore {
  loadMedia(mediaId: MediaId): Promise<Blob | null>
  saveMedia(media: Readonly<{ id: MediaId; blob: Blob }>): Promise<void>
  deleteMedia(mediaIds: readonly MediaId[]): Promise<void>
}

const mediaResourceService = new ElceMediaResourceService()

/** Reuses an exact media resource or persists the imported bytes once. */
export async function resolveImportedMedia(
  file: File,
  media: MediaMetadata,
  document: Readonly<{ medias: readonly MediaMetadata[] }>,
  store: MediaImportStore,
  signal: AbortSignal,
): Promise<Readonly<{ media: MediaMetadata; created: boolean }>> {
  const duplicate = await mediaResourceService.findDuplicate(
    file,
    document.medias,
    (mediaId) => store.loadMedia(mediaId),
  )
  if (signal.aborted) throw new Error('Import annulé.')
  if (duplicate !== null) return { media: duplicate, created: false }

  try {
    await store.saveMedia({ id: media.id, blob: file })
    if (signal.aborted) throw new Error('Import annulé.')
  } catch (error) {
    try {
      await store.deleteMedia([media.id])
    } catch {
      // Preserve the storage error that rejected the import.
    }
    throw error
  }
  return { media, created: true }
}

/** Creates the player source after a new media blob has been persisted. */
export function createObjectUrl(file: File): string | null {
  return typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
    ? URL.createObjectURL(file)
    : null
}

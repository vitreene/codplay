import { createHash, randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { FileStorage } from 'remix/file-storage'
import { openLazyFile, writeFile } from 'remix/fs'
import type { LazyFile } from 'remix/lazy-file'
import { createFileResponse } from 'remix/response/file'
import { mediaTypeFromMimeType } from '../../domain/media/media-resource-service'
import { removeUnreferencedMediaFiles } from './media-file-storage'
import type { MediaPersistence, StoredMediaResource } from './media-persistence'

/** Handles raw media uploads and streamed file responses. */
export class MediaApiController {
  private readonly persistence: MediaPersistence
  private readonly storage: FileStorage<LazyFile>
  private readonly temporaryDirectory: string
  private readonly inFlightStorageKeys = new Set<string>()

  /** Creates the controller over SQLite metadata and Remix filesystem storage. */
  public constructor(
    persistence: MediaPersistence,
    storage: FileStorage<LazyFile>,
    temporaryDirectory: string,
  ) {
    this.persistence = persistence
    this.storage = storage
    this.temporaryDirectory = temporaryDirectory
  }

  /** Streams one raw PUT body to disk, then publishes its completed file reference. */
  public async upload(request: Request, projectId: string, mediaId: string): Promise<Response> {
    const media = await this.persistence.findMediaFile(projectId, mediaId)
    if (media === null) return mediaError('media_not_found', 404)
    if (mediaTypeFromMimeType(media.mimeType) === null) return mediaError('unsupported_media_type', 415)
    if (request.body === null) return mediaError('invalid_media_body', 400)

    await mkdir(this.temporaryDirectory, { recursive: true })
    const directory = await mkdtemp(join(this.temporaryDirectory, 'upload-'))
    const temporaryPath = join(directory, 'upload')
    const contentHash = createHash('sha256')
    let receivedSize = 0
    let unpublishedStorageKey: string | null = null
    let inFlightStorageKey: string | null = null

    try {
      await writeFile(temporaryPath, {
        stream: () => request.body!.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            receivedSize += chunk.byteLength
            if (receivedSize > media.size) {
              controller.error(new Error('media_size_mismatch'))
              return
            }
            contentHash.update(chunk)
            controller.enqueue(chunk)
          },
        })),
      })
      if (receivedSize !== media.size) return mediaError('media_size_mismatch', 400)

      const sha256 = contentHash.digest('hex')
      if (media.storageKey !== null) {
        return media.contentSha256 === sha256
          ? new Response(null, { status: 204 })
          : mediaError('media_already_has_file', 409)
      }

      const storageKey = mediaStorageKey(projectId, mediaId, sha256, randomUUID())
      unpublishedStorageKey = storageKey
      inFlightStorageKey = storageKey
      this.inFlightStorageKeys.add(storageKey)
      await this.storage.put(storageKey, openLazyFile(temporaryPath, {
        name: media.name,
        type: media.mimeType,
      }))
      const result = await this.persistence.storeMediaFile(
        projectId,
        mediaId,
        media.size,
        storageKey,
        sha256,
      )

      switch (result.kind) {
        case 'stored':
          unpublishedStorageKey = null
          return Response.json({ media: mediaResponse(media, projectId) }, { status: 201 })
        case 'already-stored':
          await this.storage.remove(storageKey)
          unpublishedStorageKey = null
          return new Response(null, { status: 204 })
        case 'media-not-found':
          await this.storage.remove(storageKey)
          unpublishedStorageKey = null
          return mediaError('media_not_found', 404)
        case 'media-changed':
          await this.storage.remove(storageKey)
          unpublishedStorageKey = null
          return mediaError('media_changed', 409)
        case 'media-already-has-file':
          await this.storage.remove(storageKey)
          unpublishedStorageKey = null
          return mediaError('media_already_has_file', 409)
        case 'duplicate-content':
          await this.storage.remove(storageKey)
          unpublishedStorageKey = null
          return Response.json({
            error: 'media_already_exists',
            mediaId: result.existingMediaId,
          }, { status: 409 })
        default:
          return unhandledMediaUploadResult(result)
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'media_size_mismatch') {
        return mediaError('media_size_mismatch', 400)
      }
      throw error
    } finally {
      if (inFlightStorageKey !== null) {
        this.inFlightStorageKeys.delete(inFlightStorageKey)
        await this.removeUnreferencedFiles()
      }
      if (unpublishedStorageKey !== null) await this.storage.remove(unpublishedStorageKey)
      await rm(directory, { recursive: true, force: true })
    }
  }

  /** Streams one previously uploaded media file with Remix's native file semantics. */
  public async read(request: Request, projectId: string, mediaId: string): Promise<Response> {
    const media = await this.persistence.findMediaFile(projectId, mediaId)
    if (media === null || media.storageKey === null) return mediaError('media_not_found', 404)

    const file = await this.storage.get(media.storageKey)
    if (file === null) return mediaError('media_not_found', 404)
    return createFileResponse(file, request, {
      cacheControl: 'public, max-age=31536000, immutable',
    })
  }

  /** Removes media files no longer referenced by the saved project documents. */
  public async removeUnreferencedFiles(): Promise<void> {
    await removeUnreferencedMediaFiles(this.storage, this.persistence, this.inFlightStorageKeys)
  }
}

/** Builds a safe logical FileStorage key from the owning records and content hash. */
function mediaStorageKey(projectId: string, mediaId: string, sha256: string, uploadId: string): string {
  return `media/${encodeURIComponent(projectId)}/${encodeURIComponent(mediaId)}/${sha256}/${uploadId}`
}

/** Builds the stable same-origin media URL returned after a successful upload. */
function mediaResponse(
  media: StoredMediaResource,
  projectId: string,
): Readonly<{ id: string; url: string }> {
  const safeProjectId = encodeURIComponent(projectId)
  return {
    id: media.id,
    url: `/api/projects/${safeProjectId}/media/${encodeURIComponent(media.id)}`,
  }
}

/** Returns a consistent media API error response. */
function mediaError(code: string, status: number): Response {
  return Response.json({ error: code }, { status })
}

/** Makes a newly added media persistence result visible to the controller typecheck. */
function unhandledMediaUploadResult(result: never): never {
  throw new Error(`Résultat de stockage média non traité : ${String(result)}`)
}

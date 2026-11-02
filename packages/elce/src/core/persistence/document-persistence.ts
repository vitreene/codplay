import type { ProjectControllerPort } from '../controller/controller-types'
import type { MediaId } from '../document/content-document-types'
import { retainedHistoryMediaIds } from '../history/document-history'
import { MEDIA_TYPE } from '../media/media-config'
import { mediaTypeFromMimeType } from '../media/media-resource-service'
import type { DocumentStore } from './indexed-db/document-store-types'
import type { ProjectSessionOperation } from '../projects/project-session-types'
import type { ProjectDocumentServices } from '../projects/project-document-services'

export interface DocumentPersistenceOptions<TDocument> {
  readonly mediaSourceUrl?: (documentId: string, mediaId: MediaId) => string
  readonly onLocalSave?: (document: TDocument) => void
}

export interface AttachedDocumentPersistence<TDocument> {
  flushLocalChanges(): Promise<void>
  restoreCurrentDocument(): Promise<void>
  installServerDocument(document: TDocument, uploadedMediaIds: readonly MediaId[]): Promise<void>
  detach(): void
}

/** Restores the controller once and persists later document commits. */
export async function attachDocumentPersistence<TDocument, TSelection, TProject>(
  controller: ProjectControllerPort<TDocument, TSelection, TProject, ProjectSessionOperation>,
  store: DocumentStore<TDocument>,
  documentServices: ProjectDocumentServices<TDocument>,
  options: DocumentPersistenceOptions<TDocument> = {},
): Promise<AttachedDocumentPersistence<TDocument>> {
  let persistedDocument = controller.getSnapshot().context.document
  const historyMediaIds = (document: TDocument): readonly MediaId[] => documentServices.media(document).map((media) => media.id)
  let retainedMediaIds = retainedHistoryMediaIds(controller.getSnapshot().context.history, historyMediaIds)
  let pendingSave = Promise.resolve()
  let lastSaveError: unknown = null

  /** Restores the latest active-document cache before this window can edit. */
  async function restoreCurrentDocument(): Promise<void> {
    await pendingSave
    if (lastSaveError !== null) throw lastSaveError

    const currentDocument = controller.getSnapshot().context.document
    const currentDocumentId = documentServices.id(currentDocument)
    const storedDocument = await store.loadDocument(currentDocumentId)
    if (storedDocument === null) {
      await store.saveDocument(currentDocument)
      persistedDocument = currentDocument
      options.onLocalSave?.(currentDocument)
      return
    }

    const sameDocument = JSON.stringify(documentServices.serialize(currentDocument)) === JSON.stringify(documentServices.serialize(storedDocument))
    persistedDocument = sameDocument ? currentDocument : storedDocument
    if (!sameDocument) {
      revokeRegisteredMediaSources(controller)
      controller.send({ type: 'document.replace', document: storedDocument })
    }
    const syncState = await store.loadSyncState(documentServices.id(storedDocument))
    controller.send({ type: 'document.sync.status', status: syncState.status })
    await restoreMediaSources(controller, sameDocument ? currentDocument : storedDocument, store, documentServices, syncState.uploadedMediaIds, options.mediaSourceUrl)
    if (syncState.status !== 'synced') options.onLocalSave?.(persistedDocument)
  }

  /** Queues the latest actor-owned document once for local persistence. */
  function queueDocumentPersistence(): void {
    const { document, history } = controller.getSnapshot().context
    const nextRetainedMediaIds = retainedHistoryMediaIds(history, historyMediaIds)
    const documentChanged = document !== persistedDocument
    if (!documentChanged && sameMediaIds(retainedMediaIds, nextRetainedMediaIds)) return

    const currentMedia = documentServices.media(document)
    const persistedMedia = documentServices.media(persistedDocument)
    const nextMediaIds = new Set(currentMedia.map((media) => media.id))
    const removedMediaIds = persistedMedia
      .map((media) => media.id)
      .filter((mediaId) => !nextMediaIds.has(mediaId) && !nextRetainedMediaIds.has(mediaId))
    const releasedMediaIds = [...retainedMediaIds]
      .filter((mediaId) => !nextRetainedMediaIds.has(mediaId) && !nextMediaIds.has(mediaId))
    const releasedCurrentImages = [...retainedMediaIds]
      .filter((mediaId) => !nextRetainedMediaIds.has(mediaId)
        && currentMedia.some((media) => media.id === mediaId && mediaTypeFromMimeType(media.mimeType) === MEDIA_TYPE.IMAGE))
    const mediaToDelete = [...new Set([...removedMediaIds, ...releasedMediaIds])]
    persistedDocument = document
    retainedMediaIds = nextRetainedMediaIds
    pendingSave = pendingSave
      .then(async () => {
        if (documentChanged) {
          if (mediaToDelete.length > 0) await store.saveDocumentAndDeleteMedia(document, mediaToDelete)
          else await store.saveDocument(document)
        } else if (mediaToDelete.length > 0) {
          await store.deleteMedia(mediaToDelete)
        }
        if (releasedCurrentImages.length > 0 && options.mediaSourceUrl !== undefined) {
          const documentId = documentServices.id(document)
          const checkpoint = await store.loadSyncState(documentId)
          const uploadedIds = releasedCurrentImages.filter((mediaId) => checkpoint.uploadedMediaIds.includes(mediaId))
          if (uploadedIds.length > 0) {
            await store.deleteMedia(uploadedIds)
            for (const mediaId of uploadedIds) {
              const previous = controller.getSnapshot().context.mediaSources[mediaId]
              if (previous?.startsWith('blob:') === true) URL.revokeObjectURL(previous)
              controller.send({ type: 'media.source.register', mediaId, source: options.mediaSourceUrl(documentId, mediaId) })
            }
          }
        }
      })
      .then(() => {
        lastSaveError = null
        if (documentChanged) {
          controller.send({ type: 'document.sync.status', status: 'pending' })
          options.onLocalSave?.(document)
        }
      })
      .catch((error: unknown) => {
        lastSaveError = error
        console.error('Échec de sauvegarde du document Elcé.', error)
      })
  }

  await restoreCurrentDocument()

  const subscription = controller.subscribe(() => queueDocumentPersistence())

  return {
    flushLocalChanges: async () => {
      queueDocumentPersistence()
      await pendingSave
      if (lastSaveError !== null) throw lastSaveError
    },
    restoreCurrentDocument,
    installServerDocument: async (document, uploadedMediaIds) => {
      await pendingSave
      if (lastSaveError !== null) throw lastSaveError

      const currentDocument = controller.getSnapshot().context.document
      if (documentServices.id(currentDocument) !== documentServices.id(document)) throw new Error('Le document serveur ne correspond pas au projet actif.')

      revokeRegisteredMediaSources(controller)
      persistedDocument = document
      controller.send({ type: 'document.replace', document })
      controller.send({ type: 'document.sync.status', status: 'synced' })
      await restoreMediaSources(controller, document, store, documentServices, uploadedMediaIds, options.mediaSourceUrl)
    },
    detach: () => {
      subscription.unsubscribe()
      const activeMediaIds = new Set(historyMediaIds(controller.getSnapshot().context.document))
      const abandonedMediaIds = [...retainedMediaIds].filter((mediaId) => !activeMediaIds.has(mediaId))
      if (abandonedMediaIds.length > 0) {
        void pendingSave.then(() => store.deleteMedia(abandonedMediaIds)).catch((error: unknown) => {
          console.error('Échec du nettoyage des médias de l’historique Elcé.', error)
        })
      }
      revokeRegisteredMediaSources(controller)
    },
  }
}

/** Avoids scheduling a store write when the history retains the same blobs. */
function sameMediaIds(left: ReadonlySet<MediaId>, right: ReadonlySet<MediaId>): boolean {
  return left.size === right.size && [...left].every((mediaId) => right.has(mediaId))
}

/** Restores browser object URLs for media already persisted with the document. */
async function restoreMediaSources<TDocument, TSelection, TProject>(
  controller: ProjectControllerPort<TDocument, TSelection, TProject, ProjectSessionOperation>,
  document: TDocument | null,
  store: DocumentStore<TDocument>,
  documentServices: ProjectDocumentServices<TDocument>,
  uploadedMediaIds: readonly MediaId[],
  mediaSourceUrl?: (documentId: string, mediaId: MediaId) => string,
): Promise<void> {
  if (document === null) return
  for (const media of documentServices.media(document)) {
    if (controller.getSnapshot().context.mediaSources[media.id] !== undefined) continue
    const uploadedImage = uploadedMediaIds.includes(media.id)
      && mediaTypeFromMimeType(media.mimeType) === MEDIA_TYPE.IMAGE
      && mediaSourceUrl !== undefined
      && !retainedHistoryMediaIds(
        controller.getSnapshot().context.history,
        (current) => documentServices.media(current).map((item) => item.id),
      ).has(media.id)
    const blob = uploadedImage ? null : await store.loadMedia(media.id)
    let source: string | null = null
    if (uploadedImage) {
      await store.deleteMedia([media.id])
      source = mediaSourceUrl!(documentServices.id(document), media.id)
    } else if (blob !== null && typeof URL.createObjectURL === 'function') {
      source = URL.createObjectURL(blob)
    } else if (uploadedMediaIds.includes(media.id) && mediaSourceUrl !== undefined) {
      source = mediaSourceUrl(documentServices.id(document), media.id)
    }
    if (source === null) continue
    controller.send({ type: 'media.source.register', mediaId: media.id, source })
  }
}

/** Releases object URLs registered by the current controller session. */
function revokeRegisteredMediaSources<TDocument, TSelection, TProject>(
  controller: ProjectControllerPort<TDocument, TSelection, TProject, ProjectSessionOperation>,
): void {
  if (typeof URL.revokeObjectURL !== 'function') return
  for (const source of Object.values(controller.getSnapshot().context.mediaSources)) {
    if (source.startsWith('blob:')) URL.revokeObjectURL(source)
  }
}

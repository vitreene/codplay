import type { Actor } from 'xstate'
import { IndexedDbDocumentStore } from '../../infrastructure/indexed-db/document-store'
import type { ElceDocumentStore } from '../../infrastructure/indexed-db/document-store-types'
import type { ElceDocument } from '../../domain/document/document-model'
import type { MediaId } from '../../domain/document/document-types'
import type { controllerMachine } from './controller-machine'
import { retainedHistoryMediaIds } from '../history/document-history'
import { MEDIA_TYPE } from '../../config/document-config'
import { mediaTypeFromMimeType } from '../../domain/media/media-resource-service'

export interface DocumentPersistenceOptions {
  readonly mediaSourceUrl?: (documentId: string, mediaId: MediaId) => string
  readonly onLocalSave?: (document: ElceDocument) => void
}

export interface AttachedDocumentPersistence {
  flushLocalChanges(): Promise<void>
  restoreCurrentDocument(): Promise<void>
  installServerDocument(document: ElceDocument, uploadedMediaIds: readonly MediaId[]): Promise<void>
  detach(): void
}

/** Restores the controller once and persists later document commits. */
export async function attachDocumentPersistence(
  controller: Actor<typeof controllerMachine>,
  store: ElceDocumentStore = new IndexedDbDocumentStore(),
  options: DocumentPersistenceOptions = {},
): Promise<AttachedDocumentPersistence> {
  let persistedDocument = controller.getSnapshot().context.document
  let retainedMediaIds = retainedHistoryMediaIds(controller.getSnapshot().context.history)
  let pendingSave = Promise.resolve()
  let lastSaveError: unknown = null

  /** Restores the latest active-document cache before this window can edit. */
  async function restoreCurrentDocument(): Promise<void> {
    await pendingSave
    if (lastSaveError !== null) throw lastSaveError

    const currentDocument = controller.getSnapshot().context.document
    const storedDocument = await store.loadDocument(currentDocument.id)
    if (storedDocument === null) {
      await store.saveDocument(currentDocument)
      persistedDocument = currentDocument
      options.onLocalSave?.(currentDocument)
      return
    }

    const sameDocument = JSON.stringify(currentDocument.toJSON()) === JSON.stringify(storedDocument.toJSON())
    persistedDocument = sameDocument ? currentDocument : storedDocument
    if (!sameDocument) {
      revokeRegisteredMediaSources(controller)
      controller.send({ type: 'document.replace', document: storedDocument })
    }
    const syncState = await store.loadSyncState(storedDocument.id)
    controller.send({ type: 'document.sync.status', status: syncState.status })
    await restoreMediaSources(controller, sameDocument ? currentDocument : storedDocument, store, syncState.uploadedMediaIds, options.mediaSourceUrl)
    if (syncState.status !== 'synced') options.onLocalSave?.(persistedDocument)
  }

  /** Queues the latest actor-owned document once for local persistence. */
  function queueDocumentPersistence(): void {
    const { document, history } = controller.getSnapshot().context
    const nextRetainedMediaIds = retainedHistoryMediaIds(history)
    const documentChanged = document !== persistedDocument
    if (!documentChanged && sameMediaIds(retainedMediaIds, nextRetainedMediaIds)) return

    const nextMediaIds = new Set(document.medias.map((media) => media.id))
    const removedMediaIds = persistedDocument.medias
      .map((media) => media.id)
      .filter((mediaId) => !nextMediaIds.has(mediaId) && !nextRetainedMediaIds.has(mediaId))
    const releasedMediaIds = [...retainedMediaIds]
      .filter((mediaId) => !nextRetainedMediaIds.has(mediaId) && !nextMediaIds.has(mediaId))
    const releasedCurrentImages = [...retainedMediaIds]
      .filter((mediaId) => !nextRetainedMediaIds.has(mediaId)
        && document.medias.some((media) => media.id === mediaId && mediaTypeFromMimeType(media.mimeType) === MEDIA_TYPE.IMAGE))
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
          const checkpoint = await store.loadSyncState(document.id)
          const uploadedIds = releasedCurrentImages.filter((mediaId) => checkpoint.uploadedMediaIds.includes(mediaId))
          if (uploadedIds.length > 0) {
            await store.deleteMedia(uploadedIds)
            for (const mediaId of uploadedIds) {
              const previous = controller.getSnapshot().context.mediaSources[mediaId]
              if (previous?.startsWith('blob:') === true) URL.revokeObjectURL(previous)
              controller.send({ type: 'media.source.register', mediaId, source: options.mediaSourceUrl(document.id, mediaId) })
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
      if (currentDocument.id !== document.id) throw new Error('Le document serveur ne correspond pas au projet actif.')

      revokeRegisteredMediaSources(controller)
      persistedDocument = document
      controller.send({ type: 'document.replace', document })
      controller.send({ type: 'document.sync.status', status: 'synced' })
      await restoreMediaSources(controller, document, store, uploadedMediaIds, options.mediaSourceUrl)
    },
    detach: () => {
      subscription.unsubscribe()
      const activeMediaIds = new Set(controller.getSnapshot().context.document.medias.map((media) => media.id))
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
async function restoreMediaSources(
  controller: Actor<typeof controllerMachine>,
  document: Awaited<ReturnType<ElceDocumentStore['loadDocument']>>,
  store: ElceDocumentStore,
  uploadedMediaIds: readonly MediaId[],
  mediaSourceUrl?: (documentId: string, mediaId: MediaId) => string,
): Promise<void> {
  if (document === null) return
  for (const media of document.medias) {
    if (controller.getSnapshot().context.mediaSources[media.id] !== undefined) continue
    const uploadedImage = uploadedMediaIds.includes(media.id)
      && mediaTypeFromMimeType(media.mimeType) === MEDIA_TYPE.IMAGE
      && mediaSourceUrl !== undefined
      && !retainedHistoryMediaIds(controller.getSnapshot().context.history).has(media.id)
    const blob = uploadedImage ? null : await store.loadMedia(media.id)
    let source: string | null = null
    if (uploadedImage) {
      await store.deleteMedia([media.id])
      source = mediaSourceUrl!(document.id, media.id)
    } else if (blob !== null && typeof URL.createObjectURL === 'function') {
      source = URL.createObjectURL(blob)
    } else if (uploadedMediaIds.includes(media.id) && mediaSourceUrl !== undefined) {
      source = mediaSourceUrl(document.id, media.id)
    }
    if (source === null) continue
    controller.send({ type: 'media.source.register', mediaId: media.id, source })
  }
}

/** Releases object URLs registered by the current controller session. */
function revokeRegisteredMediaSources(controller: Actor<typeof controllerMachine>): void {
  if (typeof URL.revokeObjectURL !== 'function') return
  for (const source of Object.values(controller.getSnapshot().context.mediaSources)) {
    if (source.startsWith('blob:')) URL.revokeObjectURL(source)
  }
}

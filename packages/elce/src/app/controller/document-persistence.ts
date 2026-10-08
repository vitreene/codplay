import type { Actor } from 'xstate'
import { IndexedDbDocumentStore } from '../../infrastructure/indexed-db/document-store'
import type { ElceDocumentStore } from '../../infrastructure/indexed-db/document-store-types'
import type { ElceDocument } from '../../domain/document/document-model'
import type { MediaId } from '../../domain/document/document-types'
import type { controllerMachine } from './controller-machine'

export interface DocumentPersistenceOptions {
  readonly mediaSourceUrl?: (documentId: string, mediaId: MediaId) => string
  readonly onLocalSave?: (document: ElceDocument) => void
}

export interface AttachedDocumentPersistence {
  flushLocalChanges(): Promise<void>
  restoreCurrentDocument(): Promise<void>
  detach(): void
}

/** Restores the controller once and persists later document commits. */
export async function attachDocumentPersistence(
  controller: Actor<typeof controllerMachine>,
  store: ElceDocumentStore = new IndexedDbDocumentStore(),
  options: DocumentPersistenceOptions = {},
): Promise<AttachedDocumentPersistence> {
  let persistedDocument = controller.getSnapshot().context.document
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

    revokeRegisteredMediaSources(controller)
    persistedDocument = storedDocument
    controller.send({ type: 'document.replace', document: storedDocument })
    const syncState = await store.loadSyncState(storedDocument.id)
    controller.send({ type: 'document.sync.status', status: syncState.status })
    await restoreMediaSources(controller, storedDocument, store, syncState.uploadedMediaIds, options.mediaSourceUrl)
    if (syncState.status !== 'synced') options.onLocalSave?.(storedDocument)
  }

  /** Queues the latest actor-owned document once for local persistence. */
  function queueDocumentPersistence(document: ElceDocument): void {
    if (document === persistedDocument) return

    const nextMediaIds = new Set(document.medias.map((media) => media.id))
    const removedMediaIds = persistedDocument.medias
      .map((media) => media.id)
      .filter((mediaId) => !nextMediaIds.has(mediaId))
    persistedDocument = document
    pendingSave = pendingSave
      .then(() => removedMediaIds.length > 0
        ? store.saveDocumentAndDeleteMedia(document, removedMediaIds)
        : store.saveDocument(document))
      .then(() => {
        lastSaveError = null
        controller.send({ type: 'document.sync.status', status: 'pending' })
        options.onLocalSave?.(document)
      })
      .catch((error: unknown) => {
        lastSaveError = error
        console.error('Échec de sauvegarde du document Elcé.', error)
      })
  }

  await restoreCurrentDocument()

  const subscription = controller.subscribe((snapshot) => {
    queueDocumentPersistence(snapshot.context.document)
  })

  return {
    flushLocalChanges: async () => {
      queueDocumentPersistence(controller.getSnapshot().context.document)
      await pendingSave
      if (lastSaveError !== null) throw lastSaveError
    },
    restoreCurrentDocument,
    detach: () => {
      subscription.unsubscribe()
      revokeRegisteredMediaSources(controller)
    },
  }
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
    const blob = await store.loadMedia(media.id)
    let source: string | null = null
    if (blob !== null && typeof URL.createObjectURL === 'function') {
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

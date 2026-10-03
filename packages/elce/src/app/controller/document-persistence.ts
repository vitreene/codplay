import type { Actor } from 'xstate'
import { IndexedDbDocumentStore } from '../../infrastructure/indexed-db/document-store'
import type { ElceDocumentStore } from '../../infrastructure/indexed-db/document-store-types'
import type { controllerMachine } from './controller-machine'

/** Restores the controller once and persists later document commits. */
export async function attachDocumentPersistence(
  controller: Actor<typeof controllerMachine>,
  store: ElceDocumentStore = new IndexedDbDocumentStore(),
): Promise<() => void> {
  const storedDocument = await store.loadDocument(controller.getSnapshot().context.document.id)
  if (storedDocument) {
    controller.send({ type: 'document.replace', document: storedDocument })
    await restoreMediaSources(controller, storedDocument, store)
  } else {
    await store.saveDocument(controller.getSnapshot().context.document)
  }
  let persistedDocument = controller.getSnapshot().context.document
  let pendingSave = Promise.resolve()
  const subscription = controller.subscribe((snapshot) => {
    const document = snapshot.context.document
    const nextMediaIds = new Set(document.medias.map((media) => media.id))
    const removedMediaIds = persistedDocument.medias
      .map((media) => media.id)
      .filter((mediaId) => !nextMediaIds.has(mediaId))
    persistedDocument = document
    pendingSave = pendingSave
      .then(() => removedMediaIds.length > 0
        ? store.saveDocumentAndDeleteMedia(document, removedMediaIds)
        : store.saveDocument(document))
      .catch((error: unknown) => console.error('Échec de sauvegarde du document Elcé.', error))
  })
  return () => {
    subscription.unsubscribe()
    revokeRegisteredMediaSources(controller)
  }
}

/** Restores browser object URLs for media already persisted with the document. */
async function restoreMediaSources(
  controller: Actor<typeof controllerMachine>,
  document: Awaited<ReturnType<ElceDocumentStore['loadDocument']>>,
  store: ElceDocumentStore,
): Promise<void> {
  if (document === null || typeof URL.createObjectURL !== 'function') return
  for (const media of document.medias) {
    const blob = await store.loadMedia(media.id)
    if (blob === null) continue
    const source = URL.createObjectURL(blob)
    controller.send({ type: 'media.source.register', mediaId: media.id, source })
  }
}

/** Releases object URLs registered by the current controller session. */
function revokeRegisteredMediaSources(controller: Actor<typeof controllerMachine>): void {
  if (typeof URL.revokeObjectURL !== 'function') return
  for (const source of Object.values(controller.getSnapshot().context.mediaSources)) URL.revokeObjectURL(source)
}

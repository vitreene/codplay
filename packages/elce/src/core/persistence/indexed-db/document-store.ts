import type { MediaId } from '../../document/content-document-types'
import type { DocumentStore, DocumentStoreCodec, DocumentSyncState, MediaBlob } from './document-store-types'

const DATABASE_NAME = 'elce-poc'
const DATABASE_VERSION = 2
const DOCUMENT_STORE = 'documents'
const MEDIA_STORE = 'media'
const SYNC_STORE = 'sync'

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

/** Stores generic document caches, pending media blobs, and sync checkpoints. */
export class IndexedDbDocumentStore<TDocument> implements DocumentStore<TDocument> {
  private readonly databasePromise: Promise<IDBDatabase>
  private readonly databaseName: string
  private readonly databaseVersion: number
  private readonly codec: DocumentStoreCodec<TDocument>

  /** Opens the document cache and adds its sync checkpoint store. */
  public constructor(
    codec: DocumentStoreCodec<TDocument>,
    databaseName: string = DATABASE_NAME,
    databaseVersion: number = DATABASE_VERSION,
  ) {
    this.codec = codec
    this.databaseName = databaseName
    this.databaseVersion = databaseVersion
    this.databasePromise = this.openDatabase()
  }

  /** Loads one project cache through the composition's document codec. */
  public async loadDocument(documentId: string): Promise<TDocument | null> {
    const database = await this.databasePromise
    const transaction = database.transaction([DOCUMENT_STORE, MEDIA_STORE, SYNC_STORE], 'readwrite')
    const transactionDone = transactionComplete(transaction)
    const stored = await requestResult(transaction.objectStore(DOCUMENT_STORE).get(documentId))
    if (stored === undefined) {
      await transactionDone
      return null
    }
    await transactionDone
    return this.codec.readDocument(stored)
  }

  /** Saves one project locally and marks it pending for server sync. */
  public async saveDocument(document: TDocument): Promise<void> {
    const database = await this.databasePromise
    const transaction = database.transaction([DOCUMENT_STORE, MEDIA_STORE, SYNC_STORE], 'readwrite')
    const transactionDone = transactionComplete(transaction)
    saveProjectDocument(transaction, document, this.codec)
    await transactionDone
  }

  /** Saves a project and removes its unreferenced media in one transaction. */
  public async saveDocumentAndDeleteMedia(document: TDocument, mediaIds: readonly MediaId[]): Promise<void> {
    const database = await this.databasePromise
    const transaction = database.transaction([DOCUMENT_STORE, MEDIA_STORE, SYNC_STORE], 'readwrite')
    const transactionDone = transactionComplete(transaction)
    saveProjectDocument(transaction, document, this.codec, mediaIds)
    await transactionDone
  }

  /** Removes one project's local document, checkpoint, and unshared media. */
  public async deleteDocument(documentId: string): Promise<void> {
    const database = await this.databasePromise
    const transaction = database.transaction([DOCUMENT_STORE, MEDIA_STORE, SYNC_STORE], 'readwrite')
    const transactionDone = transactionComplete(transaction)
    const documents = transaction.objectStore(DOCUMENT_STORE)
    const request = documents.getAll()
    request.onsuccess = () => {
      const storedDocuments = request.result as Record<string, unknown>[]
      const target = storedDocuments.find((stored) => stored.id === documentId)
      const otherDocuments = storedDocuments.filter((stored) => stored.id !== documentId)
      const retainedMediaIds = new Set(otherDocuments.flatMap(mediaIdsFrom))
      const media = transaction.objectStore(MEDIA_STORE)

      for (const mediaId of target === undefined ? [] : mediaIdsFrom(target)) {
        if (!retainedMediaIds.has(mediaId)) media.delete(mediaId)
      }
      documents.delete(documentId)
      transaction.objectStore(SYNC_STORE).delete(documentId)
    }
    await transactionDone
  }

  /** Removes locally cached bytes after the server confirms their upload. */
  public async deleteMedia(mediaIds: readonly MediaId[]): Promise<void> {
    const database = await this.databasePromise
    const transaction = database.transaction(MEDIA_STORE, 'readwrite')
    const transactionDone = transactionComplete(transaction)
    const media = transaction.objectStore(MEDIA_STORE)
    for (const mediaId of mediaIds) media.delete(mediaId)
    await transactionDone
  }

  /** Removes local media bytes not referenced by any cached project document. */
  public async deleteOrphanedMedia(): Promise<void> {
    const database = await this.databasePromise
    const transaction = database.transaction([DOCUMENT_STORE, MEDIA_STORE], 'readwrite')
    const transactionDone = transactionComplete(transaction)
    const documents = transaction.objectStore(DOCUMENT_STORE)
    const media = transaction.objectStore(MEDIA_STORE)
    const documentsRequest = documents.getAll()
    const mediaKeysRequest = media.getAllKeys()
    let storedDocuments: Record<string, unknown>[] | null = null
    let mediaKeys: IDBValidKey[] | null = null

    /** Deletes only after both sides of the local document/media index are available. */
    const removeOrphans = (): void => {
      if (storedDocuments === null || mediaKeys === null) return
      const stringMediaKeys = mediaKeys.filter((key): key is string => typeof key === 'string')
      const orphanedIds = new Set(orphanedMediaIds(storedDocuments, stringMediaKeys))
      for (const mediaId of mediaKeys) {
        if (typeof mediaId !== 'string' || orphanedIds.has(mediaId)) media.delete(mediaId)
      }
    }

    documentsRequest.onsuccess = () => {
      storedDocuments = documentsRequest.result as Record<string, unknown>[]
      removeOrphans()
    }
    mediaKeysRequest.onsuccess = () => {
      mediaKeys = mediaKeysRequest.result
      removeOrphans()
    }
    await transactionDone
  }

  /** Loads the saved remote revision and whether the local document needs sync. */
  public async loadSyncState(documentId: string): Promise<DocumentSyncState> {
    const database = await this.databasePromise
    const transaction = database.transaction(SYNC_STORE, 'readonly')
    const transactionDone = transactionComplete(transaction)
    const stored = await requestResult(transaction.objectStore(SYNC_STORE).get(documentId)) as DocumentSyncState | undefined
    await transactionDone
    return stored ?? { documentId, remoteRevision: null, uploadedMediaIds: [], status: 'pending' }
  }

  /** Saves the remote checkpoint or conflict state for a local project. */
  public async saveSyncState(syncState: DocumentSyncState): Promise<void> {
    const database = await this.databasePromise
    const transaction = database.transaction(SYNC_STORE, 'readwrite')
    const transactionDone = transactionComplete(transaction)
    transaction.objectStore(SYNC_STORE).put(syncState)
    await transactionDone
  }

  /** Saves an imported media blob by its reusable media identifier. */
  public async saveMedia(media: MediaBlob): Promise<void> {
    const database = await this.databasePromise
    const transaction = database.transaction(MEDIA_STORE, 'readwrite')
    transaction.objectStore(MEDIA_STORE).put(media)
    await transactionComplete(transaction)
  }

  /** Loads an imported media blob without copying it out of IndexedDB. */
  public async loadMedia(mediaId: MediaId): Promise<Blob | null> {
    const database = await this.databasePromise
    const transaction = database.transaction(MEDIA_STORE, 'readonly')
    const media = await requestResult(transaction.objectStore(MEDIA_STORE).get(mediaId)) as MediaBlob | undefined
    await transactionComplete(transaction)
    return media?.blob ?? null
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, this.databaseVersion)
      request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains(DOCUMENT_STORE)) database.createObjectStore(DOCUMENT_STORE, { keyPath: 'id' })
        if (!database.objectStoreNames.contains(MEDIA_STORE)) database.createObjectStore(MEDIA_STORE, { keyPath: 'id' })
        if (!database.objectStoreNames.contains(SYNC_STORE)) database.createObjectStore(SYNC_STORE, { keyPath: 'documentId' })
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }
}

/** Writes one project and preserves every other project's cache. */
function saveProjectDocument<TDocument>(
  transaction: IDBTransaction,
  document: TDocument,
  codec: DocumentStoreCodec<TDocument>,
  removedMediaIds: readonly MediaId[] = [],
): void {
  const documents = transaction.objectStore(DOCUMENT_STORE)
  const media = transaction.objectStore(MEDIA_STORE)
  const sync = transaction.objectStore(SYNC_STORE)
  for (const mediaId of removedMediaIds) media.delete(mediaId)
  documents.put(codec.writeDocument(document))
  markDocumentPending(sync, codec.documentId(document), new Set(codec.mediaIds(document)))
}

/** Reads media identifiers from a stored document without requiring its version. */
function mediaIdsFrom(stored: Record<string, unknown>): MediaId[] {
  if (!Array.isArray(stored.medias)) return []
  return stored.medias.flatMap((media: unknown) => {
    if (typeof media !== 'object' || media === null || !('id' in media)) return []
    const mediaId = media.id
    return typeof mediaId === 'string' ? [mediaId] : []
  })
}

/** Lists stored media keys absent from every local project document. */
export function orphanedMediaIds(
  storedDocuments: readonly Record<string, unknown>[],
  storedMediaIds: readonly MediaId[],
): MediaId[] {
  const referencedMediaIds = new Set(storedDocuments.flatMap(mediaIdsFrom))
  return storedMediaIds.filter((mediaId) => !referencedMediaIds.has(mediaId))
}

/** Marks a document dirty without discarding a saved conflict or server revision. */
function markDocumentPending(syncStore: IDBObjectStore, documentId: string, mediaIds: ReadonlySet<MediaId>): void {
  const request = syncStore.get(documentId)
  request.onsuccess = () => {
    const stored = request.result as DocumentSyncState | undefined
    syncStore.put({
      documentId,
      remoteRevision: stored?.remoteRevision ?? null,
      uploadedMediaIds: stored?.uploadedMediaIds.filter((mediaId) => mediaIds.has(mediaId)) ?? [],
      status: stored?.status === 'conflict' ? 'conflict' : 'pending',
    } satisfies DocumentSyncState)
  }
}

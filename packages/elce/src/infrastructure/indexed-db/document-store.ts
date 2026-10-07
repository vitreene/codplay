import { ELCE_DOCUMENT_VERSION, ElceDocument } from '../../domain/document/document-model'
import type { ElceDocumentData, MediaId } from '../../domain/document/document-types'
import type { DocumentSyncState, ElceDocumentStore, MediaBlob } from './document-store-types'

const DATABASE_NAME = 'elce-poc'
const DATABASE_VERSION = 2
const DOCUMENT_STORE = 'documents'
const MEDIA_STORE = 'media'
const SYNC_STORE = 'sync'

/** Prevents replacing the only local copy before the server confirms it. */
export class ActiveDocumentSyncRequiredError extends Error {
  public constructor(documentId: string) {
    super(`Le document actif ${documentId} doit être synchronisé avant son remplacement.`)
    this.name = 'ActiveDocumentSyncRequiredError'
  }
}

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

/** Stores the active document cache, its pending media blobs, and sync checkpoint. */
export class IndexedDbDocumentStore implements ElceDocumentStore {
  private readonly databasePromise: Promise<IDBDatabase>
  private readonly databaseName: string
  private readonly databaseVersion: number

  /** Opens the active-document cache and adds its sync checkpoint store. */
  public constructor(databaseName: string = DATABASE_NAME, databaseVersion: number = DATABASE_VERSION) {
    this.databaseName = databaseName
    this.databaseVersion = databaseVersion
    this.databasePromise = this.openDatabase()
  }

  /** Loads the active document and clears its rejected v3 cache if encountered. */
  public async loadDocument(documentId: string): Promise<ElceDocument | null> {
    const database = await this.databasePromise
    const transaction = database.transaction([DOCUMENT_STORE, MEDIA_STORE, SYNC_STORE], 'readwrite')
    const transactionDone = transactionComplete(transaction)
    const documents = transaction.objectStore(DOCUMENT_STORE)
    const stored = await requestResult(documents.get(documentId)) as Record<string, unknown> | undefined
    if (stored === undefined) {
      await transactionDone
      return null
    }

    switch (stored.version) {
      case 3: {
        documents.clear()
        transaction.objectStore(MEDIA_STORE).clear()
        transaction.objectStore(SYNC_STORE).clear()
        await transactionDone
        return null
      }
      case ELCE_DOCUMENT_VERSION:
        await transactionDone
        return ElceDocument.fromJSON(stored as unknown as ElceDocumentData)
      default:
        await transactionDone
        throw new Error(`Version de document Elcé non supportée : ${String(stored.version)}`)
    }
  }

  /** Saves the active document locally and marks it pending for server sync. */
  public async saveDocument(document: ElceDocument): Promise<void> {
    const database = await this.databasePromise
    const transaction = database.transaction([DOCUMENT_STORE, MEDIA_STORE, SYNC_STORE], 'readwrite')
    const transactionDone = transactionComplete(transaction)
    let unsynchronizedDocumentId: string | null = null
    saveActiveDocument(transaction, document, [], (documentId) => { unsynchronizedDocumentId = documentId })
    await finishActiveDocumentSave(transactionDone, () => unsynchronizedDocumentId)
  }

  /** Saves a document and removes obsolete media in the same local transaction. */
  public async saveDocumentAndDeleteMedia(document: ElceDocument, mediaIds: readonly MediaId[]): Promise<void> {
    const database = await this.databasePromise
    const transaction = database.transaction([DOCUMENT_STORE, MEDIA_STORE, SYNC_STORE], 'readwrite')
    const transactionDone = transactionComplete(transaction)
    let unsynchronizedDocumentId: string | null = null
    saveActiveDocument(transaction, document, mediaIds, (documentId) => { unsynchronizedDocumentId = documentId })
    await finishActiveDocumentSave(transactionDone, () => unsynchronizedDocumentId)
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

/** Keeps only the active project's document and local media cache. */
function saveActiveDocument(
  transaction: IDBTransaction,
  document: ElceDocument,
  removedMediaIds: readonly MediaId[] = [],
  onUnsynchronizedDocument: (documentId: string) => void,
): void {
  const documents = transaction.objectStore(DOCUMENT_STORE)
  const media = transaction.objectStore(MEDIA_STORE)
  const sync = transaction.objectStore(SYNC_STORE)
  const request = documents.getAll()
  request.onsuccess = () => {
    const stored = request.result as Record<string, unknown>[]
    const otherDocuments = stored.filter((candidate) => candidate.id !== document.id)
    if (otherDocuments.length > 0) {
      const syncRequest = sync.getAll()
      syncRequest.onsuccess = () => {
        const syncStates = syncRequest.result as DocumentSyncState[]
        const unsynchronized = otherDocuments.find((candidate) => {
          const syncState = syncStates.find((state) => state.documentId === candidate.id)
          return syncState?.status !== 'synced' || syncState.remoteRevision === null
        })
        if (unsynchronized !== undefined) {
          onUnsynchronizedDocument(String(unsynchronized.id))
          transaction.abort()
          return
        }
        documents.clear()
        media.clear()
        sync.clear()
        writeActiveDocument(transaction, document, removedMediaIds)
      }
      return
    }
    writeActiveDocument(transaction, document, removedMediaIds)
  }
}

/** Completes the cache transaction or reports why its sole document was protected. */
async function finishActiveDocumentSave(
  transactionDone: Promise<void>,
  unsynchronizedDocumentId: () => string | null,
): Promise<void> {
  try {
    await transactionDone
  } catch (error) {
    const blockedDocumentId = unsynchronizedDocumentId()
    if (blockedDocumentId !== null) throw new ActiveDocumentSyncRequiredError(blockedDocumentId)
    throw error
  }
}

/** Writes one active document and marks it pending after any safe cache cleanup. */
function writeActiveDocument(
  transaction: IDBTransaction,
  document: ElceDocument,
  removedMediaIds: readonly MediaId[],
): void {
  const media = transaction.objectStore(MEDIA_STORE)
  const sync = transaction.objectStore(SYNC_STORE)
  for (const mediaId of removedMediaIds) media.delete(mediaId)
  transaction.objectStore(DOCUMENT_STORE).put(document.toJSON())
  markDocumentPending(sync, document.id)
}

/** Marks a document dirty without discarding a saved conflict or server revision. */
function markDocumentPending(syncStore: IDBObjectStore, documentId: string): void {
  const request = syncStore.get(documentId)
  request.onsuccess = () => {
    const stored = request.result as DocumentSyncState | undefined
    syncStore.put({
      documentId,
      remoteRevision: stored?.remoteRevision ?? null,
      uploadedMediaIds: stored?.uploadedMediaIds ?? [],
      status: stored?.status === 'conflict' ? 'conflict' : 'pending',
    } satisfies DocumentSyncState)
  }
}

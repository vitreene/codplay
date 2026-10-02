import { ElceDocument } from '../../domain/document-model'
import type { ElceDocumentData, MediaId } from '../../domain/document-types'
import type { ElceDocumentStore, MediaBlob } from './document-store-types'

const DATABASE_NAME = 'elce-poc'
const DATABASE_VERSION = 1
const DOCUMENT_STORE = 'documents'
const MEDIA_STORE = 'media'

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

/** Stores the single POC document and media blobs in one IndexedDB boundary. */
export class IndexedDbDocumentStore implements ElceDocumentStore {
  private readonly databasePromise: Promise<IDBDatabase>
  private readonly databaseName: string
  private readonly databaseVersion: number

  public constructor(databaseName: string = DATABASE_NAME, databaseVersion: number = DATABASE_VERSION) {
    this.databaseName = databaseName
    this.databaseVersion = databaseVersion
    this.databasePromise = this.openDatabase()
  }

  public async loadDocument(documentId: string): Promise<ElceDocument | null> {
    const database = await this.databasePromise
    const transaction = database.transaction(DOCUMENT_STORE, 'readonly')
    const data = await requestResult(transaction.objectStore(DOCUMENT_STORE).get(documentId)) as ElceDocumentData | undefined
    await transactionComplete(transaction)
    return data ? ElceDocument.fromJSON(data) : null
  }

  public async saveDocument(document: ElceDocument): Promise<void> {
    const database = await this.databasePromise
    const transaction = database.transaction(DOCUMENT_STORE, 'readwrite')
    transaction.objectStore(DOCUMENT_STORE).put(document.toJSON())
    await transactionComplete(transaction)
  }

  public async saveMedia(media: MediaBlob): Promise<void> {
    const database = await this.databasePromise
    const transaction = database.transaction(MEDIA_STORE, 'readwrite')
    transaction.objectStore(MEDIA_STORE).put(media)
    await transactionComplete(transaction)
  }

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
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }
}

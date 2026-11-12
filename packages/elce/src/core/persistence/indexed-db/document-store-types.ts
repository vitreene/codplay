import type { MediaId } from '../../document/content-document-types'

export interface MediaBlob {
  readonly id: MediaId
  readonly blob: Blob
}

/** Describes the local synchronization checkpoint for one project document. */
export interface DocumentSyncState {
  readonly documentId: string
  readonly remoteRevision: number | null
  readonly uploadedMediaIds: readonly MediaId[]
  readonly status: 'pending' | 'synced' | 'conflict'
  readonly independentCopyOf?: string
  readonly mediaSourceProjectIds?: Readonly<Record<MediaId, string>>
}

export interface DocumentStoreCodec<TDocument> {
  readDocument(value: unknown): TDocument
  writeDocument(document: TDocument): unknown
  documentId(document: TDocument): string
  mediaIds(document: TDocument): readonly MediaId[]
}

export interface DocumentStore<TDocument> {
  loadDocument(documentId: string): Promise<TDocument | null>
  saveDocument(document: TDocument): Promise<void>
  saveDocumentAndDeleteMedia(document: TDocument, mediaIds: readonly MediaId[]): Promise<void>
  deleteDocument(documentId: string): Promise<void>
  deleteMedia(mediaIds: readonly MediaId[]): Promise<void>
  loadSyncState(documentId: string): Promise<DocumentSyncState>
  saveSyncState(syncState: DocumentSyncState): Promise<void>
  saveMedia(media: MediaBlob): Promise<void>
  loadMedia(mediaId: MediaId): Promise<Blob | null>
}

import type { ElceDocument } from '../../domain/document/document-model'
import type { MediaId } from '../../domain/document/document-types'

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
}

export interface ElceDocumentStore {
  loadDocument(documentId: string): Promise<ElceDocument | null>
  saveDocument(document: ElceDocument): Promise<void>
  saveDocumentAndDeleteMedia(document: ElceDocument, mediaIds: readonly MediaId[]): Promise<void>
  deleteMedia(mediaIds: readonly MediaId[]): Promise<void>
  loadSyncState(documentId: string): Promise<DocumentSyncState>
  saveSyncState(syncState: DocumentSyncState): Promise<void>
  saveMedia(media: MediaBlob): Promise<void>
  loadMedia(mediaId: MediaId): Promise<Blob | null>
}

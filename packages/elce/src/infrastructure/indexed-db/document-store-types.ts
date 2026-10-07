import type { ElceDocument } from '../../domain/document/document-model'
import type { MediaId } from '../../domain/document/document-types'

export interface MediaBlob {
  readonly id: MediaId
  readonly blob: Blob
}

export interface ElceDocumentStore {
  loadDocument(documentId: string): Promise<ElceDocument | null>
  saveDocument(document: ElceDocument): Promise<void>
  saveDocumentAndDeleteMedia(document: ElceDocument, mediaIds: readonly MediaId[]): Promise<void>
  saveMedia(media: MediaBlob): Promise<void>
  loadMedia(mediaId: MediaId): Promise<Blob | null>
}

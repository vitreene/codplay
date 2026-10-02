import type { ElceDocument } from '../../domain/document-model'
import type { MediaId } from '../../domain/document-types'

export interface MediaBlob {
  readonly id: MediaId
  readonly blob: Blob
}

export interface ElceDocumentStore {
  loadDocument(documentId: string): Promise<ElceDocument | null>
  saveDocument(document: ElceDocument): Promise<void>
  saveMedia(media: MediaBlob): Promise<void>
  loadMedia(mediaId: MediaId): Promise<Blob | null>
}

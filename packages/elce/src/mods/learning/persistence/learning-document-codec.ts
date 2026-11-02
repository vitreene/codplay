import type { DocumentStoreCodec } from '../../../core/persistence/indexed-db/document-store-types'
import type { ProjectDocumentCodec } from '../../../core/persistence/project-api/project-document-codec'
import type { LearningDocumentData } from '../document/learning-document-types'
import type { LearningDocument } from '../document/learning-document'
import { learningDocumentService } from '../document/learning-document-service'

export const learningDocumentCodec: DocumentStoreCodec<LearningDocument> & ProjectDocumentCodec<LearningDocument, LearningDocumentData> = {
  readDocument: (value) => learningDocumentService.readDocument(value),
  writeDocument: (document) => learningDocumentService.writeDocument(document),
  documentId: (document) => document.id,
  mediaIds: (document) => document.medias.map((media) => media.id),
}

import type { LearningDocument } from '../../mods/learning/document/learning-document'
import { attachLearningDocumentPersistence as attachDocumentPersistence } from '../../mods/learning/persistence/learning-document-persistence'
import type { AttachedDocumentPersistence as CoreAttachedDocumentPersistence, DocumentPersistenceOptions as CoreDocumentPersistenceOptions } from '../../core/persistence/document-persistence'

export { attachDocumentPersistence }
export type AttachedDocumentPersistence = CoreAttachedDocumentPersistence<LearningDocument>
export type DocumentPersistenceOptions = CoreDocumentPersistenceOptions<LearningDocument>

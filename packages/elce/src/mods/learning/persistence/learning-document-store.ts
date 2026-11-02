import { IndexedDbDocumentStore } from '../../../core/persistence/indexed-db/document-store'
import type { DocumentStore } from '../../../core/persistence/indexed-db/document-store-types'
import type { LearningDocument } from '../document/learning-document'
import { learningDocumentCodec } from './learning-document-codec'

export type LearningDocumentStore = DocumentStore<LearningDocument>
export type ElceDocumentStore = LearningDocumentStore

/** Creates the Learning adapter for the shared IndexedDB document store. */
export function createLearningDocumentStore(databaseName?: string, databaseVersion?: number): IndexedDbDocumentStore<LearningDocument> {
  return new IndexedDbDocumentStore(learningDocumentCodec, databaseName, databaseVersion)
}

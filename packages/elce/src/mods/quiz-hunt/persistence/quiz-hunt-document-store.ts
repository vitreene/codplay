import { IndexedDbDocumentStore } from '../../../core/persistence/indexed-db/document-store'
import type { DocumentStore } from '../../../core/persistence/indexed-db/document-store-types'
import type { QuizHuntDocument } from '../document/quiz-hunt-document-types'
import { quizHuntDocumentCodec } from './quiz-hunt-document-codec'

export type QuizHuntDocumentStore = DocumentStore<QuizHuntDocument>

/** Creates the local cache adapter for the Quiz Hunt document codec. */
export function createQuizHuntDocumentStore(databaseName?: string, databaseVersion?: number): IndexedDbDocumentStore<QuizHuntDocument> {
  return new IndexedDbDocumentStore(quizHuntDocumentCodec, databaseName, databaseVersion)
}

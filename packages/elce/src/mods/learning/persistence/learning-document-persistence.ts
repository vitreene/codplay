import type { LearningProjectControllerPort } from '../authoring/learning-controller-types'
import type { LearningDocument } from '../document/learning-document'
import type { LearningDocumentStore } from './learning-document-store'
import { learningProjectDocumentServices } from './learning-project-document-services'
import {
  attachDocumentPersistence,
  type AttachedDocumentPersistence,
  type DocumentPersistenceOptions,
} from '../../../core/persistence/document-persistence'

/** Attaches Learning document persistence to the shared persistence circuit. */
export function attachLearningDocumentPersistence(
  controller: LearningProjectControllerPort,
  store: LearningDocumentStore,
  options: DocumentPersistenceOptions<LearningDocument> = {},
): Promise<AttachedDocumentPersistence<LearningDocument>> {
  return attachDocumentPersistence(controller, store, learningProjectDocumentServices, options)
}

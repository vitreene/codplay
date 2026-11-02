import type { LearningDocument } from '../document/learning-document'
import type { LearningDocumentData } from '../document/learning-document-types'
import type { LearningSelection } from '../authoring/learning-selection-service'
import type { LearningProjectControllerPort } from '../authoring/learning-controller-types'
import type { LearningDocumentStore } from './learning-document-store'
import { LearningProjectApiClient } from './learning-project-api-client'
import { ProjectSyncCoordinator } from '../../../core/sync/project-sync-coordinator'
import { learningProjectDocumentServices } from './learning-project-document-services'

/** Supplies the Learning document adapter to the shared synchronization circuit. */
export class LearningProjectSyncCoordinator extends ProjectSyncCoordinator<LearningDocument, LearningDocumentData, LearningSelection> {
  public constructor(controller: LearningProjectControllerPort, store: LearningDocumentStore, api: LearningProjectApiClient) {
    super(controller, store, api, learningProjectDocumentServices)
  }
}

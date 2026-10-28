import type { LearningDocument } from '../document/learning-document'
import type { LearningDocumentData } from '../document/learning-document-types'
import type { LearningSelection } from '../authoring/learning-selection-service'
import type { LearningProjectControllerPort } from '../authoring/learning-controller-types'
import type { LearningDocumentStore } from './learning-document-store'
import { LearningProjectApiClient } from './learning-project-api-client'
import { ProjectSessionCoordinator } from '../../../core/projects/project-session-coordinator'
import { createLearningProjectDocumentServices } from './learning-project-document-services'
import { learningDocumentService } from '../document/learning-document-service'
import type { LearningDocumentService } from '../document/learning-document-service'

/** Binds Learning document creation and identity rules to the shared session coordinator. */
export class LearningProjectSessionCoordinator extends ProjectSessionCoordinator<
  LearningDocument,
  LearningDocumentData,
  LearningSelection
> {
  public constructor(
    store: LearningDocumentStore,
    api: LearningProjectApiClient,
    session: Storage | null = typeof sessionStorage === 'undefined' ? null : sessionStorage,
    documentService: LearningDocumentService = learningDocumentService,
  ) {
    super(store, api, createLearningProjectDocumentServices(documentService), session)
  }

  /** Attaches the Learning actor through the shared typed controller port. */
  public override attach(controller: LearningProjectControllerPort): Promise<void> {
    return super.attach(controller)
  }
}

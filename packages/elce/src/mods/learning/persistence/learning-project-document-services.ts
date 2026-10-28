import type { ProjectSessionDocumentServices } from '../../../core/projects/project-document-services'
import type { LearningDocument } from '../document/learning-document'
import { learningDocumentService } from '../document/learning-document-service'
import type { LearningDocumentService } from '../document/learning-document-service'

/** Binds Learning identity and format rules to generic project/session services. */
export function createLearningProjectDocumentServices(
  documentService: LearningDocumentService = learningDocumentService,
): ProjectSessionDocumentServices<LearningDocument> {
  return {
    id: (document) => document.id,
    name: (document) => document.data.name,
    media: (document) => document.medias,
    serialize: (document) => document.toJSON(),
    createProjectDocument: (projects) => documentService.createProjectDocument(projects),
    withProjectIdentity: (document, id, name) => documentService.withProjectIdentity(document, id, name),
    isUnsupportedFormatError: (error) => documentService.isUnsupportedFormatError(error),
  }
}

export const learningProjectDocumentServices = createLearningProjectDocumentServices()

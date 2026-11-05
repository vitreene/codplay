import type { ProjectSessionDocumentServices } from '../../../core/projects/project-document-services'
import type { QuizHuntDocument } from '../document/quiz-hunt-document-types'
import { QuizHuntDocumentService } from '../document/quiz-hunt-document-service'
import { writeQuizHuntDocument } from './quiz-hunt-document-codec'

/** Binds Quiz Hunt identity and serialization rules to the shared project session. */
export function createQuizHuntProjectDocumentServices(
  documentService = new QuizHuntDocumentService(),
): ProjectSessionDocumentServices<QuizHuntDocument> {
  return {
    id: (document) => document.id,
    name: (document) => document.name,
    media: (document) => document.medias,
    serialize: writeQuizHuntDocument,
    createProjectDocument: (projects) => documentService.createProjectDocument(projects),
    withProjectIdentity: (document, id, name) => documentService.withProjectIdentity(document, id, name),
    isUnsupportedFormatError: (error) => error instanceof Error && error.message.startsWith('Format Quiz Hunt non pris en charge.'),
  }
}

import { ProjectApiClient } from '../../../core/persistence/project-api/project-api-client'
import type { ProjectDocumentCodec } from '../../../core/persistence/project-api/project-document-codec'
import { ProjectHttpTransport } from '../../../core/persistence/project-api/project-http-transport'
import type { QuizHuntDocument } from '../document/quiz-hunt-document-types'
import { quizHuntDocumentCodec, writeQuizHuntDocument } from './quiz-hunt-document-codec'

export type QuizHuntSerializedDocument = ReturnType<typeof writeQuizHuntDocument>

/** Selects the dedicated namespace while preserving the shared API transport behavior. */
export class QuizHuntHttpTransport extends ProjectHttpTransport {
  /** Resolves shared project paths inside the Quiz Hunt catalog. */
  public override url(path: string): URL {
    return super.url(path.replace(/^\/api(?=\/)/, '/api/quiz-hunt'))
  }
}

/** Creates the existing generic client with the mod's own codec and catalog namespace. */
export function createQuizHuntProjectApi() {
  const codec: ProjectDocumentCodec<QuizHuntDocument, QuizHuntSerializedDocument> = {
    readDocument: quizHuntDocumentCodec.readDocument,
    writeDocument: writeQuizHuntDocument,
    documentId: quizHuntDocumentCodec.documentId,
  }
  return new ProjectApiClient(codec, new QuizHuntHttpTransport())
}

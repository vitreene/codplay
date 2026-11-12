import type { LearningDocumentData } from '../document/learning-document-types'
import type { LearningDocument } from '../document/learning-document'
import { ProjectApiClient } from '../../../core/persistence/project-api/project-api-client'
import { ProjectHttpTransport } from '../../../core/persistence/project-api/project-http-transport'
import { learningDocumentCodec } from './learning-document-codec'

/** Adapts the generic project API client to the Learning document codec. */
export class LearningProjectApiClient extends ProjectApiClient<LearningDocument, LearningDocumentData> {
  public constructor(transport: ProjectHttpTransport = new ProjectHttpTransport()) {
    super(learningDocumentCodec, transport)
  }
}

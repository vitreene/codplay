import type { LearningDocument } from '../document/learning-document'
import type { LearningDocumentCommand } from './learning-document-command-types'
import { updateDocumentRevelation } from './operations/revelation-commands'

/** Applies Learning's document-wide Revelation configuration command. */
export class LearningRevelationCommandService {
  /** Applies a document Revelation command when this service owns its event. */
  public apply(document: LearningDocument, command: LearningDocumentCommand): LearningDocument | null {
    if (command.type !== 'document.revelation.update') return null
    return updateDocumentRevelation(document, command.revelationDefaults)
  }
}

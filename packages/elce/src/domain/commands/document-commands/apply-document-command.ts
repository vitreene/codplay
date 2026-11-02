import type { LearningDocument } from '../../../mods/learning/document/learning-document'
import type { LearningDocumentCommand } from '../../../mods/learning/commands/learning-document-command-types'
import { learningDocumentCommandService } from '../../../mods/learning/commands/learning-command-composition'

/** Delegates to the Learning command service for established application callers. */
export function applyDocumentCommand(document: LearningDocument, command: LearningDocumentCommand): LearningDocument {
  return learningDocumentCommandService.applyCommand(document, command)
}

/** Delegates placement admission to the authoritative Learning command service. */
export function canMoveBdcToPage(document: LearningDocument, bdcId: string, pageId: string, index: number): boolean {
  return learningDocumentCommandService.canMoveBdcToPage(document, bdcId, pageId, index)
}

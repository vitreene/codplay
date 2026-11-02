import { ELCE_DOCUMENT_VERSION, LearningDocument } from '../../document/learning-document'
import type { LearningDocumentData } from '../../document/learning-document-types'
import { learningDocumentCommandService } from '../../commands/learning-command-composition'
import type { IncomingProjectDocument } from '../../../../core/server/projects/project-api-controller'

/** Rehydrates and validates one Learning document at the generic project API boundary. */
export function readIncomingLearningDocument(value: unknown): IncomingProjectDocument<LearningDocument> {
  if (!isLearningDocumentData(value)) return { kind: 'invalid', reason: 'invalid_document_shape' }

  let document: LearningDocument
  try {
    document = LearningDocument.fromJSON(value)
  } catch (error) {
    return { kind: 'invalid', reason: 'document_rehydration_rejected', frames: errorFrames(error) }
  }

  try {
    learningDocumentCommandService.assertDocumentInvariants(document)
    return { kind: 'valid', document }
  } catch (error) {
    return { kind: 'invalid', reason: 'document_invariants_rejected', frames: errorFrames(error) }
  }
}

/** Keeps stack locations while omitting dynamic error messages from diagnostics. */
function errorFrames(error: unknown): readonly string[] {
  if (!(error instanceof Error) || error.stack === undefined) return []
  return error.stack.split('\n').slice(1).filter((line) => /^\s+at\s/.test(line)).slice(0, 8)
}

/** Narrows untrusted JSON to the required top-level Learning document fields. */
function isLearningDocumentData(value: unknown): value is LearningDocumentData {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && value.version === ELCE_DOCUMENT_VERSION
}

/** Checks whether an unknown value is a non-array JSON object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

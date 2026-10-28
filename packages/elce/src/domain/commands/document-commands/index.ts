export * from '../../../mods/learning/commands/learning-document-command-types'
export * from '../../../mods/learning/commands/operations/command-factories'
export * from '../../../resources/bdcs/card/authoring/card-command-factory'
export * from '../../../resources/bdcs/carousel/authoring/carousel-command-factory'
export * from '../../../resources/bdcs/question/authoring/question-command-factory'
export * from '../../../resources/bdcs/section/authoring/section-command-factory'
export * from '../../../resources/bdcs/statistical-graph/authoring/statistical-graph-command-factory'
export { applyDocumentCommand, canMoveBdcToPage } from './apply-document-command'
import type { LearningDocument } from '../../../mods/learning/document/learning-document'
import { learningDocumentCommandService } from '../../../mods/learning/commands/learning-command-composition'
import { learningDocumentService } from '../../../mods/learning/document/learning-document-service'

/** Verifies the Learning document through the composed invariant services. */
export const assertDocumentInvariants = (document: LearningDocument): void =>
  learningDocumentCommandService.assertDocumentInvariants(document)

/** Creates a default page command through the Learning document service. */
export const createDefaultPageCommand = (...args: Parameters<typeof learningDocumentService.createDefaultPageCommand>) =>
  learningDocumentService.createDefaultPageCommand(...args)

/** Creates a chapter command through the Learning document service. */
export const createChapterCommand = (...args: Parameters<typeof learningDocumentService.createChapterCommand>) =>
  learningDocumentService.createChapterCommand(...args)

/** Creates a Result command through the Learning document service. */
export const createEvaluationResultBdcCommand = (...args: Parameters<typeof learningDocumentService.createEvaluationResultBdcCommand>) =>
  learningDocumentService.createEvaluationResultBdcCommand(...args)

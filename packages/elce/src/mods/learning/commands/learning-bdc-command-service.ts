import type { LearningDocument } from '../document/learning-document'
import type { LearningDocumentCommand } from './learning-document-command-types'
import type { LearningCommandResourceServices } from './learning-command-resource-services'
import {
  createBdc,
  deleteBdc,
  deleteCard,
  deleteCarousel,
  deleteCatalogBdc,
  deleteEvaluationResult,
  deleteQuestion,
  deleteStatisticalGraph,
  setCardLayout,
  setStatisticalGraphLayout,
  updateCard,
  updateCarousel,
  updateEvaluationResult,
  updateQuestion,
  updateStatisticalGraph,
} from './operations/bdc-commands'

/** Applies Learning BDC lifecycle and aggregate adaptation commands. */
export class LearningBdcCommandService {
  private readonly resources: LearningCommandResourceServices

  public constructor(resources: LearningCommandResourceServices) {
    this.resources = resources
  }

  /** Creates a BDC using the resource services supplied by Learning composition. */
  public create(document: LearningDocument, command: Extract<LearningDocumentCommand, { type: 'bdc.create' }>): LearningDocument {
    return createBdc(document, command, this.resources)
  }

  /** Deletes a BDC and its owned children while preserving separate media resources. */
  public delete(document: LearningDocument, bdcId: string): LearningDocument {
    return deleteBdc(document, bdcId)
  }

  /** Applies a BDC command when this service owns its event. */
  public apply(document: LearningDocument, command: LearningDocumentCommand): LearningDocument | null {
    switch (command.type) {
      case 'bdc.create':
        return this.create(document, command)
      case 'bdc.delete':
        return deleteCatalogBdc(document, command.bdcId)
      case 'bdc.question.update':
        return updateQuestion(document, command.bdcId, command.question, this.resources)
      case 'bdc.evaluation-result.update':
        return updateEvaluationResult(document, command.bdcId, command.evaluationResult, this.resources)
      case 'bdc.carousel.update':
        return updateCarousel(document, command.bdcId, command.carousel, this.resources)
      case 'bdc.card.update':
        return updateCard(document, command.bdcId, command.card, this.resources)
      case 'bdc.statistical-graph.update':
        return updateStatisticalGraph(document, command.bdcId, command.statisticalGraph, this.resources)
      case 'bdc.statistical-graph.layout.set':
        return setStatisticalGraphLayout(document, command.bdcId, command.layoutId)
      case 'bdc.statistical-graph.delete':
        return deleteStatisticalGraph(document, command.bdcId)
      case 'bdc.card.layout.set':
        return setCardLayout(document, command.bdcId, command.layoutId)
      case 'bdc.card.delete':
        return deleteCard(document, command.bdcId)
      case 'bdc.question.delete':
        return deleteQuestion(document, command.bdcId)
      case 'bdc.evaluation-result.delete':
        return deleteEvaluationResult(document, command.bdcId)
      case 'bdc.carousel.delete':
        return deleteCarousel(document, command.bdcId)
      default:
        return null
    }
  }
}

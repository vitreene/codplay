import { LearningDocumentCommandService } from './learning-document-command-service'
import { learningDocumentService } from '../document/learning-document-service'
import { ElceAnchorReferenceService } from '../../../resources/anchoring/domain/anchor-reference-service'
import { ElceCardService } from '../../../resources/bdcs/card/domain/card-service'
import { ElceCarouselService } from '../../../resources/bdcs/carousel/domain/carousel-service'
import { ElceEvaluationResultService } from '../evaluation/domain/learning-evaluation-result-service'
import { ElceQuestionService } from '../../../resources/bdcs/question/domain/question-service'
import { ElceStatisticalGraphService } from '../../../resources/bdcs/statistical-graph/domain/statistical-graph-service'
import { LearningAnchorCommandService } from './learning-anchor-command-service'
import { LearningBdcCommandService } from './learning-bdc-command-service'
import { LearningMediaCommandService } from './learning-media-command-service'
import { LearningPageCommandService } from './learning-page-command-service'
import { LearningRevelationCommandService } from './learning-revelation-command-service'

/** Builds the current Learning command services as one domain composition. */
export function createLearningDocumentCommandService(): LearningDocumentCommandService {
  const resources = {
    anchorReferenceService: new ElceAnchorReferenceService(),
    questionService: new ElceQuestionService(),
    evaluationResultService: new ElceEvaluationResultService(),
    carouselService: new ElceCarouselService(),
    cardService: new ElceCardService(),
    statisticalGraphService: new ElceStatisticalGraphService(),
  }
  const bdcCommands = new LearningBdcCommandService(resources)
  return new LearningDocumentCommandService(
    learningDocumentService,
    resources,
    new LearningPageCommandService(learningDocumentService, bdcCommands),
    bdcCommands,
    new LearningAnchorCommandService(resources),
    new LearningMediaCommandService(),
    new LearningRevelationCommandService(),
  )
}

export const learningDocumentCommandService = createLearningDocumentCommandService()

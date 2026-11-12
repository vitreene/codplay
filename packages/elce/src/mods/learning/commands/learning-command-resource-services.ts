import type { ElceAnchorReferenceService } from '../../../resources/anchoring/domain/anchor-reference-service'
import type { ElceCardService } from '../../../resources/bdcs/card/domain/card-service'
import type { ElceCarouselService } from '../../../resources/bdcs/carousel/domain/carousel-service'
import type { ElceEvaluationResultService } from '../evaluation/domain/learning-evaluation-result-service'
import type { ElceQuestionService } from '../../../resources/bdcs/question/domain/question-service'
import type { ElceStatisticalGraphService } from '../../../resources/bdcs/statistical-graph/domain/statistical-graph-service'

/** Resource services used while Learning adapts commands to its document. */
export interface LearningCommandResourceServices {
  readonly anchorReferenceService: ElceAnchorReferenceService
  readonly questionService: ElceQuestionService
  readonly evaluationResultService: ElceEvaluationResultService
  readonly carouselService: ElceCarouselService
  readonly cardService: ElceCardService
  readonly statisticalGraphService: ElceStatisticalGraphService
}

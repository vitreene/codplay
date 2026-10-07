import { ElceAnchorReferenceService } from '../../../domain/anchor/anchor-reference-service'
import { ElceQuestionService } from '../../../domain/question/question-service'
import { ElceEvaluationResultService } from '../../../domain/evaluation/evaluation-result-service'
import { ElceCarouselService } from '../../../domain/carousel/carousel-service'
import { ElceCardService } from '../../../domain/card/card-service'

export const anchorReferenceService = new ElceAnchorReferenceService()
export const questionService = new ElceQuestionService()
export const evaluationResultService = new ElceEvaluationResultService()
export const carouselService = new ElceCarouselService()
export const cardService = new ElceCardService()

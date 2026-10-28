import { CARD_PRESET_ID, CARD_BDC_TYPE } from '../../resources/bdcs/card/card-config'
import { CAROUSEL_BDC_TYPE, CAROUSEL_PRESET_ID } from '../../resources/bdcs/carousel/carousel-config'
import { QUESTION_BDC_TYPE, QUESTION_PRESET_ID } from '../../resources/bdcs/question/question-config'
import { SECTION_BDC_TYPE, SECTION_PRESET_ID } from '../../resources/bdcs/section/section-config'
import { STATISTICAL_GRAPH_BDC_TYPE, STATISTICAL_GRAPH_PRESET_ID } from '../../resources/bdcs/statistical-graph/statistical-graph-config'
import { DIAPO_PAGE_TYPE } from '../../resources/pages/diapo/diapo-config'
import { FLUX_PAGE_TYPE } from '../../resources/pages/flux/flux-config'
import { EVALUATION_RESULT_BDC_TYPE, EVALUATION_RESULT_PRESET_ID } from './evaluation/learning-evaluation-config'

export const BDC_TYPE = {
  SECTION: SECTION_BDC_TYPE,
  QUESTION: QUESTION_BDC_TYPE,
  EVALUATION_RESULT: EVALUATION_RESULT_BDC_TYPE,
  CAROUSEL: CAROUSEL_BDC_TYPE,
  CARD: CARD_BDC_TYPE,
  STATISTICAL_GRAPH: STATISTICAL_GRAPH_BDC_TYPE,
} as const

export const PAGE_TYPE = {
  FLUX: FLUX_PAGE_TYPE,
  DIAPO: DIAPO_PAGE_TYPE,
} as const

export const DEFAULT_PRESET_ID = {
  CAROUSEL: CAROUSEL_PRESET_ID,
  TEXT_IMAGE: CARD_PRESET_ID.TEXT_IMAGE,
  SECTION: SECTION_PRESET_ID,
  PHOTO: CARD_PRESET_ID.PHOTO,
  TEXT_SHORT: CARD_PRESET_ID.TEXT_SHORT,
  QUESTION: QUESTION_PRESET_ID,
  EVALUATION_RESULT: EVALUATION_RESULT_PRESET_ID,
  IMAGE_CAPTION: CARD_PRESET_ID.IMAGE_CAPTION,
  IMAGE_TITLE: CARD_PRESET_ID.IMAGE_TITLE,
  STATISTICAL_GRAPH_ABOVE_TEXT: STATISTICAL_GRAPH_PRESET_ID.ABOVE_TEXT,
  STATISTICAL_GRAPH_SIDE_BY_SIDE: STATISTICAL_GRAPH_PRESET_ID.SIDE_BY_SIDE,
} as const

export const LEARNING_DEFINITION = {
  id: 'learning',
  name: 'Learning',
  pageTypes: Object.values(PAGE_TYPE),
  bdcTypes: Object.values(BDC_TYPE),
} as const

export type BdcType = typeof BDC_TYPE[keyof typeof BDC_TYPE]
export type PageType = typeof PAGE_TYPE[keyof typeof PAGE_TYPE]

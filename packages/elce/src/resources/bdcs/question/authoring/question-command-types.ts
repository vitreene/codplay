import type { BdcId, MediaId, MediaMetadata } from '../../../../core/document/content-document-types'
import type { BdcPlacement } from '../../../../core/document/content-location'
import type { QuestionContent } from '../domain/question-types'
import { QUESTION_BDC_TYPE, QUESTION_PRESET_ID } from '../question-config'

/** Commands that author a Question resource. */
export type QuestionCommand =
  | Readonly<{ type: 'bdc.create'; bdcId: BdcId; bdcType: typeof QUESTION_BDC_TYPE; presetId: typeof QUESTION_PRESET_ID; placement: BdcPlacement }>
  | Readonly<{ type: 'bdc.question.update'; bdcId: BdcId; question: QuestionContent }>
  | Readonly<{ type: 'bdc.question.media.set'; bdcId: BdcId; mediaId: MediaId | null }>
  | Readonly<{ type: 'bdc.question.media.attach'; bdcId: BdcId; media: MediaMetadata }>
  | Readonly<{ type: 'bdc.question.delete'; bdcId: BdcId }>

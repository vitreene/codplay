import { BDC_LOCATION } from '../../../../core/document/content-location'
import type { BdcId, PageId } from '../../../../core/document/content-document-types'
import { QUESTION_BDC_TYPE, QUESTION_PRESET_ID } from '../question-config'
import type { QuestionCommand } from './question-command-types'

/** Creates the single Question BDC command at its requested page position. */
export function createQuestionBdcCommand(
  bdcId: BdcId,
  pageId: PageId,
  index: number,
): Extract<QuestionCommand, { type: 'bdc.create' }> {
  return {
    type: 'bdc.create',
    bdcId,
    bdcType: QUESTION_BDC_TYPE,
    presetId: QUESTION_PRESET_ID,
    placement: { kind: BDC_LOCATION.PAGE, pageId, index },
  }
}

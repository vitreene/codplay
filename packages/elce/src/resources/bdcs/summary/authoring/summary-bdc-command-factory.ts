import { BDC_LOCATION } from '../../../../core/document/content-location'
import type { BdcId, PageId } from '../../../../core/document/content-document-types'
import { SUMMARY_BDC_TYPE, SUMMARY_PRESET_ID } from '../summary-config'
import type { SummaryBdcCommand } from './summary-bdc-command-types'

/** Creates the document command that adds a Summary BDC at a page position. */
export function createSummaryBdcCommand(
  bdcId: BdcId,
  pageId: PageId,
  index: number,
): SummaryBdcCommand {
  return {
    type: 'bdc.create',
    bdcId,
    bdcType: SUMMARY_BDC_TYPE,
    presetId: SUMMARY_PRESET_ID,
    placement: { kind: BDC_LOCATION.PAGE, pageId, index },
  }
}

import type { BdcPlacement } from '../../../../core/document/content-location'
import type { BdcId } from '../../../../core/document/content-document-types'
import { SUMMARY_BDC_TYPE, SUMMARY_PRESET_ID } from '../summary-config'

/** Describes creation of a list-only Summary BDC directly in a page. */
export type SummaryBdcCommand = Readonly<{
  type: 'bdc.create'
  bdcId: BdcId
  bdcType: typeof SUMMARY_BDC_TYPE
  presetId: typeof SUMMARY_PRESET_ID
  placement: BdcPlacement
}>

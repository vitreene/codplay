import { BDC_LOCATION } from '../../../../core/document/content-location'
import type { BdcId, PageId } from '../../../../core/document/content-document-types'
import { SECTION_BDC_TYPE, SECTION_PRESET_ID } from '../section-config'
import type { SectionCommand } from './section-command-types'

/** Creates a Section BDC command at its requested page position. */
export function createSectionBdcCommand(
  bdcId: BdcId,
  pageId: PageId,
  index: number,
): Extract<SectionCommand, { type: 'bdc.create' }> {
  return {
    type: 'bdc.create',
    bdcId,
    bdcType: SECTION_BDC_TYPE,
    presetId: SECTION_PRESET_ID,
    placement: { kind: BDC_LOCATION.PAGE, pageId, index },
  }
}

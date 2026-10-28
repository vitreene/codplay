import { BDC_LOCATION } from '../../../../core/document/content-location'
import type { BdcId, PageId } from '../../../../core/document/content-document-types'
import { createStableId } from '../../../../core/document/stable-id'
import { CAROUSEL_BDC_TYPE, CAROUSEL_PRESET_ID } from '../carousel-config'
import type { CarouselCommand } from './carousel-command-types'

/** Creates a Carousel BDC command with its first Card identity. */
export function createCarouselBdcCommand(
  bdcId: BdcId,
  pageId: PageId,
  index: number,
  initialCardBdcId: BdcId = createStableId('bdc-card'),
): Extract<CarouselCommand, { type: 'bdc.create' }> {
  return {
    type: 'bdc.create',
    bdcId,
    bdcType: CAROUSEL_BDC_TYPE,
    presetId: CAROUSEL_PRESET_ID,
    placement: { kind: BDC_LOCATION.PAGE, pageId, index },
    initialCardBdcId,
  }
}

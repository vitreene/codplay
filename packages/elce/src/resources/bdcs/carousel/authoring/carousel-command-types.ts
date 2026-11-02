import type { BdcId } from '../../../../core/document/content-document-types'
import type { BdcPlacement } from '../../../../core/document/content-location'
import type { CarouselContent } from '../domain/carousel-types'
import { CAROUSEL_BDC_TYPE, CAROUSEL_PRESET_ID } from '../carousel-config'

/** Commands that author a Carousel resource. */
export type CarouselCommand =
  | Readonly<{
      type: 'bdc.create'
      bdcId: BdcId
      bdcType: typeof CAROUSEL_BDC_TYPE
      presetId: typeof CAROUSEL_PRESET_ID
      placement: BdcPlacement
      initialCardBdcId: BdcId
    }>
  | Readonly<{ type: 'bdc.carousel.update'; bdcId: BdcId; carousel: CarouselContent }>
  | Readonly<{ type: 'bdc.carousel.delete'; bdcId: BdcId }>

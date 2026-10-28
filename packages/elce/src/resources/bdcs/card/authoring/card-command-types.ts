import type { BdcId, MediaId, MediaMetadata } from '../../../../core/document/content-document-types'
import type { BdcPlacement } from '../../../../core/document/content-location'
import type { CardContent, CardPresentationOptions } from '../domain/card-types'
import { CARD_BDC_TYPE, type CardLayoutId } from '../card-config'

/** Commands that author a Card resource. */
export type CardCommand =
  | Readonly<{
      type: 'bdc.create'
      bdcId: BdcId
      bdcType: typeof CARD_BDC_TYPE
      presetId: CardLayoutId
      placement: BdcPlacement
      initialCardOptions?: CardPresentationOptions
    }>
  | Readonly<{ type: 'bdc.card.update'; bdcId: BdcId; card: CardContent }>
  | Readonly<{ type: 'bdc.card.layout.set'; bdcId: BdcId; layoutId: CardLayoutId }>
  | Readonly<{ type: 'bdc.card.media.set'; bdcId: BdcId; mediaId: MediaId | null }>
  | Readonly<{ type: 'bdc.card.media.attach'; bdcId: BdcId; media: MediaMetadata }>
  | Readonly<{ type: 'bdc.card.delete'; bdcId: BdcId }>

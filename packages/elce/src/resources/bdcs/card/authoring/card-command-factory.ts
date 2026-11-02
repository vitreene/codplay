import { BDC_LOCATION } from '../../../../core/document/content-location'
import type { BdcId, PageId } from '../../../../core/document/content-document-types'
import type { CardPresentationOptions } from '../domain/card-types'
import { CARD_PRESET_ID, type CardLayoutId } from '../card-config'
import type { CardCommand } from './card-command-types'

/** Creates a Card command at its requested container position. */
export function createCardBdcCommand(
  bdcId: BdcId,
  parentBdcId: BdcId,
  index: number,
  layoutId: CardLayoutId,
  initialCardOptions?: CardPresentationOptions,
): Extract<CardCommand, { type: 'bdc.create' }> {
  return {
    type: 'bdc.create',
    bdcId,
    bdcType: 'card',
    presetId: layoutId,
    placement: { kind: BDC_LOCATION.PARENT, parentBdcId, index },
    ...(initialCardOptions === undefined ? {} : { initialCardOptions }),
  }
}

/** Creates a standalone Card command at its requested page position. */
export function createStandaloneCardBdcCommand(
  bdcId: BdcId,
  pageId: PageId,
  layoutId: CardLayoutId = CARD_PRESET_ID.TEXT_SHORT,
  initialCardOptions?: CardPresentationOptions,
): Extract<CardCommand, { type: 'bdc.create' }> {
  return {
    type: 'bdc.create',
    bdcId,
    bdcType: 'card',
    presetId: layoutId,
    placement: { kind: BDC_LOCATION.PAGE, pageId },
    ...(initialCardOptions === undefined ? {} : { initialCardOptions }),
  }
}

import { BDC_LOCATION } from '../../../../core/document/content-location'
import type { BdcId, PageId } from '../../../../core/document/content-document-types'
import { STATISTICAL_GRAPH_BDC_TYPE, STATISTICAL_GRAPH_PRESET_ID, type StatisticalGraphLayoutId } from '../statistical-graph-config'
import type { StatisticalGraphCommand } from './statistical-graph-command-types'

/** Creates a Statistical Graph command at its requested page position. */
export function createStatisticalGraphBdcCommand(
  bdcId: BdcId,
  pageId: PageId,
  index: number,
  layoutId: StatisticalGraphLayoutId = STATISTICAL_GRAPH_PRESET_ID.ABOVE_TEXT,
): Extract<StatisticalGraphCommand, { type: 'bdc.create' }> {
  return {
    type: 'bdc.create',
    bdcId,
    bdcType: STATISTICAL_GRAPH_BDC_TYPE,
    presetId: layoutId,
    placement: { kind: BDC_LOCATION.PAGE, pageId, index },
  }
}

/** Creates a Statistical Graph command at its requested Carousel position. */
export function createStatisticalGraphCarouselBdcCommand(
  bdcId: BdcId,
  carouselBdcId: BdcId,
  index: number,
  layoutId: StatisticalGraphLayoutId = STATISTICAL_GRAPH_PRESET_ID.ABOVE_TEXT,
): Extract<StatisticalGraphCommand, { type: 'bdc.create' }> {
  return {
    type: 'bdc.create',
    bdcId,
    bdcType: STATISTICAL_GRAPH_BDC_TYPE,
    presetId: layoutId,
    placement: { kind: BDC_LOCATION.PARENT, parentBdcId: carouselBdcId, index },
  }
}

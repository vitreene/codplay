import type { BdcId } from '../../../../core/document/content-document-types'
import type { BdcPlacement } from '../../../../core/document/content-location'
import type { StatisticalGraphContent } from '../domain/statistical-graph-types'
import { STATISTICAL_GRAPH_BDC_TYPE, type StatisticalGraphLayoutId } from '../statistical-graph-config'

/** Commands that author a Statistical Graph resource. */
export type StatisticalGraphCommand =
  | Readonly<{
      type: 'bdc.create'
      bdcId: BdcId
      bdcType: typeof STATISTICAL_GRAPH_BDC_TYPE
      presetId: StatisticalGraphLayoutId
      placement: BdcPlacement
    }>
  | Readonly<{ type: 'bdc.statistical-graph.update'; bdcId: BdcId; statisticalGraph: StatisticalGraphContent }>
  | Readonly<{ type: 'bdc.statistical-graph.layout.set'; bdcId: BdcId; layoutId: StatisticalGraphLayoutId }>
  | Readonly<{ type: 'bdc.statistical-graph.delete'; bdcId: BdcId }>

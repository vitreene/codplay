import type { StatisticalGraphCommand } from './statistical-graph-command-types'
import type { BdcId } from '../../../../core/document/content-document-types'
import type { StatisticalGraphContent } from '../domain/statistical-graph-types'
import { ElceStatisticalGraphService } from '../domain/statistical-graph-service'
import type { StatisticalGraphEditorActions } from './statistical-graph-facade-types'

export interface StatisticalGraphCommandDispatcher {
  dispatch(command: StatisticalGraphCommand): void
}

/** Sends Statistical Graph edits through the existing ElceDocument command path. */
export class StatisticalGraphFacade {
  private readonly dispatcher: StatisticalGraphCommandDispatcher
  private readonly service: ElceStatisticalGraphService

  public constructor(dispatcher: StatisticalGraphCommandDispatcher, service: ElceStatisticalGraphService) {
    this.dispatcher = dispatcher
    this.service = service
  }

  /** Creates editor callbacks that update one current graph by immutable command. */
  public createEditorActions(bdcId: BdcId, content: StatisticalGraphContent): StatisticalGraphEditorActions {
    const update = (next: StatisticalGraphContent): void => {
      this.dispatcher.dispatch({ type: 'bdc.statistical-graph.update', bdcId, statisticalGraph: next })
    }
    const updateFrom = (transform: (current: StatisticalGraphContent) => StatisticalGraphContent): void => update(transform(content))
    return {
      setText: (field, value) => updateFrom((current) => ({ ...current, [field]: value })),
      setRendering: (rendering) => updateFrom((current) => this.service.setStatisticalGraphRendering(current, rendering)),
      setLayout: (layoutId) => this.dispatcher.dispatch({ type: 'bdc.statistical-graph.layout.set', bdcId, layoutId }),
      setTranspose: (enabled) => updateFrom((current) => this.service.setStatisticalGraphTranspose(current, enabled)),
      setPieSeries: (seriesId) => updateFrom((current) => this.service.setStatisticalGraphPieSeries(current, seriesId)),
      setPieCategory: (categoryId) => updateFrom((current) => this.service.setStatisticalGraphPieCategory(current, categoryId)),
      setCategoryLabel: (categoryId, label) => updateFrom((current) => this.service.setStatisticalGraphCategoryLabel(current, categoryId, label)),
      setSeriesLabel: (seriesId, label) => updateFrom((current) => this.service.setStatisticalGraphSeriesLabel(current, seriesId, label)),
      setCell: (categoryId, seriesId, value) => updateFrom((current) => this.service.setStatisticalGraphCell(current, categoryId, seriesId, value)),
      setGridCell: (rowIndex, columnIndex, value, headings) => updateFrom((current) => this.service.setStatisticalGraphGridCell(current, rowIndex, columnIndex, value, headings)),
      addCategory: () => updateFrom((current) => this.service.addStatisticalGraphCategory(current)),
      removeCategory: (categoryId) => updateFrom((current) => this.service.removeStatisticalGraphCategory(current, categoryId)),
      addSeries: () => updateFrom((current) => this.service.addStatisticalGraphSeries(current)),
      removeSeries: (seriesId) => updateFrom((current) => this.service.removeStatisticalGraphSeries(current, seriesId)),
      replaceTable: (text) => updateFrom((current) => this.service.replaceStatisticalGraphTable(current, text)),
      update,
      deleteGraph: () => this.dispatcher.dispatch({ type: 'bdc.statistical-graph.delete', bdcId }),
    }
  }
}

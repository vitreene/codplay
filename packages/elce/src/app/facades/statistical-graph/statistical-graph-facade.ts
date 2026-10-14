import type { DocumentCommand } from '../../../domain/commands/document-command-types'
import type { BdcId } from '../../../domain/document/document-types'
import type { StatisticalGraphContent } from '../../../domain/statistical-graph/statistical-graph-types'
import {
  addStatisticalGraphCategory,
  addStatisticalGraphSeries,
  removeStatisticalGraphCategory,
  removeStatisticalGraphSeries,
  replaceStatisticalGraphTable,
  setStatisticalGraphCategoryLabel,
  setStatisticalGraphCell,
  setStatisticalGraphGridCell,
  setStatisticalGraphPieCategory,
  setStatisticalGraphPieSeries,
  setStatisticalGraphRendering,
  setStatisticalGraphSeriesLabel,
  setStatisticalGraphTranspose,
} from '../../../domain/statistical-graph/statistical-graph-service'
import type { StatisticalGraphEditorActions } from './statistical-graph-facade-types'

export interface StatisticalGraphCommandDispatcher {
  dispatch(command: DocumentCommand): void
}

/** Sends Statistical Graph edits through the existing ElceDocument command path. */
export class StatisticalGraphFacade {
  private readonly dispatcher: StatisticalGraphCommandDispatcher

  public constructor(dispatcher: StatisticalGraphCommandDispatcher) {
    this.dispatcher = dispatcher
  }

  /** Creates editor callbacks that update one current graph by immutable command. */
  public createEditorActions(bdcId: BdcId, content: StatisticalGraphContent): StatisticalGraphEditorActions {
    const update = (next: StatisticalGraphContent): void => {
      this.dispatcher.dispatch({ type: 'bdc.statistical-graph.update', bdcId, statisticalGraph: next })
    }
    const updateFrom = (transform: (current: StatisticalGraphContent) => StatisticalGraphContent): void => update(transform(content))
    return {
      setText: (field, value) => updateFrom((current) => ({ ...current, [field]: value })),
      setRendering: (rendering) => updateFrom((current) => setStatisticalGraphRendering(current, rendering)),
      setLayout: (layoutId) => this.dispatcher.dispatch({ type: 'bdc.statistical-graph.layout.set', bdcId, layoutId }),
      setTranspose: (enabled) => updateFrom((current) => setStatisticalGraphTranspose(current, enabled)),
      setPieSeries: (seriesId) => updateFrom((current) => setStatisticalGraphPieSeries(current, seriesId)),
      setPieCategory: (categoryId) => updateFrom((current) => setStatisticalGraphPieCategory(current, categoryId)),
      setCategoryLabel: (categoryId, label) => updateFrom((current) => setStatisticalGraphCategoryLabel(current, categoryId, label)),
      setSeriesLabel: (seriesId, label) => updateFrom((current) => setStatisticalGraphSeriesLabel(current, seriesId, label)),
      setCell: (categoryId, seriesId, value) => updateFrom((current) => setStatisticalGraphCell(current, categoryId, seriesId, value)),
      setGridCell: (rowIndex, columnIndex, value, headings) => updateFrom((current) => setStatisticalGraphGridCell(current, rowIndex, columnIndex, value, headings)),
      addCategory: () => updateFrom(addStatisticalGraphCategory),
      removeCategory: (categoryId) => updateFrom((current) => removeStatisticalGraphCategory(current, categoryId)),
      addSeries: () => updateFrom(addStatisticalGraphSeries),
      removeSeries: (seriesId) => updateFrom((current) => removeStatisticalGraphSeries(current, seriesId)),
      replaceTable: (text) => updateFrom((current) => replaceStatisticalGraphTable(current, text)),
      update,
      deleteGraph: () => this.dispatcher.dispatch({ type: 'bdc.statistical-graph.delete', bdcId }),
    }
  }
}

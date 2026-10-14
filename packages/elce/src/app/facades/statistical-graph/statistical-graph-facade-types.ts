import type { StatisticalGraphLayoutId, StatisticalGraphRendering } from '../../../config/document-config-types'
import type { StatisticalGraphContent } from '../../../domain/statistical-graph/statistical-graph-types'

export type StatisticalGraphTextField = 'overline' | 'title' | 'categoryAxisLabel' | 'seriesAxisLabel' | 'editorialText'

export interface StatisticalGraphEditorActions {
  readonly setText: (field: StatisticalGraphTextField, value: string) => void
  readonly setRendering: (rendering: StatisticalGraphRendering) => void
  readonly setLayout: (layoutId: StatisticalGraphLayoutId) => void
  readonly setTranspose: (enabled: boolean) => void
  readonly setPieSeries: (seriesId: string) => void
  readonly setPieCategory: (categoryId: string) => void
  readonly setCategoryLabel: (categoryId: string, label: string) => void
  readonly setSeriesLabel: (seriesId: string, label: string) => void
  readonly setCell: (categoryId: string, seriesId: string, value: string) => void
  readonly setGridCell: (
    rowIndex: number,
    columnIndex: number,
    value: string,
    headings?: Partial<Pick<StatisticalGraphContent, 'columnLabelsEnabled' | 'rowLabelsEnabled'>>,
  ) => void
  readonly addCategory: () => void
  readonly removeCategory: (categoryId: string) => void
  readonly addSeries: () => void
  readonly removeSeries: (seriesId: string) => void
  readonly replaceTable: (text: string) => void
  readonly update: (content: StatisticalGraphContent) => void
  readonly deleteGraph: () => void
}

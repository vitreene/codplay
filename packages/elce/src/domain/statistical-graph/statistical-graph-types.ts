import type { StatisticalGraphRendering } from '../../config/document-config-types'
import type { StatisticalGraphLayoutId } from '../../config/document-config-types'
import type { ElceTextValue } from '../document/document-types'

export interface StatisticalGraphCategory {
  readonly id: string
  readonly label: ElceTextValue
}

export interface StatisticalGraphSeries {
  readonly id: string
  readonly label: ElceTextValue
}

export interface StatisticalGraphValue {
  readonly categoryId: string
  readonly seriesId: string
  readonly value: number
}

export interface StatisticalGraphContent {
  readonly rendering: StatisticalGraphRendering
  readonly transposeEnabled?: boolean
  readonly columnLabelsEnabled?: boolean
  readonly rowLabelsEnabled?: boolean
  readonly overline: ElceTextValue
  readonly title: ElceTextValue
  readonly categoryAxisLabel: ElceTextValue
  readonly seriesAxisLabel: ElceTextValue
  readonly editorialText: ElceTextValue
  readonly pieSeriesId: string | null
  readonly pieCategoryId?: string | null
  readonly categories: readonly StatisticalGraphCategory[]
  readonly series: readonly StatisticalGraphSeries[]
  readonly values: readonly StatisticalGraphValue[]
}

export type StatisticalGraphLayout = StatisticalGraphLayoutId

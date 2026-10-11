import type { StatisticalGraphRendering } from '../../config/document-config-types'
import type { StatisticalGraphLayoutId } from '../../config/document-config-types'

export interface StatisticalGraphCategory {
  readonly id: string
  readonly label: string
}

export interface StatisticalGraphSeries {
  readonly id: string
  readonly label: string
}

export interface StatisticalGraphValue {
  readonly categoryId: string
  readonly seriesId: string
  readonly value: number
}

export interface StatisticalGraphContent {
  readonly rendering: StatisticalGraphRendering
  readonly overline: string
  readonly title: string
  readonly categoryAxisLabel: string
  readonly seriesAxisLabel: string
  readonly editorialText: string
  readonly pieSeriesId: string | null
  readonly categories: readonly StatisticalGraphCategory[]
  readonly series: readonly StatisticalGraphSeries[]
  readonly values: readonly StatisticalGraphValue[]
}

export type StatisticalGraphLayout = StatisticalGraphLayoutId

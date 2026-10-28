export const STATISTICAL_GRAPH_BDC_TYPE = 'statistical-graph' as const

export const STATISTICAL_GRAPH_PRESET_ID = {
  ABOVE_TEXT: 'statistical-graph-above-text',
  SIDE_BY_SIDE: 'statistical-graph-side-by-side',
} as const

export const STATISTICAL_GRAPH_RENDERING = {
  BAR: 'bar',
  LINE: 'line',
  PIE: 'pie',
  TABLE: 'table',
} as const

export const STATISTICAL_GRAPH_LAYOUT_IDS = [
  STATISTICAL_GRAPH_PRESET_ID.ABOVE_TEXT,
  STATISTICAL_GRAPH_PRESET_ID.SIDE_BY_SIDE,
] as const

export type StatisticalGraphRendering = typeof STATISTICAL_GRAPH_RENDERING[keyof typeof STATISTICAL_GRAPH_RENDERING]
export type StatisticalGraphLayoutId = typeof STATISTICAL_GRAPH_LAYOUT_IDS[number]

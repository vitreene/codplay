import { STATISTICAL_GRAPH_RENDERING } from '../../config/document-config'
import type { StatisticalGraphContent } from './statistical-graph-types'

/** Creates the initial 5-by-3 grid, counting its header row and column. */
export function createDefaultStatisticalGraphContent(): StatisticalGraphContent {
  const categories = Array.from({ length: 4 }, () => ({ id: createGraphId('graph-category'), label: '' }))
  const series = Array.from({ length: 2 }, () => ({ id: createGraphId('graph-series'), label: '' }))
  return {
    rendering: STATISTICAL_GRAPH_RENDERING.BAR,
    transposeEnabled: true,
    columnLabelsEnabled: true,
    rowLabelsEnabled: true,
    overline: '',
    title: '',
    categoryAxisLabel: '',
    seriesAxisLabel: '',
    editorialText: '',
    pieSeriesId: series[0]!.id,
    pieCategoryId: categories[0]!.id,
    categories,
    series,
    values: [],
  }
}

/** Replaces one cell while retaining sparse empty and nonnumeric values. */
export function setStatisticalGraphCell(
  content: StatisticalGraphContent,
  categoryId: string,
  seriesId: string,
  rawValue: string,
): StatisticalGraphContent {
  if (!content.categories.some((category) => category.id === categoryId)
    || !content.series.some((series) => series.id === seriesId)) return content
  const value = parseStatisticalGraphNumber(rawValue)
  const values = content.values.filter((entry) => entry.categoryId !== categoryId || entry.seriesId !== seriesId)
  if (value !== null) values.push({ categoryId, seriesId, value })
  return { ...content, values }
}

/** Changes the visible label of one category row. */
export function setStatisticalGraphCategoryLabel(
  content: StatisticalGraphContent,
  categoryId: string,
  label: string,
): StatisticalGraphContent {
  return {
    ...content,
    categories: content.categories.map((category) => category.id === categoryId ? { ...category, label } : category),
  }
}

/** Changes the visible label of one data series. */
export function setStatisticalGraphSeriesLabel(
  content: StatisticalGraphContent,
  seriesId: string,
  label: string,
): StatisticalGraphContent {
  return {
    ...content,
    series: content.series.map((series) => series.id === seriesId ? { ...series, label } : series),
  }
}

/** Adds one category to the end of the current data rows. */
export function addStatisticalGraphCategory(content: StatisticalGraphContent): StatisticalGraphContent {
  return { ...content, categories: [...content.categories, { id: createGraphId('graph-category'), label: '' }] }
}

/** Removes a category and its values while preserving one editable row. */
export function removeStatisticalGraphCategory(content: StatisticalGraphContent, categoryId: string): StatisticalGraphContent {
  if (content.categories.length <= 1) return content
  const categories = content.categories.filter((category) => category.id !== categoryId)
  return {
    ...content,
    categories,
    values: content.values.filter((entry) => entry.categoryId !== categoryId),
    pieCategoryId: categories.some((category) => category.id === content.pieCategoryId)
      ? content.pieCategoryId
      : categories[0]?.id ?? null,
  }
}

/** Adds one series to the end of the current data columns. */
export function addStatisticalGraphSeries(content: StatisticalGraphContent): StatisticalGraphContent {
  return { ...content, series: [...content.series, { id: createGraphId('graph-series'), label: '' }] }
}

/** Removes a series and its values while preserving one editable column. */
export function removeStatisticalGraphSeries(content: StatisticalGraphContent, seriesId: string): StatisticalGraphContent {
  if (content.series.length <= 1) return content
  const series = content.series.filter((entry) => entry.id !== seriesId)
  return {
    ...content,
    series,
    values: content.values.filter((entry) => entry.seriesId !== seriesId),
    pieSeriesId: content.pieSeriesId === seriesId ? series[0]?.id ?? null : content.pieSeriesId,
  }
}

/** Selects a graph presentation and keeps Pie's required series selection valid. */
export function setStatisticalGraphRendering(
  content: StatisticalGraphContent,
  rendering: StatisticalGraphContent['rendering'],
): StatisticalGraphContent {
  return {
    ...content,
    rendering,
    pieSeriesId: content.pieSeriesId ?? content.series[0]?.id ?? null,
    pieCategoryId: content.categories.some((category) => category.id === content.pieCategoryId)
      ? content.pieCategoryId
      : content.categories[0]?.id ?? null,
  }
}

/** Stores whether graph renderings should swap their category and series dimensions. */
export function setStatisticalGraphTranspose(
  content: StatisticalGraphContent,
  transposeEnabled: boolean,
): StatisticalGraphContent {
  return {
    ...content,
    transposeEnabled,
    pieCategoryId: content.categories.some((category) => category.id === content.pieCategoryId)
      ? content.pieCategoryId
      : content.categories[0]?.id ?? null,
  }
}

/** Selects the one series displayed by a Pie chart. */
export function setStatisticalGraphPieSeries(
  content: StatisticalGraphContent,
  pieSeriesId: string,
): StatisticalGraphContent {
  return content.series.some((series) => series.id === pieSeriesId) ? { ...content, pieSeriesId } : content
}

/** Selects the one category used by a transposed Pie chart. */
export function setStatisticalGraphPieCategory(
  content: StatisticalGraphContent,
  pieCategoryId: string,
): StatisticalGraphContent {
  return content.categories.some((category) => category.id === pieCategoryId) ? { ...content, pieCategoryId } : content
}

/** Replaces one grid cell and extends its data row or column when needed. */
export function setStatisticalGraphGridCell(
  content: StatisticalGraphContent,
  rowIndex: number,
  columnIndex: number,
  rawValue: string,
  headings?: Partial<Pick<StatisticalGraphContent, 'columnLabelsEnabled' | 'rowLabelsEnabled'>>,
): StatisticalGraphContent {
  const next = setStatisticalGraphGridCellValue(content, rowIndex, columnIndex, rawValue)
  return headings === undefined ? next : { ...next, ...headings }
}

/** Maps one visible grid position to its heading or sparse numeric value. */
function setStatisticalGraphGridCellValue(
  content: StatisticalGraphContent,
  rowIndex: number,
  columnIndex: number,
  rawValue: string,
): StatisticalGraphContent {
  if (!Number.isInteger(rowIndex) || rowIndex < 0 || !Number.isInteger(columnIndex) || columnIndex < 0) return content
  const hasColumnLabels = content.columnLabelsEnabled ?? true
  const hasRowLabels = content.rowLabelsEnabled ?? true
  const categoryIndex = rowIndex - Number(hasColumnLabels)
  const seriesIndex = columnIndex - Number(hasRowLabels)
  if (hasColumnLabels && rowIndex === 0) {
    if (hasRowLabels && columnIndex === 0) return content
    return setSeriesLabelAtIndex(content, columnIndex - Number(hasRowLabels), rawValue)
  }
  if (hasRowLabels && columnIndex === 0) {
    return setCategoryLabelAtIndex(content, rowIndex - Number(hasColumnLabels), rawValue)
  }
  if (categoryIndex < 0 || seriesIndex < 0) return content
  if ((categoryIndex >= content.categories.length || seriesIndex >= content.series.length)
    && (rawValue.trim().length === 0 || parseStatisticalGraphNumber(rawValue) === null)) return content

  const expanded = ensureGraphDimensions(content, categoryIndex + 1, seriesIndex + 1)
  const category = expanded.categories[categoryIndex]
  const series = expanded.series[seriesIndex]
  return category === undefined || series === undefined
    ? content
    : setStatisticalGraphCell(expanded, category.id, series.id, rawValue)
}

/** Replaces the grid using enabled labels and the pasted data dimensions. */
export function replaceStatisticalGraphTable(
  content: StatisticalGraphContent,
  clipboardText: string,
): StatisticalGraphContent {
  const rows = parseTabularText(clipboardText)
  const hasColumnLabels = content.columnLabelsEnabled ?? true
  const hasRowLabels = content.rowLabelsEnabled ?? true
  const headerRowOffset = Number(hasColumnLabels)
  const headerColumnOffset = Number(hasRowLabels)
  const height = Math.max(1, rows.length - headerRowOffset)
  const width = Math.max(1, ...rows.map((row) => row.length - headerColumnOffset))
  const categories = Array.from({ length: height }, (_unused, index) => ({
    id: createGraphId('graph-category'),
    label: hasRowLabels ? rows[index + headerRowOffset]?.[0] ?? '' : '',
  }))
  const series = Array.from({ length: width }, (_unused, index) => ({
    id: createGraphId('graph-series'),
    label: hasColumnLabels ? rows[0]?.[index + headerColumnOffset] ?? '' : '',
  }))
  const values = categories.flatMap((category, rowIndex) => series.flatMap((entry, columnIndex) => {
    const value = parseStatisticalGraphNumber(rows[rowIndex + headerRowOffset]?.[columnIndex + headerColumnOffset] ?? '')
    return value === null ? [] : [{ categoryId: category.id, seriesId: entry.id, value }]
  }))
  return {
    ...content,
    categories,
    series,
    values,
    pieSeriesId: series.some((entry) => entry.id === content.pieSeriesId)
      ? content.pieSeriesId
      : series[0]?.id ?? null,
    pieCategoryId: categories.some((entry) => entry.id === content.pieCategoryId)
      ? content.pieCategoryId
      : categories[0]?.id ?? null,
  }
}

/** Validates graph references, dimensions, values, and selected pie series. */
export function assertStatisticalGraphContent(content: StatisticalGraphContent): void {
  if (!Object.values(STATISTICAL_GRAPH_RENDERING).includes(content.rendering)) {
    throw new Error(`Rendu de graphe inconnu : ${String(content.rendering)}`)
  }
  if (content.categories.length < 1 || content.series.length < 1) {
    throw new Error('Un graphe accepte au moins une ligne et une série de données.')
  }
  if ((content.transposeEnabled !== undefined && typeof content.transposeEnabled !== 'boolean')
    || (content.columnLabelsEnabled !== undefined && typeof content.columnLabelsEnabled !== 'boolean')
    || (content.rowLabelsEnabled !== undefined && typeof content.rowLabelsEnabled !== 'boolean')) {
    throw new Error('Les options du graphe doivent être booléennes.')
  }
  assertUniqueIds(content.categories.map((category) => category.id), 'catégorie')
  assertUniqueIds(content.series.map((series) => series.id), 'série')
  const categoryIds = new Set(content.categories.map((category) => category.id))
  const seriesIds = new Set(content.series.map((series) => series.id))
  const valueKeys = new Set<string>()
  for (const entry of content.values) {
    if (!categoryIds.has(entry.categoryId) || !seriesIds.has(entry.seriesId)) {
      throw new Error('Une valeur de graphe référence une ligne ou une série absente.')
    }
    if (!Number.isFinite(entry.value)) throw new Error('Une valeur de graphe doit être un nombre fini.')
    const key = `${entry.categoryId}\u0000${entry.seriesId}`
    if (valueKeys.has(key)) throw new Error('Une cellule ne peut contenir qu’une valeur.')
    valueKeys.add(key)
  }
  if (content.pieSeriesId !== null && !seriesIds.has(content.pieSeriesId)) {
    throw new Error('La série choisie pour les secteurs doit appartenir au graphe.')
  }
  if (content.pieCategoryId != null && !categoryIds.has(content.pieCategoryId)) {
    throw new Error('La catégorie choisie pour les secteurs transposés doit appartenir au graphe.')
  }
  if (content.rendering === STATISTICAL_GRAPH_RENDERING.PIE && content.pieSeriesId === null) {
    throw new Error('Un graphe en secteurs doit choisir une série.')
  }
  if (content.rendering === STATISTICAL_GRAPH_RENDERING.PIE
    && content.transposeEnabled === true
    && content.pieCategoryId == null) {
    throw new Error('Un graphe en secteurs transposé doit choisir une catégorie.')
  }
  for (const text of [content.overline, content.title, content.categoryAxisLabel, content.seriesAxisLabel, content.editorialText]) {
    if (typeof text !== 'string') throw new Error('Les textes du graphe doivent être des chaînes.')
  }
}

/** Converts a simple localized numeric cell to a finite number, or ignores it. */
export function parseStatisticalGraphNumber(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  const normalized = trimmed.replaceAll(' ', '').replace(',', '.')
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(normalized)) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

/** Creates stable-shaped identifiers for graph rows and columns. */
function createGraphId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

/** Sets a series heading by its grid index and creates that series if needed. */
function setSeriesLabelAtIndex(content: StatisticalGraphContent, index: number, label: string): StatisticalGraphContent {
  if (index < 0 || (index >= content.series.length && label.trim().length === 0)) return content
  const expanded = ensureGraphDimensions(content, content.categories.length, index + 1)
  const series = expanded.series[index]
  return series === undefined ? content : setStatisticalGraphSeriesLabel(expanded, series.id, label)
}

/** Sets a category heading by its grid index and creates that category if needed. */
function setCategoryLabelAtIndex(content: StatisticalGraphContent, index: number, label: string): StatisticalGraphContent {
  if (index < 0 || (index >= content.categories.length && label.trim().length === 0)) return content
  const expanded = ensureGraphDimensions(content, index + 1, content.series.length)
  const category = expanded.categories[index]
  return category === undefined ? content : setStatisticalGraphCategoryLabel(expanded, category.id, label)
}

/** Adds only the category and series rows required by an entered grid cell. */
function ensureGraphDimensions(
  content: StatisticalGraphContent,
  categoryCount: number,
  seriesCount: number,
): StatisticalGraphContent {
  const categories = [...content.categories]
  while (categories.length < categoryCount) categories.push({ id: createGraphId('graph-category'), label: '' })
  const series = [...content.series]
  while (series.length < seriesCount) series.push({ id: createGraphId('graph-series'), label: '' })
  if (categories.length === content.categories.length && series.length === content.series.length) return content
  return {
    ...content,
    categories,
    series,
    pieSeriesId: content.pieSeriesId ?? series[0]?.id ?? null,
    pieCategoryId: content.pieCategoryId ?? categories[0]?.id ?? null,
  }
}

/** Extracts a rectangular matrix from tab, semicolon, or comma-delimited text. */
function parseTabularText(text: string): readonly (readonly string[])[] {
  const normalized = text.replaceAll('\r\n', '\n').replaceAll('\r', '\n')
  const delimiter = detectDelimiter(normalized)
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index]!
    if (character === '"') {
      if (quoted && normalized[index + 1] === '"') {
        cell += '"'
        index += 1
      } else {
        quoted = !quoted
      }
      continue
    }
    if (!quoted && character === delimiter) {
      row.push(cell)
      cell = ''
      continue
    }
    if (!quoted && character === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }
    cell += character
  }
  if (cell.length > 0 || row.length > 0 || !normalized.endsWith('\n')) {
    row.push(cell)
    rows.push(row)
  }
  return rows.length === 0 ? [['']] : rows
}

/** Chooses a basic table delimiter from its first physical row. */
function detectDelimiter(text: string): string {
  let quoteOpen = false
  const counts = new Map([['\t', 0], [';', 0], [',', 0]])
  for (const character of text) {
    if (character === '"') quoteOpen = !quoteOpen
    else if (character === '\n') break
    else if (!quoteOpen && counts.has(character)) counts.set(character, counts.get(character)! + 1)
  }
  if ((counts.get('\t') ?? 0) > 0) return '\t'
  const semicolons = counts.get(';') ?? 0
  const commas = counts.get(',') ?? 0
  return semicolons > commas ? ';' : ','
}

/** Rejects duplicate row or column identifiers. */
function assertUniqueIds(ids: readonly string[], kind: string): void {
  if (ids.some((id) => id.trim().length === 0) || new Set(ids).size !== ids.length) {
    throw new Error(`Les identifiants de ${kind} doivent être présents et uniques.`)
  }
}

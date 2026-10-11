import { STATISTICAL_GRAPH_RENDERING } from '../../config/document-config'
import type { StatisticalGraphContent } from './statistical-graph-types'

const MAX_GRAPH_DIMENSION = 40

/** Creates the initial 5-by-3 grid, counting its header row and column. */
export function createDefaultStatisticalGraphContent(): StatisticalGraphContent {
  const categories = Array.from({ length: 4 }, () => ({ id: createGraphId('graph-category'), label: '' }))
  const series = Array.from({ length: 2 }, () => ({ id: createGraphId('graph-series'), label: '' }))
  return {
    rendering: STATISTICAL_GRAPH_RENDERING.BAR,
    overline: '',
    title: '',
    categoryAxisLabel: '',
    seriesAxisLabel: '',
    editorialText: '',
    pieSeriesId: series[0]!.id,
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

/** Adds one category up to the configured 40 data rows. */
export function addStatisticalGraphCategory(content: StatisticalGraphContent): StatisticalGraphContent {
  if (content.categories.length >= MAX_GRAPH_DIMENSION) return content
  return { ...content, categories: [...content.categories, { id: createGraphId('graph-category'), label: '' }] }
}

/** Removes a category and its values while preserving one editable row. */
export function removeStatisticalGraphCategory(content: StatisticalGraphContent, categoryId: string): StatisticalGraphContent {
  if (content.categories.length <= 1) return content
  return {
    ...content,
    categories: content.categories.filter((category) => category.id !== categoryId),
    values: content.values.filter((entry) => entry.categoryId !== categoryId),
  }
}

/** Adds one series up to the configured 40 data columns. */
export function addStatisticalGraphSeries(content: StatisticalGraphContent): StatisticalGraphContent {
  if (content.series.length >= MAX_GRAPH_DIMENSION) return content
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
  }
}

/** Selects the one series displayed by a Pie chart. */
export function setStatisticalGraphPieSeries(
  content: StatisticalGraphContent,
  pieSeriesId: string,
): StatisticalGraphContent {
  return content.series.some((series) => series.id === pieSeriesId) ? { ...content, pieSeriesId } : content
}

/** Replaces the grid using only the pasted dimensions and basic delimited text. */
export function replaceStatisticalGraphTable(
  content: StatisticalGraphContent,
  clipboardText: string,
): StatisticalGraphContent {
  const rows = parseTabularText(clipboardText)
  const width = Math.max(2, ...rows.map((row) => row.length))
  const height = Math.max(2, rows.length)
  if (width > MAX_GRAPH_DIMENSION + 1 || height > MAX_GRAPH_DIMENSION + 1) {
    throw new Error(`Le tableau dépasse la limite de ${MAX_GRAPH_DIMENSION + 1} lignes ou colonnes, en-têtes compris.`)
  }
  const matrix = Array.from({ length: height }, (_, rowIndex) => Array.from(
    { length: width },
    (_unused, columnIndex) => rows[rowIndex]?.[columnIndex] ?? '',
  ))
  const categories = matrix.slice(1).map((row) => ({ id: createGraphId('graph-category'), label: row[0] ?? '' }))
  const series = matrix[0]!.slice(1).map((label) => ({ id: createGraphId('graph-series'), label }))
  const values = categories.flatMap((category, rowIndex) => series.flatMap((entry, columnIndex) => {
    const value = parseStatisticalGraphNumber(matrix[rowIndex + 1]?.[columnIndex + 1] ?? '')
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
  }
}

/** Validates graph references, dimensions, values, and selected pie series. */
export function assertStatisticalGraphContent(content: StatisticalGraphContent): void {
  if (!Object.values(STATISTICAL_GRAPH_RENDERING).includes(content.rendering)) {
    throw new Error(`Rendu de graphe inconnu : ${String(content.rendering)}`)
  }
  if (content.categories.length < 1 || content.categories.length > MAX_GRAPH_DIMENSION
    || content.series.length < 1 || content.series.length > MAX_GRAPH_DIMENSION) {
    throw new Error(`Un graphe accepte de 1 à ${MAX_GRAPH_DIMENSION} lignes et séries de données.`)
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
  if (content.rendering === STATISTICAL_GRAPH_RENDERING.PIE && content.pieSeriesId === null) {
    throw new Error('Un graphe en secteurs doit choisir une série.')
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

import { BDC_TYPE, STATISTICAL_GRAPH_RENDERING } from '../../config/document-config'
import type { Bdc } from '../../domain/document/document-types'
import type { StatisticalGraphContent } from '../../domain/statistical-graph/statistical-graph-types'

export interface StatisticalGraphSceneBuild {
  readonly markup: string
  readonly rootClassName: string
  readonly contentPersos: readonly []
  readonly mediaPersos: readonly []
}

const graphColors = ['#326c64', '#c27b3a', '#5376a2', '#a64f4f', '#7a6599', '#7f8f45', '#4c8491', '#bd6688']

/** Projects one Statistical Graph BDC into accessible markup for the existing page and Carousel builders. */
export class ElceStatisticalGraphSceneBuilder {
  /** Builds the selected SVG chart or visible HTML table and its semantic data table. */
  public build(bdc: Bdc, rootId = `elce-${bdc.id}-graph`, partId?: string): StatisticalGraphSceneBuild {
    if (bdc.type !== BDC_TYPE.STATISTICAL_GRAPH || bdc.statisticalGraph == null) {
      throw new Error(`Le BDC ${bdc.id} n’est pas un Graphe statistique complet.`)
    }
    return this.buildContent(bdc.statisticalGraph, bdc.presetId, rootId, partId)
  }

  /** Builds preview markup from graph content without requiring a document BDC wrapper. */
  public buildContent(
    content: StatisticalGraphContent,
    layoutId: string,
    rootId: string,
    partId?: string,
  ): StatisticalGraphSceneBuild {
    const titleId = `${rootId}-svg-title`
    const renderingContent = transposeStatisticalGraphContent(content)
    const title = content.title.trim() || 'Graphe statistique'
    const visibleTitle = content.title.trim().length > 0
      ? `<h2 id="${rootId}-heading" class="elce-statistical-graph__title">${escapeHtml(content.title)}</h2>`
      : `<h2 id="${rootId}-heading" class="elce-statistical-graph__title elce-statistical-graph__visually-hidden">${escapeHtml(title)}</h2>`
    const overline = content.overline.trim().length === 0
      ? ''
      : `<p id="${rootId}-overline" class="elce-statistical-graph__overline">${escapeHtml(content.overline)}</p>`
    const chart = renderingContent.rendering === STATISTICAL_GRAPH_RENDERING.TABLE
      ? renderVisibleTable(renderingContent, rootId)
      : `${renderSvgChart(renderingContent, rootId, titleId)}${renderAccessibleTable(renderingContent, rootId)}`
    const layoutClass = layoutId === 'statistical-graph-side-by-side'
      ? 'elce-statistical-graph--side-by-side'
      : 'elce-statistical-graph--above-text'
    const textPanel = content.editorialText.trim().length === 0
      ? ''
      : `<div id="${rootId}-editorial" class="elce-statistical-graph__editorial">${renderParagraphs(content.editorialText, `${rootId}-editorial`)}</div>`
    const rootPart = partId === undefined ? '' : `<!-- data-part="${escapeHtml(partId)}:root" -->`
    const markup = `<figure id="${rootId}" class="elce-statistical-graph ${layoutClass} elce-statistical-graph--${content.rendering}">${rootPart}${overline}${visibleTitle}<div id="${rootId}-body" class="elce-statistical-graph__body"><div id="${rootId}-visual" class="elce-statistical-graph__visual">${chart}</div>${textPanel}</div></figure>`
    return { markup, rootClassName: 'elce-statistical-graph', contentPersos: [], mediaPersos: [] }
  }
}

/** Creates a render-only graph projection with categories and series swapped. */
function transposeStatisticalGraphContent(content: StatisticalGraphContent): StatisticalGraphContent {
  if (content.transposeEnabled === false) return content
  return {
    ...content,
    categoryAxisLabel: content.seriesAxisLabel,
    seriesAxisLabel: content.categoryAxisLabel,
    pieSeriesId: content.pieCategoryId ?? content.categories[0]?.id ?? null,
    pieCategoryId: content.pieSeriesId,
    categories: content.series.map((series) => ({ id: series.id, label: series.label })),
    series: content.categories.map((category) => ({ id: category.id, label: category.label })),
    values: content.values.map((entry) => ({
      categoryId: entry.seriesId,
      seriesId: entry.categoryId,
      value: entry.value,
    })),
  }
}

/** Renders an SVG chart with density-limited axis labels and compact series cues. */
function renderSvgChart(content: StatisticalGraphContent, rootId: string, titleId: string): string {
  const descriptionId = `${rootId}-description`
  const title = content.title.trim() || 'Graphe statistique'
  const transpositionDescription = content.transposeEnabled !== false
    ? ' Les catégories et les séries sont transposées.'
    : ''
  const axisLabel = content.categoryAxisLabel.trim().length === 0
    ? ''
    : `<text id="${rootId}-category-axis-label" class="elce-statistical-graph__axis-label" x="500" y="486" text-anchor="middle">${escapeHtml(content.categoryAxisLabel)}</text>`
  const seriesLabel = content.seriesAxisLabel.trim().length === 0
    ? ''
    : `<text id="${rootId}-series-axis-label" class="elce-statistical-graph__axis-label" x="20" y="235" text-anchor="middle" transform="rotate(-90 20 235)">${escapeHtml(content.seriesAxisLabel)}</text>`
  const graphic = content.rendering === STATISTICAL_GRAPH_RENDERING.PIE
    ? renderPie(content, rootId)
    : renderCartesian(content, rootId)
  const legend = renderLegend(content, rootId)
  return `<div id="${rootId}-chart-frame" class="elce-statistical-graph__chart-frame"><svg id="${rootId}-svg" class="elce-statistical-graph__svg" viewBox="0 0 1000 500" role="img" aria-labelledby="${titleId} ${descriptionId}" preserveAspectRatio="xMidYMid meet"><title id="${titleId}">${escapeHtml(title)}</title><desc id="${descriptionId}">${renderingDescription(content.rendering)}.${transpositionDescription} Le tableau détaillé des données suit le graphique.</desc>${graphic}${content.rendering === STATISTICAL_GRAPH_RENDERING.PIE ? '' : axisLabel}${content.rendering === STATISTICAL_GRAPH_RENDERING.PIE ? '' : seriesLabel}</svg>${legend}</div>`
}

/** Draws grouped bars or lines from the same sparse values used by the data table. */
function renderCartesian(content: StatisticalGraphContent, rootId: string): string {
  const allValues = content.values.map((entry) => entry.value)
  const scale = Math.max(1, ...allValues.map((value) => Math.abs(value)))
  const minimum = Math.min(0, ...allValues.map((value) => value / scale))
  const maximum = Math.max(0, ...allValues.map((value) => value / scale))
  const range = maximum - minimum || 1
  const left = 82
  const top = 28
  const width = 880
  const height = 400
  const zeroY = top + (maximum / range) * height
  const grid = Array.from({ length: 5 }, (_, index) => {
    const y = top + (height * index) / 4
    return `<line id="${rootId}-grid-${index}" class="elce-statistical-graph__grid-line" x1="${left}" y1="${round(y)}" x2="${left + width}" y2="${round(y)}" />`
  }).join('')
  const baseline = `<line id="${rootId}-baseline" class="elce-statistical-graph__baseline" x1="${left}" y1="${round(zeroY)}" x2="${left + width}" y2="${round(zeroY)}" />`
  const plotted = content.rendering === STATISTICAL_GRAPH_RENDERING.LINE
    ? renderLines(content, rootId, left, top, width, height, maximum, range, scale)
    : renderBars(content, rootId, left, top, width, height, maximum, range, scale)
  const density = labelDensity(content.categories.length)
  const labels = content.categories.flatMap((category, index) => {
    if (index % density !== 0 && index !== content.categories.length - 1) return []
    const x = left + (width * (index + 0.5)) / content.categories.length
    const y = top + height + 24
    return [`<text id="${rootId}-category-label-${index}" class="elce-statistical-graph__tick-label" x="${round(x)}" y="${round(y)}" text-anchor="middle">${escapeHtml(category.label)}</text>`]
  }).join('')
  return `<g id="${rootId}-cartesian-plot" class="elce-statistical-graph__plot">${grid}${baseline}${plotted}${labels}</g>`
}

/** Renders one colored group of bars per category, including negative values. */
function renderBars(
  content: StatisticalGraphContent,
  rootId: string,
  left: number,
  top: number,
  width: number,
  height: number,
  maximum: number,
  range: number,
  scale: number,
): string {
  const categoryWidth = width / content.categories.length
  const availableWidth = categoryWidth * 0.8
  const barWidth = Math.min(18, availableWidth / content.series.length)
  return content.values.flatMap((entry) => {
    const categoryIndex = content.categories.findIndex((category) => category.id === entry.categoryId)
    const seriesIndex = content.series.findIndex((series) => series.id === entry.seriesId)
    if (categoryIndex < 0 || seriesIndex < 0) return []
    const baseline = top + (maximum / range) * height
    const valueY = top + ((maximum - entry.value / scale) / range) * height
    const x = left + categoryWidth * categoryIndex + (categoryWidth - barWidth * content.series.length) / 2 + barWidth * seriesIndex
    const y = Math.min(baseline, valueY)
    const barHeight = Math.max(1, Math.abs(valueY - baseline))
    return [`<rect id="${rootId}-bar-${categoryIndex}-${seriesIndex}" class="elce-statistical-graph__bar" x="${round(x)}" y="${round(y)}" width="${round(barWidth * 0.88)}" height="${round(barHeight)}" fill="${graphColor(seriesIndex)}" />`]
  }).join('')
}

/** Renders connected data points for each series, leaving gaps for missing values. */
function renderLines(
  content: StatisticalGraphContent,
  rootId: string,
  left: number,
  top: number,
  width: number,
  height: number,
  maximum: number,
  range: number,
  scale: number,
): string {
  return content.series.map((series, seriesIndex) => {
    const points = content.categories.map((category, categoryIndex) => {
      const value = content.values.find((entry) => entry.categoryId === category.id && entry.seriesId === series.id)
      if (value === undefined) return null
      const x = left + (width * (categoryIndex + 0.5)) / content.categories.length
      const y = top + ((maximum - value.value / scale) / range) * height
      return { x: round(x), y: round(y), categoryIndex }
    })
    const segments: NonNullable<typeof points[number]>[][] = []
    let segment: NonNullable<typeof points[number]>[] = []
    for (const point of points) {
      if (point === null) {
        if (segment.length > 0) segments.push(segment)
        segment = []
      } else {
        segment.push(point)
      }
    }
    if (segment.length > 0) segments.push(segment)
    const path = segments
      .filter((pointsInSegment) => pointsInSegment.length > 1)
      .map((pointsInSegment) => pointsInSegment.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' '))
      .join(' ')
    const line = path.length === 0
      ? ''
      : `<path id="${rootId}-line-${seriesIndex}" class="elce-statistical-graph__line" d="${path}" stroke="${graphColor(seriesIndex)}" />`
    const markers = points.flatMap((point) => point === null ? [] : [
      `<circle id="${rootId}-point-${seriesIndex}-${point.categoryIndex}" class="elce-statistical-graph__point" cx="${point.x}" cy="${point.y}" r="3" fill="${graphColor(seriesIndex)}" />`,
    ]).join('')
    return `${line}${markers}`
  }).join('')
}

/** Renders the selected positive pie series as SVG sectors with proportional angles. */
function renderPie(content: StatisticalGraphContent, rootId: string): string {
  const values = content.categories.map((category) => ({
    category,
    value: content.values.find((entry) => entry.categoryId === category.id && entry.seriesId === content.pieSeriesId)?.value ?? 0,
  })).filter((entry) => entry.value > 0)
  const largest = Math.max(0, ...values.map((entry) => entry.value))
  const total = values.reduce((sum, entry) => sum + entry.value / largest, 0)
  if (total <= 0) return `<text id="${rootId}-pie-empty" class="elce-statistical-graph__empty" x="500" y="252" text-anchor="middle">Aucune valeur positive</text>`
  let angle = -Math.PI / 2
  return values.map((entry, index) => {
    const nextAngle = angle + ((entry.value / largest) / total) * Math.PI * 2
    const path = pieSectorPath(500, 245, 185, angle, nextAngle)
    const sector = `<path id="${rootId}-sector-${index}" class="elce-statistical-graph__sector" d="${path}" fill="${graphColor(content.categories.findIndex((category) => category.id === entry.category.id))}" />`
    angle = nextAngle
    return sector
  }).join('')
}

/** Creates one SVG sector path, including the special one-sector circle case. */
function pieSectorPath(centerX: number, centerY: number, radius: number, start: number, end: number): string {
  const startX = centerX + radius * Math.cos(start)
  const startY = centerY + radius * Math.sin(start)
  const endX = centerX + radius * Math.cos(end)
  const endY = centerY + radius * Math.sin(end)
  if (end - start >= Math.PI * 2 - 0.0001) return `M ${centerX} ${centerY - radius} A ${radius} ${radius} 0 1 1 ${centerX} ${centerY + radius} A ${radius} ${radius} 0 1 1 ${centerX} ${centerY - radius} Z`
  const largeArc = end - start > Math.PI ? 1 : 0
  return `M ${centerX} ${centerY} L ${round(startX)} ${round(startY)} A ${radius} ${radius} 0 ${largeArc} 1 ${round(endX)} ${round(endY)} Z`
}

/** Renders concise, density-limited series or category color keys. */
function renderLegend(content: StatisticalGraphContent, rootId: string): string {
  const isPie = content.rendering === STATISTICAL_GRAPH_RENDERING.PIE
  const legendLabel = isPie
    ? content.transposeEnabled !== false ? 'Séries' : 'Catégories'
    : content.transposeEnabled !== false ? 'Catégories' : 'Séries'
  const entries = isPie
    ? content.categories.map((category, index) => ({ id: category.id, label: category.label, colorIndex: index }))
      .filter((entry) => (content.values.find((value) => value.categoryId === entry.id && value.seriesId === content.pieSeriesId)?.value ?? 0) > 0)
    : content.series.map((series, index) => ({ id: series.id, label: series.label, colorIndex: index }))
  const namedEntries = entries.filter((entry) => entry.label.trim().length > 0)
  if (namedEntries.length === 0) return ''
  const density = labelDensity(namedEntries.length)
  const selectedEntries = namedEntries.filter((_entry, index) => index % density === 0 || index === namedEntries.length - 1)
  return `<ul id="${rootId}-legend" class="elce-statistical-graph__legend" aria-label="${legendLabel}">${selectedEntries.map((entry) => `<li id="${rootId}-legend-${entry.id}" class="elce-statistical-graph__legend-item"><span id="${rootId}-legend-mark-${entry.id}" class="elce-statistical-graph__legend-mark" style="background-color:${graphColor(entry.colorIndex)}"></span><span id="${rootId}-legend-label-${entry.id}" class="elce-statistical-graph__legend-label">${escapeHtml(entry.label)}</span></li>`).join('')}</ul>`
}

/** Renders only populated category rows in the visible Table representation. */
function renderVisibleTable(content: StatisticalGraphContent, rootId: string): string {
  const populatedCategoryIds = new Set(content.values.map((entry) => entry.categoryId))
  const visibleContent = {
    ...content,
    categories: content.categories.filter((category) => populatedCategoryIds.has(category.id)),
  }
  return `${renderAxisCaptions(content, rootId)}${renderTable(visibleContent, rootId, 'elce-statistical-graph__table')}`
}

/** Renders the required semantic alternative after an SVG chart. */
function renderAccessibleTable(content: StatisticalGraphContent, rootId: string): string {
  return renderTable(content, `${rootId}-accessible`, 'elce-statistical-graph__table elce-statistical-graph__table--visually-hidden')
}

/** Creates a correctly scoped data table from the normalized graph matrix. */
function renderTable(content: StatisticalGraphContent, rootId: string, className: string): string {
  const title = content.title.trim() || 'Graphe statistique'
  const isVisible = !className.includes('--visually-hidden')
  const denseClass = !isVisible || Math.max(content.series.length, content.categories.length) < 12
    ? ''
    : ' elce-statistical-graph__table--dense'
  const header = `<tr id="${rootId}-head-row"><th id="${rootId}-corner" class="elce-statistical-graph__row-heading" scope="col" title="${escapeHtml(content.categoryAxisLabel)}">${escapeHtml(content.categoryAxisLabel)}</th>${content.series.map((series, index) => `<th id="${rootId}-series-${index}" scope="col" title="${escapeHtml(series.label)}">${escapeHtml(series.label)}</th>`).join('')}</tr>`
  const body = content.categories.map((category, categoryIndex) => {
    const rowHeading = `<th id="${rootId}-category-${categoryIndex}" class="elce-statistical-graph__row-heading" scope="row" title="${escapeHtml(category.label)}">${escapeHtml(category.label)}</th>`
    const cells = content.series.map((series, seriesIndex) => {
      const value = content.values.find((entry) => entry.categoryId === category.id && entry.seriesId === series.id)
      const formattedValue = value === undefined ? '' : formatValue(value.value)
      return `<td id="${rootId}-cell-${categoryIndex}-${seriesIndex}" title="${escapeHtml(formattedValue)}">${formattedValue}</td>`
    }).join('')
    return `<tr id="${rootId}-category-row-${categoryIndex}">${rowHeading}${cells}</tr>`
  }).join('')
  return `<table id="${rootId}-table" class="${className}${denseClass}"${renderTableFitStyle(content, isVisible)}><caption id="${rootId}-caption" class="elce-statistical-graph__table-caption">${escapeHtml(title)}</caption><thead id="${rootId}-thead">${header}</thead><tbody id="${rootId}-tbody">${body}</tbody></table>`
}

/** Sets one shared font size using the most constrained visible table cells. */
function renderTableFitStyle(content: StatisticalGraphContent, isVisible: boolean): string {
  if (!isVisible) return ''

  const maxValueLength = Math.max(1, ...content.values.map((value) => formatValue(value.value).length))
  const maxRowHeadingLength = Math.max(1, content.categoryAxisLabel.length, ...content.categories.map((category) => category.label.length))
  const maxSeriesHeadingLength = Math.max(1, ...content.series.map((series) => series.label.length))
  return ` style="--statistical-graph-series-count:${content.series.length};--statistical-graph-category-count:${content.categories.length};--statistical-graph-max-value-length:${maxValueLength};--statistical-graph-max-row-heading-length:${maxRowHeadingLength};--statistical-graph-max-series-heading-length:${maxSeriesHeadingLength}"`
}

/** Keeps separate axis labels visible when the HTML table is selected. */
function renderAxisCaptions(content: StatisticalGraphContent, rootId: string): string {
  const category = content.categoryAxisLabel.trim().length === 0
    ? ''
    : `<p id="${rootId}-table-category-axis" class="elce-statistical-graph__table-axis">${escapeHtml(content.categoryAxisLabel)}</p>`
  const series = content.seriesAxisLabel.trim().length === 0
    ? ''
    : `<p id="${rootId}-table-series-axis" class="elce-statistical-graph__table-axis">${escapeHtml(content.seriesAxisLabel)}</p>`
  return `<div id="${rootId}-table-axis-captions" class="elce-statistical-graph__table-axis-captions">${category}${series}</div>`
}

/** Keeps the editorial text as separate paragraphs without interpreting markup. */
function renderParagraphs(text: string, idPrefix: string): string {
  return text.split(/\n\s*\n/).map((paragraph, index) => `<p id="${idPrefix}-paragraph-${index}">${escapeHtml(paragraph).replaceAll('\n', '<br>')}</p>`).join('')
}

/** Chooses the category or legend label interval for dense charts. */
function labelDensity(count: number): number {
  if (count > 20) return 10
  if (count > 10) return 5
  return 1
}

/** Returns the SVG chart description announced to assistive technology. */
function renderingDescription(rendering: StatisticalGraphContent['rendering']): string {
  switch (rendering) {
    case STATISTICAL_GRAPH_RENDERING.BAR:
      return 'Diagramme en barres'
    case STATISTICAL_GRAPH_RENDERING.LINE:
      return 'Graphe en courbes'
    case STATISTICAL_GRAPH_RENDERING.PIE:
      return 'Graphe en secteurs'
    case STATISTICAL_GRAPH_RENDERING.TABLE:
      return 'Tableau de données'
  }
}

/** Returns a stable palette color for an indexed graph series or category. */
function graphColor(index: number): string {
  return graphColors[index % graphColors.length]!
}

/** Formats numeric cells with the browser's French locale convention. */
function formatValue(value: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 6 }).format(value)
}

/** Rounds SVG coordinates to a compact finite decimal representation. */
function round(value: number): string {
  return Number.isFinite(value) ? String(Math.round(value * 100) / 100) : '0'
}

/** Escapes text before inserting it into static graph markup. */
function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

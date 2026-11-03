import { STATISTICAL_GRAPH_BDC_TYPE } from '../statistical-graph-config'
import { STATISTICAL_GRAPH_RENDERING } from '../statistical-graph-config'
import type { ResourceBdc } from '../../../document/resource-document-types'
import type { StatisticalGraphContent } from '../domain/statistical-graph-types'
import type { PersoDoc } from 'codplay/scene/types'
import { VIEWPORT_EXPANSION_CONTENT_ATTR } from '../../../viewport-expansion/viewport-expansion-builder'
import { sceneClassRule, sceneStyleClassName } from '../../../../builders/scene-style/scene-style-classes'
import type { ElceTextValue } from '../../../document/rich-text-types'
import { authoredTextToPlainText } from '../../../../core/document/rich-text-utils'
import { wrapResourceInlineTextSceneParts, type ResourceInlineTextSceneFeature } from '../../../document/resource-inline-text-feature'

export interface StatisticalGraphSceneBuild {
  readonly markup: string
  readonly rootClassName: string
  readonly contentPersos: readonly PersoDoc<string>[]
  readonly mediaPersos: readonly PersoDoc<string>[]
  readonly styleSheet: string
}

interface GraphInlineMarkup {
  readonly markup: string
  readonly persos: readonly PersoDoc<string>[]
}

type PlainGraphCategory = Omit<StatisticalGraphContent['categories'][number], 'label'> & { readonly label: string }
type PlainGraphSeries = Omit<StatisticalGraphContent['series'][number], 'label'> & { readonly label: string }
type PlainGraphContent = Omit<StatisticalGraphContent,
  'overline' | 'title' | 'categoryAxisLabel' | 'seriesAxisLabel' | 'editorialText' | 'categories' | 'series'
> & {
  readonly overline: string
  readonly title: string
  readonly categoryAxisLabel: string
  readonly seriesAxisLabel: string
  readonly editorialText: string
  readonly categories: readonly PlainGraphCategory[]
  readonly series: readonly PlainGraphSeries[]
}

const graphColors = ['#326c64', '#c27b3a', '#5376a2', '#a64f4f', '#7a6599', '#7f8f45', '#4c8491', '#bd6688']

/** Projects one Statistical Graph BDC into accessible markup for the existing page and Carousel builders. */
export class ElceStatisticalGraphSceneBuilder {
  /** Builds the selected SVG chart or visible HTML table and its semantic data table. */
  public build(
    bdc: ResourceBdc,
    rootId = `elce-${bdc.id}-graph`,
    partId?: string,
    appearanceClassName?: string,
    inlineTextSceneFeature?: ResourceInlineTextSceneFeature,
  ): StatisticalGraphSceneBuild {
    if (bdc.type !== STATISTICAL_GRAPH_BDC_TYPE || bdc.statisticalGraph == null) {
      throw new Error(`Le BDC ${bdc.id} n’est pas un Graphe complet.`)
    }
    return this.buildContent(bdc.statisticalGraph, bdc.presetId, rootId, partId, appearanceClassName, true, inlineTextSceneFeature)
  }

  /** Builds preview markup from graph content without requiring a document BDC wrapper. */
  public buildContent(
    content: StatisticalGraphContent,
    layoutId: string,
    rootId: string,
    partId?: string,
    appearanceClassName?: string,
    interactiveLabels = true,
    inlineTextSceneFeature?: ResourceInlineTextSceneFeature,
  ): StatisticalGraphSceneBuild {
    const titleId = `${rootId}-svg-title`
    const tableFitRules: string[] = []
    const plainContent = flattenGraphText(content)
    const renderingContent = transposeStatisticalGraphContent(plainContent)
    const renderingRichContent = transposeStatisticalGraphContent(content)
    const title = plainContent.title.trim() || 'Graphe'
    const hasTitle = plainContent.title.trim().length > 0
    const hasOverline = plainContent.overline.trim().length > 0
    const hasEditorial = plainContent.editorialText.trim().length > 0
    const contentPersos: PersoDoc<string>[] = []
    const titleMarkup = hasTitle
      ? graphInlineMarkup(content.title, `${rootId}-heading-content`, 'h2', 'elce-statistical-graph__title', interactiveLabels, inlineTextSceneFeature)
      : null
    const overlineMarkup = hasOverline
      ? graphInlineMarkup(content.overline, `${rootId}-overline-content`, 'p', 'elce-statistical-graph__overline', interactiveLabels, inlineTextSceneFeature)
      : null
    const editorialMarkup = hasEditorial
      ? graphEditorialMarkup(content.editorialText, `${rootId}-editorial`, interactiveLabels, inlineTextSceneFeature)
      : null
    contentPersos.push(...(titleMarkup?.persos ?? []), ...(overlineMarkup?.persos ?? []), ...(editorialMarkup?.persos ?? []))
    const visibleTitle = titleMarkup !== null
      ? titleMarkup.markup.replace(`${rootId}-heading-content`, `${rootId}-heading`)
      : ''
    const overline = overlineMarkup?.markup.replace(`${rootId}-overline-content`, `${rootId}-overline`) ?? ''
    const chartProjection = renderingContent.rendering === STATISTICAL_GRAPH_RENDERING.TABLE
      ? renderVisibleTable(renderingContent, renderingRichContent, rootId, tableFitRules, contentPersos, interactiveLabels, inlineTextSceneFeature)
      : renderSvgChart(renderingContent, renderingRichContent, rootId, titleId, contentPersos, interactiveLabels, inlineTextSceneFeature)
    const chart = renderingContent.rendering === STATISTICAL_GRAPH_RENDERING.TABLE
      ? chartProjection
      : `${chartProjection}${renderAccessibleTable(renderingContent, rootId, tableFitRules)}`
    const layoutClass = layoutId === 'statistical-graph-side-by-side'
      ? 'elce-statistical-graph--side-by-side'
      : 'elce-statistical-graph--above-text'
    const textPanel = editorialMarkup?.markup ?? ''
    const rootPart = partId === undefined ? '' : `<!-- data-part="${escapeHtml(partId)}:root" -->`
    const visualPartId = partId === undefined ? undefined : `${partId}:visual`
    const visualMarkup = visualPartId === undefined
      ? chart
      : `<!-- data-part="${escapeHtml(visualPartId)}" -->`
    const visualClassName = `elce-statistical-graph__visual${content.rendering === STATISTICAL_GRAPH_RENDERING.TABLE ? ' elce-statistical-graph__visual--table' : ''}`
    const appearanceClass = ` ${appearanceClassName ?? 'graph bdc'}`
    const markup = `<figure id="${rootId}" class="elce-statistical-graph ${layoutClass} elce-statistical-graph--${content.rendering}${appearanceClass}">${rootPart}${overline}${visibleTitle}<div id="${rootId}-body" class="elce-statistical-graph__body"><div id="${rootId}-visual" class="${visualClassName}">${visualMarkup}</div>${textPanel}</div></figure>`
    const mediaPersos = visualPartId === undefined
      ? []
      : [createViewportGraphPerso(rootId, visualPartId, chart, content.rendering)]
    return {
      markup,
      rootClassName: `elce-statistical-graph${appearanceClass}`,
      contentPersos,
      mediaPersos,
      styleSheet: [
        ...(renderingContent.rendering === STATISTICAL_GRAPH_RENDERING.TABLE ? [] : [graphColorStyleSheet()]),
        ...tableFitRules,
      ].join('\n'),
    }
  }
}

/** Creates the moveable visual while the graph title and commentary stay in their source layout. */
function createViewportGraphPerso(
  rootId: string,
  targetPartId: string,
  chart: string,
  rendering: StatisticalGraphContent['rendering'],
): PersoDoc<string> {
  const className = `elce-statistical-graph__visual-content${rendering === STATISTICAL_GRAPH_RENDERING.TABLE ? ' elce-statistical-graph__visual-content--table' : ''}`
  return {
    id: `${rootId}-viewport-visual`,
    type: 'layout',
    initial: {
      move: { target: targetPartId },
      className,
      attr: {
        [VIEWPORT_EXPANSION_CONTENT_ATTR]: 'graph',
        role: 'group',
        tabindex: '0',
      },
      markup: `<div id="${rootId}-visual-content" class="${className}" ${VIEWPORT_EXPANSION_CONTENT_ATTR}="graph" role="group" tabindex="0">${chart}</div>`,
    },
  }
}

/** Creates a render-only graph projection with categories and series swapped. */
function transposeStatisticalGraphContent<T extends StatisticalGraphContent | PlainGraphContent>(content: T): T {
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
  } as T
}

/** Resolves rich graph labels to plain reader text for the chart's SVG and table. */
function flattenGraphText(content: StatisticalGraphContent): PlainGraphContent {
  return {
    ...content,
    overline: authoredTextToPlainText(content.overline),
    title: authoredTextToPlainText(content.title),
    categoryAxisLabel: authoredTextToPlainText(content.categoryAxisLabel),
    seriesAxisLabel: authoredTextToPlainText(content.seriesAxisLabel),
    editorialText: authoredTextToPlainText(content.editorialText),
    categories: content.categories.map((category) => ({ ...category, label: authoredTextToPlainText(category.label) })),
    series: content.series.map((series) => ({ ...series, label: authoredTextToPlainText(series.label) })),
  }
}

/** Renders an SVG chart with density-limited axis labels and compact series cues. */
function renderSvgChart(
  content: PlainGraphContent,
  richContent: StatisticalGraphContent,
  rootId: string,
  titleId: string,
  persos: PersoDoc<string>[],
  interactiveLabels: boolean,
  inlineTextSceneFeature: ResourceInlineTextSceneFeature | undefined,
): string {
  const descriptionId = `${rootId}-description`
  const title = content.title.trim() || 'Graphe'
  const transpositionDescription = content.transposeEnabled !== false
    ? ' Les catégories et les séries sont transposées.'
    : ''
  const axisLabel = content.categoryAxisLabel.trim().length === 0
    ? ''
    : `<text id="${rootId}-category-axis-label" class="elce-statistical-graph__axis-label${!interactiveLabels || typeof richContent.categoryAxisLabel === 'string' ? '' : ' elce-statistical-graph__axis-label--rich'}" x="500" y="486" text-anchor="middle">${escapeHtml(content.categoryAxisLabel)}</text>`
  const seriesLabel = content.seriesAxisLabel.trim().length === 0
    ? ''
    : `<text id="${rootId}-series-axis-label" class="elce-statistical-graph__axis-label${!interactiveLabels || typeof richContent.seriesAxisLabel === 'string' ? '' : ' elce-statistical-graph__axis-label--rich'}" x="20" y="235" text-anchor="middle" transform="rotate(-90 20 235)">${escapeHtml(content.seriesAxisLabel)}</text>`
  const graphic = content.rendering === STATISTICAL_GRAPH_RENDERING.PIE
    ? renderPie(content, rootId)
    : renderCartesian(content, richContent, rootId, interactiveLabels)
  const legend = renderLegend(content, richContent, rootId, persos, interactiveLabels, inlineTextSceneFeature)
  const overlay = renderSvgInlineLabelOverlay(content, richContent, rootId, persos, interactiveLabels, inlineTextSceneFeature)
  return `<div id="${rootId}-chart-frame" class="elce-statistical-graph__chart-frame"><div id="${rootId}-chart-shell" class="elce-statistical-graph__chart-shell"><svg id="${rootId}-svg" class="elce-statistical-graph__svg" viewBox="0 0 1000 500" role="img" aria-labelledby="${titleId} ${descriptionId}" preserveAspectRatio="xMidYMid meet"><title id="${titleId}">${escapeHtml(title)}</title><desc id="${descriptionId}">${renderingDescription(content.rendering)}.${transpositionDescription} Le tableau détaillé des données suit le graphique.</desc>${graphic}${content.rendering === STATISTICAL_GRAPH_RENDERING.PIE ? '' : axisLabel}${content.rendering === STATISTICAL_GRAPH_RENDERING.PIE ? '' : seriesLabel}</svg>${overlay}</div>${legend}</div>`
}

/** Draws grouped bars or lines from the same sparse values used by the data table. */
function renderCartesian(content: PlainGraphContent, richContent: StatisticalGraphContent, rootId: string, interactiveLabels: boolean): string {
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
    if (category.label.trim().length === 0) return []
    const x = left + (width * (index + 0.5)) / content.categories.length
    const y = top + height + 24
    const richCategory = richContent.categories.find((candidate) => candidate.id === category.id)
    const richClassName = !interactiveLabels || richCategory === undefined || typeof richCategory.label === 'string' ? '' : ' elce-statistical-graph__tick-label--rich'
    return [`<text id="${rootId}-category-label-${index}" class="elce-statistical-graph__tick-label${richClassName}" x="${round(x)}" y="${round(y)}" text-anchor="middle">${escapeHtml(category.label)}</text>`]
  }).join('')
  return `<g id="${rootId}-cartesian-plot" class="elce-statistical-graph__plot">${grid}${baseline}${plotted}${labels}</g>`
}

/** Renders one colored group of bars per category, including negative values. */
function renderBars(
  content: PlainGraphContent,
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
    return [`<rect id="${rootId}-bar-${categoryIndex}-${seriesIndex}" class="elce-statistical-graph__bar ${graphColorClassName(seriesIndex)}" x="${round(x)}" y="${round(y)}" width="${round(barWidth * 0.88)}" height="${round(barHeight)}" />`]
  }).join('')
}

/** Renders connected data points for each series, leaving gaps for missing values. */
function renderLines(
  content: PlainGraphContent,
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
      : `<path id="${rootId}-line-${seriesIndex}" class="elce-statistical-graph__line ${graphColorClassName(seriesIndex)}" d="${path}" />`
    const markers = points.flatMap((point) => point === null ? [] : [
      `<circle id="${rootId}-point-${seriesIndex}-${point.categoryIndex}" class="elce-statistical-graph__point ${graphColorClassName(seriesIndex)}" cx="${point.x}" cy="${point.y}" r="3" />`,
    ]).join('')
    return `${line}${markers}`
  }).join('')
}

/** Renders the selected positive pie series as SVG sectors with proportional angles. */
function renderPie(content: PlainGraphContent, rootId: string): string {
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
    const sector = `<path id="${rootId}-sector-${index}" class="elce-statistical-graph__sector ${graphColorClassName(content.categories.findIndex((category) => category.id === entry.category.id))}" d="${path}" />`
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
function renderLegend(
  content: PlainGraphContent,
  richContent: StatisticalGraphContent,
  rootId: string,
  persos: PersoDoc<string>[],
  interactiveLabels: boolean,
  inlineTextSceneFeature: ResourceInlineTextSceneFeature | undefined,
): string {
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
  const labels = selectedEntries.map((entry) => {
    const richLabel = isPie
      ? richContent.categories.find((candidate) => candidate.id === entry.id)?.label
      : richContent.series.find((candidate) => candidate.id === entry.id)?.label
    const labelId = `${rootId}-legend-label-${entry.id}`
    const labelMarkup = !interactiveLabels || richLabel === undefined || typeof richLabel === 'string'
      ? `<span id="${labelId}" class="elce-statistical-graph__legend-label">${escapeHtml(entry.label)}</span>`
      : graphInlineMarkup(richLabel, labelId, 'span', 'elce-statistical-graph__legend-label', true, inlineTextSceneFeature)
    if (interactiveLabels && richLabel !== undefined && typeof richLabel !== 'string' && typeof labelMarkup !== 'string') persos.push(...labelMarkup.persos)
    const renderedLabel = typeof labelMarkup === 'string' ? labelMarkup : labelMarkup.markup
    return `<li id="${rootId}-legend-${entry.id}" class="elce-statistical-graph__legend-item"><span id="${rootId}-legend-mark-${entry.id}" class="elce-statistical-graph__legend-mark ${graphLegendColorClassName(entry.colorIndex)}"></span>${renderedLabel}</li>`
  }).join('')
  return `<ul id="${rootId}-legend" class="elce-statistical-graph__legend" aria-label="${legendLabel}">${labels}</ul>`
}

/** Places accessible HTML link targets over rich labels drawn inside the SVG. */
function renderSvgInlineLabelOverlay(
  content: PlainGraphContent,
  richContent: StatisticalGraphContent,
  rootId: string,
  persos: PersoDoc<string>[],
  interactiveLabels: boolean,
  inlineTextSceneFeature: ResourceInlineTextSceneFeature | undefined,
): string {
  if (!interactiveLabels || content.rendering === STATISTICAL_GRAPH_RENDERING.PIE) return ''
  const labels: string[] = []
  const addLabel = (value: ElceTextValue, id: string, left: number, top: number, transform: string): void => {
    if (authoredTextToPlainText(value).trim().length === 0) return
    const projection = graphInlineMarkup(value, id, 'span', 'elce-statistical-graph__inline-overlay-label', true, inlineTextSceneFeature)
    if (projection.markup.length === 0) return
    labels.push(`<div id="${id}-position" class="elce-statistical-graph__inline-overlay-position" style="left:${left}%;top:${top}%;transform:${transform}">${projection.markup}</div>`)
    persos.push(...projection.persos)
  }
  addLabel(richContent.categoryAxisLabel, `${rootId}-category-axis-inline`, 50, 97.2, 'translate(-50%, -50%)')
  addLabel(richContent.seriesAxisLabel, `${rootId}-series-axis-inline`, 2, 47, 'translate(-50%, -50%) rotate(-90deg)')
  const density = labelDensity(content.categories.length)
  content.categories.forEach((category, index) => {
    if (index % density !== 0 && index !== content.categories.length - 1) return
    const richCategory = richContent.categories.find((candidate) => candidate.id === category.id)
    if (richCategory === undefined) return
    const x = 82 + (880 * (index + 0.5)) / content.categories.length
    addLabel(richCategory.label, `${rootId}-category-inline-${index}`, x / 10, 90.4, 'translate(-50%, -50%)')
  })
  if (labels.length === 0) return ''
  return `<div id="${rootId}-inline-label-overlay" class="elce-statistical-graph__inline-label-overlay">${labels.join('')}</div>`
}

/** Bounds the visible Table to populated rows and the last populated column. */
function renderVisibleTable(
  content: PlainGraphContent,
  richContent: StatisticalGraphContent,
  rootId: string,
  tableFitRules: string[],
  persos: PersoDoc<string>[],
  interactiveLabels: boolean,
  inlineTextSceneFeature: ResourceInlineTextSceneFeature | undefined,
): string {
  const populatedCategoryIds = new Set(content.values.map((entry) => entry.categoryId))
  const seriesIndexById = new Map(content.series.map((series, index) => [series.id, index]))
  const lastPopulatedSeriesIndex = content.values.reduce(
    (lastIndex, entry) => Math.max(lastIndex, seriesIndexById.get(entry.seriesId) ?? -1),
    -1,
  )
  const visibleContent = {
    ...content,
    categories: content.categories.filter((category) => populatedCategoryIds.has(category.id)),
    series: content.series.slice(0, lastPopulatedSeriesIndex + 1),
  }
  return `${renderAxisCaptions(richContent, rootId, persos, interactiveLabels, inlineTextSceneFeature)}${renderTable(visibleContent, rootId, 'elce-statistical-graph__table', tableFitRules, richContent, persos, interactiveLabels, inlineTextSceneFeature)}`
}

/** Renders the required semantic alternative after an SVG chart. */
function renderAccessibleTable(content: PlainGraphContent, rootId: string, tableFitRules: string[]): string {
  return renderTable(content, `${rootId}-accessible`, 'elce-statistical-graph__table elce-statistical-graph__table--visually-hidden', tableFitRules)
}

/** Creates a correctly scoped data table from the normalized graph matrix. */
function renderTable(
  content: PlainGraphContent,
  rootId: string,
  className: string,
  tableFitRules: string[],
  richContent?: StatisticalGraphContent,
  persos?: PersoDoc<string>[],
  interactiveLabels = true,
  inlineTextSceneFeature?: ResourceInlineTextSceneFeature,
): string {
  const title = content.title.trim() || 'Graphe'
  const isVisible = !className.includes('--visually-hidden')
  const renderLabel = (value: string, richValue: ElceTextValue | undefined, id: string): string => {
    if (value.trim().length === 0) return ''
    if (!interactiveLabels || !isVisible || richValue === undefined || typeof richValue === 'string' || persos === undefined) return escapeHtml(value)
    if (authoredTextToPlainText(richValue).trim().length === 0) return escapeHtml(value)
    const projection = graphInlineMarkup(richValue, id, 'span', undefined, true, inlineTextSceneFeature)
    persos.push(...projection.persos)
    return projection.markup
  }
  const denseClass = !isVisible || Math.max(content.series.length, content.categories.length) < 12
    ? ''
    : ' elce-statistical-graph__table--dense'
  const richSeriesById = new Map(richContent?.series.map((series) => [series.id, series.label]) ?? [])
  const richCategoriesById = new Map(richContent?.categories.map((category) => [category.id, category.label]) ?? [])
  const header = `<tr id="${rootId}-head-row"><th id="${rootId}-corner" class="elce-statistical-graph__row-heading" scope="col" title="${escapeHtml(content.categoryAxisLabel)}">${renderLabel(content.categoryAxisLabel, richContent?.categoryAxisLabel, `${rootId}-corner-label`)}</th>${content.series.map((series, index) => `<th id="${rootId}-series-${index}" scope="col" title="${escapeHtml(series.label)}">${renderLabel(series.label, richSeriesById.get(series.id), `${rootId}-series-label-${index}`)}</th>`).join('')}</tr>`
  const body = content.categories.map((category, categoryIndex) => {
    const rowHeading = `<th id="${rootId}-category-${categoryIndex}" class="elce-statistical-graph__row-heading" scope="row" title="${escapeHtml(category.label)}">${renderLabel(category.label, richCategoriesById.get(category.id), `${rootId}-category-label-${categoryIndex}`)}</th>`
    const cells = content.series.map((series, seriesIndex) => {
      const value = content.values.find((entry) => entry.categoryId === category.id && entry.seriesId === series.id)
      const formattedValue = value === undefined ? '' : formatValue(value.value)
      return `<td id="${rootId}-cell-${categoryIndex}-${seriesIndex}" title="${escapeHtml(formattedValue)}">${formattedValue}</td>`
    }).join('')
    return `<tr id="${rootId}-category-row-${categoryIndex}">${rowHeading}${cells}</tr>`
  }).join('')
  const fitClassName = renderTableFitClassName(content, rootId, isVisible, tableFitRules)
  const caption = renderLabel(title, richContent?.title, `${rootId}-caption-label`)
  return `<table id="${rootId}-table" class="${className}${denseClass}${fitClassName === '' ? '' : ` ${fitClassName}`}"><caption id="${rootId}-caption" class="elce-statistical-graph__table-caption">${caption}</caption><thead id="${rootId}-thead">${header}</thead><tbody id="${rootId}-tbody">${body}</tbody></table>`
}

/** Creates a class rule with the text dimensions used to fit the visible table. */
function renderTableFitClassName(
  content: PlainGraphContent,
  rootId: string,
  isVisible: boolean,
  tableFitRules: string[],
): string {
  if (!isVisible) return ''

  const maxValueLength = Math.max(1, ...content.values.map((value) => formatValue(value.value).length))
  const maxRowHeadingLength = Math.max(1, content.categoryAxisLabel.length, ...content.categories.map((category) => category.label.length))
  const maxSeriesHeadingLength = Math.max(1, ...content.series.map((series) => series.label.length))
  const className = sceneStyleClassName('graph-table-fit', rootId)
  tableFitRules.push(sceneClassRule(className, {
    '--statistical-graph-series-count': String(content.series.length),
    '--statistical-graph-category-count': String(content.categories.length),
    '--statistical-graph-max-value-length': String(maxValueLength),
    '--statistical-graph-max-row-heading-length': String(maxRowHeadingLength),
    '--statistical-graph-max-series-heading-length': String(maxSeriesHeadingLength),
  }))
  return className
}

/** Keeps separate axis labels visible when the HTML table is selected. */
function renderAxisCaptions(
  content: StatisticalGraphContent,
  rootId: string,
  persos: PersoDoc<string>[],
  interactiveLabels: boolean,
  inlineTextSceneFeature: ResourceInlineTextSceneFeature | undefined,
): string {
  const category = authoredTextToPlainText(content.categoryAxisLabel).trim().length === 0
    ? ''
    : graphInlineMarkup(content.categoryAxisLabel, `${rootId}-table-category-axis`, 'p', 'elce-statistical-graph__table-axis', interactiveLabels, inlineTextSceneFeature)
  const series = authoredTextToPlainText(content.seriesAxisLabel).trim().length === 0
    ? ''
    : graphInlineMarkup(content.seriesAxisLabel, `${rootId}-table-series-axis`, 'p', 'elce-statistical-graph__table-axis', interactiveLabels, inlineTextSceneFeature)
  if (category !== '' && interactiveLabels) persos.push(...category.persos)
  if (series !== '' && interactiveLabels) persos.push(...series.persos)
  if (category === '' && series === '') return ''
  return `<div id="${rootId}-table-axis-captions" class="elce-statistical-graph__table-axis-captions">${category === '' ? '' : category.markup}${series === '' ? '' : series.markup}</div>`
}

/** Creates one safe Graph text projection and its Elcé inline-link targets. */
function graphInlineMarkup(
  value: ElceTextValue,
  id: string,
  tag: string,
  className?: string,
  interactiveLabels = true,
  inlineTextSceneFeature?: ResourceInlineTextSceneFeature,
): GraphInlineMarkup {
  if (!interactiveLabels && typeof value !== 'string') {
    const classAttribute = className === undefined ? '' : ` class="${escapeHtml(className)}"`
    return { markup: `<${tag} id="${escapeHtml(id)}"${classAttribute}>${escapeHtml(authoredTextToPlainText(value))}</${tag}>`, persos: [] }
  }
  if (typeof value === 'string') {
    const classAttribute = className === undefined ? '' : ` class="${escapeHtml(className)}"`
    return { markup: `<${tag} id="${escapeHtml(id)}"${classAttribute}>${escapeHtml(value)}</${tag}>`, persos: [] }
  }
  if (inlineTextSceneFeature === undefined) throw new Error(`Le rendu du texte enrichi ${id} exige une contribution inline.`)
  const parts = inlineTextSceneFeature.build(value, id)
  return { markup: wrapResourceInlineTextSceneParts(parts, id, tag, className), persos: parts.persos }
}

/** Preserves Graph editorial paragraphs while projecting rich labels inline. */
function graphEditorialMarkup(
  value: ElceTextValue,
  id: string,
  interactiveLabels: boolean,
  inlineTextSceneFeature: ResourceInlineTextSceneFeature | undefined,
): GraphInlineMarkup {
  if (typeof value === 'string' || !interactiveLabels) {
    const plainValue = authoredTextToPlainText(value)
    return {
      markup: `<div id="${id}" class="elce-statistical-graph__editorial">${renderParagraphs(plainValue, id)}</div>`,
      persos: [],
    }
  }
  if (inlineTextSceneFeature === undefined) throw new Error(`Le rendu du texte enrichi ${id} exige une contribution inline.`)
  const parts = inlineTextSceneFeature.build(value, id)
  return {
    markup: wrapResourceInlineTextSceneParts(parts, id, 'div', 'elce-statistical-graph__editorial'),
    persos: parts.persos,
  }
}

/** Keeps the editorial text as separate paragraphs without interpreting markup. */
function renderParagraphs(text: string, idPrefix: string): string {
  return text.split(/\n\s*\n/)
    .filter((paragraph) => paragraph.trim().length > 0)
    .map((paragraph, index) => `<p id="${idPrefix}-paragraph-${index}">${escapeHtml(paragraph).replaceAll('\n', '<br>')}</p>`)
    .join('')
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

/** Returns the CSS class for one repeating graph palette color. */
function graphColorClassName(index: number): string {
  return `elce-statistical-graph__color--${index % graphColors.length}`
}

/** Returns the legend-specific CSS class for one repeating graph color. */
function graphLegendColorClassName(index: number): string {
  return `elce-statistical-graph__legend-mark--${index % graphColors.length}`
}

/** Emits the graph palette as CSS class rules shared by this scene's markup. */
function graphColorStyleSheet(): string {
  return graphColors.map((color, index) => {
    const colorClass = graphColorClassName(index)
    return [
      `.elce-statistical-graph__bar.${colorClass}, .elce-statistical-graph__point.${colorClass}, .elce-statistical-graph__sector.${colorClass} { fill: ${color}; }`,
      `.elce-statistical-graph__line.${colorClass} { fill: none; stroke: ${color}; }`,
      `.elce-statistical-graph__legend-mark.${graphLegendColorClassName(index)} { background-color: ${color}; }`,
    ].join('\n')
  }).join('\n')
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

import { describe, expect, it } from 'vitest'
import { STATISTICAL_GRAPH_RENDERING } from '../../config/document-config'
import type { StatisticalGraphContent } from '../../domain/statistical-graph/statistical-graph-types'
import { ElceStatisticalGraphSceneBuilder } from './statistical-graph-scene-builder'

const builder = new ElceStatisticalGraphSceneBuilder()

describe('Statistical Graph scene builder', () => {
  it('renders the selected Table as visible HTML and chooses one font size for all cells', () => {
    const build = builder.buildContent(createGraph(STATISTICAL_GRAPH_RENDERING.TABLE, { transposeEnabled: false }), 'statistical-graph-above-text', 'table-graph')

    expect(build.markup).toContain('<table id="table-graph-table" class="elce-statistical-graph__table" style="--statistical-graph-series-count:1;--statistical-graph-category-count:1;--statistical-graph-max-value-length:1;--statistical-graph-max-row-heading-length:6;--statistical-graph-max-series-heading-length:10">')
    expect(build.markup).toContain('<th id="table-graph-series-0" scope="col" title="Population">Population</th>')
    expect(build.markup).toContain('<th id="table-graph-category-0" class="elce-statistical-graph__row-heading" scope="row" title="Nord">Nord</th>')
    expect(build.markup).toContain('<td id="table-graph-cell-0-0" title="0">0</td>')
    expect(build.markup).not.toContain('--statistical-graph-cell-fit-factor')
    expect(build.markup).not.toContain('--statistical-graph-cell-length')
    expect(build.markup).not.toContain('<svg')
    expect(build.markup).not.toContain('visually-hidden">0</td>')
  })

  it('marks wide visible tables for responsive dense layout while preserving every series label', () => {
    const series = Array.from({ length: 40 }, (_unused, index) => ({ id: `s${index}`, label: `Série ${index + 1}` }))
    const markup = builder.buildContent(createGraph(STATISTICAL_GRAPH_RENDERING.TABLE, {
      series,
      values: [
        { categoryId: 'c1', seriesId: 's1', value: 0 },
        { categoryId: 'c1', seriesId: 's39', value: 1 },
      ],
      transposeEnabled: false,
    }), 'statistical-graph-above-text', 'dense-table').markup

    expect(markup).toContain('class="elce-statistical-graph__table elce-statistical-graph__table--dense" style="--statistical-graph-series-count:40;--statistical-graph-category-count:1;--statistical-graph-max-value-length:1;--statistical-graph-max-row-heading-length:6;--statistical-graph-max-series-heading-length:8"')
    expect(markup).toContain('id="dense-table-category-0" class="elce-statistical-graph__row-heading" scope="row" title="Nord">Nord</th>')
    expect(markup).toContain('id="dense-table-cell-0-1" title="0">0</td>')
    expect(markup).toContain('title="Série 40">Série 40</th>')
  })

  it('uses the dense layout for tall tables and includes the longest content in the shared fit size', () => {
    const categories = Array.from({ length: 40 }, (_unused, index) => ({ id: `c${index}`, label: `Catégorie ${index + 1}` }))
    const series = [{ id: 's1', label: 'Valeur A' }, { id: 's2', label: 'Valeur B' }]
    const values = categories.map((category, index) => ({
      categoryId: category.id,
      seriesId: 's1',
      value: index === categories.length - 1 ? 1600 : index,
    }))
    const markup = builder.buildContent(createGraph(STATISTICAL_GRAPH_RENDERING.TABLE, {
      categories,
      series,
      values,
      transposeEnabled: false,
    }), 'statistical-graph-above-text', 'tall-table').markup

    expect(markup).toContain('class="elce-statistical-graph__table elce-statistical-graph__table--dense" style="--statistical-graph-series-count:1;--statistical-graph-category-count:40;--statistical-graph-max-value-length:5;--statistical-graph-max-row-heading-length:12;--statistical-graph-max-series-heading-length:8"')
    expect(markup).toContain('id="tall-table-cell-39-0" title="1 600">1 600</td>')
  })

  it('transposes the table and its axis headings by default', () => {
    const markup = builder.buildContent(createGraph(STATISTICAL_GRAPH_RENDERING.TABLE, {
      categories: [{ id: 'c1', label: 'Nord' }, { id: 'c2', label: 'Sud' }],
      series: [{ id: 's1', label: 'Population' }, { id: 's2', label: 'Surface' }],
      values: [
        { categoryId: 'c1', seriesId: 's1', value: 0 },
        { categoryId: 'c2', seriesId: 's2', value: 42 },
      ],
    }), 'statistical-graph-above-text', 'transposed-table').markup

    expect(markup).toContain('id="transposed-table-table-category-axis" class="elce-statistical-graph__table-axis">Habitants</p>')
    expect(markup).toContain('id="transposed-table-table-series-axis" class="elce-statistical-graph__table-axis">Région</p>')
    expect(markup).toContain('id="transposed-table-series-0" scope="col" title="Nord">Nord</th>')
    expect(markup).toContain('id="transposed-table-category-0" class="elce-statistical-graph__row-heading" scope="row" title="Population">Population</th>')
    expect(markup).toContain('id="transposed-table-cell-0-0" title="0">0</td>')
    expect(markup).toContain('id="transposed-table-cell-1-1" title="42">42</td>')
  })

  it('trims a transposed table at its last populated row and column', () => {
    const markup = builder.buildContent(createGraph(STATISTICAL_GRAPH_RENDERING.TABLE, {
      categories: [
        { id: 'c1', label: 'Nord' },
        { id: 'c2', label: 'Centre' },
        { id: 'c3', label: 'Sud' },
        { id: 'c4', label: 'Est' },
      ],
      series: [
        { id: 's1', label: '2024' },
        { id: 's2', label: '2025' },
        { id: 's3', label: '2026' },
      ],
      values: [
        { categoryId: 'c1', seriesId: 's1', value: 0 },
        { categoryId: 'c3', seriesId: 's2', value: 8 },
      ],
    }), 'statistical-graph-above-text', 'bounded-transposed-table').markup

    expect(markup).toContain('id="bounded-transposed-table-series-1" scope="col" title="Centre">Centre</th>')
    expect(markup).toContain('id="bounded-transposed-table-series-2" scope="col" title="Sud">Sud</th>')
    expect(markup).toContain('id="bounded-transposed-table-cell-0-1" title=""></td>')
    expect(markup).not.toContain('title="Est">Est</th>')
    expect(markup).not.toContain('title="2026">2026</th>')
  })

  it('uses Graphe as the default accessible title', () => {
    const markup = builder.buildContent(createGraph(STATISTICAL_GRAPH_RENDERING.BAR, { title: '' }), 'statistical-graph-above-text', 'untitled-graph').markup

    expect(markup).toContain('class="elce-statistical-graph__title elce-statistical-graph__visually-hidden">Graphe</h2>')
    expect(markup).toContain('<title id="untitled-graph-svg-title">Graphe</title>')
    expect(markup).not.toContain('Graphe statistique')
  })

  it('shows only populated table rows and treats zero as data', () => {
    const markup = builder.buildContent(createGraph(STATISTICAL_GRAPH_RENDERING.TABLE, {
      transposeEnabled: false,
      categories: [
        { id: 'empty', label: 'Vide' },
        { id: 'zero', label: 'Zéro' },
        { id: 'value', label: 'Valeur' },
      ],
      values: [
        { categoryId: 'zero', seriesId: 's1', value: 0 },
        { categoryId: 'value', seriesId: 's2', value: 3 },
      ],
    }), 'statistical-graph-above-text', 'populated-table').markup

    expect(markup).not.toContain('title="Vide">Vide</th>')
    expect(markup).toContain('id="populated-table-category-0" class="elce-statistical-graph__row-heading" scope="row" title="Zéro">Zéro</th>')
    expect(markup).toContain('id="populated-table-cell-0-0" title="0">0</td>')
    expect(markup).toContain('id="populated-table-category-1" class="elce-statistical-graph__row-heading" scope="row" title="Valeur">Valeur</th>')
  })

  it('uses the selected category for a transposed pie and keeps only named legend entries', () => {
    const markup = builder.buildContent(createGraph(STATISTICAL_GRAPH_RENDERING.PIE, {
      categories: [{ id: 'c1', label: 'Nord' }, { id: 'c2', label: 'Sud' }],
      series: [{ id: 's1', label: 'Population' }, { id: 's2', label: 'Surface' }],
      values: [
        { categoryId: 'c1', seriesId: 's1', value: 5 },
        { categoryId: 'c2', seriesId: 's1', value: 0 },
        { categoryId: 'c2', seriesId: 's2', value: 9 },
      ],
      pieCategoryId: 'c2',
    }), 'statistical-graph-above-text', 'transposed-pie').markup

    expect(markup).toContain('id="transposed-pie-legend" class="elce-statistical-graph__legend" aria-label="Séries"')
    expect(markup).toContain('id="transposed-pie-legend-label-s2" class="elce-statistical-graph__legend-label">Surface</span>')
    expect(markup).not.toContain('id="transposed-pie-legend-label-s1"')
    expect(markup.match(/class="elce-statistical-graph__sector"/g)).toHaveLength(1)
  })

  it('omits chart legends when no applicable label is named', () => {
    const markup = builder.buildContent(createGraph(STATISTICAL_GRAPH_RENDERING.BAR, {
      transposeEnabled: false,
      series: [{ id: 's1', label: ' ' }, { id: 's2', label: '' }],
    }), 'statistical-graph-above-text', 'unlabeled-chart').markup

    expect(markup).not.toContain('id="unlabeled-chart-legend"')
  })

  it('exposes each SVG mode by its title and keeps the same semantic data table', () => {
    for (const rendering of [STATISTICAL_GRAPH_RENDERING.BAR, STATISTICAL_GRAPH_RENDERING.LINE, STATISTICAL_GRAPH_RENDERING.PIE]) {
      const markup = builder.buildContent(createGraph(rendering), 'statistical-graph-above-text', `graph-${rendering}`).markup

      expect(markup).toContain('role="img"')
      expect(markup).toContain(`aria-labelledby="graph-${rendering}-svg-title graph-${rendering}-description"`)
      expect(markup).toContain(`<table id="graph-${rendering}-accessible-table"`)
      expect(markup).toContain('class="elce-statistical-graph__table elce-statistical-graph__table--visually-hidden"')
      expect(markup).not.toContain('display:none')
      expect(markup).not.toContain('hidden=""')
    }
  })

  it('does not connect a line across a missing data cell', () => {
    const content = createGraph(STATISTICAL_GRAPH_RENDERING.LINE, {
      categories: [
        { id: 'c1', label: 'A' },
        { id: 'c2', label: 'B' },
        { id: 'c3', label: 'C' },
      ],
      values: [
        { categoryId: 'c1', seriesId: 's1', value: 1 },
        { categoryId: 'c3', seriesId: 's1', value: 3 },
      ],
    })
    const markup = builder.buildContent(content, 'statistical-graph-above-text', 'gapped-line').markup

    expect(markup).not.toContain('id="gapped-line-line-0"')
    expect(markup.match(/class="elce-statistical-graph__point"/g)).toHaveLength(2)
  })

  it('keeps every 40 by 40 value in the semantic table and reduces chart labels', () => {
    const categories = Array.from({ length: 40 }, (_unused, index) => ({ id: `c${index}`, label: `Catégorie ${index}` }))
    const series = Array.from({ length: 40 }, (_unused, index) => ({ id: `s${index}`, label: `Série ${index}` }))
    const values = categories.flatMap((category) => series.map((entry, index) => ({
      categoryId: category.id,
      seriesId: entry.id,
      value: index,
    })))
    const markup = builder.buildContent(createGraph(STATISTICAL_GRAPH_RENDERING.BAR, { categories, series, values }), 'statistical-graph-above-text', 'dense-graph').markup

    expect(markup.match(/<td id="dense-graph-accessible-cell-/g)).toHaveLength(1600)
    expect(markup.match(/class="elce-statistical-graph__tick-label"/g)).toHaveLength(5)
    expect(markup.match(/class="elce-statistical-graph__legend-item"/g)).toHaveLength(5)
  })

  it('emits unique ids for every authored element and keeps extreme finite values drawable', () => {
    const content = createGraph(STATISTICAL_GRAPH_RENDERING.BAR, {
      values: [
        { categoryId: 'c1', seriesId: 's1', value: -1e308 },
        { categoryId: 'c1', seriesId: 's2', value: 1e308 },
      ],
    })
    const markup = builder.buildContent(content, 'statistical-graph-above-text', 'extreme-graph').markup
    const tags = [...markup.matchAll(/<([a-z][\w:-]*)([^>]*)>/gi)]
    const ids = [...markup.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]!)

    expect(tags.every((tag) => /\sid="[^"]+"/.test(tag[2]!))).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
    expect(markup).not.toMatch(/NaN|Infinity/)
  })
})

/** Creates graph content owned by the scene-builder tests. */
function createGraph(
  rendering: StatisticalGraphContent['rendering'],
  overrides: Partial<StatisticalGraphContent> = {},
): StatisticalGraphContent {
  return {
    rendering,
    overline: '',
    title: 'Population',
    categoryAxisLabel: 'Région',
    seriesAxisLabel: 'Habitants',
    editorialText: 'Données de démonstration.',
    pieSeriesId: 's1',
    categories: [{ id: 'c1', label: 'Nord' }],
    series: [{ id: 's1', label: 'Population' }, { id: 's2', label: 'Surface' }],
    values: [{ categoryId: 'c1', seriesId: 's1', value: 0 }],
    ...overrides,
  }
}

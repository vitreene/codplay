import { describe, expect, it } from 'vitest'
import { STATISTICAL_GRAPH_RENDERING } from '../statistical-graph-config'
import { ElceStatisticalGraphService } from './statistical-graph-service'

const service = new ElceStatisticalGraphService()

describe('Statistical Graph domain service', () => {
  it('replaces the full matrix from tabular clipboard text and ignores nonnumeric data', () => {
    const content = service.createDefaultStatisticalGraphContent()
    const replaced = service.replaceStatisticalGraphTable(content, 'Période\tSérie A\tSérie B\nJanvier\t1,5\t2\nFévrier\t\ttexte')

    expect(content.categories).toHaveLength(4)
    expect(content.series).toHaveLength(2)
    expect(replaced.categories).toHaveLength(2)
    expect(replaced.series).toHaveLength(2)
    expect(replaced.categories.map((category) => category.label)).toEqual(['Janvier', 'Février'])
    expect(replaced.series.map((series) => series.label)).toEqual(['Série A', 'Série B'])
    expect(replaced.values.map((entry) => entry.value)).toEqual([1.5, 2])
    expect(replaced.rendering).toBe(STATISTICAL_GRAPH_RENDERING.BAR)
    expect(content.categories).toHaveLength(4)
    expect(content.series).toHaveLength(2)
  })

  it('accepts semicolon-separated CSV-like text with decimal commas and quoted delimiters', () => {
    const content = service.createDefaultStatisticalGraphContent()
    const replaced = service.replaceStatisticalGraphTable(content, '"Zone; secteur";"Série, A"\n"Nord";2,75')

    expect(replaced.categories.map((category) => category.label)).toEqual(['Nord'])
    expect(replaced.series.map((series) => series.label)).toEqual(['Série, A'])
    expect(replaced.values.map((entry) => entry.value)).toEqual([2.75])
  })

  it('extends the table beyond 40 data rows and columns', () => {
    let content = service.createDefaultStatisticalGraphContent()
    for (let index = 1; index < 42; index += 1) {
      content = service.addStatisticalGraphCategory(content)
      content = service.addStatisticalGraphSeries(content)
    }

    expect(content.categories).toHaveLength(45)
    expect(content.series).toHaveLength(43)
    const extended = service.setStatisticalGraphGridCell(content, 45, 46, '12')
    expect(extended.categories).toHaveLength(45)
    expect(extended.series).toHaveLength(46)
    expect(extended.values).toHaveLength(1)
  })

  it('uses only enabled headings when replacing the table and accepts dimensions beyond 41', () => {
    const content = service.createDefaultStatisticalGraphContent()
    const values = '1\t2\n3\t4'
    const bothHeadings = service.replaceStatisticalGraphTable(content, values)
    const columnHeadings = service.replaceStatisticalGraphTable({ ...content, rowLabelsEnabled: false }, values)
    const rowHeadings = service.replaceStatisticalGraphTable({ ...content, columnLabelsEnabled: false }, values)
    const noHeadings = service.replaceStatisticalGraphTable({
      ...content,
      columnLabelsEnabled: false,
      rowLabelsEnabled: false,
    }, values)
    const manyRowText = ['Titre\tSérie', ...Array.from(
      { length: 42 },
      (_unused, index) => `Ligne ${index + 1}\t${index}`,
    )].join('\n')
    const manyColumnText = `Titre\t${Array.from(
      { length: 42 },
      (_unused, index) => `Série ${index + 1}`,
    ).join('\t')}`
    const manyRows = service.replaceStatisticalGraphTable(content, manyRowText)
    const manyColumns = service.replaceStatisticalGraphTable(content, manyColumnText)

    expect(bothHeadings.categories.map((category) => category.label)).toEqual(['3'])
    expect(bothHeadings.series.map((series) => series.label)).toEqual(['2'])
    expect(bothHeadings.values.map((entry) => entry.value)).toEqual([4])
    expect(columnHeadings.categories).toHaveLength(1)
    expect(columnHeadings.series).toHaveLength(2)
    expect(columnHeadings.values.map((entry) => entry.value)).toEqual([3, 4])
    expect(rowHeadings.categories.map((category) => category.label)).toEqual(['1', '3'])
    expect(rowHeadings.series).toHaveLength(1)
    expect(rowHeadings.values.map((entry) => entry.value)).toEqual([2, 4])
    expect(noHeadings.categories).toHaveLength(2)
    expect(noHeadings.series).toHaveLength(2)
    expect(noHeadings.values.map((entry) => entry.value)).toEqual([1, 2, 3, 4])
    expect(manyRows.categories).toHaveLength(42)
    expect(manyColumns.series).toHaveLength(42)
    expect(content.categories).toHaveLength(4)
    expect(content.series).toHaveLength(2)
  })

  it('keeps zero and signed numeric values while clearing blank or nonnumeric cells', () => {
    const content = service.createDefaultStatisticalGraphContent()
    const categoryId = content.categories[0]!.id
    const seriesId = content.series[0]!.id
    const withZero = service.setStatisticalGraphCell(content, categoryId, seriesId, '0')
    const withNegative = service.setStatisticalGraphCell(withZero, categoryId, seriesId, '-3,25')
    const cleared = service.setStatisticalGraphCell(withNegative, categoryId, seriesId, 'texte')

    expect(withZero.values[0]?.value).toBe(0)
    expect(withNegative.values[0]?.value).toBe(-3.25)
    expect(cleared.values).toEqual([])
  })

  it('owns graph labels, validation, display options, and row removal', () => {
    const initial = service.createDefaultStatisticalGraphContent()
    const firstCategory = initial.categories[0]!
    const secondCategory = initial.categories[1]!
    const firstSeries = initial.series[0]!
    const withLabels = service.setStatisticalGraphSeriesLabel(
      service.setStatisticalGraphCategoryLabel(initial, firstCategory.id, '2026'),
      firstSeries.id,
      'Visites',
    )
    const withValue = service.setStatisticalGraphCell(withLabels, firstCategory.id, firstSeries.id, '8')
    const withNewRows = service.addStatisticalGraphSeries(service.addStatisticalGraphCategory(withValue))
    const withOptions = service.setStatisticalGraphTranspose(
      service.setStatisticalGraphRendering(withNewRows, STATISTICAL_GRAPH_RENDERING.PIE),
      false,
    )
    const selectedSeries = withOptions.series[1]!
    const withPieSelection = service.setStatisticalGraphPieSeries(withOptions, selectedSeries.id)
    const withoutFirstCategory = service.removeStatisticalGraphCategory(withPieSelection, firstCategory.id)
    const withoutFirstSeries = service.removeStatisticalGraphSeries(withoutFirstCategory, firstSeries.id)

    expect(withPieSelection.categories[0]?.label).toBe('2026')
    expect(withPieSelection.series[0]?.label).toBe('Visites')
    expect(withoutFirstCategory.values).toEqual([])
    expect(withoutFirstCategory.pieCategoryId).toBe(secondCategory.id)
    expect(withoutFirstSeries.series).toHaveLength(2)
    expect(withoutFirstSeries.pieSeriesId).toBe(selectedSeries.id)
    expect(service.removeStatisticalGraphCategory({ ...initial, categories: [firstCategory] }, firstCategory.id).categories)
      .toEqual([firstCategory])
    expect(service.removeStatisticalGraphSeries({ ...initial, series: [firstSeries] }, firstSeries.id).series)
      .toEqual([firstSeries])
    expect(() => service.assertStatisticalGraphContent(withoutFirstSeries)).not.toThrow()
    expect(service.setStatisticalGraphPieSeries(withoutFirstSeries, 'unknown-series')).toBe(withoutFirstSeries)
    expect(service.setStatisticalGraphPieCategory(withoutFirstSeries, 'unknown-category')).toBe(withoutFirstSeries)
  })

  it('parses finite localized numbers and rejects graph references outside the content', () => {
    const content = service.createDefaultStatisticalGraphContent()

    expect(service.parseStatisticalGraphNumber(' -1 234,5e-1 ')).toBe(-123.45)
    expect(service.parseStatisticalGraphNumber('1,2,3')).toBeNull()
    expect(() => service.assertStatisticalGraphContent({
      ...content,
      values: [{ categoryId: 'missing-category', seriesId: content.series[0]!.id, value: 1 }],
    })).toThrow('Une valeur de graphe référence une ligne ou une série absente.')
  })
})

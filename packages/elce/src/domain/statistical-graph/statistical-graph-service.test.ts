import { describe, expect, it } from 'vitest'
import { STATISTICAL_GRAPH_RENDERING } from '../../config/document-config'
import {
  addStatisticalGraphCategory,
  addStatisticalGraphSeries,
  createDefaultStatisticalGraphContent,
  replaceStatisticalGraphTable,
  setStatisticalGraphCell,
  setStatisticalGraphGridCell,
} from './statistical-graph-service'

describe('Statistical Graph domain service', () => {
  it('replaces the full matrix from tabular clipboard text and ignores nonnumeric data', () => {
    const content = createDefaultStatisticalGraphContent()
    const replaced = replaceStatisticalGraphTable(content, 'Période\tSérie A\tSérie B\nJanvier\t1,5\t2\nFévrier\t\ttexte')

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
    const content = createDefaultStatisticalGraphContent()
    const replaced = replaceStatisticalGraphTable(content, '"Zone; secteur";"Série, A"\n"Nord";2,75')

    expect(replaced.categories.map((category) => category.label)).toEqual(['Nord'])
    expect(replaced.series.map((series) => series.label)).toEqual(['Série, A'])
    expect(replaced.values.map((entry) => entry.value)).toEqual([2.75])
  })

  it('extends the table beyond 40 data rows and columns', () => {
    let content = createDefaultStatisticalGraphContent()
    for (let index = 1; index < 42; index += 1) {
      content = addStatisticalGraphCategory(content)
      content = addStatisticalGraphSeries(content)
    }

    expect(content.categories).toHaveLength(45)
    expect(content.series).toHaveLength(43)
    const extended = setStatisticalGraphGridCell(content, 45, 46, '12')
    expect(extended.categories).toHaveLength(45)
    expect(extended.series).toHaveLength(46)
    expect(extended.values).toHaveLength(1)
  })

  it('uses only enabled headings when replacing the table and accepts dimensions beyond 41', () => {
    const content = createDefaultStatisticalGraphContent()
    const values = '1\t2\n3\t4'
    const bothHeadings = replaceStatisticalGraphTable(content, values)
    const columnHeadings = replaceStatisticalGraphTable({ ...content, rowLabelsEnabled: false }, values)
    const rowHeadings = replaceStatisticalGraphTable({ ...content, columnLabelsEnabled: false }, values)
    const noHeadings = replaceStatisticalGraphTable({
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
    const manyRows = replaceStatisticalGraphTable(content, manyRowText)
    const manyColumns = replaceStatisticalGraphTable(content, manyColumnText)

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
    const content = createDefaultStatisticalGraphContent()
    const categoryId = content.categories[0]!.id
    const seriesId = content.series[0]!.id
    const withZero = setStatisticalGraphCell(content, categoryId, seriesId, '0')
    const withNegative = setStatisticalGraphCell(withZero, categoryId, seriesId, '-3,25')
    const cleared = setStatisticalGraphCell(withNegative, categoryId, seriesId, 'texte')

    expect(withZero.values[0]?.value).toBe(0)
    expect(withNegative.values[0]?.value).toBe(-3.25)
    expect(cleared.values).toEqual([])
  })
})

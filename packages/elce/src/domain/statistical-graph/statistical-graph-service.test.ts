import { describe, expect, it } from 'vitest'
import { STATISTICAL_GRAPH_RENDERING } from '../../config/document-config'
import {
  addStatisticalGraphCategory,
  addStatisticalGraphSeries,
  createDefaultStatisticalGraphContent,
  replaceStatisticalGraphTable,
  setStatisticalGraphCell,
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

  it('accepts 40 data rows and columns, then refuses additions beyond the boundary', () => {
    let content = createDefaultStatisticalGraphContent()
    for (let index = 1; index < 40; index += 1) {
      content = addStatisticalGraphCategory(content)
      content = addStatisticalGraphSeries(content)
    }

    expect(content.categories).toHaveLength(40)
    expect(content.series).toHaveLength(40)
    expect(addStatisticalGraphCategory(content)).toBe(content)
    expect(addStatisticalGraphSeries(content)).toBe(content)
  })

  it('rejects a whole-table replacement beyond 41 rows or columns without mutating its source', () => {
    const content = createDefaultStatisticalGraphContent()
    const tooManyRows = ['Catégorie\tSérie', ...Array.from({ length: 41 }, (_unused, index) => `Ligne ${index + 1}\t${index}`)].join('\n')
    const tooManyColumns = `Catégorie\t${Array.from({ length: 41 }, (_unused, index) => `Série ${index + 1}`).join('\t')}`

    expect(() => replaceStatisticalGraphTable(content, tooManyRows)).toThrow('41 lignes ou colonnes')
    expect(() => replaceStatisticalGraphTable(content, tooManyColumns)).toThrow('41 lignes ou colonnes')
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

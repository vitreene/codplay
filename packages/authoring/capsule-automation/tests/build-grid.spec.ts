import { describe, expect, it } from 'vitest'
import { AutoCapsule, CAPSULE_TYPE } from '../src'

describe('buildGrid() — gridMode fixed per CAPSULE_TYPE', () => {
  it('carousel forces a 1x1 grid regardless of rows/cols input', () => {
    const capsule = new AutoCapsule({
      capsule: { id: 'c', type: CAPSULE_TYPE.carousel, grid: { rows: 9, cols: 16 } },
      children: [],
    })
    expect(capsule.buildGrid().context).toMatchObject({ rows: 1, cols: 1, mode: 'forced' })
  })

  it('rangee derives a horizontal line from the visible child count by default orientation', () => {
    const capsule = new AutoCapsule({
      capsule: { id: 'c', type: CAPSULE_TYPE.rangee, grid: {} },
      children: [
        { id: 'a', order: 1, timeRange: { startMs: 0, endMs: 1000 } },
        { id: 'b', order: 2, timeRange: { startMs: 0, endMs: 1000 } },
        { id: 'c', order: 3, timeRange: { startMs: 0, endMs: 1000 } },
      ],
    })
    expect(capsule.buildGrid().context).toMatchObject({ rows: 1, cols: 3, mode: 'derived' })
  })

  it('rangee derives a vertical line when orientation is vertical', () => {
    const capsule = new AutoCapsule({
      capsule: { id: 'c', type: CAPSULE_TYPE.rangee, grid: { orientation: 'vertical' } },
      children: [
        { id: 'a', order: 1, timeRange: { startMs: 0, endMs: 1000 } },
        { id: 'b', order: 2, timeRange: { startMs: 0, endMs: 1000 } },
      ],
    })
    expect(capsule.buildGrid().context).toMatchObject({ rows: 2, cols: 1, mode: 'derived' })
  })

  it('liste builds one row per visible child', () => {
    const capsule = new AutoCapsule({
      capsule: { id: 'c', type: CAPSULE_TYPE.liste, grid: {} },
      children: [
        { id: 'a', order: 1, timeRange: { startMs: 0, endMs: 1000 } },
        { id: 'b', order: 2, timeRange: { startMs: 0, endMs: 1000 } },
        { id: 'c', order: 3, timeRange: { startMs: 0, endMs: 1000 } },
        { id: 'd', order: 4, timeRange: { startMs: 0, endMs: 1000 } },
      ],
    })
    expect(capsule.buildGrid().context).toMatchObject({ rows: 4, cols: 1, mode: 'list' })
  })

  it('grille uses explicit rows/cols on a manual grid', () => {
    const capsule = new AutoCapsule({
      capsule: { id: 'c', type: CAPSULE_TYPE.grille, grid: { rows: 2, cols: 5 } },
      children: [],
    })
    expect(capsule.buildGrid().context).toMatchObject({ rows: 2, cols: 5, mode: 'manual' })
  })

  it('grille falls back to type defaults (9x16) when rows/cols are omitted', () => {
    const capsule = new AutoCapsule({
      capsule: { id: 'c', type: CAPSULE_TYPE.grille, grid: {} },
      children: [],
    })
    expect(capsule.buildGrid().context).toMatchObject({ rows: 9, cols: 16, mode: 'manual' })
  })

  it('card also resolves to a manual grid, defaulting to 9x16', () => {
    const capsule = new AutoCapsule({
      capsule: { id: 'c', type: CAPSULE_TYPE.card, grid: {} },
      children: [],
    })
    expect(capsule.buildGrid().context).toMatchObject({ rows: 9, cols: 16, mode: 'manual' })
  })

  it('applies gap, rowGap and columnGap independently to the inline style', () => {
    const capsule = new AutoCapsule({
      capsule: {
        id: 'c',
        type: CAPSULE_TYPE.grille,
        grid: { rows: 2, cols: 2, gap: '4px', rowGap: '8px', columnGap: '12px' },
      },
      children: [],
    })
    const grid = capsule.buildGrid()
    expect(grid.inlineStyle.gap).toBe('4px')
    expect(grid.inlineStyle.rowGap).toBe('8px')
    expect(grid.inlineStyle.columnGap).toBe('12px')
  })
})

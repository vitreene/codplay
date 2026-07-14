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

describe('buildGrid() — sceneRoot fills its real host container', () => {
  it('adds the fixed ac-scene-root class alongside the grid class when sceneRoot is set', () => {
    const capsule = new AutoCapsule({
      capsule: { id: 'root', type: CAPSULE_TYPE.card, grid: {}, sceneRoot: true },
      children: [],
    })
    const grid = capsule.buildGrid()
    expect(grid.className.split(' ')).toContain('ac-scene-root')
  })

  it('does not add ac-scene-root when sceneRoot is omitted (nested capsule default)', () => {
    const capsule = new AutoCapsule({
      capsule: { id: 'nested', type: CAPSULE_TYPE.card, grid: {} },
      children: [],
    })
    const grid = capsule.buildGrid()
    expect(grid.className.split(' ')).not.toContain('ac-scene-root')
  })

  it('never mixes the fill concern into the grid class/name — same grid class with or without sceneRoot', () => {
    const sceneRootCapsule = new AutoCapsule({
      capsule: { id: 'root', type: CAPSULE_TYPE.card, grid: {}, sceneRoot: true },
      children: [],
    })
    const nestedCapsule = new AutoCapsule({
      capsule: { id: 'nested', type: CAPSULE_TYPE.card, grid: {} },
      children: [],
    })
    const sceneRootGridToken = sceneRootCapsule.buildGrid().className.split(' ').find((token) => token.startsWith('ac-grid-'))
    const nestedGridToken = nestedCapsule.buildGrid().className.split(' ').find((token) => token.startsWith('ac-grid-'))
    expect(sceneRootGridToken).toBe(nestedGridToken)
  })

  it('never sets width/height on the grid inline style — dimension is a separate class, not a grid concern', () => {
    const capsule = new AutoCapsule({
      capsule: { id: 'root', type: CAPSULE_TYPE.card, grid: {}, sceneRoot: true },
      children: [],
    })
    const grid = capsule.buildGrid()
    expect(grid.inlineStyle.width).toBeUndefined()
    expect(grid.inlineStyle.height).toBeUndefined()
  })

  it('propagates a dedicated .ac-scene-root rule (dimension, grid-area, min-width/height:0, overflow, container-type) into the resolved styleSheet', () => {
    const capsule = new AutoCapsule({
      capsule: { id: 'root', type: CAPSULE_TYPE.card, grid: {}, sceneRoot: true },
      children: [],
    })
    const result = capsule.resolve()
    expect(result.styleSheet).toContain('.ac-scene-root{width:100%;height:100%;grid-area:1/-1;min-width:0;min-height:0;overflow:hidden;container-type:size;}')
  })

  it('min-width:0/min-height:0 prevent the capsule\'s own oversized children from growing the parent grid track (and it) beyond the real container', () => {
    // CSS Grid items default to min-width/min-height:auto, refusing to shrink below their own
    // content's intrinsic size — that pushes an auto-sized parent track (ex. the demo shell's
    // `.container`, no explicit grid-template) to grow around it, defeating width:100%/height:100%
    // entirely. min-width:0/min-height:0 is what actually makes the fill bound-able.
    const capsule = new AutoCapsule({
      capsule: { id: 'root', type: CAPSULE_TYPE.card, grid: {}, sceneRoot: true },
      children: [],
    })
    const result = capsule.resolve()
    expect(result.styleSheet).toMatch(/\.ac-scene-root\{[^}]*min-width:0;[^}]*min-height:0;/)
  })

  it('grid-area:1/-1 matters when the real host container is itself display:grid — fills the whole parent area, not one auto-placed cell', () => {
    // Simulates a grid parent with no explicit template (like the demo shell's `.container`,
    // `display:grid;place-items:center`, no `grid-template-columns/rows`) — a plain
    // `width:100%;height:100%` child there only fills its own auto-placed implicit cell.
    const capsule = new AutoCapsule({
      capsule: { id: 'root', type: CAPSULE_TYPE.card, grid: {}, sceneRoot: true },
      children: [],
    })
    const result = capsule.resolve()
    expect(result.styleSheet).toMatch(/\.ac-scene-root\{[^}]*grid-area:1\/-1;/)
  })
})

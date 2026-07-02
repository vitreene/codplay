// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import type { AutoCapsuleGridArtifact } from '@codplay/capsule-automation'

import type { AuthorApi } from '../src/author-api'
import { createLibreAdapter } from '../src/adapters/libre-adapter'
import { createFlexAdapter, FLEX_POINT_ALIGNMENT } from '../src/adapters/flex-adapter'
import { createGridPlacementAdapter } from '../src/adapters/grid-placement-adapter'

function temp__createAuthorApiStub(node: Element | null): AuthorApi {
  return {
    subscribeToNode: (_persoId, cb) => {
      cb(node)
      return () => {}
    },
    subscribeToPlayerState: (cb) => {
      cb({ isPlaying: false })
      return () => {}
    },
    getPlayerState: () => ({ isPlaying: false })
  }
}

function temp__createGridArtifact(rows: number, cols: number): AutoCapsuleGridArtifact {
  return {
    className: 'grid',
    inlineStyle: {},
    cssRules: [],
    context: { rows, cols, areas: [], mode: 'fixed' }
  }
}

describe('LibreAdapter', () => {
  it('accumulates move deltas on the translate property by default', () => {
    const node = document.createElement('div')
    const adapter = createLibreAdapter({ authorApi: temp__createAuthorApiStub(node), itemId: 'a' })

    adapter.applyMove({ dx: 10, dy: 5 })
    expect(node.style.translate).toBe('10px 5px')

    adapter.applyMove({ dx: -3, dy: 7 })
    expect(node.style.translate).toBe('7px 12px')
  })

  it('mutates top/left in top-left mode', () => {
    const node = document.createElement('div')
    node.style.left = '100px'
    node.style.top = '50px'
    const adapter = createLibreAdapter({ authorApi: temp__createAuthorApiStub(node), itemId: 'a', mode: 'top-left' })

    adapter.applyMove({ dx: 20, dy: -10 })
    expect(node.style.left).toBe('120px')
    expect(node.style.top).toBe('40px')
    expect(node.style.translate).toBe('')
  })

  it('applies resize deltas onto style width/height', () => {
    const node = document.createElement('div')
    node.style.width = '200px'
    node.style.height = '100px'
    const adapter = createLibreAdapter({ authorApi: temp__createAuthorApiStub(node), itemId: 'a' })

    adapter.applyResize({ dw: 30, dh: -20 })
    expect(node.style.width).toBe('230px')
    expect(node.style.height).toBe('80px')
  })

  it('does nothing when the node is absent (suspended)', () => {
    const adapter = createLibreAdapter({ authorApi: temp__createAuthorApiStub(null), itemId: 'a' })
    expect(() => adapter.applyMove({ dx: 5, dy: 5 })).not.toThrow()
  })

  it('accumulates rotation deltas on the rotate property', () => {
    const node = document.createElement('div')
    const adapter = createLibreAdapter({ authorApi: temp__createAuthorApiStub(node), itemId: 'a' })

    adapter.applyRotate({ dr: 15 })
    expect(node.style.rotate).toBe('15deg')

    adapter.applyRotate({ dr: -5 })
    expect(node.style.rotate).toBe('10deg')
  })

  it('compensates translate when the rotation origin changes on a rotated element', () => {
    const node = document.createElement('div')
    node.style.width = '100px'
    node.style.height = '100px'
    document.body.appendChild(node)
    const adapter = createLibreAdapter({ authorApi: temp__createAuthorApiStub(node), itemId: 'a' })

    // Rotate 90° around the default center — no jump, no compensation.
    adapter.applyRotate({ dr: 90, origin: { fx: 0.5, fy: 0.5 } })
    expect(node.style.translate).toBe('')

    // Move the origin to the top-left corner: (I − R90)·(50,50) = (100, 0).
    adapter.applyRotate({ dr: 0, origin: { fx: 0, fy: 0 } })
    const parts = node.style.translate.split(/\s+/).map((part) => Number.parseFloat(part))
    expect(parts[0]).toBeCloseTo(100, 3)
    expect(parts[1]).toBeCloseTo(0, 3)

    node.remove()
  })

  it('transposes the rotation origin into transform-origin', () => {
    const node = document.createElement('div')
    const adapter = createLibreAdapter({ authorApi: temp__createAuthorApiStub(node), itemId: 'a' })

    adapter.applyRotate({ dr: 10, origin: { fx: 0, fy: 1 } })
    expect(node.style.transformOrigin).toBe('0% 100%')
    expect(node.style.rotate).toBe('10deg')

    adapter.applyRotate({ dr: 5 })
    expect(node.style.transformOrigin).toBe('0% 100%')
    expect(node.style.rotate).toBe('15deg')
  })

  it('composes scale factors on the scale property', () => {
    const node = document.createElement('div')
    const adapter = createLibreAdapter({ authorApi: temp__createAuthorApiStub(node), itemId: 'a' })

    adapter.applyScale({ fx: 2, fy: 2 })
    expect(node.style.scale).toBe('2 2')

    adapter.applyScale({ fx: 0.5, fy: 1 })
    expect(node.style.scale).toBe('1 2')
  })
})

describe('FlexAdapter', () => {
  it('maps the 11 interaction points onto align-self/justify-self', () => {
    expect(FLEX_POINT_ALIGNMENT.TL).toEqual({ alignSelf: 'start', justifySelf: 'start' })
    expect(FLEX_POINT_ALIGNMENT.C).toEqual({ alignSelf: 'center', justifySelf: 'center' })
    expect(FLEX_POINT_ALIGNMENT.BR).toEqual({ alignSelf: 'end', justifySelf: 'end' })
    expect(FLEX_POINT_ALIGNMENT['stretch-h']).toEqual({ justifySelf: 'stretch' })
    expect(FLEX_POINT_ALIGNMENT['stretch-v']).toEqual({ alignSelf: 'stretch' })
  })

  it('applies the clicked alignment onto the element', () => {
    const node = document.createElement('div')
    const applied: unknown[] = []
    const adapter = createFlexAdapter({
      authorApi: temp__createAuthorApiStub(node),
      itemId: 'a',
      onApplied: (alignment) => applied.push(alignment)
    })

    adapter.applyAlignment('TR')
    expect(node.style.alignSelf).toBe('start')
    expect(node.style.justifySelf).toBe('end')
    expect(applied).toHaveLength(1)
  })

  it('keeps the orthogonal axis untouched on stretch points', () => {
    const node = document.createElement('div')
    node.style.alignSelf = 'center'
    const adapter = createFlexAdapter({ authorApi: temp__createAuthorApiStub(node), itemId: 'a' })

    adapter.applyAlignment('stretch-h')
    expect(node.style.justifySelf).toBe('stretch')
    expect(node.style.alignSelf).toBe('center')
  })

  it('ignores raw move and resize deltas', () => {
    const node = document.createElement('div')
    const adapter = createFlexAdapter({ authorApi: temp__createAuthorApiStub(node), itemId: 'a' })

    adapter.applyMove({ dx: 50, dy: 50 })
    adapter.applyResize({ dw: 50, dh: 50 })
    expect(node.style.translate).toBe('')
    expect(node.style.width).toBe('')
  })
})

describe('GridPlacementAdapter', () => {
  it('converts pixel deltas into cell placement changes', () => {
    const placements: unknown[] = []
    const adapter = createGridPlacementAdapter({
      grid: temp__createGridArtifact(4, 4),
      getContainerSize: () => ({ width: 400, height: 400 }),
      initialPlacement: { row: 1, col: 1 },
      onPlacement: (placement) => placements.push(placement)
    })

    adapter.applyMove({ dx: 100, dy: 0 })
    expect(adapter.getPlacement()).toMatchObject({ row: 1, col: 2 })

    adapter.applyMove({ dx: 0, dy: 200 })
    expect(adapter.getPlacement()).toMatchObject({ row: 3, col: 2 })
    expect(placements).toHaveLength(2)
  })

  it('accumulates sub-cell movement until a boundary is crossed', () => {
    const adapter = createGridPlacementAdapter({
      grid: temp__createGridArtifact(4, 4),
      getContainerSize: () => ({ width: 400, height: 400 }),
      initialPlacement: { row: 1, col: 1 },
      onPlacement: () => {}
    })

    adapter.applyMove({ dx: 30, dy: 0 })
    expect(adapter.getPlacement()).toMatchObject({ col: 1 })

    adapter.applyMove({ dx: 30, dy: 0 })
    expect(adapter.getPlacement()).toMatchObject({ col: 2 })
  })

  it('clamps placement to the grid bounds', () => {
    const adapter = createGridPlacementAdapter({
      grid: temp__createGridArtifact(2, 2),
      getContainerSize: () => ({ width: 200, height: 200 }),
      initialPlacement: { row: 1, col: 1 },
      onPlacement: () => {}
    })

    adapter.applyMove({ dx: 10_000, dy: 10_000 })
    expect(adapter.getPlacement()).toMatchObject({ row: 2, col: 2 })

    adapter.applyMove({ dx: -10_000, dy: -10_000 })
    expect(adapter.getPlacement()).toMatchObject({ row: 1, col: 1 })
  })

  it('converts resize deltas into span changes within bounds', () => {
    const adapter = createGridPlacementAdapter({
      grid: temp__createGridArtifact(4, 4),
      getContainerSize: () => ({ width: 400, height: 400 }),
      initialPlacement: { row: 1, col: 1 },
      onPlacement: () => {}
    })

    adapter.applyResize({ dw: 200, dh: 100 })
    expect(adapter.getPlacement()).toMatchObject({ colSpan: 3, rowSpan: 2 })

    adapter.applyResize({ dw: 10_000, dh: 10_000 })
    expect(adapter.getPlacement()).toMatchObject({ colSpan: 4, rowSpan: 4 })
  })

  it('accumulates small continuous resize increments until a cell boundary is crossed', () => {
    const adapter = createGridPlacementAdapter({
      grid: temp__createGridArtifact(4, 4),
      getContainerSize: () => ({ width: 400, height: 400 }),
      initialPlacement: { row: 1, col: 1 },
      onPlacement: () => {}
    })

    // 60 increments of 1px: each alone rounds to 0 cells — the accumulation
    // must cross the 50px half-stride boundary (stride = 100px).
    for (let index = 0; index < 60; index += 1) {
      adapter.applyResize({ dw: 1, dh: 0 })
    }
    expect(adapter.getPlacement()).toMatchObject({ colSpan: 2 })
  })

  it('applyCellDrop lands exactly on the given cell (drop contract)', () => {
    const placements: unknown[] = []
    const adapter = createGridPlacementAdapter({
      grid: temp__createGridArtifact(4, 4),
      getContainerSize: () => ({ width: 400, height: 400 }),
      initialPlacement: { row: 1, col: 1 },
      onPlacement: (placement) => placements.push(placement)
    })

    adapter.applyCellDrop!({ row: 3, col: 4 })
    expect(adapter.getPlacement()).toMatchObject({ row: 3, col: 4 })

    // Clamped so the span stays inside the grid.
    adapter.applyCellDrop!({ row: 1, col: 1 })
    adapter.applyResize({ dw: 150, dh: 0 })
    expect(adapter.getPlacement()).toMatchObject({ colSpan: 3 })
    adapter.applyCellDrop!({ row: 1, col: 4 })
    expect(adapter.getPlacement()).toMatchObject({ row: 1, col: 2, colSpan: 3 })
    expect(placements.length).toBeGreaterThan(0)
  })

  it('accounts for gaps in cell size computation', () => {
    const adapter = createGridPlacementAdapter({
      grid: temp__createGridArtifact(2, 2),
      // 2 cols, 20px gap: cell width = (420 - 20) / 2 = 200; stride = 220
      getContainerSize: () => ({ width: 420, height: 420 }),
      gaps: { column: 20, row: 20 },
      initialPlacement: { row: 1, col: 1 },
      onPlacement: () => {}
    })

    adapter.applyMove({ dx: 100, dy: 0 })
    expect(adapter.getPlacement()).toMatchObject({ col: 1 })

    adapter.applyMove({ dx: 120, dy: 0 })
    expect(adapter.getPlacement()).toMatchObject({ col: 2 })
  })

  it('resets accumulation on resetTo', () => {
    const adapter = createGridPlacementAdapter({
      grid: temp__createGridArtifact(4, 4),
      getContainerSize: () => ({ width: 400, height: 400 }),
      initialPlacement: { row: 2, col: 2 },
      onPlacement: () => {}
    })

    adapter.applyMove({ dx: 40, dy: 0 })
    adapter.resetTo({ row: 1, col: 1 })
    adapter.applyMove({ dx: 40, dy: 0 })
    expect(adapter.getPlacement()).toMatchObject({ row: 1, col: 1 })
  })
})

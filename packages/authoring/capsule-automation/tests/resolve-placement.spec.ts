import { describe, expect, it } from 'vitest'
import { AutoCapsule, CAPSULE_TYPE } from '../src'
import type { AutoCapsuleChildInput } from '../src'

function child(id: string, order: number, extra: Partial<AutoCapsuleChildInput> = {}): AutoCapsuleChildInput {
  return { id, order, timeRange: { startMs: 0, endMs: 1000 }, ...extra }
}

describe('resolveAutoCapsulePlacement', () => {
  it('places explicit row/col/rowSpan/colSpan on a manual grid', () => {
    const capsule = new AutoCapsule({
      capsule: { id: 'c', type: CAPSULE_TYPE.grille, grid: { rows: 4, cols: 4 } },
      children: [child('a', 1, { placement: { row: 2, col: 3, rowSpan: 1, colSpan: 2 } })],
    })
    const result = capsule.resolve()
    expect(result.children[0]!.placement.gridRow).toBe('2 / span 1')
    expect(result.children[0]!.placement.gridColumn).toBe('3 / span 2')
    expect(result.children[0]!.meta.usedAutoPlacement).toBe(false)
  })

  it('resolves an explicit area reference without generating a CSS rule', () => {
    const capsule = new AutoCapsule({
      capsule: { id: 'c', type: CAPSULE_TYPE.card, grid: {} },
      children: [child('a', 1, { placement: { area: 'title' } })],
    })
    const result = capsule.resolve()
    expect(result.children[0]!.placement.areaClassName).toBe('title')
    expect(result.children[0]!.placement.cssRules).toEqual([])
  })

  it('auto-places children sequentially onto a manual grid when the policy allows it (grille = mixed)', () => {
    const capsule = new AutoCapsule({
      capsule: { id: 'c', type: CAPSULE_TYPE.grille, grid: { rows: 2, cols: 2 } },
      children: [child('a', 1), child('b', 2), child('c', 3)],
    })
    const result = capsule.resolve()
    expect(result.children.map((c) => c.placement.gridRow)).toEqual(['1 / span 1', '1 / span 1', '2 / span 1'])
    expect(result.children.map((c) => c.placement.gridColumn)).toEqual(['1 / span 1', '2 / span 1', '1 / span 1'])
    expect(result.children.every((c) => c.meta.usedAutoPlacement)).toBe(true)
  })

  it('places children one per row for liste, ignoring the grid dimensions', () => {
    const capsule = new AutoCapsule({
      capsule: { id: 'c', type: CAPSULE_TYPE.liste, grid: {} },
      children: [child('a', 1), child('b', 2)],
    })
    const result = capsule.resolve()
    expect(result.children[0]!.placement.areaClassName).toBe('ac-list-r1')
    expect(result.children[1]!.placement.areaClassName).toBe('ac-list-r2')
  })

  it('resolves a card child left without any placement (explicitOnly policy) to the full-surface ghost zone', () => {
    // §3/§11 (`2026-07-08-capsule-spec.md`) — declarative, automatic for ANY explicitOnly type,
    // no caller-side type-literal branching needed for this: previously an empty placement +
    // warning, requiring the ed2 Builder to special-case `card` itself and apply the ghost zone
    // by hand (`setChildPlacement`) — moved here so it happens by construction instead.
    const capsule = new AutoCapsule({
      capsule: { id: 'c', type: CAPSULE_TYPE.card, grid: { rows: 9, cols: 16 } },
      children: [child('a', 1)],
    })
    const result = capsule.resolve()
    expect(result.children[0]!.placement.gridRow).toBe('1 / span 9')
    expect(result.children[0]!.placement.gridColumn).toBe('1 / span 16')
    expect(result.children[0]!.meta.usedAutoPlacement).toBe(true)
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'placement-ghost-zone-applied', childId: 'a' }),
    )
  })
})

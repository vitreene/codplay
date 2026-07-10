import { describe, expect, it } from 'vitest'

import {
  MAX_GAP_ROWS_COLS_FOR_CSS_GAP,
  addZone,
  adjustFineGridForReservedTracks,
  breakContainer,
  divideZone,
  listAllZoneNames,
  mergeZones,
  removeZone,
  renameZone,
  resizeContainerAxis,
  validateZoneGridModel,
} from '../src/zone-model'
import type { ZoneEditorState } from '../src/zone-model'

function baseState(rows = 9, cols = 16): ZoneEditorState {
  return { grid: { rows, cols }, zones: [] }
}

describe('validateZoneGridModel', () => {
  it('allows a gap on a coarse grid', () => {
    expect(validateZoneGridModel({ rows: 4, cols: 4, gap: { row: 8, col: 8 } })).toEqual([])
  })

  it('flags a gap on a fine grid (either axis past the threshold)', () => {
    const errors = validateZoneGridModel({ rows: MAX_GAP_ROWS_COLS_FOR_CSS_GAP + 1, cols: 4, gap: { row: 4, col: 4 } })
    expect(errors).toEqual([expect.objectContaining({ code: 'ZONE_GRID_GAP_NOT_ALLOWED_ON_FINE_GRID' })])
  })

  it('allows no gap at all, regardless of grid size', () => {
    expect(validateZoneGridModel({ rows: 160, cols: 90 })).toEqual([])
  })
})

describe('addZone / removeZone / renameZone', () => {
  it('defaults an unnamed zone to the first free z{n}, with a freshly generated id', () => {
    const state = addZone(baseState(), { row: 1, col: 1, rowSpan: 1, colSpan: 1 })
    expect(state.zones).toEqual([{ id: expect.any(String), name: 'z1', row: 1, col: 1, rowSpan: 1, colSpan: 1 }])
  })

  it('skips over an explicitly-used name when auto-naming the next zone', () => {
    let state = addZone(baseState(), { row: 1, col: 1, rowSpan: 1, colSpan: 1 }, 'z1')
    state = addZone(state, { row: 2, col: 1, rowSpan: 1, colSpan: 1 })
    expect(state.zones.map((z) => z.name)).toEqual(['z1', 'z2'])
  })

  it('rejects adding a zone whose name already exists', () => {
    const state = addZone(baseState(), { row: 1, col: 1, rowSpan: 1, colSpan: 1 }, 'a')
    expect(() => addZone(state, { row: 2, col: 1, rowSpan: 1, colSpan: 1 }, 'a')).toThrow()
  })

  it('allows two zones to overlap — no placement uniqueness constraint', () => {
    let state = addZone(baseState(), { row: 1, col: 1, rowSpan: 2, colSpan: 2 }, 'a')
    state = addZone(state, { row: 1, col: 1, rowSpan: 2, colSpan: 2 }, 'b')
    expect(state.zones).toHaveLength(2)
  })

  it('generates distinct ids for successive zones', () => {
    let state = addZone(baseState(), { row: 1, col: 1, rowSpan: 1, colSpan: 1 }, 'a')
    state = addZone(state, { row: 2, col: 1, rowSpan: 1, colSpan: 1 }, 'b')
    const [a, b] = state.zones
    expect(a!.id).not.toBe(b!.id)
  })

  it('removes a zone by name', () => {
    const state = addZone(baseState(), { row: 1, col: 1, rowSpan: 1, colSpan: 1 }, 'a')
    expect(removeZone(state, 'a').zones).toEqual([])
  })

  it('renames a zone, rejecting a collision with an existing name, without changing its id', () => {
    let state = addZone(baseState(), { row: 1, col: 1, rowSpan: 1, colSpan: 1 }, 'a')
    state = addZone(state, { row: 2, col: 1, rowSpan: 1, colSpan: 1 }, 'b')
    const originalId = state.zones[0]!.id
    const renamed = renameZone(state, 'a', 'titre')
    expect(renamed.zones.map((z) => z.name)).toEqual(['titre', 'b'])
    expect(renamed.zones.find((z) => z.name === 'titre')!.id).toBe(originalId)
    expect(() => renameZone(state, 'a', 'b')).toThrow()
  })
})

describe('divideZone — "diviser en 2" is the founding signal', () => {
  it('the SAME zone gains `container` — never removed from `zones`, never a new entry', () => {
    const state = addZone(baseState(), { row: 1, col: 1, rowSpan: 4, colSpan: 6 }, 'z1')
    const originalId = state.zones[0]!.id
    const next = divideZone(state, 'z1')
    expect(next.zones).toHaveLength(1)
    expect(next.zones[0]).toMatchObject({ id: originalId, name: 'z1', row: 1, col: 1, rowSpan: 4, colSpan: 6 })
  })

  it('defaults to a vertical split (axis "col", 2 columns) when no axis is given', () => {
    const state = addZone(baseState(), { row: 1, col: 1, rowSpan: 4, colSpan: 6 }, 'z1')
    const next = divideZone(state, 'z1')
    const zone = next.zones.find((z) => z.name === 'z1')!
    expect(zone.container!.grid).toEqual({ rows: 1, cols: 2 })
    expect(zone.container!.children).toHaveLength(2)
  })

  it('splits on the row axis when explicitly requested', () => {
    const state = addZone(baseState(), { row: 1, col: 1, rowSpan: 4, colSpan: 6 }, 'z1')
    const next = divideZone(state, 'z1', 'row')
    const zone = next.zones.find((z) => z.name === 'z1')!
    expect(zone.container!.grid).toEqual({ rows: 2, cols: 1 })
    expect(zone.container!.children.map((c) => ({ row: c.row, col: c.col }))).toEqual([
      { row: 1, col: 1 },
      { row: 2, col: 1 },
    ])
  })

  it('rejects dividing a zone that does not exist', () => {
    expect(() => divideZone(baseState(), 'nope')).toThrow()
  })

  it('rejects dividing a zone that already carries a container', () => {
    const state = addZone(baseState(), { row: 1, col: 1, rowSpan: 1, colSpan: 2 }, 'z1')
    const divided = divideZone(state, 'z1')
    expect(() => divideZone(divided, 'z1')).toThrow()
  })

  it('every id in the resulting state (zone and its 2 children) is distinct', () => {
    const state = addZone(baseState(), { row: 1, col: 1, rowSpan: 1, colSpan: 2 }, 'z1')
    const next = divideZone(state, 'z1')
    const zone = next.zones.find((z) => z.name === 'z1')!
    const ids = [zone.id, ...zone.container!.children.map((c) => c.id)]
    expect(new Set(ids).size).toBe(3)
  })
})

describe('resizeContainerAxis — "les zones-enfants correspondent aux cellules d\'une grille"', () => {
  function dividedState(): ZoneEditorState {
    const state = addZone(baseState(), { row: 1, col: 1, rowSpan: 1, colSpan: 6 }, 'z1')
    return divideZone(state, 'z1')
  }

  it('growing an axis regenerates children to exactly match the new rows×cols — one 1×1 cell per position', () => {
    const next = resizeContainerAxis(dividedState(), 'z1', 'col', 4)
    const zone = next.zones.find((z) => z.name === 'z1')!
    expect(zone.container!.grid).toEqual({ rows: 1, cols: 4 })
    expect(zone.container!.children).toHaveLength(4)
    expect(zone.container!.children.map((c) => ({ row: c.row, col: c.col, rowSpan: c.rowSpan, colSpan: c.colSpan })).sort((a, b) => a.col - b.col)).toEqual([
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 4, rowSpan: 1, colSpan: 1 },
    ])
  })

  it('cells that already existed keep their own id — an attachment survives', () => {
    const before = dividedState()
    const idsBefore = before.zones.find((z) => z.name === 'z1')!.container!.children.map((c) => ({ pos: `${c.row}.${c.col}`, id: c.id }))
    const after = resizeContainerAxis(before, 'z1', 'col', 3)
    const idsAfter = after.zones.find((z) => z.name === 'z1')!.container!.children.map((c) => ({ pos: `${c.row}.${c.col}`, id: c.id }))
    for (const cell of idsBefore) {
      expect(idsAfter.find((c) => c.pos === cell.pos)?.id).toBe(cell.id)
    }
  })

  it('shrinking an axis simply drops the cells that no longer exist — no rejection', () => {
    const grown = resizeContainerAxis(dividedState(), 'z1', 'col', 4)
    const shrunk = resizeContainerAxis(grown, 'z1', 'col', 2)
    const zone = shrunk.zones.find((z) => z.name === 'z1')!
    expect(zone.container!.grid).toEqual({ rows: 1, cols: 2 })
    expect(zone.container!.children).toHaveLength(2)
  })

  it('rejects a count below the divider\'s own floor of 2', () => {
    expect(() => resizeContainerAxis(dividedState(), 'z1', 'col', 1)).toThrow()
  })

  it('rejects resizing a zone that does not carry a container', () => {
    const state = addZone(baseState(), { row: 1, col: 1, rowSpan: 1, colSpan: 2 }, 'z1')
    expect(() => resizeContainerAxis(state, 'z1', 'col', 3)).toThrow()
  })

  it('resizing the OTHER axis regenerates the full 2D cell grid (rows × cols)', () => {
    const next = resizeContainerAxis(dividedState(), 'z1', 'row', 2)
    const zone = next.zones.find((z) => z.name === 'z1')!
    expect(zone.container!.grid).toEqual({ rows: 2, cols: 2 })
    expect(zone.container!.children).toHaveLength(4)
  })
})

describe('breakContainer', () => {
  it('the SOURCE zone (carrying container) is removed from zones, replaced by one ZoneDef per child', () => {
    const state = addZone(baseState(), { row: 3, col: 1, rowSpan: 1, colSpan: 6 }, 'z1')
    const divided = divideZone(state, 'z1')
    const { state: broken, createdNames } = breakContainer(divided, 'z1')

    expect(broken.zones.some((z) => z.name === 'z1')).toBe(false)
    expect(createdNames).toEqual(['z1.1.1', 'z1.1.2'])
    const [a, b] = [...broken.zones].sort((x, y) => x.col - y.col)
    expect(a).toMatchObject({ name: 'z1.1.1', row: 3, col: 1, rowSpan: 1, colSpan: 3 })
    expect(b).toMatchObject({ name: 'z1.1.2', row: 3, col: 4, rowSpan: 1, colSpan: 3 })
  })

  it('preserves each child\'s own id across the break — an existing attachment would survive', () => {
    const state = addZone(baseState(), { row: 1, col: 1, rowSpan: 1, colSpan: 4 }, 'z1')
    const divided = divideZone(state, 'z1')
    const sourceId = divided.zones.find((z) => z.name === 'z1')!.id
    const childIds = divided.zones.find((z) => z.name === 'z1')!.container!.children.map((c) => c.id)

    const { state: broken } = breakContainer(divided, 'z1')
    expect(broken.zones.map((z) => z.id).sort()).toEqual([...childIds].sort())
    expect(broken.zones.some((z) => z.id === sourceId)).toBe(false)
  })

  it('breaks only ONE divided zone, never applied in bulk', () => {
    let state = addZone(baseState(), { row: 1, col: 1, rowSpan: 1, colSpan: 2 }, 'a')
    state = addZone(state, { row: 2, col: 1, rowSpan: 1, colSpan: 2 }, 'b')
    state = divideZone(state, 'a')
    state = divideZone(state, 'b')
    expect(state.zones.filter((z) => z.container)).toHaveLength(2)

    const { state: next } = breakContainer(state, 'a')
    expect(next.zones.filter((z) => z.container)).toHaveLength(1)
    expect(next.zones.find((z) => z.container)!.name).toBe('b')
  })

  it('rejects breaking a zone that does not carry a container', () => {
    expect(() => breakContainer(baseState(), 'nope')).toThrow()
  })
})

describe('listAllZoneNames', () => {
  it('lists zones and container children together, distinguishing their kind', () => {
    let state = addZone(baseState(), { row: 1, col: 1, rowSpan: 1, colSpan: 1 }, 'a')
    state = addZone(state, { row: 2, col: 1, rowSpan: 1, colSpan: 4 }, 'z1')
    const divided = divideZone(state, 'z1')
    const containerId = divided.zones.find((z) => z.name === 'z1')!.id

    const listed = listAllZoneNames(divided)
    expect(listed).toHaveLength(4) // 'a' (leaf) + 'z1' (leaf, carries container) + 2 children
    expect(listed.filter((z) => z.kind === 'leaf').map((z) => z.name).sort()).toEqual(['a', 'z1'])
    const children = listed.filter((z) => z.kind === 'container-child')
    expect(children).toHaveLength(2)
    expect(children.every((z) => z.containerId === containerId)).toBe(true)
    expect(children.map((z) => z.name)).toEqual(['z1.1.1', 'z1.1.2'])
  })

  it('returns an empty list for an empty state', () => {
    expect(listAllZoneNames(baseState())).toEqual([])
  })
})

describe('mergeZones — bounding footprint (plan\'s own definition)', () => {
  it('merges 2 non-adjacent zones into their bounding box, removing the sources, inheriting the first zone\'s own id', () => {
    let state = addZone(baseState(), { row: 1, col: 1, rowSpan: 1, colSpan: 1 }, 'a')
    state = addZone(state, { row: 3, col: 4, rowSpan: 2, colSpan: 2 }, 'b')
    const firstId = state.zones[0]!.id

    const { state: next, mergedName } = mergeZones(state, ['a', 'b'])
    expect(mergedName).toBe('a')
    expect(next.zones).toEqual([{ id: firstId, name: 'a', row: 1, col: 1, rowSpan: 4, colSpan: 5 }])
  })

  it('accepts an explicit name for the merged zone, overriding the first-selected default', () => {
    let state = addZone(baseState(), { row: 1, col: 1, rowSpan: 1, colSpan: 1 }, 'a')
    state = addZone(state, { row: 2, col: 2, rowSpan: 1, colSpan: 1 }, 'b')
    const { mergedName } = mergeZones(state, ['a', 'b'], 'fusion')
    expect(mergedName).toBe('fusion')
  })

  it('rejects merging fewer than 2 zones', () => {
    const state = addZone(baseState(), { row: 1, col: 1, rowSpan: 1, colSpan: 1 }, 'a')
    expect(() => mergeZones(state, ['a'])).toThrow()
  })

  it('rejects merging a zone that carries a container — never silently drops its division structure', () => {
    let state = addZone(baseState(), { row: 1, col: 1, rowSpan: 1, colSpan: 2 }, 'a')
    state = addZone(state, { row: 2, col: 1, rowSpan: 1, colSpan: 2 }, 'b')
    state = divideZone(state, 'a')
    expect(() => mergeZones(state, ['a', 'b'])).toThrow()
  })
})

describe('adjustFineGridForReservedTracks — the plan\'s own worked example (160 cells, 16 macro-cells, step 10)', () => {
  it('16 macro-cells at step 10 with 1-unit reserved gaps between each does not fit in 160 (175 > 160) — picks the nearest that does', () => {
    const result = adjustFineGridForReservedTracks({ maxFineTracks: 160, stepSize: 10, reservedGapUnits: 1, preferredMacroCount: 16 })
    // 16 -> 16*10 + 15*1 = 175 > 160 (rejected); 14 -> 140+13=153 <= 160; 15 -> 150+14=164 > 160
    expect(result).toEqual({ macroCount: 14, fineTrackCount: 153 })
  })

  it('no reserved gap needed: fineTrackCount is exactly macroCount * stepSize', () => {
    const result = adjustFineGridForReservedTracks({ maxFineTracks: 160, stepSize: 10, reservedGapUnits: 0, preferredMacroCount: 16 })
    expect(result).toEqual({ macroCount: 16, fineTrackCount: 160 })
  })
})

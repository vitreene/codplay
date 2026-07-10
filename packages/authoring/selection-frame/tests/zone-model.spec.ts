import { describe, expect, it } from 'vitest'

import {
  MAX_GAP_ROWS_COLS_FOR_CSS_GAP,
  addZone,
  adjustFineGridForReservedTracks,
  getSplitOptions,
  mergeZones,
  removeZone,
  renameZone,
  splitZone,
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
  it('defaults an unnamed zone to the first free z{n}', () => {
    const state = addZone(baseState(), { row: 1, col: 1, rowSpan: 1, colSpan: 1 })
    expect(state.zones).toEqual([{ name: 'z1', row: 1, col: 1, rowSpan: 1, colSpan: 1 }])
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

  it('removes a zone by name', () => {
    const state = addZone(baseState(), { row: 1, col: 1, rowSpan: 1, colSpan: 1 }, 'a')
    expect(removeZone(state, 'a').zones).toEqual([])
  })

  it('renames a zone, rejecting a collision with an existing name', () => {
    let state = addZone(baseState(), { row: 1, col: 1, rowSpan: 1, colSpan: 1 }, 'a')
    state = addZone(state, { row: 2, col: 1, rowSpan: 1, colSpan: 1 }, 'b')
    expect(renameZone(state, 'a', 'titre').zones.map((z) => z.name)).toEqual(['titre', 'b'])
    expect(() => renameZone(state, 'a', 'b')).toThrow()
  })
})

describe('getSplitOptions / splitZone — the plan\'s own worked example (6-track span)', () => {
  it('a 6-span zone with no fake gap offers exactly 1, 2, 3, 6 (integer divisors)', () => {
    const state = addZone(baseState(), { row: 1, col: 1, rowSpan: 1, colSpan: 6 }, 'z3')
    expect(getSplitOptions(state, 'z3').cols).toEqual([1, 2, 3, 6])
  })

  it('splitting that 6-span zone 2x3 (no fake gap) produces 6 equal 1x2-wide children named z3-1..z3-6', () => {
    const state = addZone(baseState(), { row: 1, col: 1, rowSpan: 2, colSpan: 6 }, 'z3')
    const { state: next, createdNames } = splitZone(state, 'z3', { rows: 2, cols: 3 })
    expect(createdNames).toEqual(['z3-1', 'z3-2', 'z3-3', 'z3-4', 'z3-5', 'z3-6'])
    expect(next.zones.every((z) => z.rowSpan === 1 && z.colSpan === 2)).toBe(true)
    expect(next.zones.find((z) => z.name === 'z3')).toBeUndefined()
  })

  it('a fake gap of 1 excludes split counts that would break equal integer parts', () => {
    // span=6, gapUnits=1: n=1 -> 6/1 ok; n=2 -> (6-1)/2=2.5 not ok; n=3 -> (6-2)/3=4/3 not ok
    const state = addZone(baseState(), { row: 1, col: 1, rowSpan: 1, colSpan: 6 }, 'z1')
    state.grid.fakeGapUnits = 1
    expect(getSplitOptions(state, 'z1').cols).toEqual([1])
  })

  it('a fake gap that DOES divide evenly is offered and produces the expected constant-gap layout', () => {
    // span=7, gapUnits=1, n=3: (7-2)/3 = 5/3 -> not valid; n=2: (7-1)/2=3 -> valid (parts of 3, gap of 1 between)
    const state: ZoneEditorState = { grid: { rows: 1, cols: 7, fakeGapUnits: 1 }, zones: [{ name: 'z1', row: 1, col: 1, rowSpan: 1, colSpan: 7 }] }
    expect(getSplitOptions(state, 'z1').cols).toContain(2)

    const { state: next } = splitZone(state, 'z1', { cols: 2 })
    const [a, b] = [...next.zones].sort((x, y) => x.col - y.col)
    expect(a).toMatchObject({ col: 1, colSpan: 3 })
    expect(b).toMatchObject({ col: 5, colSpan: 3 }) // col 1 + span 3 + gap 1 = 5
  })

  it('rejects a split that does not divide the span into equal integer parts', () => {
    const state = addZone(baseState(), { row: 1, col: 1, rowSpan: 1, colSpan: 5 }, 'z1')
    expect(() => splitZone(state, 'z1', { cols: 3 })).toThrow()
  })

  it('splitting only one axis (the other omitted) leaves that axis whole', () => {
    const state = addZone(baseState(), { row: 1, col: 1, rowSpan: 4, colSpan: 6 }, 'z1')
    const { createdNames, state: next } = splitZone(state, 'z1', { cols: 2 })
    expect(createdNames).toHaveLength(2)
    expect(next.zones.every((z) => z.rowSpan === 4)).toBe(true)
  })
})

describe('mergeZones — bounding footprint (plan\'s own definition)', () => {
  it('merges 2 non-adjacent zones into their bounding box, removing the sources', () => {
    let state = addZone(baseState(), { row: 1, col: 1, rowSpan: 1, colSpan: 1 }, 'a')
    state = addZone(state, { row: 3, col: 4, rowSpan: 2, colSpan: 2 }, 'b')

    const { state: next, mergedName } = mergeZones(state, ['a', 'b'])
    expect(mergedName).toBe('a')
    expect(next.zones).toEqual([{ name: 'a', row: 1, col: 1, rowSpan: 4, colSpan: 5 }])
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

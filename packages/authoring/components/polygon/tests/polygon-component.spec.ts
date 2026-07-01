import { describe, expect, it } from 'vitest'
import { createPolygonVertices, normalizePolygonShapeState, resolveMorphPathString, resolvePolygonPathString } from '../src/polygon-geometry.js'

describe('normalizePolygonShapeState', () => {
  it('clamps and normalizes authored polygon values', () => {
    expect(normalizePolygonShapeState({ sides: 2, outer: -3, inner: 999, rotationDeg: 45 })).toEqual({
      sides: 3,
      outer: 1,
      inner: 1,
      rotationDeg: 45,
      inflexion: [0, 0, 0],
    })
  })

  it('expands a scalar inflexion to one value per segment', () => {
    const state = normalizePolygonShapeState({ sides: 4, inflexion: 5 })
    expect(state.inflexion).toEqual([5, 5, 5, 5])
  })

  it('maps an array inflexion to segments, filling missing entries with 0', () => {
    const state = normalizePolygonShapeState({ sides: 4, inflexion: [10, -5] })
    expect(state.inflexion).toEqual([10, -5, 0, 0])
  })

  it('uses twice as many segments for a star', () => {
    const state = normalizePolygonShapeState({ sides: 5, inner: 20, outer: 40, inflexion: 3 })
    expect(state.inflexion).toHaveLength(10)
  })
})

describe('createPolygonVertices', () => {
  it('creates one regular polygon when inner is absent', () => {
    expect(createPolygonVertices(normalizePolygonShapeState({ sides: 5, outer: 40 }))).toHaveLength(5)
  })

  it('creates one star when inner is smaller than outer', () => {
    expect(createPolygonVertices(normalizePolygonShapeState({ sides: 5, inner: 20, outer: 40 }))).toHaveLength(10)
  })
})

describe('polygon path serialization', () => {
  it('serializes one straight-segment shape to an SVG path string', () => {
    const d = resolvePolygonPathString({ sides: 3, outer: 40 })
    expect(d).toMatch(/^M /)
    expect(d).toContain('L ')
    expect(d).toContain('Z')
  })

  it('serializes one arc-segment shape using SVG arc commands', () => {
    const d = resolvePolygonPathString({ sides: 3, outer: 40, inflexion: 5 })
    expect(d).toMatch(/^M /)
    expect(d).toContain('A ')
    expect(d).toContain('Z')
  })

  it('serializes one morph interpolation as a straight-segment path', () => {
    const d = resolveMorphPathString({
      from: { sides: 3, outer: 40 },
      to: { sides: 5, inner: 20, outer: 40 },
      progress: 0.5,
    })
    expect(d).toMatch(/^M /)
    expect(d).toContain('L ')
    expect(d).toContain('Z')
  })
})

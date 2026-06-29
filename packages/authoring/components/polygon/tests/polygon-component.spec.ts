import { describe, expect, it } from 'vitest'
import { createPolygonVertices, normalizePolygonShapeState, resolveMorphPointsString, resolvePolygonPointsString } from '../src/polygon-geometry.js'

describe('normalizePolygonShapeState', () => {
  it('clamps and normalizes authored polygon values', () => {
    expect(normalizePolygonShapeState({ sides: 2, outer: -3, inner: 999, rotationDeg: 45 })).toEqual({
      sides: 3,
      outer: 1,
      inner: 1,
      rotationDeg: 45,
    })
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

describe('polygon points serialization', () => {
  it('serializes one static shape to an SVG points string', () => {
    expect(resolvePolygonPointsString({ sides: 3, outer: 40 })).toContain(',')
  })

  it('serializes one morph interpolation between two shapes', () => {
    expect(resolveMorphPointsString({
      from: { sides: 3, outer: 40 },
      to: { sides: 5, inner: 20, outer: 40 },
      progress: 0.5,
    })).toContain(',')
  })
})

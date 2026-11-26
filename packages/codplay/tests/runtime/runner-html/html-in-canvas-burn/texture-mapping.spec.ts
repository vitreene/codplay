import { describe, expect, it } from 'vitest'
import {
  getCanvasViewGeometry,
  getDrawableTextureMapping,
  getNativeMediaTextureMapping,
} from '../../../../src/runtime/runner-html/replace-presentation/html-in-canvas-burn/texture-mapping'

describe('H-i-C texture geometry', () => {
  it('aligns the support while keeping the view at its original fractional position', () => {
    const geometry = getCanvasViewGeometry(
      { left: 10.125, top: 20.375, width: 100.5, height: 80.25 }, 100.5, 80.25, 2,
    )
    expect(geometry).toMatchObject({ left: -0.125, top: -0.375, width: 202, height: 162, cssWidth: 101, cssHeight: 81 })
    expect(geometry.mapping[0] + (0.125 / 101) * geometry.mapping[2]).toBeCloseTo(0, 12)
    expect(geometry.mapping[0] + (100.625 / 101) * geometry.mapping[2]).toBeCloseTo(1, 12)
  })

  it('retains the view under a scaled parent and negative screen coordinates', () => {
    const geometry = getCanvasViewGeometry(
      { left: -0.25, top: 10.5, width: 201, height: 160.5 }, 100.5, 80.25, 2,
    )
    expect(geometry.left).toBe(-0.125)
    expect(geometry.top).toBe(0)
    expect((-0.25 + geometry.left * 2) * 2).toBe(-1)
    expect(geometry.cssWidth).toBe(100.75)
    expect(geometry.width).toBe(403)
  })

  it('preserves a fractional cover crop without rounding a viewport', () => {
    getNativeMediaTextureMapping(200, 100, 100.5, 100, 'cover').forEach((value, index) => {
      expect(value).toBeCloseTo([0.24875, 0, 0.5025, 1][index]!, 12)
    })
  })

  it('centers a contained native image with transparent space above and below', () => {
    const [x, y, width, height] = getNativeMediaTextureMapping(200, 100, 100.5, 100, 'contain')
    expect(x).toBeCloseTo(0, 12)
    expect(width).toBeCloseTo(1, 12)
    expect(y).toBeCloseTo(-24.875 / 50.25, 12)
    expect(height).toBeCloseTo(100 / 50.25, 12)
    expect(y + height / 2).toBeCloseTo(0.5, 12)
  })

  it('maps fill to the full native texture at fractional CSS dimensions', () => {
    getNativeMediaTextureMapping(200, 100, 100.5, 80.25, 'fill').forEach((value, index) => {
      expect(value).toBeCloseTo([0, 0, 1, 1][index]!, 12)
    })
  })

  it('excludes the padded lower row after the drawable upload is flipped vertically', () => {
    const [x, y, width, height] = getDrawableTextureMapping(465, 425.0000305, 465, 426)
    expect(x).toBe(0)
    expect(width).toBe(1)
    expect(y).toBeCloseTo(0.9999695 / 426, 12)
    expect(height).toBeCloseTo(425.0000305 / 426, 12)
    expect(y + height).toBeCloseTo(1, 12)
  })

  it('leaves an exactly allocated drawable unchanged', () => {
    expect(getDrawableTextureMapping(320, 240, 320, 240)).toEqual([0, 0, 1, 1])
  })
})

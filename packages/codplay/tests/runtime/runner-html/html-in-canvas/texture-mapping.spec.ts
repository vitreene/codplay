import { describe, expect, it } from 'vitest'
import {
  getCanvasViewGeometry,
  getDrawableTextureMap,
  getNativeMediaTextureMap,
} from '../../../../src/runtime/runner-html/replace-presentation/html-in-canvas/texture-mapping'

describe('HTML-in-Canvas texture geometry', () => {
  it('aligns the support while keeping the view at its original fractional position', () => {
    const geometry = getCanvasViewGeometry(
      { left: 10.125, top: 20.375, width: 100.5, height: 80.25 }, 100.5, 80.25, 2,
    )
    expect(geometry).toMatchObject({ left: -0.125, top: -0.375, width: 202, height: 162, cssWidth: 101, cssHeight: 81 })
    // view = mapping.xy + canvas * mapping.zw, with a top-left origin on both sides.
    expect(geometry.mapping[0] + (0.125 / 101) * geometry.mapping[2]).toBeCloseTo(0, 12)
    expect(geometry.mapping[0] + (100.625 / 101) * geometry.mapping[2]).toBeCloseTo(1, 12)
    expect(geometry.mapping[1] + (0.375 / 81) * geometry.mapping[3]).toBeCloseTo(0, 12)
    expect(geometry.mapping[1] + (80.625 / 81) * geometry.mapping[3]).toBeCloseTo(1, 12)
  })

  it('retains the view under a scaled parent and negative screen coordinates', () => {
    const geometry = getCanvasViewGeometry(
      { left: -0.25, top: 10.5, width: 201, height: 160.5 }, 100.5, 80.25, 2,
    )
    expect(geometry.left).toBe(-0.125)
    expect(geometry.top).toBe(0)
    expect(geometry.cssWidth).toBe(100.75)
    expect(geometry.width).toBe(403)
  })

  it('samples only the fractional drawable image inside its whole-texel allocation', () => {
    const [x, y, width, height] = getDrawableTextureMap(465, 425.0000305, 465, 426)
    expect([x, y, width]).toEqual([0, 0, 1])
    expect(height).toBeCloseTo(425.0000305 / 426, 12)
    expect(getDrawableTextureMap(320, 240, 320, 240)).toEqual([0, 0, 1, 1])
  })

  it('frames a native outgoing frame like its CSS object-fit', () => {
    getNativeMediaTextureMap(200, 100, 100, 100, 'cover').forEach((value, index) => {
      expect(value).toBeCloseTo([0.25, 0, 0.5, 1][index]!, 12)
    })
    const [x, y, width, height] = getNativeMediaTextureMap(200, 100, 100, 100, 'contain')
    expect([x, width]).toEqual([-0, 1])
    expect(y).toBeCloseTo(-0.5, 12)
    expect(height).toBeCloseTo(2, 12)
    expect(getNativeMediaTextureMap(200, 100, 100, 100, 'fill')).toEqual([-0, -0, 1, 1])
  })
})

import { describe, expect, it } from 'vitest'

import { localizePose, resolveLocalProjectionMatrix } from '../../../src/runtime/flip/html-dom-projection'
import type { HtmlMatrix, HtmlPose } from '../../../src/runtime/flip/types'

const identity: HtmlMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

function pose(left: number, top: number, width: number, height: number, matrix: HtmlMatrix = identity): HtmlPose {
  const scaleX = Math.hypot(matrix.a, matrix.b)
  const scaleY = Math.hypot(matrix.c, matrix.d)
  return {
    rect: { left, top, width, height },
    origin: { x: left, y: top },
    matrix,
    parentMatrix: identity,
    rotationMatrix: identity,
    scaleX,
    scaleY,
    localWidth: width,
    localHeight: height,
    frameWidth: width * scaleX,
    frameHeight: height * scaleY,
  }
}

describe('V2 HTML DOM projection math', () => {
  it('uses the local item origin as the CSS translation after an AABB rotation', () => {
    const root = pose(10, 20, 500, 400)
    const angle = -4 * Math.PI / 180
    const target = pose(100, 120, 40, 44, {
      a: Math.cos(angle) * 1.05,
      b: Math.sin(angle) * 1.05,
      c: -Math.sin(angle) * 1.05,
      d: Math.cos(angle) * 1.05,
      e: 0,
      f: 0,
    })

    const localized = localizePose(root, target)
    const transformedTop = Math.min(0, localized.matrix.b * target.localWidth, localized.matrix.d * target.localHeight, localized.matrix.b * target.localWidth + localized.matrix.d * target.localHeight)
    const expectedTranslationY = target.rect.top - transformedTop - root.rect.top

    expect(localized.matrix.e).toBeCloseTo(localized.origin.x)
    expect(localized.matrix.f).toBeCloseTo(expectedTranslationY)
    expect(localized.matrix.f).toBeCloseTo(localized.origin.y)
  })

  it('resolves one complete local matrix for translation, rotation, and scale', () => {
    const natural = { ...pose(0, 0, 100, 50), layoutOffset: { x: 10, y: 20 } }
    const target = {
      ...pose(0, 0, 100, 50, { a: 0, b: 2, c: -3, d: 0, e: 0, f: 0 }),
      origin: { x: 100, y: 40 },
    }

    const matrix = resolveLocalProjectionMatrix(natural, target, pose(0, 0, 800, 600))

    expect(matrix.a).toBeCloseTo(0)
    expect(matrix.b).toBeCloseTo(2)
    expect(matrix.c).toBeCloseTo(-3)
    expect(matrix.d).toBeCloseTo(0)
    expect(matrix.e).toBeCloseTo(90)
    expect(matrix.f).toBeCloseTo(20)
  })

  it('keeps size interpolation out of the local transform matrix', () => {
    const natural = pose(0, 0, 100, 50)
    const target = pose(120, 80, 200, 100)

    const matrix = resolveLocalProjectionMatrix(natural, target, undefined)

    expect(matrix.a).toBeCloseTo(1)
    expect(matrix.d).toBeCloseTo(1)
    expect(matrix.e).toBeCloseTo(120)
    expect(matrix.f).toBeCloseTo(80)
  })

})

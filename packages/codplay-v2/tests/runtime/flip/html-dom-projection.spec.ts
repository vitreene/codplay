import { describe, expect, it } from 'vitest'

import { localizePose } from '../../../src/runtime/flip/html-dom-projection'
import type { HtmlMatrix, HtmlPose } from '../../../src/runtime/flip/types'

const identity: HtmlMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

function pose(left: number, top: number, width: number, height: number, matrix: HtmlMatrix = identity): HtmlPose {
  const scaleX = Math.hypot(matrix.a, matrix.b)
  const scaleY = Math.hypot(matrix.c, matrix.d)
  return {
    rect: { left, top, width, height },
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
})

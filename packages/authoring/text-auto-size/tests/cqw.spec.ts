import { describe, expect, it } from 'vitest'
import { cqwToPx, pxToCqw } from '../src/core/cqw'

describe('cqw conversion (§3.3, §4)', () => {
  it('convertit px vers cqw par règle de 3', () => {
    expect(pxToCqw(192, 1920)).toBeCloseTo(10)
  })

  it('convertit cqw vers px par règle de 3', () => {
    expect(cqwToPx(10, 1920)).toBeCloseTo(192)
  })

  it('fait un aller-retour cohérent quelle que soit la référence', () => {
    const px = 37.5
    const referenceWidthPx = 1080
    expect(cqwToPx(pxToCqw(px, referenceWidthPx), referenceWidthPx)).toBeCloseTo(px)
  })
})

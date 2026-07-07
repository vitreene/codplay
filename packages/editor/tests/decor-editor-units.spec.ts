import { describe, it, expect } from 'vitest'
import { pxToCqw, cqwToPx } from '../src/decor-editor/units'

describe('pxToCqw / cqwToPx', () => {
  it('convertit px → cqw relatif à la largeur du conteneur', () => {
    expect(pxToCqw(100, 1000)).toBeCloseTo(10)
  })

  it('convertit cqw → px relatif à la largeur du conteneur', () => {
    expect(cqwToPx(10, 1000)).toBeCloseTo(100)
  })

  it('aller-retour px → cqw → px restitue la valeur d\'origine', () => {
    const containerWidthPx = 743
    const original = 128
    const roundTrip = cqwToPx(pxToCqw(original, containerWidthPx), containerWidthPx)
    expect(roundTrip).toBeCloseTo(original)
  })

  it('100% de la largeur du conteneur = 100 cqw', () => {
    expect(pxToCqw(500, 500)).toBeCloseTo(100)
  })
})

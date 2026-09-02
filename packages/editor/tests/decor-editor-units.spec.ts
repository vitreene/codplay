import { describe, it, expect } from 'vitest'
import { offsetPatchToValuesPx, offsetValuesPxToPatch, pxToCqw, cqwToPx } from '../src/decor-editor/units'

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

  it('projette une valeur complète du cadre vers le vocabulaire offset unitless', () => {
    expect(offsetValuesPxToPatch({ x: 80, y: 40, width: 160, height: 96, rotate: 12, scaleX: 1.2, scaleY: 0.8, rotationOrigin: { fx: 0.25, fy: 0.75 } }, 800)).toEqual({
      translate: { x: 10, y: 5 },
      width: 20,
      height: 12,
      rotate: 12,
      scale: { x: 1.2, y: 0.8 },
      rotationOrigin: { fx: 0.25, fy: 0.75 },
    })
  })

  it('réhydrate la valeur px sans modifier la donnée logique', () => {
    expect(offsetPatchToValuesPx({ translate: { x: 13, y: 5 }, width: 25, height: 12, rotate: 12, scale: { x: 1.2, y: 0.8 }, rotationOrigin: { fx: 0.25, fy: 0.75 } }, 1200)).toEqual({
      x: 156,
      y: 60,
      width: 300,
      height: 144,
      rotate: 12,
      scaleX: 1.2,
      scaleY: 0.8,
      rotationOrigin: { fx: 0.25, fy: 0.75 },
    })
  })
})

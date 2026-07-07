import { describe, it, expect } from 'vitest'
import { hexToCssOklch, cssOklchComponentsToHex } from '../src/decor-editor/color-adapter'

describe('hexToCssOklch', () => {
  it('produit une chaîne CSS oklch() bien formée', () => {
    expect(hexToCssOklch('#3388cc')).toMatch(/^oklch\(-?\d+\.\d{4} \d+\.\d{4} \d+\.\d\)$/)
  })

  it('blanc → lightness ~1, chroma ~0', () => {
    const result = hexToCssOklch('#ffffff')
    const [, l, c] = result.match(/oklch\(([\d.]+) ([\d.]+)/)!
    expect(Number(l)).toBeCloseTo(1, 2)
    expect(Number(c)).toBeCloseTo(0, 2)
  })

  it('noir → lightness ~0, chroma ~0', () => {
    const result = hexToCssOklch('#000000')
    const [, l, c] = result.match(/oklch\(([\d.]+) ([\d.]+)/)!
    expect(Number(l)).toBeCloseTo(0, 2)
    expect(Number(c)).toBeCloseTo(0, 2)
  })

  it('rouge pur → chroma nettement supérieur à un gris', () => {
    const red = hexToCssOklch('#ff0000')
    const gray = hexToCssOklch('#808080')
    const chromaOf = (s: string) => Number(s.match(/oklch\([\d.]+ ([\d.]+)/)![1])
    expect(chromaOf(red)).toBeGreaterThan(chromaOf(gray))
  })
})

describe('cssOklchComponentsToHex', () => {
  it('produit une chaîne hex valide', () => {
    expect(cssOklchComponentsToHex(0.6, 0.13, 246)).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })

  it('aller-retour hex → composants oklch → hex reste visuellement proche', () => {
    const original = '#3388cc'
    const oklchString = hexToCssOklch(original)
    const [l, c, h] = oklchString.match(/oklch\(([\d.-]+) ([\d.]+) ([\d.]+)\)/)!.slice(1).map(Number)
    const roundTrip = cssOklchComponentsToHex(l!, c!, h!)
    expect(roundTrip.toLowerCase()).toBe(original.toLowerCase())
  })
})

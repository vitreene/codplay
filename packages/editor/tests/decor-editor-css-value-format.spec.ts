import { describe, it, expect } from 'vitest'
import { formatNumberForCssProperty, parseNumberFromCssValue } from '../src/decor-editor/css-value-format'

describe('formatNumberForCssProperty', () => {
  it('propriété par défaut : suffixe cqw, échelle 1', () => {
    expect(formatNumberForCssProperty('width', 10)).toBe('10cqw')
  })

  it('propriété "raw" (order, z-index, opacity…) : nombre nu, sans unité', () => {
    expect(formatNumberForCssProperty('order', 3)).toBe('3')
    expect(formatNumberForCssProperty('z-index', 5)).toBe('5')
    expect(formatNumberForCssProperty('opacity', 0.5)).toBe('0.5')
  })

  it('border-width/border-radius/padding appliquent le facteur d\'échelle 0.25', () => {
    expect(formatNumberForCssProperty('border-width', 1)).toBe('0.25cqw')
    expect(formatNumberForCssProperty('border-radius', 4)).toBe('1cqw')
    expect(formatNumberForCssProperty('padding', 8)).toBe('2cqw')
  })
})

describe('parseNumberFromCssValue', () => {
  it('propriété par défaut : extrait le nombre tel quel', () => {
    expect(parseNumberFromCssValue('width', '10cqw')).toBe(10)
  })

  it('inverse le facteur d\'échelle pour redonner la valeur saisie par l\'utilisateur', () => {
    expect(parseNumberFromCssValue('border-width', '0.25cqw')).toBeCloseTo(1)
    expect(parseNumberFromCssValue('border-radius', '1cqw')).toBeCloseTo(4)
  })

  it('aller-retour format → parse redonne la valeur saisie', () => {
    const original = 3
    const formatted = formatNumberForCssProperty('padding', original)
    expect(parseNumberFromCssValue('padding', formatted)).toBeCloseTo(original)
  })

  it('valeur non numérique → undefined', () => {
    expect(parseNumberFromCssValue('width', 'auto')).toBeUndefined()
  })
})

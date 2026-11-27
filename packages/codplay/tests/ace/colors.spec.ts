import { describe, expect, it } from 'vitest'

import { formatColor, parseColor, prepareInterval, resolveInterval, toOklchColor, type ColorValue } from '../../src/ace'
import { NAMED_COLORS } from '../../src/ace/adapters/named-colors'

/** Reference OKLCH of sRGB red, from the CSS Color 4 conversion sample code. */
const RED: readonly number[] = [0.627955, 0.257683, 29.2339]

function expectOklch(value: ColorValue, coords: readonly number[], alpha = 1, digits = 4): void {
  expect(value.kind).toBe('color')
  expect(value.space).toBe('oklch')
  value.coords.forEach((coordinate, index) => expect(coordinate).toBeCloseTo(coords[index], digits))
  expect(value.alpha).toBeCloseTo(alpha, 6)
}

describe('parseColor', () => {
  it('converts named, transparent, hexadecimal and rgb forms to OKLCH', () => {
    expectOklch(parseColor('RED'), RED)
    expectOklch(parseColor('#f00'), RED)
    expectOklch(parseColor('#ff000080'), RED, 128 / 255)
    expectOklch(parseColor('rgba(255, 0, 0, 0.5)'), RED, 0.5)
    expectOklch(parseColor('rgb(100% 0% 0% / 25%)'), RED, 0.25)
    expectOklch(parseColor('transparent'), [0, 0, 0], 0)
    expect(NAMED_COLORS.grey).toEqual(NAMED_COLORS.gray)
  })

  it('converts every CSS Color 4 function to the same OKLCH color', () => {
    for (const red of [
      'hsl(0, 100%, 50%)',
      'hsl(0deg 100 50)',
      'hwb(0 0% 0%)',
      'color(srgb 1 0 0)',
      'color(srgb-linear 100% 0% 0%)',
    ]) {
      expectOklch(parseColor(red), RED)
    }
    expectOklch(parseColor('color(xyz-d65 0.412391 0.212639 0.019331)'), RED, 1, 3)
    expectOklch(parseColor('lab(54.29 80.8 69.89)'), RED, 1, 2)
    expectOklch(parseColor('lch(54.29 106.84 40.85)'), RED, 1, 1)
    expectOklch(parseColor('oklab(0.627955 0.224863 0.125846)'), RED, 1, 3)
    expectOklch(parseColor('color(display-p3 1 0 0)'), [0.648574, 0.299485, 28.9581])
  })

  it('keeps authored OKLCH with CSS percentage scales and hue units', () => {
    expectOklch(parseColor('oklch(60% 0.2 30)'), [0.6, 0.2, 30])
    expectOklch(parseColor('oklch(0.6 50% 0.5turn / 25%)'), [0.6, 0.2, 180], 0.25)
    expectOklch(parseColor('oklch(120% -0.1 -30deg)'), [1, 0, 0])
  })

  it('stores achromatic colors with chroma and hue at zero', () => {
    expectOklch(parseColor('white'), [1, 0, 0])
    expect(parseColor('gray').coords.slice(1)).toEqual([0, 0])
  })

  it('rejects unsupported or malformed color values', () => {
    expect(() => parseColor('not-a-color')).toThrow(/unsupported color/)
    expect(() => parseColor('color-mix(in srgb, red, blue)')).toThrow(/unsupported color/)
    expect(() => parseColor('color(cmyk 1 0 0)')).toThrow(/unsupported color\(\) space/)
    expect(() => parseColor('#12')).toThrow(/invalid hexadecimal/)
    expect(() => parseColor('rgb(1, 2)')).toThrow(/invalid rgb/)
    expect(() => parseColor('rgb(1px, 2, 3)')).toThrow(/invalid rgb channel/)
    expect(() => parseColor('rgba(1, 2, 3, 0.5junk)')).toThrow(/invalid color alpha/)
    expect(() => parseColor('oklch(60%, 0.2, 30)')).toThrow(/invalid oklch/)
    expect(() => parseColor('oklch(60% 0.2 30 /)')).toThrow(/invalid color alpha/)
  })
})

describe('ColorValue and ACE', () => {
  it('converts the deprecated sRGB intermediate to OKLCH', () => {
    expectOklch(toOklchColor({ kind: 'color', space: 'srgb', coords: [1, 0, 0], alpha: 1 }), RED)
  })

  it('formats colors as CSS oklch() with bounded precision', () => {
    expect(formatColor(parseColor('oklch(60% 0.2 30 / 50%)'))).toBe('oklch(0.6 0.2 30 / 0.5)')
  })

  it('interpolates in premultiplied alpha, so a fade to transparent keeps its color', () => {
    const middle = resolveInterval(prepareInterval('red', 'transparent'), 0.5) as ColorValue
    expectOklch(middle, RED, 0.5)
  })

  it('borrows the hue of the chromatic bound instead of rotating from an achromatic one', () => {
    const blue = parseColor('#00f')
    const middle = resolveInterval(prepareInterval('white', blue), 0.5) as ColorValue
    expect(middle.coords[2]).toBeCloseTo(blue.coords[2], 6)
  })

  it('interpolates mixed author forms in the single OKLCH space', () => {
    const middle = resolveInterval(prepareInterval('#f00', 'oklch(0.8 0.1 29.2339)'), 0.5) as ColorValue
    expectOklch(middle, [(RED[0] + 0.8) / 2, (RED[1] + 0.1) / 2, 29.2339])
  })
})

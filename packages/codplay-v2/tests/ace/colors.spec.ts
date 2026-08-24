import { describe, expect, it } from 'vitest'

import { parseColor, prepareInterval, resolveInterval } from '../../src/ace'
import { NAMED_COLORS } from '../../src/ace/adapters/named-colors'

describe('parseColor', () => {
  it('parses named colors without browser resolution', () => {
    expect(parseColor('rebeccapurple')).toEqual({
      kind: 'color',
      space: 'srgb',
      coords: [0.4, 0.2, 0.6],
      alpha: 1,
    })
    expect(parseColor('transparent').alpha).toBe(0)
  })

  it('keeps named colors in an explicit RGB transcription table', () => {
    expect(NAMED_COLORS.red).toEqual([255, 0, 0])
    expect(NAMED_COLORS.rebeccapurple).toEqual([102, 51, 153])
    expect(NAMED_COLORS.grey).toEqual(NAMED_COLORS.gray)
    expect(parseColor('RED')).toEqual({ kind: 'color', space: 'srgb', coords: [1, 0, 0], alpha: 1 })
  })

  it('parses short and long hexadecimal forms with alpha', () => {
    expect(parseColor('#f00')).toEqual({ kind: 'color', space: 'srgb', coords: [1, 0, 0], alpha: 1 })
    expect(parseColor('#1234')).toEqual({
      kind: 'color',
      space: 'srgb',
      coords: [0.06666666666666667, 0.13333333333333333, 0.2],
      alpha: 0.26666666666666666,
    })
  })

  it('parses comma and space rgb forms with numeric and percentage channels', () => {
    expect(parseColor('rgba(255, 0, 127, 0.5)')).toEqual({
      kind: 'color',
      space: 'srgb',
      coords: [1, 0, 0.4980392156862745],
      alpha: 0.5,
    })
    expect(parseColor('rgb(100% 0% 50% / 25%)')).toEqual({
      kind: 'color',
      space: 'srgb',
      coords: [1, 0, 0.5],
      alpha: 0.25,
    })
  })

  it('parses OKLCH with percentage channels, hue units and alpha', () => {
    expect(parseColor('oklch(60% 0.2 30)')).toEqual({
      kind: 'color',
      space: 'oklch',
      coords: [0.6, 0.2, 30],
      alpha: 1,
    })
    expect(parseColor('oklch(0.6 50% 0.5turn / 25%)')).toEqual({
      kind: 'color',
      space: 'oklch',
      coords: [0.6, 0.2, 180],
      alpha: 0.25,
    })
    expect(parseColor('oklch(120% -0.1 -30deg)')).toEqual({
      kind: 'color',
      space: 'oklch',
      coords: [1, 0, 330],
      alpha: 1,
    })
  })

  it('rejects unsupported or malformed color values', () => {
    expect(() => parseColor('not-a-color')).toThrow(/unsupported color/)
    expect(() => parseColor('#12')).toThrow(/invalid hexadecimal/)
    expect(() => parseColor('rgb(1, 2)')).toThrow(/invalid rgb/)
    expect(() => parseColor('rgb(1px, 2, 3)')).toThrow(/invalid rgb channel/)
    expect(() => parseColor('rgba(1, 2, 3, 0.5junk)')).toThrow(/invalid color alpha/)
    expect(() => parseColor('oklch(60%, 0.2, 30)')).toThrow(/invalid oklch/)
    expect(() => parseColor('oklch(60% 0.2 30 /)')).toThrow(/invalid color alpha/)
  })
})

describe('ColorValue and ACE', () => {
  it('feeds normalized colors into the existing color interval', () => {
    const interval = prepareInterval(parseColor('#f00'), parseColor('#00f'))

    expect(resolveInterval(interval, 0.5)).toEqual({
      kind: 'color',
      space: 'srgb',
      coords: [0.5, 0, 0.5],
      alpha: 1,
    })
  })
})

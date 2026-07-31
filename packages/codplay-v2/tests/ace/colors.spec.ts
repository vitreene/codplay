import { describe, expect, it } from 'vitest'

import { parseColor, prepareInterval, resolveInterval } from '../../src/ace'

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

  it('rejects unsupported or malformed color values', () => {
    expect(() => parseColor('not-a-color')).toThrow(/unsupported color/)
    expect(() => parseColor('#12')).toThrow(/invalid hexadecimal/)
    expect(() => parseColor('rgb(1, 2)')).toThrow(/invalid rgb/)
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

import { describe, expect, it } from 'vitest'
import { resolveBorderInsetsPx, resolveContentInsetLengths, resolveContentInsetsPx } from '../../src/motion-editor/border-insets'

describe('motion editor border geometry adapter', () => {
  it('resolves a uniform cqw border without changing the frame dimensions', () => {
    expect(resolveBorderInsetsPx({ 'border-width': '0.6cqw', 'border-style': 'solid' }, 800)).toEqual({
      top: 4.8,
      right: 4.8,
      bottom: 4.8,
      left: 4.8,
    })
  })

  it('supports border shorthand and physical side overrides', () => {
    expect(resolveBorderInsetsPx({
      border: '4px solid red',
      'border-left-width': '8px',
      'border-top-style': 'none',
    }, 800)).toEqual({
      top: 0,
      right: 4,
      bottom: 4,
      left: 8,
    })
  })

  it('does not infer a visible inset from a width whose style is none', () => {
    expect(resolveBorderInsetsPx({ 'border-width': '20px', 'border-style': 'none' }, 800)).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    })
  })

  it('accepts the structured length values used by a CodPlay snapshot', () => {
    expect(resolveBorderInsetsPx({
      'border-width': { kind: 'length', value: 2, unit: 'cqw' },
      'border-style': 'solid',
    }, 500)).toEqual({
      top: 10,
      right: 10,
      bottom: 10,
      left: 10,
    })
  })
  it('adds padding and border in mixed units through the shared content conversion', () => {
    const style = { border: '2px solid red', padding: '1cqw 4px', 'padding-left': '2cqw' }
    expect(resolveContentInsetLengths(style).left).toEqual({
      border: { value: 2, unit: 'px' }, padding: { value: 2, unit: 'cqw' },
    })
    expect(resolveContentInsetsPx(style, 800)).toEqual({ top: 10, right: 6, bottom: 10, left: 18 })
  })

  it.each([
    [0, 1, 0], [0.2, 1, 1], [0.6, 1, 1], [1.25, 1, 1], [16.4, 1, 16],
    [0.2, 2, 0.5], [0.6, 2, 0.5], [1.25, 2, 1], [1.75, 2, 1.5], [16.4, 2, 16], [17.6, 2, 17.5],
  ])('snaps border %spx at pixel ratio %s to %spx', (value, pixelRatio, expected) => {
    expect(resolveContentInsetsPx({ border: `${value}px solid red` }, 820, pixelRatio).left).toBe(expected)
  })

  it('snaps a responsive border while preserving fractional padding', () => {
    const style = { border: '2cqw solid red', padding: '1.75px' }
    expect(resolveContentInsetsPx(style, 820, 2).left).toBe(17.75)
    expect(resolveContentInsetsPx(style, 880, 2).left).toBe(19.25)
  })

})

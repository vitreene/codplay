import { describe, expect, it } from 'vitest'
import { resolveBorderInsetsPx } from '../../src/motion-editor/border-insets'

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
})

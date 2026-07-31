import { describe, expect, it } from 'vitest'

import {
  getTransformOrder,
  materializeTransformIdentity,
  normalizeTransformProperties,
  prepareTransformTween,
  resolveTransformFrom,
  resolveTween,
} from '../../src/ace'

describe('normalizeTransformProperties', () => {
  it('maps x/y/z aliases and applies the canonical composition order', () => {
    const result = normalizeTransformProperties({
      scaleY: 2,
      rotate: '20deg',
      y: '10px',
      x: '5px',
      perspective: '800px',
    })

    expect(result).toEqual({
      ok: true,
      operations: [
        { property: 'perspective', value: '800px' },
        { property: 'translateX', value: '5px' },
        { property: 'translateY', value: '10px' },
        { property: 'rotate', value: '20deg' },
        { property: 'scaleY', value: 2 },
      ],
    })
  })

  it('keeps matrix operations separate and after channel operations', () => {
    const result = normalizeTransformProperties({ matrix: [1, 0, 0, 1, 20, 30], scale: 2, x: 10 })

    expect(result).toEqual({
      ok: true,
      operations: [
        { property: 'translateX', value: 10 },
        { property: 'scale', value: 2 },
        { property: 'matrix', value: [1, 0, 0, 1, 20, 30] },
      ],
    })
  })

  it('rejects unsupported raw CSS transform forms', () => {
    const result = normalizeTransformProperties({ transform: 'translate(10px) rotate(20deg)', translate: '10px' })

    expect(result).toMatchObject({
      ok: false,
      issues: [
        { code: 'TRANSFORM_PROPERTY_UNSUPPORTED', property: 'transform' },
        { code: 'TRANSFORM_PROPERTY_UNSUPPORTED', property: 'translate' },
      ],
    })
  })

  it('rejects duplicate canonical channels declared through aliases', () => {
    const result = normalizeTransformProperties({ x: 10, translateX: 20 })

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: 'TRANSFORM_PROPERTY_DUPLICATE', property: 'translateX' }],
    })
  })
})

describe('getTransformOrder', () => {
  it('exposes the stable order without exposing mutable state', () => {
    const order = getTransformOrder()

    expect(order.slice(0, 5)).toEqual(['perspective', 'translateX', 'translateY', 'translateZ', 'rotate'])
    expect(order.at(-2)).toBe('matrix')
    expect(order.at(-1)).toBe('matrix3d')
  })
})

describe('materializeTransformIdentity', () => {
  it('inherits the explicit reference unit for zero identities', () => {
    expect(materializeTransformIdentity('translateX', '50%')).toBe('0%')
    expect(materializeTransformIdentity('rotate', '20deg')).toBe('0deg')
    expect(materializeTransformIdentity('translateY', 12)).toBe(0)
  })

  it('keeps scale identity unitless', () => {
    expect(materializeTransformIdentity('scaleX', 2)).toBe(1)
    expect(() => materializeTransformIdentity('scaleX', '2px')).toThrow(/unitless numeric reference/)
  })

  it('does not invent identities for matrix or perspective operations', () => {
    expect(materializeTransformIdentity('matrix', 1)).toBeUndefined()
    expect(materializeTransformIdentity('perspective', 800)).toBeUndefined()
  })
})

describe('prepareTransformTween', () => {
  it('completes a missing translation from in the target unit', () => {
    const tween = prepareTransformTween({ property: 'translateX', to: '50%', duration: 100, ease: 'linear' })

    expect(resolveTween(tween, 0)).toBe('0%')
    expect(resolveTween(tween, 50)).toBe('25%')
    expect(resolveTween(tween, 100)).toBe('50%')
  })

  it('completes a missing rotation from in the target angle unit', () => {
    const tween = prepareTransformTween({ property: 'rotate', to: '20deg', duration: 100, ease: 'linear' })

    expect(resolveTween(tween, 50)).toBe('10deg')
  })

  it('requires an explicit from for operations without an identity', () => {
    expect(() => prepareTransformTween({ property: 'matrix', to: [1, 0, 0, 1, 10, 10] })).toThrow(/runtime from/)
  })
})

describe('resolveTransformFrom', () => {
  it('distinguishes author, identity, and runtime sources', () => {
    expect(resolveTransformFrom('translateX', '10px', '50px')).toEqual({
      status: 'resolved',
      value: '10px',
    })
    expect(resolveTransformFrom('translateX', undefined, '50%')).toEqual({
      status: 'resolved',
      value: '0%',
    })
    expect(resolveTransformFrom('matrix', undefined, [1, 0, 0, 1, 10, 10])).toEqual({
      status: 'deferred',
      property: 'matrix',
      to: [1, 0, 0, 1, 10, 10],
    })
  })
})

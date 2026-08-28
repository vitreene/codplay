import { describe, expect, it } from 'vitest'
import { isFiniteNumber } from '../../../src/shared'

describe('isFiniteNumber', () => {
  it('accepts finite numbers and rejects non-finite or non-numeric values', () => {
    expect(isFiniteNumber(0)).toBe(true)
    expect(isFiniteNumber(Number.MAX_VALUE)).toBe(true)
    expect(isFiniteNumber(Number.NaN)).toBe(false)
    expect(isFiniteNumber(Number.POSITIVE_INFINITY)).toBe(false)
    expect(isFiniteNumber('1')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { compareNumberPaths } from '../../../src/shared'

describe('compareNumberPaths', () => {
  it('orders divergent and nested declaration paths lexicographically', () => {
    expect(compareNumberPaths([1], [2])).toBeLessThan(0)
    expect(compareNumberPaths([2, 0], [1, 9])).toBeGreaterThan(0)
    expect(compareNumberPaths([1], [1, 0])).toBeLessThan(0)
    expect(compareNumberPaths([1, 0], [1, 0])).toBe(0)
  })
})

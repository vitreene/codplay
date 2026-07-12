import { describe, expect, it } from 'vitest'
import { nextOrderKey, orderKeyBetween, OrderKeyHardBoundaryError, rebalanceOrderKeys } from '../../src/app/commands/order-key'

describe('nextOrderKey', () => {
  it('returns the centered first key when there are no siblings yet', () => {
    expect(nextOrderKey([])).toBe('mmm')
  })

  it('returns a key that sorts after the last existing sibling', () => {
    const key = nextOrderKey(['mmm'])
    expect(key > 'mmm').toBe(true)
  })

  it('ignores input order — sorts siblings itself before picking the last one', () => {
    const key = nextOrderKey(['mmb', 'mma', 'mmc'])
    expect(key > 'mmc').toBe(true)
  })
})

describe('orderKeyBetween', () => {
  it('returns the centered first key when both bounds are absent', () => {
    expect(orderKeyBetween(null, null)).toBe('mmm')
  })

  it('returns a key strictly before `after` when `before` is absent', () => {
    const key = orderKeyBetween(null, 'mmm')
    expect(key < 'mmm').toBe(true)
  })

  it('returns a key strictly after `before` when `after` is absent', () => {
    const key = orderKeyBetween('mmm', null)
    expect(key > 'mmm').toBe(true)
  })

  it('returns a key strictly between two given bounds', () => {
    const key = orderKeyBetween('mmm', 'mmn')
    expect(key > 'mmm').toBe(true)
    expect(key < 'mmn').toBe(true)
  })

  it('rejects bounds given out of order', () => {
    expect(() => orderKeyBetween('mmn', 'mmm')).toThrow()
  })
})

describe('repeated insertion at the same extreme point (carry-over mechanics)', () => {
  it('always inserting before the running lowest key stays strictly decreasing, hundreds of times over', () => {
    let key = 'mmm'
    for (let i = 0; i < 500; i += 1) {
      const next = orderKeyBetween(null, key)
      expect(next < key).toBe(true)
      key = next
    }
  })

  it('always inserting after the running highest key stays strictly increasing, hundreds of times over', () => {
    let key = 'mmm'
    for (let i = 0; i < 500; i += 1) {
      const next = orderKeyBetween(key, null)
      expect(next > key).toBe(true)
      key = next
    }
  })

  it('reaches the real floor ("aaa") only after ~2196 repeated inserts at the same low extreme', () => {
    let key = 'mmm'
    let count = 0
    expect(() => {
      while (true) {
        key = orderKeyBetween(null, key)
        count += 1
      }
    }).toThrow(OrderKeyHardBoundaryError)
    expect(count).toBe(2196)
    expect(key).toBe('aaa')
  })

  it('reaches the real ceiling ("zzz") only after ~2743 repeated inserts at the same high extreme', () => {
    let key = 'mmm'
    let count = 0
    expect(() => {
      while (true) {
        key = orderKeyBetween(key, null)
        count += 1
      }
    }).toThrow(OrderKeyHardBoundaryError)
    expect(count).toBe(2743)
    expect(key).toBe('zzz')
  })
})

describe('rebalanceOrderKeys', () => {
  it('returns as many keys as requested, in increasing order', () => {
    const keys = rebalanceOrderKeys(5)
    expect(keys).toHaveLength(5)
    expect([...keys].sort()).toEqual(keys)
  })

  it('returns an empty array for a non-positive count', () => {
    expect(rebalanceOrderKeys(0)).toEqual([])
  })
})

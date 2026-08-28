import { describe, expect, it } from 'vitest'
import { cloneRecord, cloneValue } from '../../../src/shared'

describe('shared value cloning', () => {
  it('clones nested arrays and plain records without changing the source', () => {
    const source = {
      nested: { values: [1, { enabled: true }] },
    }

    const cloned = cloneRecord(source)
    const nested = cloned.nested as { values: Array<number | { enabled: boolean }> }
    nested.values[1] = { enabled: false }

    expect(cloned).not.toBe(source)
    expect(cloned.nested).not.toBe(source.nested)
    expect(cloned.nested.values).not.toBe(source.nested.values)
    expect(source.nested.values[1]).toEqual({ enabled: true })
  })

  it('preserves primitives and non-plain object references', () => {
    const date = new Date('2026-01-01T00:00:00.000Z')
    const source = { date, value: 3 }

    const cloned = cloneValue(source)

    expect(cloned.date).toBe(date)
    expect(cloned.value).toBe(3)
  })
})

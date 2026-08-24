import { describe, expect, it } from 'vitest'
import { isMeasurableHtmlElement } from '../../../src/runtime/html'

describe('isMeasurableHtmlElement', () => {
  it('rejects values that do not belong to the browser element surface', () => {
    expect(isMeasurableHtmlElement(undefined)).toBe(false)
    expect(isMeasurableHtmlElement({
      ownerDocument: {},
      getBoundingClientRect: () => ({ left: 0 }),
    })).toBe(false)
  })
})

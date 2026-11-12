import { describe, expect, it } from 'vitest'
import {
  anchorEditorBlockPositionFor,
  anchorEditorReservationFor,
  anchorFlowBlockSizeFor,
  anchorReservationFor,
} from './anchor-position'

describe('anchor BDC spacing', () => {
  it('doubles the top and bottom margins around anchored BDCs', () => {
    expect(anchorReservationFor('75%')).toBe('calc(75% + 2rem)')
    expect(anchorEditorReservationFor('75%')).toBe('calc(75% + 1lh + 2rem + 2rem)')
    expect(anchorEditorBlockPositionFor()).toBe('calc(anchor(top) + 1lh + 2rem)')
    expect(anchorFlowBlockSizeFor('75%')).toBe('calc(75% + 2rem + 2rem)')
  })
})

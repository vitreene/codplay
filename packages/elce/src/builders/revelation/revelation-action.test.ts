import { describe, expect, it } from 'vitest'
import { createRevelationAction } from './revelation-action'

describe('Revelation actions', () => {
  it('enters from the left and exits to the right for the rightward pair', () => {
    const intro = createRevelationAction('swipe-right', 'intro')
    const outro = createRevelationAction('swipe-right', 'outro')

    expect(intro).toMatchObject({ style: { x: { from: -250, to: 0 } } })
    expect(outro).toMatchObject({ style: { x: { to: 250 } } })
  })
})

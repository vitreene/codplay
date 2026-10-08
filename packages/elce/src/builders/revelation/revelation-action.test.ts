import { describe, expect, it } from 'vitest'
import { createRevelationAction, createRevelationInitialStyle } from './revelation-action'

describe('Revelation actions', () => {
  it('enters from the left and exits to the right for the rightward pair', () => {
    const intro = createRevelationAction('swipe-right', 'intro')
    const outro = createRevelationAction('swipe-right', 'outro')

    expect(intro).toMatchObject({ style: { x: { from: -250, to: 0 } } })
    expect(outro).toMatchObject({ style: { x: { to: 250 } } })
  })

  it('provides the resting style used to resolve configured outro starts', () => {
    expect(createRevelationInitialStyle('fade')).toEqual({ opacity: 1 })
    expect(createRevelationInitialStyle('swipe-right')).toEqual({ opacity: 1, x: 0 })
    expect(createRevelationInitialStyle('zoom')).toEqual({ opacity: 1, scale: 1 })
    expect(createRevelationInitialStyle('cut')).toEqual({})
  })
})

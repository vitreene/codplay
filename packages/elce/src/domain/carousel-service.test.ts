import { describe, expect, it } from 'vitest'
import { CAROUSEL_CONFIG, CAROUSEL_PLAYBACK_MODE } from '../config/document-config'
import { ElceCarouselService } from './carousel-service'

describe('ElceCarouselService', () => {
  it('creates a manual Carousel with one identified Card child', () => {
    const service = new ElceCarouselService()
    const carousel = service.createDefault('card-1')

    expect(carousel).toMatchObject({
      playbackMode: CAROUSEL_PLAYBACK_MODE.MANUAL,
      defaultViewDurationMs: CAROUSEL_CONFIG.defaultViewDurationMs,
      cards: [{ bdcId: 'card-1', durationMs: null }],
    })
  })

  it('adds, removes and reorders identified Card entries with their duration', () => {
    const service = new ElceCarouselService()
    const first = service.createDefault('card-1')
    const withSecond = service.addCard(first, 'card-2')
    const withThird = service.addCard(withSecond, 'card-3')
    const timed = service.setCardDuration(withThird, 'card-2', 2500)
    const reordered = service.moveCard(timed, 'card-2', 2)
    const removed = service.removeCard(reordered, 'card-3')

    expect(reordered.cards.map(({ bdcId }) => bdcId)).toEqual(['card-1', 'card-3', 'card-2'])
    expect(reordered.cards[2]).toEqual({ bdcId: 'card-2', durationMs: 2500 })
    expect(removed.cards.map(({ bdcId }) => bdcId)).toEqual(['card-1', 'card-2'])
    expect(service.removeCard(first, 'card-1')).toBe(first)
  })

  it('validates unique children and positive durations', () => {
    const service = new ElceCarouselService()
    const carousel = service.createDefault('card-1')

    expect(() => service.assertValid({ ...carousel, cards: [...carousel.cards, { bdcId: 'card-1', durationMs: null }] }))
      .toThrow('ne peut apparaître qu’une fois')
    expect(() => service.assertValid({ ...carousel, cards: [{ bdcId: 'card-1', durationMs: 0 }] }))
      .toThrow('doit être positive')
    expect(() => service.assertValid({ ...carousel, cards: [] })).toThrow('au moins une carte')
  })

  it('updates playback and frame settings without changing Card relationships', () => {
    const service = new ElceCarouselService()
    const carousel = service.createDefault('card-1')
    const automatic = service.setPlaybackMode(carousel, CAROUSEL_PLAYBACK_MODE.AUTOMATIC)
    const repeated = service.setRepeatCount(automatic, 0)
    const square = service.setAspectRatio(repeated, { width: 1, height: 1 })
    const transitioned = service.setTransition(square, 'cut')

    expect(transitioned).toMatchObject({
      playbackMode: CAROUSEL_PLAYBACK_MODE.AUTOMATIC,
      repeatCount: 0,
      aspectRatio: { width: 1, height: 1 },
      transition: 'cut',
      cards: carousel.cards,
    })
  })
})

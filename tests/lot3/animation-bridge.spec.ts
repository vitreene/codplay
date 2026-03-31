import { describe, expect, it, vi } from 'vitest'

import { createAnimationAdapter } from '../../src/animation/adapter'
import { deriveSimpleTransitions } from '../../src/animation/derive-simple'
import { runAnimationBatch } from '../../src/animation/run-batch'
import type { AnimationResolvedAction } from '../../src/animation/types'

/**
 * Creates one resolved action with sensible defaults for animation tests.
 */
function makeResolvedAction(partial: Partial<AnimationResolvedAction>): AnimationResolvedAction {
  return {
    eventId: partial.eventId ?? 'evt-1',
    eventName: partial.eventName ?? 'intro',
    listenerId: partial.listenerId ?? 'item-1',
    actionKey: partial.actionKey ?? 'intro',
    action: partial.action ?? {}
  }
}

describe('Lot 03 - animation bridge', () => {
  it('L3-T1 one resolved event creates one anime transition call', () => {
    const animeImplementation = vi.fn(() => ({ pause: vi.fn() }))
    const adapter = createAnimationAdapter(animeImplementation)

    const resolvedActions: AnimationResolvedAction[] = [
      makeResolvedAction({
        action: {
          target: '#item-1',
          style: {
            opacity: { from: 0, to: 1, duration: 500 }
          }
        }
      })
    ]

    const transitions = deriveSimpleTransitions(resolvedActions)
    const result = runAnimationBatch(transitions, adapter)

    expect(transitions).toHaveLength(1)
    expect(animeImplementation).toHaveBeenCalledTimes(1)
    expect(result.appliedCount).toBe(1)
  })

  it('L3-T2 incomplete style payload is ignored', () => {
    const animeImplementation = vi.fn(() => ({ pause: vi.fn() }))
    const adapter = createAnimationAdapter(animeImplementation)

    const resolvedActions: AnimationResolvedAction[] = [
      makeResolvedAction({
        action: {
          target: '#item-1',
          style: {
            opacity: { from: 0, duration: 500 }
          }
        }
      })
    ]

    const transitions = deriveSimpleTransitions(resolvedActions)
    const result = runAnimationBatch(transitions, adapter)

    expect(transitions).toHaveLength(0)
    expect(animeImplementation).toHaveBeenCalledTimes(0)
    expect(result.appliedCount).toBe(0)
  })

  it('L3-T3 empty batch is a no-op', () => {
    const animeImplementation = vi.fn(() => ({ pause: vi.fn() }))
    const adapter = createAnimationAdapter(animeImplementation)

    const result = runAnimationBatch([], adapter)

    expect(animeImplementation).toHaveBeenCalledTimes(0)
    expect(result).toEqual({ appliedCount: 0, trace: [] })
  })

  it('L3-T4 batch returns a minimal event-to-transition trace', () => {
    const animeImplementation = vi.fn(() => ({ pause: vi.fn() }))
    const adapter = createAnimationAdapter(animeImplementation)

    const resolvedActions: AnimationResolvedAction[] = [
      makeResolvedAction({
        eventId: 'evt-42',
        eventName: 'intro',
        listenerId: 'item-42',
        action: {
          target: '#item-42',
          style: {
            x: { to: 120, duration: 300 }
          }
        }
      })
    ]

    const transitions = deriveSimpleTransitions(resolvedActions)
    const result = runAnimationBatch(transitions, adapter)

    expect(result.trace).toHaveLength(1)
    expect(result.trace[0]).toMatchObject({
      eventId: 'evt-42',
      eventName: 'intro',
      transitionId: 'tr-evt-42-x',
      property: 'x',
      status: 'applied'
    })
  })
})

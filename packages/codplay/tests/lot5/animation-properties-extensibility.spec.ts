import { describe, expect, it, vi } from 'vitest'

import { createAnimationAdapter, type AnimeImplementation } from '../../src/animation/adapter'
import { deriveSimpleTransitions } from '../../src/animation/derive-simple'
import type { AnimationResolvedAction } from '../../src/animation/types'
import { applyResolvedActions } from '../../src/runtime/apply-actions'
import type { RuntimeElementMap, RuntimeNode } from '../../src/runtime/types'

/**
 * Creates one resolved action with sensible defaults for animation tests.
 */
function temp__makeResolvedAction(partial: Partial<AnimationResolvedAction>): AnimationResolvedAction {
  return {
    eventId: partial.eventId ?? 'evt-1',
    eventName: partial.eventName ?? 'intro',
    listenerId: partial.listenerId ?? 'item-1',
    actionKey: partial.actionKey ?? 'intro',
    action: partial.action ?? {}
  }
}

describe('Lot 05 - animation properties extensibility', () => {
  it('L5-T1 deriveSimpleTransitions forwards arbitrary style properties', () => {
    const resolvedActions: AnimationResolvedAction[] = [
      temp__makeResolvedAction({
        action: {
          target: '#item-1',
          style: {
            opacity: { from: 0, to: 1, duration: 400 },
            width: { from: '100px', to: '200px', duration: 500 },
            progress: { from: 0, to: 1, duration: 700 }
          }
        }
      })
    ]

    const transitions = deriveSimpleTransitions(resolvedActions)

    expect(transitions).toHaveLength(3)
    expect(transitions[0]?.property).toBe('opacity')
    expect(transitions[1]).toMatchObject({
      property: 'width',
      from: '100px',
      to: '200px',
      duration: 500
    })
    expect(transitions[2]).toMatchObject({
      property: 'progress',
      from: 0,
      to: 1,
      duration: 700
    })
  })

  it('L5-T2 applyResolvedActions forwards arbitrary html-style properties to adapter', () => {
    const runtimeNode: RuntimeNode = {
      tagName: 'DIV',
      id: 'item-1',
      className: '',
      style: { width: '100px' },
      attributes: {}
    }

    const runtimeElements: RuntimeElementMap = new Map([
      [
        'item-1',
        {
          runtimeItemId: 'item-1',
          nodeRef: runtimeNode
        }
      ]
    ])

    const resolvedActions: AnimationResolvedAction[] = [
      temp__makeResolvedAction({
        listenerId: 'item-1',
        action: {
          targetId: 'item-1',
          style: {
            width: { from: '100px', to: '200px', duration: 600 }
          }
        }
      })
    ]

    const animeImplementation = vi.fn<AnimeImplementation>(() => ({ pause: vi.fn() }))
    const adapter = createAnimationAdapter(animeImplementation)

    const result = applyResolvedActions(resolvedActions, runtimeElements, adapter)

    expect(animeImplementation).toHaveBeenCalledTimes(1)

    const firstCallArguments = animeImplementation.mock.calls[0]?.[0]
    if (firstCallArguments === undefined) {
      throw new Error('Expected anime implementation to be called at least once')
    }

    expect(firstCallArguments.width).toEqual({ from: '100px', to: '200px' })
    expect(firstCallArguments.duration).toBe(600)
    expect(runtimeNode.style.width).toBe('200px')
    expect(result.animation.appliedCount).toBe(1)
  })

  it('L5-T3 applyResolvedActions supports non-html object targets', () => {
    const thirdPartyTarget = {
      progress: 0
    }

    const runtimeElements: RuntimeElementMap = new Map([
      [
        'rive-1',
        {
          runtimeItemId: 'rive-1',
          nodeRef: thirdPartyTarget
        }
      ]
    ])

    const resolvedActions: AnimationResolvedAction[] = [
      temp__makeResolvedAction({
        listenerId: 'rive-1',
        action: {
          targetId: 'rive-1',
          style: {
            progress: { from: 0, to: 1, duration: 450 }
          }
        }
      })
    ]

    const animeImplementation = vi.fn<AnimeImplementation>(() => ({ pause: vi.fn() }))
    const adapter = createAnimationAdapter(animeImplementation)

    const result = applyResolvedActions(resolvedActions, runtimeElements, adapter)

    expect(animeImplementation).toHaveBeenCalledTimes(1)

    const firstCallArguments = animeImplementation.mock.calls[0]?.[0]
    if (firstCallArguments === undefined) {
      throw new Error('Expected anime implementation to be called at least once')
    }

    expect(firstCallArguments.progress).toEqual({ from: 0, to: 1 })
    expect(firstCallArguments.duration).toBe(450)
    expect(thirdPartyTarget.progress).toBe(1)
    expect(result.animation.appliedCount).toBe(1)
  })
})

import { describe, expect, it, vi } from 'vitest'

import { createAnimationAdapter, type AnimeImplementation } from '../../src/animation/adapter'
import { dispatchEvents } from '../../src/core/events/dispatch'
import { flattenEventNodes } from '../../src/core/events/flatten'
import { sortRuntimeEvents } from '../../src/core/events/sort'
import { applyResolvedActions } from '../../src/runtime/apply-actions'
import { mountSceneElements } from '../../src/runtime/mount-elements'
import type { ItemDoc, RuntimeNode, RuntimePersos } from '../../src/runtime/types'

/**
 * Creates a minimal text item used in Lot 04 integration tests.
 */
function temp__createTextItem(): ItemDoc {
  return {
    id: 'item-text-1',
    type: 'tag',
    initial: {
      id: 'item-text-1',
      tag: 'p',
      content: 'hello',
      style: {
        opacity: 0
      }
    },
    actions: {
      intro: {
        style: {
          opacity: { from: 0, to: 1, duration: 500 }
        }
      }
    }
  }
}

describe('Lot 04 - minimal end-to-end', () => {
  it('L4-T1 event intro creates node and animates opacity 0 -> 1', () => {
    const runtimePersos: RuntimePersos = {
      id: 'story-main',
      persos: {
          'item-text-1': temp__createTextItem()
      }
    }

    const runtimeElements = mountSceneElements(runtimePersos)
    const runtimeElement = runtimeElements.get('item-text-1')

    expect(runtimeElement).toBeDefined()

    const timelineEvents = flattenEventNodes([
      {
        name: 'intro',
        startAt: 100
      }
    ])

    const sortedEvents = sortRuntimeEvents(timelineEvents, {})
    const resolvedActions = dispatchEvents(sortedEvents, {
      listeners: [
        {
          listenerId: 'item-text-1',
          actionsByEventName: runtimePersos.persos['item-text-1'].actions
        }
      ]
    })

    const animeImplementation = vi.fn<AnimeImplementation>(() => ({ pause: vi.fn() }))
    const animationAdapter = createAnimationAdapter(animeImplementation)

    const result = applyResolvedActions(resolvedActions, runtimeElements, animationAdapter)

    expect(animeImplementation).toHaveBeenCalledTimes(1)
    const firstCallArguments = animeImplementation.mock.calls[0]?.[0]
    if (firstCallArguments === undefined) {
      throw new Error('Expected anime implementation to be called at least once')
    }

    expect(firstCallArguments.opacity).toEqual({ from: 0, to: 1 })
    expect(firstCallArguments.duration).toBe(500)

    const node = runtimeElement?.nodeRef as RuntimeNode
    expect(node.style.opacity).toBe(1)
    expect(result.appliedActionsCount).toBe(1)
    expect(result.animation.appliedCount).toBe(1)
  })
})

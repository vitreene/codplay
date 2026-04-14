import { describe, expect, it, vi } from 'vitest'

import { createAnimationAdapter, type AnimeImplementation } from '../../src/animation/adapter'
import type { AnimationResolvedAction } from '../../src/animation/types'
import { applyResolvedActions } from '../../src/runtime/apply-actions'
import type { RuntimeElementMap, RuntimeNode } from '../../src/runtime/types'

/**
 * Creates one resolved action with predictable defaults.
 */
function makeResolvedAction(partial: Partial<AnimationResolvedAction>): AnimationResolvedAction {
  return {
    eventId: partial.eventId ?? 'evt-default',
    eventName: partial.eventName ?? 'intro',
    listenerId: partial.listenerId ?? 'item-1',
    actionKey: partial.actionKey ?? 'intro',
    action: partial.action ?? {}
  }
}

/**
 * Creates one runtime element map for the provided nodes.
 */
function makeRuntimeElements(nodes: Record<string, RuntimeNode>): RuntimeElementMap {
  return new Map(
    Object.entries(nodes).map(([runtimeItemId, nodeRef]) => [
      runtimeItemId,
      {
        runtimeItemId,
        nodeRef
      }
    ])
  )
}

describe('Lot 10 - same-tick runtime conflicts', () => {
  it('L10-T1 style conflict keeps last property value and traces override', () => {
    const runtimeElements = makeRuntimeElements({
      'item-1': {
        tagName: 'DIV',
        id: 'item-1',
        className: '',
        style: { opacity: 0 },
        attributes: {}
      }
    })

    const actions: AnimationResolvedAction[] = [
      makeResolvedAction({
        eventId: 'evt-1',
        listenerId: 'item-1',
        action: {
          targetId: 'item-1',
          style: {
            opacity: { from: 0, to: 0.5, duration: 300 }
          }
        }
      }),
      makeResolvedAction({
        eventId: 'evt-2',
        listenerId: 'item-1',
        action: {
          targetId: 'item-1',
          style: {
            opacity: { from: 0.5, to: 1, duration: 300 }
          }
        }
      })
    ]

    const animeImplementation = vi.fn<AnimeImplementation>(() => ({ pause: vi.fn() }))
    const adapter = createAnimationAdapter(animeImplementation)

    const result = applyResolvedActions(actions, runtimeElements, adapter)

    expect(animeImplementation).toHaveBeenCalledTimes(1)
    expect(result.animation.appliedCount).toBe(1)
    expect(result.conflictTrace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'rejected',
          reason: 'STYLE_OVERRIDDEN_SAME_TICK',
          payload: expect.objectContaining({
            key: 'opacity',
            winnerEventId: 'evt-2',
            loserEventId: 'evt-1'
          })
        }),
        expect.objectContaining({
          status: 'applied',
          reason: 'STYLE_OVERRIDDEN_SAME_TICK',
          payload: expect.objectContaining({ key: 'opacity', winnerEventId: 'evt-2' })
        })
      ])
    )
  })

  it('L10-T2 style properties without key overlap remain co-applied', () => {
    const runtimeElements = makeRuntimeElements({
      'item-1': {
        tagName: 'DIV',
        id: 'item-1',
        className: '',
        style: { opacity: 0, width: '100px' },
        attributes: {}
      }
    })

    const actions: AnimationResolvedAction[] = [
      makeResolvedAction({
        eventId: 'evt-1',
        listenerId: 'item-1',
        action: {
          targetId: 'item-1',
          style: {
            opacity: { from: 0, to: 1, duration: 300 }
          }
        }
      }),
      makeResolvedAction({
        eventId: 'evt-2',
        listenerId: 'item-1',
        action: {
          targetId: 'item-1',
          style: {
            width: { from: '100px', to: '200px', duration: 300 }
          }
        }
      })
    ]

    const animeImplementation = vi.fn<AnimeImplementation>(() => ({ pause: vi.fn() }))
    const adapter = createAnimationAdapter(animeImplementation)
    const result = applyResolvedActions(actions, runtimeElements, adapter)

    expect(result.animation.appliedCount).toBe(2)
    expect(result.conflictTrace).toEqual([])
  })

  it('L10-T3 attr conflict keeps last key value and traces override', () => {
    const runtimeElements = makeRuntimeElements({
      'item-1': {
        tagName: 'DIV',
        id: 'item-1',
        className: '',
        style: {},
        attributes: {}
      }
    })

    const actions: AnimationResolvedAction[] = [
      makeResolvedAction({
        eventId: 'evt-1',
        listenerId: 'item-1',
        action: {
          targetId: 'item-1',
          attr: {
            'data-state': 'loading'
          }
        }
      }),
      makeResolvedAction({
        eventId: 'evt-2',
        listenerId: 'item-1',
        action: {
          targetId: 'item-1',
          attr: {
            'data-state': 'done'
          }
        }
      })
    ]

    const animeImplementation = vi.fn<AnimeImplementation>(() => ({ pause: vi.fn() }))
    const adapter = createAnimationAdapter(animeImplementation)
    const result = applyResolvedActions(actions, runtimeElements, adapter)

    const node = runtimeElements.get('item-1')?.nodeRef as RuntimeNode
    expect(node.attributes['data-state']).toBe('done')
    expect(result.conflictTrace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'rejected', reason: 'ATTR_OVERRIDDEN_SAME_TICK' }),
        expect.objectContaining({ status: 'applied', reason: 'ATTR_OVERRIDDEN_SAME_TICK' })
      ])
    )
  })

  it('L10-T4 className token conflict keeps last operation for one token', () => {
    const runtimeElements = makeRuntimeElements({
      'item-1': {
        tagName: 'DIV',
        id: 'item-1',
        className: '',
        style: {},
        attributes: {}
      }
    })

    const actions: AnimationResolvedAction[] = [
      makeResolvedAction({
        eventId: 'evt-1',
        listenerId: 'item-1',
        action: {
          targetId: 'item-1',
          className: { add: 'active' }
        }
      }),
      makeResolvedAction({
        eventId: 'evt-2',
        listenerId: 'item-1',
        action: {
          targetId: 'item-1',
          className: { remove: 'active' }
        }
      })
    ]

    const animeImplementation = vi.fn<AnimeImplementation>(() => ({ pause: vi.fn() }))
    const adapter = createAnimationAdapter(animeImplementation)
    const result = applyResolvedActions(actions, runtimeElements, adapter)

    const node = runtimeElements.get('item-1')?.nodeRef as RuntimeNode
    expect(node.className).toBe('')
    expect(result.conflictTrace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'rejected', reason: 'CLASSNAME_OVERRIDDEN_SAME_TICK' }),
        expect.objectContaining({ status: 'applied', reason: 'CLASSNAME_OVERRIDDEN_SAME_TICK' })
      ])
    )
  })

  it('L10-T5 same key on different targets does not conflict', () => {
    const runtimeElements = makeRuntimeElements({
      'item-1': {
        tagName: 'DIV',
        id: 'item-1',
        className: '',
        style: { opacity: 0 },
        attributes: {}
      },
      'item-2': {
        tagName: 'DIV',
        id: 'item-2',
        className: '',
        style: { opacity: 0 },
        attributes: {}
      }
    })

    const actions: AnimationResolvedAction[] = [
      makeResolvedAction({
        eventId: 'evt-1',
        listenerId: 'item-1',
        action: {
          targetId: 'item-1',
          style: {
            opacity: { from: 0, to: 1, duration: 300 }
          }
        }
      }),
      makeResolvedAction({
        eventId: 'evt-2',
        listenerId: 'item-2',
        action: {
          targetId: 'item-2',
          style: {
            opacity: { from: 0, to: 1, duration: 300 }
          }
        }
      })
    ]

    const animeImplementation = vi.fn<AnimeImplementation>(() => ({ pause: vi.fn() }))
    const adapter = createAnimationAdapter(animeImplementation)
    const result = applyResolvedActions(actions, runtimeElements, adapter)

    expect(result.animation.appliedCount).toBe(2)
    expect(result.conflictTrace).toEqual([])
  })

  it('L10-T6 move-only action is preserved and updates runtime parent id', () => {
    const runtimeElements = makeRuntimeElements({
      parent: {
        tagName: 'DIV',
        id: 'parent',
        className: '',
        style: {},
        attributes: {}
      },
      child: {
        tagName: 'DIV',
        id: 'child',
        className: '',
        style: {},
        attributes: {}
      }
    })

    const actions: AnimationResolvedAction[] = [
      makeResolvedAction({
        eventId: 'evt-1',
        listenerId: 'child',
        action: {
          targetId: 'child',
          move: 'parent'
        }
      })
    ]

    const animeImplementation = vi.fn<AnimeImplementation>(() => ({ pause: vi.fn() }))
    const adapter = createAnimationAdapter(animeImplementation)
    const result = applyResolvedActions(actions, runtimeElements, adapter)

    const childNode = runtimeElements.get('child')?.nodeRef as RuntimeNode & { parentId?: string }
    expect(childNode.parentId).toBe('parent')
    expect(result.appliedActionsCount).toBe(1)
  })

  it('L10-T7 move is applied before className patch on same action', () => {
    const operationOrder: string[] = []
    let parentIdValue = ''
    let classNameValue = 'before-move'

    const childNode: RuntimeNode & { parentId?: string } = {
      tagName: 'DIV',
      id: 'child',
      className: classNameValue,
      style: {},
      attributes: {}
    }

    Object.defineProperty(childNode, 'parentId', {
      configurable: true,
      enumerable: true,
      get: () => parentIdValue,
      set: (value: unknown) => {
        parentIdValue = String(value)
        operationOrder.push(`move:${parentIdValue}`)
      }
    })

    Object.defineProperty(childNode, 'className', {
      configurable: true,
      enumerable: true,
      get: () => classNameValue,
      set: (value: unknown) => {
        classNameValue = String(value)
        operationOrder.push(`class:${classNameValue}`)
      }
    })

    const runtimeElements = makeRuntimeElements({
      parent: {
        tagName: 'DIV',
        id: 'parent',
        className: '',
        style: {},
        attributes: {}
      },
      child: childNode
    })

    const actions: AnimationResolvedAction[] = [
      makeResolvedAction({
        eventId: 'evt-1',
        listenerId: 'child',
        action: {
          targetId: 'child',
          move: 'parent',
          className: { add: 'after-move' }
        }
      })
    ]

    const animeImplementation = vi.fn<AnimeImplementation>(() => ({ pause: vi.fn() }))
    const adapter = createAnimationAdapter(animeImplementation)
    applyResolvedActions(actions, runtimeElements, adapter)

    expect(operationOrder).toEqual(['move:parent', 'class:before-move after-move'])
  })
})

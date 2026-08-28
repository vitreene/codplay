import { describe, expect, it } from 'vitest'

import { computeListDiff } from '../../src/runtime/list-plugin/compute-list-diff'
import { runListPlugin } from '../../src/runtime/list-plugin/run-list-plugin'
import type { ListPlugin } from '../../src/runtime/list-plugin/types'
import { createElement } from '../../src/runtime/create-element'
import type { ItemDoc } from '../../src/runtime/types'

/**
 * Creates a list item fixture used in Lot 07 tests.
 */
function temp__createListItem(): ItemDoc {
  return {
    id: 'list-1',
    type: 'list',
    initial: {
      tag: 'ul'
    },
    list: {
      autoAnimate: {
        insert: true,
        remove: true,
        move: true,
        durationMs: 300,
        easing: 'easeOutQuad',
        staggerMs: 10
      },
      perf: {
        maxMoveAnimations: 8
      }
    },
    actions: {}
  }
}

describe('Lot 07 - list plugin (diff + FLIP + fallback)', () => {
  it('L7-T1 computes diff with stable added/removed/moved sets', () => {
    const diff = computeListDiff(['a', 'b', 'c'], ['b', 'c', 'd'])

    expect(diff).toEqual({
      added: ['d'],
      removed: ['a'],
      moved: ['b', 'c']
    })
  })

  it('L7-T2 derives FLIP move transitions from before/after snapshots', () => {
    const output = runListPlugin({
      runtimeListId: 'list-1',
      nodeRef: {},
      prevChildrenIds: ['a', 'b'],
      nextChildrenIds: ['b', 'a'],
      nowMs: 10,
      positionsBefore: {
        a: { x: 0, y: 0 },
        b: { x: 100, y: 0 }
      },
      positionsAfter: {
        a: { x: 100, y: 0 },
        b: { x: 0, y: 0 }
      }
    })

    const moveTransitions = output.transitions.filter((transition) => transition.eventName === 'list:child:move:flip')
    expect(moveTransitions).toHaveLength(2)
    expect(moveTransitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ childId: 'a', property: 'x', from: -100, to: 0 }),
        expect.objectContaining({ childId: 'b', property: 'x', from: 100, to: 0 })
      ])
    )
  })

  it('L7-T3 applies perf fallback by dropping move transitions only', () => {
    const output = runListPlugin({
      runtimeListId: 'list-1',
      nodeRef: {},
      prevChildrenIds: ['a', 'b', 'c', 'd'],
      nextChildrenIds: ['d', 'c', 'b', 'e'],
      nowMs: 20,
      perf: {
        maxMoveAnimations: 1
      },
      positionsBefore: {
        b: { x: 100, y: 0 },
        c: { x: 200, y: 0 },
        d: { x: 300, y: 0 }
      },
      positionsAfter: {
        b: { x: 200, y: 0 },
        c: { x: 100, y: 0 },
        d: { x: 0, y: 0 }
      }
    })

    const moveTransitions = output.transitions.filter((transition) => transition.eventName === 'list:child:move:flip')
    const enterLeaveTransitions = output.transitions.filter(
      (transition) => transition.eventName === 'list:child:enter' || transition.eventName === 'list:child:leave:started'
    )

    expect(moveTransitions).toHaveLength(0)
    expect(enterLeaveTransitions).toHaveLength(2)
    expect(output.perf).toEqual({ fallbackUsed: true, droppedMoveAnimations: 3 })
    expect(output.trace.some((entry) => entry.eventName === 'list:perf:fallback')).toBe(true)
  })

  it('L7-T4 creates a list plugin instance from createElement', () => {
    const listItem = temp__createListItem()
    const runtimeElement = createElement(listItem)
    const listPlugin = runtimeElement.plugins?.[0] as ListPlugin

    expect(listPlugin.name).toBe('list-plugin')

    const output = listPlugin.compute({
      prevChildrenIds: ['a'],
      nextChildrenIds: ['a', 'b'],
      nowMs: 100
    })

    expect(output.diff.added).toEqual(['b'])
    expect(output.transitions.some((transition) => transition.eventName === 'list:child:enter')).toBe(true)
  })

  it('L7-T5 outputs commit plan for leaving children on remove', () => {
    const output = runListPlugin({
      runtimeListId: 'list-1',
      nodeRef: {},
      prevChildrenIds: ['a', 'b'],
      nextChildrenIds: ['b'],
      nowMs: 30
    })

    expect(output.commitPlan).toEqual({
      leaving: ['a'],
      detachAfterAnimation: ['a']
    })
  })
})

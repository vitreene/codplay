import { describe, expect, it } from 'vitest'

import type { AnimationResolvedAction } from '../../src/animation/types'
import { RuntimeComponentOrchestrator } from '../../src/runtime/components'
import type { RuntimeComponentWarning } from '../../src/runtime/components'
import type { RuntimePersos } from '../../src/runtime/types'

type RuntimeNodeFixture = {
  tagName: string
  style: Record<string, unknown>
  attributes: Record<string, unknown>
  className?: string
  textContent?: string
  parentId?: string
}

/**
 * Creates one runtime node fixture map used by nodeFactory.
 */
function temp__createRuntimeNodeFixtures(): Map<string, RuntimeNodeFixture> {
  const nodeById = new Map<string, RuntimeNodeFixture>()

  for (const itemId of ['list-a', 'list-b', 'item-a', 'item-b', 'item-c']) {
    nodeById.set(itemId, {
      tagName: itemId.startsWith('list') ? 'SECTION' : 'DIV',
      style: {},
      attributes: {}
    })
  }

  return nodeById
}

/**
 * Creates one baseline runtime perso fixture for Phase C move tests.
 */
function temp__createStoryFixture(overrides?: {
  listAConfig?: { reorderOnMove?: boolean; reorderOnAdd?: boolean; reorderOnRemove?: boolean }
}): RuntimePersos {
  return {
    id: 'story-phase-c',
    persos: {
      'list-a': {
        id: 'list-a',
        type: 'list',
        initial: {
          id: 'list-a',
          className: 'list-a',
          config: overrides?.listAConfig
        },
        actions: {}
      },
      'list-b': {
        id: 'list-b',
        type: 'list',
        initial: {
          id: 'list-b',
          className: 'list-b'
        },
        actions: {}
      },
      'item-a': {
        id: 'item-a',
        type: 'text',
        initial: {
          id: 'item-a',
          content: 'A',
          move: {
            parentId: 'list-a',
          }
        },
        actions: {}
      },
      'item-b': {
        id: 'item-b',
        type: 'text',
        initial: {
          id: 'item-b',
          content: 'B',
          move: {
            parentId: 'list-a',
          }
        },
        actions: {}
      },
      'item-c': {
        id: 'item-c',
        type: 'text',
        initial: {
          id: 'item-c',
          content: 'C',
          move: {
            parentId: 'list-a',
          }
        },
        actions: {}
      }
    }
  }
}

/**
 * Creates one resolved action wrapper for component orchestrator tests.
 */
function temp__createResolvedAction(input: {
  eventId: string
  listenerId: string
  action: Record<string, unknown>
}): AnimationResolvedAction {
  return {
    eventId: input.eventId,
    eventName: input.eventId,
    listenerId: input.listenerId,
    actionKey: input.eventId,
    action: input.action
  }
}

/**
 * Routes one move command through orchestrator with deterministic event metadata.
 */
function temp__routeMove(
  orchestrator: RuntimeComponentOrchestrator,
  input: {
    eventId: string
    eventSeq: number
    listenerId: string
    move: Record<string, unknown>
  }
): void {
  orchestrator.routeUpdates([
    {
      resolvedAction: temp__createResolvedAction({
        eventId: input.eventId,
        listenerId: input.listenerId,
        action: {
          move: input.move
        }
      }),
      eventSeq: input.eventSeq
    }
  ])
}

describe('Lot 18 - move phase C orchestration', () => {
  it('L18-T1 handles local move, transfer, detached state and reattach reuse', () => {
    const warnings: RuntimeComponentWarning[] = []
    const nodes = temp__createRuntimeNodeFixtures()
    const orchestrator = new RuntimeComponentOrchestrator({
      warn: (warning) => {
        warnings.push(warning)
      },
      createElementOptions: {
        nodeFactory: (item) => nodes.get(item.id)
      }
    })

    orchestrator.loadPersos(temp__createStoryFixture())
    const registry = orchestrator.getRuntimeRegistrySnapshot()

    temp__routeMove(orchestrator, {
      eventId: 'evt-local-first',
      eventSeq: 10,
      listenerId: 'item-c',
      move: {
        parentId: 'list-a',
        mode: 'first'
      }
    })

    const listA = registry.getListById('list-a')
    expect(listA?.getChildrenSnapshot()).toEqual(['item-c', 'item-a', 'item-b'])

    temp__routeMove(orchestrator, {
      eventId: 'evt-transfer',
      eventSeq: 11,
      listenerId: 'item-c',
      move: {
        parentId: 'list-b',
      }
    })

    expect(registry.getParentListId('item-c')).toBe('list-b')
    expect(registry.isMounted('item-c')).toBe(true)

    const nodeBeforeDetach = registry.getNodeById('item-c')
    temp__routeMove(orchestrator, {
      eventId: 'evt-detach',
      eventSeq: 12,
      listenerId: 'item-c',
      move: {
        parentId: 'missing-list',
      }
    })

    expect(registry.getParentListId('item-c')).toBeNull()
    expect(registry.isMounted('item-c')).toBe(false)
    expect(registry.getNodeById('item-c')).toBe(nodeBeforeDetach)

    temp__routeMove(orchestrator, {
      eventId: 'evt-reattach',
      eventSeq: 13,
      listenerId: 'item-c',
      move: {
        parentId: 'list-a',
      }
    })

    expect(registry.getParentListId('item-c')).toBe('list-a')
    expect(registry.isMounted('item-c')).toBe(true)
    expect(registry.getNodeById('item-c')).toBe(nodeBeforeDetach)

    expect(warnings.some((warning) => warning.code === 'AUTHOR_LAYOUT_OUTLET_NOT_FOUND')).toBe(true)
  })

  it('L18-T2 resolves same-tick move conflicts with last-write-wins and invalid-last ignore', () => {
    const warnings: RuntimeComponentWarning[] = []
    const orchestrator = new RuntimeComponentOrchestrator({
      warn: (warning) => {
        warnings.push(warning)
      },
      createElementOptions: {
        nodeFactory: (item) => ({
          tagName: item.type === 'list' ? 'SECTION' : 'DIV',
          style: {},
          attributes: {}
        })
      }
    })

    orchestrator.loadPersos(temp__createStoryFixture())
    const registry = orchestrator.getRuntimeRegistrySnapshot()

    orchestrator.routeUpdates([
      {
        resolvedAction: temp__createResolvedAction({
          eventId: 'evt-conflict-1',
          listenerId: 'item-a',
          action: {
            move: {
              parentId: 'list-a',
            }
          }
        }),
        eventSeq: 20
      },
      {
        resolvedAction: temp__createResolvedAction({
          eventId: 'evt-conflict-2',
          listenerId: 'item-a',
          action: {
            move: {
              parentId: 'list-b',
            }
          }
        }),
        eventSeq: 20
      }
    ])

    expect(registry.getParentListId('item-a')).toBe('list-b')
    expect(warnings.filter((warning) => warning.code === 'AUTHOR_MOVE_CONFLICT_SAME_TICK')).toHaveLength(1)

    orchestrator.routeUpdates([
      {
        resolvedAction: temp__createResolvedAction({
          eventId: 'evt-invalid-1',
          listenerId: 'item-b',
          action: {
            move: {
              parentId: 'list-b',
            }
          }
        }),
        eventSeq: 21
      },
      {
        resolvedAction: temp__createResolvedAction({
          eventId: 'evt-invalid-2',
          listenerId: 'item-b',
          action: {
            move: {
              parentId: 42,
            }
          }
        }),
        eventSeq: 21
      }
    ])

    expect(registry.getParentListId('item-b')).toBe('list-a')
    expect(warnings.filter((warning) => warning.code === 'AUTHOR_MOVE_LAST_INVALID_SAME_TICK')).toHaveLength(1)
  })

  it('L18-T3 applies number clamp, persistent placement and reorder policy overrides', () => {
    const orchestrator = new RuntimeComponentOrchestrator({
      warn: () => {
        return
      },
      createElementOptions: {
        nodeFactory: (item) => ({
          tagName: item.type === 'list' ? 'SECTION' : 'DIV',
          style: {},
          attributes: {}
        })
      }
    })

    orchestrator.loadPersos(
      temp__createStoryFixture({
        listAConfig: {
          reorderOnMove: false
        }
      })
    )

    const registry = orchestrator.getRuntimeRegistrySnapshot()
    const listA = registry.getListById('list-a')
    if (listA === null) {
      throw new Error('Expected list-a component')
    }

    expect(listA.getChildrenSnapshot()).toEqual(['item-a', 'item-b', 'item-c'])

    temp__routeMove(orchestrator, {
      eventId: 'evt-auto-no-reorder',
      eventSeq: 30,
      listenerId: 'item-c',
      move: {
        parentId: 'list-a',
        mode: 'auto'
      }
    })

    expect(listA.getChildrenSnapshot()).toEqual(['item-a', 'item-b', 'item-c'])

    temp__routeMove(orchestrator, {
      eventId: 'evt-first-persistent',
      eventSeq: 31,
      listenerId: 'item-c',
      move: {
        parentId: 'list-a',
        mode: 'first',
        reorder: false
      }
    })

    expect(listA.getChildrenSnapshot()).toEqual(['item-c', 'item-a', 'item-b'])

    temp__routeMove(orchestrator, {
      eventId: 'evt-number-clamp',
      eventSeq: 32,
      listenerId: 'item-a',
      move: {
        parentId: 'list-a',
        mode: 999
      }
    })

    expect(listA.getChildrenSnapshot()).toEqual(['item-c', 'item-b', 'item-a'])
  })

  it('L18-T4 keeps move routing stable with flipMode opt-in and unknown values', () => {
    const warnings: RuntimeComponentWarning[] = []
    const orchestrator = new RuntimeComponentOrchestrator({
      warn: (warning) => {
        warnings.push(warning)
      },
      createElementOptions: {
        nodeFactory: (item) => ({
          tagName: item.type === 'list' ? 'SECTION' : 'DIV',
          style: {},
          attributes: {}
        })
      }
    })

    orchestrator.loadPersos(temp__createStoryFixture())
    const registry = orchestrator.getRuntimeRegistrySnapshot()

    temp__routeMove(orchestrator, {
      eventId: 'evt-overlay-world',
      eventSeq: 40,
      listenerId: 'item-a',
      move: {
        parentId: 'list-b',
        flipMode: 'overlay-world'
      }
    })

    expect(registry.getParentListId('item-a')).toBe('list-b')

    temp__routeMove(orchestrator, {
      eventId: 'evt-unknown-flip-mode',
      eventSeq: 41,
      listenerId: 'item-a',
      move: {
        parentId: 'list-a',
        flipMode: 'some-future-mode'
      }
    })

    expect(registry.getParentListId('item-a')).toBe('list-a')
    expect(warnings.some((warning) => warning.code === 'AUTHOR_MOVE_COMMAND_INVALID')).toBe(false)
  })

})

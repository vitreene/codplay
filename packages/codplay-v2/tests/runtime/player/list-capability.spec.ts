import { describe, expect, it } from 'vitest'

import {
  ListCapabilityState,
  MOUNT_PLACEMENT_PARENT,
  MOVE_OPERATION_MOUNT,
  MOVE_OPERATION_MOVE,
  MOVE_OPERATION_UNMOUNT,
  MOVE_ORDER_MODE_FIRST,
  buildSolvedGraph,
} from '../../../src/runtime/player'
import type { MoveStateDelta, SolvedPerso, SolvedScene } from '../../../src/runtime/player'

function mountDelta(itemId: string, targetId: string, mode?: 'first' | number): MoveStateDelta {
  return {
    operation: MOVE_OPERATION_MOUNT,
    persoKey: itemId,
    mountedBefore: false,
    mountedAfter: true,
    toTargetId: targetId,
    toPlacement: { kind: MOUNT_PLACEMENT_PARENT, mounted: true, targetId, mode },
  }
}

describe('ListCapabilityState', () => {
  it('registers outlets owned by list components as list targets', () => {
    const list: SolvedPerso = {
      key: 'main:list',
      storyId: 'main',
      persoId: 'list',
      type: 'list',
      state: {},
      placement: {
        kind: MOUNT_PLACEMENT_PARENT,
        mounted: true,
        targetId: 'root-host',
        target: { id: 'root-host', kind: 'root', storyId: 'main' },
      },
      moveIssues: [],
    }
    const item: SolvedPerso = {
      key: 'main:item',
      storyId: 'main',
      persoId: 'item',
      type: 'tag',
      state: {},
      placement: {
        kind: MOUNT_PLACEMENT_PARENT,
        mounted: true,
        targetId: 'list-outlet',
        target: { id: 'list-outlet', kind: 'outlet', storyId: 'main', ownerId: 'main:list' },
        parentKey: 'main:list',
      },
      moveIssues: [],
    }
    const scene: SolvedScene = {
      scene: {} as SolvedScene['scene'],
      timeMs: 0,
      sceneState: {},
      storyStates: {},
      persos: { 'main:list': list, 'main:item': item },
      graph: buildSolvedGraph({ 'main:list': list, 'main:item': item }),
      moveIssues: [],
    }
    const capability = new ListCapabilityState()

    capability.initializeScene(scene)

    expect(capability.getChildrenIds('list-outlet')).toEqual(['main:item'])
  })

  it('consumes generic mount, move, and unmount deltas', () => {
    const capability = new ListCapabilityState()
    capability.registerContainer('list-a')
    capability.registerContainer('list-b')
    capability.registerDetachedItem('item')

    capability.applyDelta(mountDelta('item', 'list-a'))
    expect(capability.getParentId('item')).toBe('list-a')
    expect(capability.getChildrenIds('list-a')).toEqual(['item'])

    capability.applyDelta({
      operation: MOVE_OPERATION_MOVE,
      persoKey: 'item',
      fromTargetId: 'list-a',
      toTargetId: 'list-b',
      mountedBefore: true,
      mountedAfter: true,
      fromPlacement: { kind: MOUNT_PLACEMENT_PARENT, mounted: true, targetId: 'list-a' },
      toPlacement: { kind: MOUNT_PLACEMENT_PARENT, mounted: true, targetId: 'list-b' },
    })
    expect(capability.getChildrenIds('list-a')).toEqual([])
    expect(capability.getChildrenIds('list-b')).toEqual(['item'])

    capability.applyDelta({
      operation: MOVE_OPERATION_UNMOUNT,
      persoKey: 'item',
      fromTargetId: 'list-b',
      mountedBefore: true,
      mountedAfter: false,
      fromPlacement: { kind: MOUNT_PLACEMENT_PARENT, mounted: true, targetId: 'list-b' },
    })
    expect(capability.isMounted('item')).toBe(false)
    expect(capability.getChildrenIds('list-b')).toEqual([])
  })

  it('honors add policy while allowing explicit modes to override it', () => {
    const capability = new ListCapabilityState()
    capability.registerContainer('list', { reorderOnAdd: false })
    capability.registerDetachedItem('first')
    capability.registerDetachedItem('second')

    capability.applyDelta(mountDelta('first', 'list'))
    capability.applyDelta(mountDelta('second', 'list', MOVE_ORDER_MODE_FIRST))

    expect(capability.getChildrenIds('list')).toEqual(['second', 'first'])
  })

  it('does not reorder a same-parent move when reorderOnMove is disabled', () => {
    const capability = new ListCapabilityState()
    capability.registerContainer('list', { reorderOnMove: false })
    capability.registerDetachedItem('first')
    capability.registerDetachedItem('second')
    capability.applyDelta(mountDelta('first', 'list'))
    capability.applyDelta(mountDelta('second', 'list'))

    capability.applyDelta({
      operation: MOVE_OPERATION_MOVE,
      persoKey: 'second',
      fromTargetId: 'list',
      toTargetId: 'list',
      mountedBefore: true,
      mountedAfter: true,
      fromPlacement: { kind: MOUNT_PLACEMENT_PARENT, mounted: true, targetId: 'list' },
      toPlacement: { kind: MOUNT_PLACEMENT_PARENT, mounted: true, targetId: 'list' },
    })

    expect(capability.getChildrenIds('list')).toEqual(['first', 'second'])
  })

  it('publishes authoritative order and the siblings touched by a transfer', () => {
    const capability = new ListCapabilityState()
    capability.registerContainer('source')
    capability.registerContainer('target')
    capability.registerDetachedItem('first')
    capability.registerDetachedItem('second')
    capability.registerDetachedItem('third')
    capability.applyDelta(mountDelta('first', 'source'))
    capability.applyDelta(mountDelta('second', 'source'))
    capability.applyDelta(mountDelta('third', 'target'))
    capability.consumeLayoutProjectionState()

    capability.applyDelta({
      operation: MOVE_OPERATION_MOVE,
      persoKey: 'second',
      fromTargetId: 'source',
      toTargetId: 'target',
      mountedBefore: true,
      mountedAfter: true,
      fromPlacement: { kind: MOUNT_PLACEMENT_PARENT, mounted: true, targetId: 'source' },
      toPlacement: { kind: MOUNT_PLACEMENT_PARENT, mounted: true, targetId: 'target' },
    })

    expect(capability.consumeLayoutProjectionState()).toEqual({
      childrenByTarget: { source: ['first'], target: ['third', 'second'] },
      touchedItemIds: ['second', 'first', 'third'],
    })
  })
})

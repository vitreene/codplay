import { describe, expect, it } from 'vitest'

import {
  ListCapabilityState,
  MOUNT_PLACEMENT_PARENT,
  MOVE_OPERATION_MOUNT,
  MOVE_OPERATION_MOVE,
  MOVE_OPERATION_UNMOUNT,
  MOVE_ORDER_MODE_FIRST,
} from '../../../src/runtime/player'
import type { MoveStateDelta } from '../../../src/runtime/player'

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
})

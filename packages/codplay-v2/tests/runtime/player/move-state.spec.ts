import { describe, expect, it } from 'vitest'

import {
  diffSolvedScenes,
  materializeScene,
  MOUNT_TARGET_KIND_OUTLET,
  MOUNT_TARGET_KIND_ROOT,
  MOVE_OPERATION_MOUNT,
  MOVE_OPERATION_MOVE,
  MOVE_OPERATION_UNMOUNT,
  resolveScene,
  solveScene,
} from '../../../src/runtime/player'
import type { CompiledScene } from '../../../src/scene/compiled'

const scene: CompiledScene = {
  schemaVersion: 'codplay.v2.scene.v1',
  createdAt: '2026-08-01T00:00:00.000Z',
  scene: {
    id: 'move-state-scene',
    listen: [],
    tracks: {},
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: 'item',
          type: 'tag',
          initial: { move: '@root' },
          actions: {
             transfer: { move: { target: 'outlet-a' } },
            detach: { move: '@off' },
             attach: { move: { target: 'outlet-b' } },
          },
        }],
        listen: [],
        eventimes: [
          { name: 'transfer', startAt: 100 },
          { name: 'detach', startAt: 200 },
          { name: 'attach', startAt: 300 },
        ],
      },
    },
  },
  resources: { entries: [] },
  rootNodeIds: ['item'],
  requirements: { components: [], services: [], modules: [], resources: [] },
  actionTargetIndex: {},
}

const mountTargets = [
  { id: 'root-host', kind: MOUNT_TARGET_KIND_ROOT, storyId: 'main' },
  { id: 'outlet-a', kind: MOUNT_TARGET_KIND_OUTLET, storyId: 'main' },
  { id: 'outlet-b', kind: MOUNT_TARGET_KIND_OUTLET, storyId: 'main' },
] as const

function solveAt(timeMs: number) {
  return solveScene(resolveScene(materializeScene(scene, timeMs)), { mountTargets })
}

describe('move state deltas', () => {
  it('reports generic mount, unmount, and parent-change transitions', () => {
    const before = solveAt(50)
    const transferred = solveAt(150)
    const detached = solveAt(250)
    const reattached = solveAt(350)

    expect(diffSolvedScenes(before, transferred)).toMatchObject([{
      operation: MOVE_OPERATION_MOVE,
      persoKey: 'main:item',
      fromTargetId: 'root-host',
      toTargetId: 'outlet-a',
    }])
    expect(diffSolvedScenes(transferred, detached)).toMatchObject([{
      operation: MOVE_OPERATION_UNMOUNT,
      persoKey: 'main:item',
      mountedBefore: true,
      mountedAfter: false,
    }])
    expect(diffSolvedScenes(detached, reattached)).toMatchObject([{
      operation: MOVE_OPERATION_MOUNT,
      persoKey: 'main:item',
      mountedBefore: false,
      mountedAfter: true,
      toTargetId: 'outlet-b',
    }])
  })

  it('does not apply list ordering or emit a delta for unchanged placement', () => {
    const current = solveAt(150)

    expect(diffSolvedScenes(current, solveAt(150))).toEqual([])
  })
})

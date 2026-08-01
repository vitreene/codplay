import { describe, expect, it } from 'vitest'

import {
  MOUNT_TARGET_KIND_HOST,
  MOUNT_TARGET_KIND_OUTLET,
  MOUNT_TARGET_KIND_ROOT,
  MountTargetRegistry,
} from '../../../src/runtime/player'
import type { CompiledScene } from '../../../src/scene/compiled'

const scene: CompiledScene = {
  schemaVersion: 'codplay.v2.scene.v1',
  createdAt: '2026-08-01T00:00:00.000Z',
  scene: {
    id: 'target-scene',
    listen: [],
    tracks: {},
    stories: {
      main: {
        id: 'main',
        persos: [{ id: 'panel', type: 'tag', initial: {}, actions: {} }],
        listen: [],
      },
    },
  },
  resources: { entries: [] },
  rootNodeIds: ['panel'],
  requirements: { components: [], services: [], modules: [], resources: [] },
}

describe('MountTargetRegistry', () => {
  it('resolves opaque IDs from internal declarations without parsing their names', () => {
    const registry = MountTargetRegistry.fromScene(scene, [
      { id: 'toto', kind: MOUNT_TARGET_KIND_OUTLET, storyId: 'main', ownerId: 'panel' },
      { id: 'tutu', kind: MOUNT_TARGET_KIND_HOST, storyId: 'main' },
      { id: 'root-host', kind: MOUNT_TARGET_KIND_ROOT, storyId: 'main' },
    ])

    expect(registry.resolve('toto')).toMatchObject({ kind: MOUNT_TARGET_KIND_OUTLET })
    expect(registry.resolve('tutu')).toMatchObject({ kind: MOUNT_TARGET_KIND_HOST })
    expect(registry.resolveStoryRoot('main')).toMatchObject({ id: 'root-host' })
    expect(registry.resolve('missing')).toBeUndefined()
  })

  it('rejects duplicate IDs at scene scope', () => {
    expect(() => MountTargetRegistry.fromScene(scene, [{ id: 'panel', kind: MOUNT_TARGET_KIND_HOST }]))
      .toThrow('Mount target ID is duplicated: panel')
  })
})

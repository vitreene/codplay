import { describe, expect, it } from 'vitest'

import {
  RuntimeStateStore,
  STRAP_SCOPE_SCENE,
  STRAP_SCOPE_STORY,
} from '../../../src/runtime/player'
import type { CompiledScene } from '../../../src/scene/compiled'

const scene: CompiledScene = {
  schemaVersion: 'codplay.v2.scene.v1',
  createdAt: '2026-08-01T00:00:00.000Z',
  scene: {
    id: 'state-scene',
    state: { score: 0 },
    listen: [],
    tracks: {},
    stories: {
      main: { id: 'main', state: { count: 1 }, persos: [], listen: [] },
    },
  },
  resources: { entries: [] },
  rootNodeIds: [],
  requirements: { components: [], services: [], modules: [], resources: [] },
  actionTargetIndex: {},
}

describe('RuntimeStateStore', () => {
  it('exposes frozen snapshots and applies scoped updates explicitly', () => {
    const store = new RuntimeStateStore(scene)

    expect(store.snapshot(STRAP_SCOPE_SCENE)).toEqual({ score: 0 })
    expect(store.snapshot(STRAP_SCOPE_STORY, 'main')).toEqual({ count: 1 })
    expect(Object.isFrozen(store.snapshot(STRAP_SCOPE_STORY, 'main'))).toBe(true)
    expect(store.applyUpdate(STRAP_SCOPE_STORY, { count: 2, answered: true }, 'main')).toEqual({
      count: 2,
      answered: true,
    })
    expect(store.snapshot(STRAP_SCOPE_SCENE)).toEqual({ score: 0 })
  })

  it('supports replacing one scope after a seek reconstruction', () => {
    const store = new RuntimeStateStore(scene)

    store.applyUpdate(STRAP_SCOPE_SCENE, { score: 10 })
    store.replace(STRAP_SCOPE_SCENE, { score: 3 })

    expect(store.snapshot(STRAP_SCOPE_SCENE)).toEqual({ score: 3 })
  })

  it('requires story ids for story-scoped access', () => {
    const store = new RuntimeStateStore(scene)

    expect(() => store.snapshot(STRAP_SCOPE_STORY)).toThrow(/storyId/)
    expect(() => store.applyUpdate(STRAP_SCOPE_STORY, { count: 2 })).toThrow(/storyId/)
  })
})

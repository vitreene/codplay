import { describe, expect, it } from 'vitest'

import {
  resolveStrapCollection,
  resolveSceneStrap,
  resolveStoryStrap,
  STRAP_SCOPE_SCENE,
  STRAP_SCOPE_STORY,
  validateStrapCollections,
  type StrapCollections,
} from '../../../src/runtime/player'
import type { CompiledScene, CompiledFunctionCollection } from '../../../src/scene/compiled'

const scene: CompiledScene = {
  schemaVersion: 'codplay.v2.scene.v1',
  createdAt: '2026-08-01T00:00:00.000Z',
  scene: {
    id: 'strap-scene',
    straps: ['scene-strap', 'missing-scene-strap'],
    listen: [],
    tracks: {},
    stories: {
      main: {
        id: 'main',
        straps: ['story-strap', 'missing-story-strap'],
        persos: [],
        listen: [],
      },
    },
  },
  resources: { entries: [] },
  rootNodeIds: [],
  requirements: { components: [], services: [], modules: [], resources: [] },
  actionTargetIndex: {},
}

describe('strap collection scopes', () => {
  it('resolves local scene/story declarations without an external collection', () => {
    const functions: CompiledFunctionCollection = {
      'fn:scene': () => undefined,
      'fn:story': () => undefined,
    }
    const sceneCollection = resolveStrapCollection(
      { local: { ref: 'fn:scene' } },
      {},
      functions,
    )
    const storyCollection = resolveStrapCollection(
      { local: { ref: 'fn:story' } },
      {},
      functions,
    )

    expect(sceneCollection.local).toBe(functions['fn:scene'])
    expect(storyCollection.local).toBe(functions['fn:story'])
  })

  it('does not merge a local declaration with a reusable collection', () => {
    const local = () => undefined
    const reusable = () => undefined
    const collection = resolveStrapCollection(
      { shared: { ref: 'fn:local' } },
      { shared: reusable },
      { 'fn:local': local },
    )

    expect(collection.shared).toBe(local)
  })

  it('does not fall back between scene and story collections', () => {
    const sceneStrap = () => undefined
    const storyStrap = () => undefined
    const collections: StrapCollections = {
      scene: { 'scene-strap': sceneStrap },
      stories: { main: { 'story-strap': storyStrap } },
    }

    expect(resolveSceneStrap('scene-strap', collections)).toBe(sceneStrap)
    expect(resolveSceneStrap('story-strap', collections)).toBeUndefined()
    expect(resolveStoryStrap('main', 'story-strap', collections)).toBe(storyStrap)
    expect(resolveStoryStrap('main', 'scene-strap', collections)).toBeUndefined()
  })

  it('reports missing declared straps in their owning scope', () => {
    const issues = validateStrapCollections(scene, {
      scene: { 'scene-strap': () => undefined },
      stories: { main: { 'story-strap': () => undefined } },
    })

    expect(issues).toEqual([
      {
        code: 'AUTHOR_SCENE_STRAP_MISSING',
        message: 'Scene strap is declared but not available: missing-scene-strap',
        scope: STRAP_SCOPE_SCENE,
        strapName: 'missing-scene-strap',
      },
      {
        code: 'AUTHOR_STORY_STRAP_MISSING',
        message: 'Story strap is declared but not available: missing-story-strap',
        scope: STRAP_SCOPE_STORY,
        storyId: 'main',
        strapName: 'missing-story-strap',
      },
    ])
  })
})

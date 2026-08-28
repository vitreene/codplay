// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { BuilderFacade } from '../../src/builder/create-builder'
import { Player } from '../../src/player'
import { PlayerFacade } from '../../src/player/create-player'
import type { SceneDef } from '../../src/builder/types'
import type { SceneDoc } from '../../src/player/types'

type RuntimeNodeFixture = {
  tagName: string
  style: Record<string, unknown>
  attributes: Record<string, unknown>
  id?: string
  className?: string
  textContent?: string
  parentNode?: RuntimeNodeFixture | null
  children?: RuntimeNodeFixture[]
}

/**
 * Creates one plain runtime node fixture for one authored perso.
 */
function createRuntimeNodeFixture(tagName: string): RuntimeNodeFixture {
  return {
    tagName,
    style: {},
    attributes: {}
  }
}

/**
 * Creates one strict scene fixture mounting two stories into the same runtime.
 */
function createMountedStoriesSceneFixture(): SceneDoc {
  return {
    id: 'scene-mounted-stories',
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      'story-a': {
        id: 'story-a',
        name: 'a',
        initial: { move: '@root' },
        persos: [
          {
            id: 'story-a__title',
            name: 'title-a',
            type: 'tag',
            initial: { content: 'A', move: '@root' },
            actions: {
              'story-a__title': null
            }
          }
        ],
        straps: undefined,
        listen: []
      },
      'story-b': {
        id: 'story-b',
        name: 'b',
        initial: { move: '@root' },
        persos: [
          {
            id: 'story-b__title',
            name: 'title-b',
            type: 'tag',
            initial: { content: 'B', move: '@root' },
            actions: {
              'story-b__title': null
            }
          }
        ],
        straps: undefined,
        listen: []
      }
    },
    tracks: {}
  }
}

/**
 * Creates one builder-compatible scene fixture with two root-level persos in
 * the same story (`story.initial.move: '@root'`, each perso also `'@root'`).
 * Compiled through the full Builder -> Player pipeline so `rootNodeIds` and
 * `Player.mountRootNodes()` (the real page-root grouping mechanism) run.
 */
function createRootGroupingSceneFixture(): SceneDef {
  return {
    id: 'scene-story-host',
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      'story-a': {
        id: 'story-a',
        name: 'a',
        initial: { move: '@root' },
        persos: [
          {
            id: 'story-a__lead',
            name: 'lead',
            type: 'tag',
            initial: { content: 'lead', move: '@root' },
            actions: {
              'story-a__lead': null
            }
          },
          {
            id: 'story-a__tail',
            name: 'tail',
            type: 'tag',
            initial: { content: 'tail', move: '@root' },
            actions: {
              'story-a__tail': null
            }
          }
        ],
        straps: undefined,
        listen: []
      }
    },
    tracks: {}
  }
}

describe('V1 - mounted stories runtime', () => {
  it('keeps all mounted stories composed in the runtime registry', async () => {
    const player = new PlayerFacade({
      createElementOptions: {
        nodeFactory: (perso) => createRuntimeNodeFixture(perso.type === 'list' ? 'SECTION' : 'DIV')
      }
    })

    const initResult = await player.init(createMountedStoriesSceneFixture())

    expect(initResult.ok).toBe(true)
    expect(player.getRuntimeRegistry().getNodeById('story-a__title')).not.toBeNull()
    expect(player.getRuntimeRegistry().getNodeById('story-b__title')).not.toBeNull()
  })

  it('groups two @root persos of the same story directly under the real page mountTarget (no synthetic story host node)', async () => {
    const builder = new BuilderFacade()
    const compileResult = builder.compile({ scene: createRootGroupingSceneFixture() })
    expect(compileResult.ok).toBe(true)
    if (!compileResult.ok) {
      return
    }

    expect(compileResult.data.compiledScene.rootNodeIds).toEqual(['story-a__lead', 'story-a__tail'])

    const mountTarget = document.createElement('div')
    const player = new Player()

    const initResult = await player.init({
      mountTarget,
      compiledScene: compileResult.data.compiledScene,
      resourceManifest: compileResult.data.resourceManifest
    })
    expect(initResult).toEqual({ ok: true, data: undefined })

    // The engine never creates a node itself (v1-invariants.md "Invariants
    // moteur") — there is no intermediate synthetic node between mountTarget
    // and the two persos: they are mountTarget's direct children.
    expect(Array.from(mountTarget.children).map((child) => child.id)).toEqual([
      'story-a__lead',
      'story-a__tail'
    ])

    const registry = player.getRuntimeRegistry()
    expect(registry.isMounted('story-a__lead')).toBe(true)
    expect(registry.isMounted('story-a__tail')).toBe(true)
  })
})

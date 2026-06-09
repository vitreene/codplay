import { describe, expect, it } from 'vitest'

import { PlayerFacade } from '../../src/player/create-player'
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
    rootStories: ['story-a', 'story-b'],
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      'story-a': {
        id: 'story-a',
        name: 'a',
        entries: ['story-a__title'],
        initial: undefined,
        persos: [
          {
            id: 'story-a__title',
            name: 'title-a',
            type: 'tag',
            initial: { content: 'A' },
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
        entries: ['story-b__title'],
        initial: undefined,
        persos: [
          {
            id: 'story-b__title',
            name: 'title-b',
            type: 'tag',
            initial: { content: 'B' },
            actions: {
              'story-b__title': null
            }
          }
        ],
        straps: undefined,
        listen: []
      }
    },
    init(scene, options) {
      options.mount(scene.rootStories[0])
      options.mount(scene.rootStories[1])
    },
    tracks: {}
  }
}

/**
 * Creates one strict scene fixture that mounts root entries into one shared story host.
 */
function createStoryHostSceneFixture(): SceneDoc {
  return {
    id: 'scene-story-host',
    rootStories: ['story-a'],
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      'story-a': {
        id: 'story-a',
        name: 'a',
        entries: ['story-a__lead', 'story-a__tail'],
        initial: undefined,
        persos: [
          {
            id: 'story-a__lead',
            name: 'lead',
            type: 'tag',
            initial: { content: 'lead', move: 'root' },
            actions: {
              'story-a__lead': null
            }
          },
          {
            id: 'story-a__tail',
            name: 'tail',
            type: 'tag',
            initial: { content: 'tail' },
            actions: {
              'story-a__tail': null
            }
          }
        ],
        straps: undefined,
        listen: []
      }
    },
    init(scene, options) {
      options.mount(scene.rootStories[0])
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

  it('mounts root entries into the story host when rootToken is used', async () => {
    const player = new PlayerFacade({
      createElementOptions: {
        nodeFactory: (perso) => createRuntimeNodeFixture(perso.type === 'list' ? 'SECTION' : 'DIV')
      }
    })

    const initResult = await player.init(createStoryHostSceneFixture())

    expect(initResult.ok).toBe(true)

    const registry = player.getRuntimeRegistry()
    const leadNode = registry.getNodeById('story-a__lead') as RuntimeNodeFixture | null
    const tailNode = registry.getNodeById('story-a__tail') as RuntimeNodeFixture | null

    expect(leadNode?.parentNode).toBe(tailNode?.parentNode)
    expect(leadNode?.parentNode?.children?.map((child) => child.id)).toEqual([
      'story-a__lead',
      'story-a__tail'
    ])
  })
})

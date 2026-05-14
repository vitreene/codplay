import { describe, expect, it } from 'vitest'

import { BuilderFacade } from '../../src/builder/create-builder'
import type { SceneDef } from '../../src/builder/types'
import { Player } from '../../src/player'
import { RUNTIME_OBJECT_EVENT_HANDLERS } from '../../src/runtime/create-element'

type RuntimeNodeFixture = {
  tagName: string
  style: Record<string, unknown>
  attributes: Record<string, unknown>
  className?: string
  textContent?: string
  [RUNTIME_OBJECT_EVENT_HANDLERS]?: Record<string, () => void>
}

const EVENT_NAME = {
  localTrigger: 'story:local:trigger',
  localFlash: 'story:flash:local',
  globalTrigger: 'story:global:trigger',
  sceneFlash: 'scene:flash',
  globalFlash: 'story:flash:global'
} as const

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
 * Creates one scene fixture proving story.listen local scope and scene cascade.
 */
function createStoryListenScopeSceneFixture(): SceneDef {
  return {
    id: 'scene-story-listen-scope',
    rootStories: ['story-a', 'story-b'],
    initial: undefined,
    straps: undefined,
    listen: [
      {
        on: EVENT_NAME.sceneFlash,
        emit: [{ name: EVENT_NAME.globalFlash }]
      }
    ],
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
            type: 'text',
            initial: { content: 'A' },
            actions: {
              'story-a__title': null,
              [EVENT_NAME.localFlash]: {
                className: { add: 'local-a' }
              },
              [EVENT_NAME.globalFlash]: {
                className: { add: 'global-a' }
              }
            },
            emit: {
              click: {
                event: {
                  name: EVENT_NAME.localTrigger
                }
              },
              dblclick: {
                event: {
                  name: EVENT_NAME.globalTrigger
                }
              }
            }
          }
        ],
        straps: undefined,
        listen: [
          {
            on: EVENT_NAME.localTrigger,
            emit: [{ name: EVENT_NAME.localFlash }]
          },
          {
            on: EVENT_NAME.globalTrigger,
            emit: [{ name: EVENT_NAME.sceneFlash, cascade: true }]
          }
        ]
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
            type: 'text',
            initial: { content: 'B' },
            actions: {
              'story-b__title': null,
              [EVENT_NAME.localFlash]: {
                className: { add: 'local-b' }
              },
              [EVENT_NAME.globalFlash]: {
                className: { add: 'global-b' }
              }
            }
          }
        ],
        straps: undefined,
        listen: []
      }
    },
    init(scene, options) {
      for (const storyId of scene.rootStories) {
        options.mount(storyId)
      }
    },
    tracks: {}
  }
}

describe('V1 - story.listen scope', () => {
  it('keeps story.listen emits local unless cascade promotes them to scene level', async () => {
    const builder = new BuilderFacade()
    const player = new Player({
      createElementOptions: {
        nodeFactory: (item) => createRuntimeNodeFixture(item.type === 'list' ? 'SECTION' : 'DIV')
      }
    })
    const compileResult = builder.compile({ scene: createStoryListenScopeSceneFixture() })

    expect(compileResult.ok).toBe(true)
    if (!compileResult.ok) {
      return
    }

    expect(await player.init({
      mountTarget: {},
      compiledScene: compileResult.data.compiledScene,
      resourceManifest: compileResult.data.resourceManifest
    })).toEqual({ ok: true, data: undefined })

    const nodeA = player.getRuntimeRegistry().getNodeById('story-a__title') as RuntimeNodeFixture | null
    const nodeB = player.getRuntimeRegistry().getNodeById('story-b__title') as RuntimeNodeFixture | null
    expect(nodeA).not.toBeNull()
    expect(nodeB).not.toBeNull()

    nodeA?.[RUNTIME_OBJECT_EVENT_HANDLERS]?.click?.()

    expect(player.getRuntimeRegistry().getNodeById('story-a__title')).toMatchObject({
      className: 'local-a'
    })
    expect(player.getRuntimeRegistry().getNodeById('story-b__title')).toMatchObject({
      className: ''
    })

    nodeA?.[RUNTIME_OBJECT_EVENT_HANDLERS]?.dblclick?.()

    expect(player.getRuntimeRegistry().getNodeById('story-a__title')).toMatchObject({
      className: 'local-a global-a'
    })
    expect(player.getRuntimeRegistry().getNodeById('story-b__title')).toMatchObject({
      className: 'global-b'
    })
  })
})

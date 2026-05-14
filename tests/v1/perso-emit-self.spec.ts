import { describe, expect, it } from 'vitest'

import { PlayerFacade } from '../../src/player/create-player'
import { RUNTIME_OBJECT_EVENT_HANDLERS } from '../../src/runtime/create-element'
import type { SceneDoc } from '../../src/player/types'

type RuntimeNodeFixture = {
  tagName: string
  style: Record<string, unknown>
  attributes: Record<string, unknown>
  className?: string
  textContent?: string
  [RUNTIME_OBJECT_EVENT_HANDLERS]?: Record<string, () => void>
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
 * Creates one strict scene fixture with one perso user emit.
 */
function createPersoEmitSceneFixture(): SceneDoc {
  return {
    id: 'scene-emit-self',
    rootStories: ['story-main'],
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      'story-main': {
        id: 'story-main',
        name: 'main',
        entries: ['story-main__title'],
        initial: undefined,
        persos: [
          {
            id: 'story-main__title',
            name: 'title',
            type: 'text',
            initial: { content: 'hello' },
            actions: {
              'story-main__title': null,
              'title:clicked': {
                className: { add: 'clicked' }
              }
            },
            emit: {
              click: {
                event: {
                  name: 'title:clicked'
                },
                data: {
                  origin: 'user'
                }
              }
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

describe('V1 - perso emit self context', () => {
  it('injects self.id/self.name/self.storyId into perso emits', async () => {
    const player = new PlayerFacade({
      createElementOptions: {
        nodeFactory: (item) => createRuntimeNodeFixture(item.type === 'list' ? 'SECTION' : 'DIV')
      }
    })
    const traces: Array<Record<string, unknown>> = []
    player.onTrace((row) => {
      if (row.eventName === 'player:emit' && row.payload) {
        traces.push(row.payload)
      }
    })

    expect(await player.init(createPersoEmitSceneFixture())).toEqual({ ok: true })

    const node = player.getRuntimeRegistry().getNodeById('story-main__title') as RuntimeNodeFixture | null
    expect(node).not.toBeNull()

    node?.[RUNTIME_OBJECT_EVENT_HANDLERS]?.click?.()

    expect(traces.at(-1)).toMatchObject({
      eventName: 'title:clicked',
      payload: {
        origin: 'user',
        self: {
          id: 'story-main__title',
          name: 'title',
          storyId: 'story-main'
        }
      }
    })

    expect(player.getRuntimeRegistry().getNodeById('story-main__title')).toMatchObject({
      className: 'clicked'
    })
  })
})

import { describe, expect, it } from 'vitest'

import { PlayerFacade } from '../../src/player/create-player'
import type { SceneDoc } from '../../src/player/types'

type RuntimeNodeFixture = {
  tagName: string
  style: Record<string, unknown>
  attributes: Record<string, unknown>
  className?: string
  textContent?: string
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
 * Creates one strict scene fixture used to verify runtime registry persistence across seek.
 */
function createPersistentRuntimeSceneFixture(): SceneDoc {
  return {
    id: 'scene-persistent-runtime',
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
            type: 'tag',
            initial: {
              content: 'persist'
            },
            actions: {
              'story-main__title': null,
              'title:flash': {
                className: { add: 'flashed' }
              }
            }
          }
        ],
        straps: undefined,
        listen: [],
        eventimes: [
          {
            name: 'title:flash',
            startAt: 0
          }
        ]
      }
    },
    init(scene, options) {
      options.mount(scene.rootStories[0])
    },
    onStart(scene, options) {
      options.schedule(scene.rootStories[0])
    },
    tracks: {}
  }
}

describe('V1 - runtime registry persistence', () => {
  it('keeps the same runtime item addressable across seek reloads', async () => {
    const player = new PlayerFacade({
      createElementOptions: {
        nodeFactory: (perso) => createRuntimeNodeFixture(perso.type === 'list' ? 'SECTION' : 'DIV')
      }
    })

    expect(await player.init(createPersistentRuntimeSceneFixture())).toEqual({ ok: true })
    expect(await player.play()).toEqual({ ok: true })

    const nodeBeforeSeek = player.getRuntimeRegistry().getNodeById('story-main__title')
    expect(nodeBeforeSeek).not.toBeNull()

    expect(await player.seek(0)).toEqual({ ok: true })

    const nodeAfterSeek = player.getRuntimeRegistry().getNodeById('story-main__title')
    expect(nodeAfterSeek).not.toBeNull()
    expect(nodeAfterSeek).toMatchObject({
      textContent: 'persist'
    })
  })
})

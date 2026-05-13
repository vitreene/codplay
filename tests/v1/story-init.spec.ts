import { describe, expect, it } from 'vitest'

import { PlayerFacade } from '../../src/player/create-player'
import type { SceneDoc } from '../../src/player/types'

const INIT_TRACE_EVENT = 'player:init:done'

/**
 * Creates one strict scene fixture proving all stories are initialized at scene init.
 */
function createStoryInitSceneFixture(calls: string[]): SceneDoc {
  return {
    id: 'scene-story-init',
    rootStories: ['story-a'],
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      'story-a': {
        id: 'story-a',
        name: 'a',
        entries: ['story-a__title'],
        initial: {
          marker: 'A'
        },
        persos: [
          {
            id: 'story-a__title',
            name: 'title-a',
            type: 'text',
            initial: {
              content: 'A'
            },
            actions: {
              'story-a__title': null
            }
          }
        ],
        straps: undefined,
        listen: [],
        init(input) {
          calls.push(`story-a:${String(input?.marker)}`)
          return {
            initialized: true
          }
        }
      },
      'story-b': {
        id: 'story-b',
        name: 'b',
        entries: ['story-b__title'],
        initial: {
          marker: 'B'
        },
        persos: [
          {
            id: 'story-b__title',
            name: 'title-b',
            type: 'text',
            initial: {
              content: 'B'
            },
            actions: {
              'story-b__title': null
            }
          }
        ],
        straps: undefined,
        listen: [],
        init(input) {
          calls.push(`story-b:${String(input?.marker)}`)
          return {
            initialized: true
          }
        }
      }
    },
    init(scene, options) {
      calls.push(`scene:${Object.keys(scene.stories).length}`)
      options.mount(scene.rootStories[0])
    },
    tracks: {}
  }
}

describe('V1 - story init', () => {
  it('initializes all stories before scene init runs', async () => {
    const calls: string[] = []
    const traces: Array<Record<string, unknown>> = []
    const player = new PlayerFacade()

    player.onTrace((row) => {
      if (row.eventName === INIT_TRACE_EVENT && row.payload) {
        traces.push(row.payload)
      }
    })

    const initResult = await player.init(createStoryInitSceneFixture(calls))

    expect(initResult.ok).toBe(true)
    expect(calls).toEqual(['story-a:A', 'story-b:B', 'scene:2'])
    expect(traces.at(-1)).toMatchObject({
      initializedStoryCount: 2
    })
  })
})

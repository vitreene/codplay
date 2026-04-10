import { describe, expect, it, vi } from 'vitest'

import { createAnimationAdapter, type AnimeImplementation } from '../../src/animation/adapter'
import { PlayerFacade } from '../../src/player/create-player'
import type { SceneDoc } from '../../src/player/types'

/**
 * Creates one scene fixture matching the red DEMO rotation proof of concept.
 */
function createDemoSceneFixture(): SceneDoc {
  return {
    id: 'scene-demo',
    initialStoryId: 'story-demo',
    stories: {
      'story-demo': {
        id: 'story-demo',
        items: {
          'demo-box': {
            id: 'demo-box',
            type: 'text',
            initial: {
              id: 'demo-box',
              tag: 'div',
              className: 'demo-box',
              content: 'DEMO',
              style: {
                backgroundColor: '#c80f17',
                color: '#ffffff'
              }
            },
            actions: {
              'demo:rotate': {
                style: {
                  rotate: {
                    to: 180,
                    duration: 2000
                  }
                }
              }
            }
          }
        }
      }
    },
    tracks: {
      'track-demo': {
        id: 'track-demo',
        source: 'story',
        order: 0,
        events: [
          {
            id: 'evt-demo-rotate',
            ms: 0,
            name: 'demo:rotate',
            index: 0,
            source: 'story'
          }
        ]
      }
    }
  }
}

/**
 * Creates one scene fixture without timeline events for direct emit tests.
 */
function createEmitOnlySceneFixture(): SceneDoc {
  const scene = createDemoSceneFixture()
  return {
    ...scene,
    tracks: {}
  }
}

describe('Lot 17 - real demo flow', () => {
  it('L17-T1 timeline applies DEMO node style and rotate transition', async () => {
    vi.useFakeTimers()

    const runtimeNode = {
      tagName: 'DIV',
      style: {},
      attributes: {}
    }

    const animeImplementation = vi.fn<AnimeImplementation>(() => ({ pause: vi.fn() }))
    const animationAdapter = createAnimationAdapter(animeImplementation)
    const player = new PlayerFacade({
      animationAdapter,
      createElementOptions: {
        nodeFactory: () => runtimeNode
      }
    })

    await player.init(createDemoSceneFixture())
    await player.play()
    await vi.runAllTimersAsync()

    expect(runtimeNode.style).toMatchObject({
      backgroundColor: '#c80f17',
      color: '#ffffff'
    })

    expect(animeImplementation).toHaveBeenCalledTimes(1)
    const callParameters = animeImplementation.mock.calls[0]?.[0] as Record<string, unknown>
    expect(callParameters.targets).toBe(runtimeNode)
    expect(callParameters.duration).toBe(2000)
    expect(callParameters.rotate).toMatchObject({ to: 180 })

    vi.useRealTimers()
  })

  it('L17-T2 emit processes one public event without timeline scheduling', async () => {
    const runtimeNode = {
      tagName: 'DIV',
      style: {},
      attributes: {}
    }

    const traceEvents: string[] = []
    const animeImplementation = vi.fn<AnimeImplementation>(() => ({ pause: vi.fn() }))
    const animationAdapter = createAnimationAdapter(animeImplementation)
    const player = new PlayerFacade({
      animationAdapter,
      createElementOptions: {
        nodeFactory: () => runtimeNode
      }
    })

    player.onTrace((row) => {
      traceEvents.push(`${row.status}:${row.eventName}`)
    })

    await player.init(createEmitOnlySceneFixture())
    await player.emit({
      id: 'evt-public-1',
      name: 'demo:rotate',
      ms: 0,
      source: 'user'
    })

    expect(animeImplementation).toHaveBeenCalledTimes(1)
    expect(traceEvents).toEqual(
      expect.arrayContaining([
        'applied:player:emit',
        'applied:player:event:applied'
      ])
    )
  })
})

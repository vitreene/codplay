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

/**
 * Creates one scene fixture that mutates class and attributes on playback.
 */
function createRewindStateSceneFixture(): SceneDoc {
  return {
    id: 'scene-rewind-state',
    initialStoryId: 'story-rewind-state',
    stories: {
      'story-rewind-state': {
        id: 'story-rewind-state',
        items: {
          'state-box': {
            id: 'state-box',
            type: 'text',
            initial: {
              id: 'state-box',
              className: 'state-initial',
              content: 'STATE',
              style: {
                opacity: 0
              },
              attr: {
                'data-state': 'initial'
              }
            },
            actions: {
              'state:mutate': {
                className: { add: 'state-mutated', remove: 'state-initial' },
                style: {
                  opacity: { to: 1, duration: 200 }
                },
                attr: {
                  'data-state': 'mutated',
                  'data-extra': 'transient'
                }
              }
            }
          }
        }
      }
    },
    tracks: {
      'track-rewind-state': {
        id: 'track-rewind-state',
        source: 'story',
        order: 0,
        events: [
          {
            id: 'evt-state-mutate',
            ms: 0,
            name: 'state:mutate',
            index: 0,
            source: 'story'
          }
        ]
      }
    }
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

  it('L17-T3 playback keeps ms=0 event scheduling with non-zero perf clock', async () => {
    vi.useFakeTimers()

    const runtimeNode = {
      tagName: 'DIV',
      style: {},
      attributes: {}
    }

    let nowValue = 1000
    const nowSpy = vi.spyOn(globalThis.performance, 'now').mockImplementation(() => {
      nowValue += 1
      return nowValue
    })

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

    expect(animeImplementation).toHaveBeenCalledTimes(1)

    nowSpy.mockRestore()
    vi.useRealTimers()
  })

  it('L17-T4 rewind restores runtime node initial style state', async () => {
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
    await player.pause()

    expect(runtimeNode.style).toMatchObject({
      backgroundColor: '#c80f17',
      color: '#ffffff',
      rotate: 180
    })

    await player.rewind()

    expect(player.getState()).toMatchObject({
      status: 'paused',
      timelineMs: 0
    })

    expect(runtimeNode.style).toMatchObject({
      backgroundColor: '#c80f17',
      color: '#ffffff'
    })
    expect(runtimeNode.style.rotate).toBeUndefined()

    vi.useRealTimers()
  })

  it('L17-T5 rewind restores initial className and attributes', async () => {
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

    await player.init(createRewindStateSceneFixture())
    await player.play()
    await vi.runAllTimersAsync()
    await player.pause()

    expect(runtimeNode.className).toBe('state-mutated')
    expect(runtimeNode.attributes).toMatchObject({
      'data-state': 'mutated',
      'data-extra': 'transient'
    })

    await player.rewind()

    expect(player.getState()).toMatchObject({
      status: 'paused',
      timelineMs: 0
    })
    expect(runtimeNode.className).toBe('state-initial')
    expect(runtimeNode.attributes).toEqual({
      'data-state': 'initial'
    })

    vi.useRealTimers()
  })
})

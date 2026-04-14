import { describe, expect, it, vi } from 'vitest'

import { createAnimationAdapter, type AnimeImplementation } from '../../src/animation/adapter'
import { PlayerFacade } from '../../src/player/create-player'
import type { SceneDoc } from '../../src/player/types'

describe('Lot 16 - playback timeline minimal', () => {
  it('L16-T1 play schedules timeline events and applies mapped actions', async () => {
    vi.useFakeTimers()

    const runtimeNode = {
      tagName: 'DIV',
      style: {
        opacity: 0
      },
      attributes: {}
    }

    const scene: SceneDoc = {
      id: 'scene-main',
      initialStoryId: 'story-main',
      stories: {
        'story-main': {
          id: 'story-main',
          items: {
            title: {
              id: 'title',
              type: 'text',
              initial: {
                id: 'title'
              },
              actions: {
                intro: {
                  style: {
                    opacity: {
                      from: 0,
                      to: 1,
                      duration: 300
                    }
                  }
                }
              }
            }
          }
        }
      },
      tracks: {
        'track-story-main': {
          id: 'track-story-main',
          source: 'story',
          order: 0,
          events: [
            {
              id: 'evt-1',
              ms: 0,
              name: 'intro',
              index: 0,
              source: 'story'
            }
          ]
        }
      }
    }

    const animeImplementation = vi.fn<AnimeImplementation>(() => ({ pause: vi.fn() }))
    const animationAdapter = createAnimationAdapter(animeImplementation)
    const player = new PlayerFacade({
      animationAdapter,
      createElementOptions: {
        nodeFactory: () => runtimeNode
      }
    })

    await player.init(scene)
    await player.play()

    await vi.runAllTimersAsync()

    expect(animeImplementation).toHaveBeenCalledTimes(1)
    expect(runtimeNode.style.opacity).toBe(1)

    vi.useRealTimers()
  })

  it('L16-T2 pause stops pending timeline actions after current cursor', async () => {
    vi.useFakeTimers()

    const runtimeNode = {
      tagName: 'DIV',
      style: {
        opacity: 0,
        x: 0
      },
      attributes: {}
    }

    const scene: SceneDoc = {
      id: 'scene-main',
      initialStoryId: 'story-main',
      stories: {
        'story-main': {
          id: 'story-main',
          items: {
            title: {
              id: 'title',
              type: 'text',
              initial: {
                id: 'title'
              },
              actions: {
                intro: {
                  style: {
                    opacity: {
                      to: 1,
                      duration: 100
                    }
                  }
                },
                outro: {
                  style: {
                    x: {
                      to: 100,
                      duration: 100
                    }
                  }
                }
              }
            }
          }
        }
      },
      tracks: {
        'track-story-main': {
          id: 'track-story-main',
          source: 'story',
          order: 0,
          events: [
            {
              id: 'evt-1',
              ms: 0,
              name: 'intro',
              index: 0,
              source: 'story'
            },
            {
              id: 'evt-2',
              ms: 1000,
              name: 'outro',
              index: 1,
              source: 'story'
            }
          ]
        }
      }
    }

    const animeImplementation = vi.fn<AnimeImplementation>(() => ({ pause: vi.fn() }))
    const animationAdapter = createAnimationAdapter(animeImplementation)
    const player = new PlayerFacade({
      animationAdapter,
      createElementOptions: {
        nodeFactory: () => runtimeNode
      }
    })

    await player.init(scene)
    await player.play()
    await vi.advanceTimersByTimeAsync(10)
    await player.pause()
    await vi.advanceTimersByTimeAsync(2000)

    expect(runtimeNode.style.opacity).toBe(1)
    expect(runtimeNode.style.x).toBeUndefined()

    vi.useRealTimers()
  })
})

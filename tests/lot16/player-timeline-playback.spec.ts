import { describe, expect, it, vi } from 'vitest'

import { createAnimationAdapter, type AnimeImplementation } from '../../src/animation/adapter'
import type { AnimationAdapter } from '../../src/animation/types'
import { PlayerFacade } from '../../src/player/create-player'
import type { SceneDoc } from '../../src/player/types'

/**
 * Creates one anime implementation that applies target end values immediately.
 */
function temp__createApplyingAnimeImplementation() {
  return vi.fn<AnimeImplementation>((parameters) => {
    const targets = parameters.targets
    const targetList = Array.isArray(targets)
      ? (targets as Record<string, unknown>[])
      : [targets as Record<string, unknown>]

    for (const target of targetList) {
      if (typeof target !== 'object' || target === null) {
        continue
      }

      const mutableTarget = target as Record<string, unknown>
      const mutableStyle =
        typeof mutableTarget.style === 'object' && mutableTarget.style !== null
          ? (mutableTarget.style as Record<string, unknown>)
          : null

      for (const [property, value] of Object.entries(parameters)) {
        if (property === 'targets' || property === 'duration' || property === 'delay' || property === 'ease' || property === 'composition') {
          continue
        }

        const resolvedValue =
          typeof value === 'object' && value !== null && 'to' in value
            ? (value as { to: unknown }).to
            : value

        if (mutableStyle !== null) {
          mutableStyle[property] = resolvedValue
        } else {
          mutableTarget[property] = resolvedValue
        }
      }
    }

    return { pause: vi.fn() }
  })
}

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

    const animeImplementation = temp__createApplyingAnimeImplementation()
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

    const animeImplementation = temp__createApplyingAnimeImplementation()
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

  it('L16-T3 playback auto-stops when timeline reaches deterministic end', async () => {
    vi.useFakeTimers()

    const runtimeNode = {
      tagName: 'DIV',
      style: {
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
                    x: {
                      from: 0,
                      to: 100,
                      duration: 120
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

    const animeImplementation = temp__createApplyingAnimeImplementation()
    const animationAdapter = createAnimationAdapter(animeImplementation)
    const player = new PlayerFacade({
      animationAdapter,
      createElementOptions: {
        nodeFactory: () => runtimeNode
      }
    })

    await player.init(scene)
    await player.play()

    await vi.advanceTimersByTimeAsync(1000)
    ;(player as unknown as { runPlaybackTick: () => void }).runPlaybackTick()

    const stateAfterEnd = player.getState()
    expect(stateAfterEnd.status).toBe('paused')
    expect(stateAfterEnd.timelineMs).toBe(120)

    await vi.advanceTimersByTimeAsync(1000)
    ;(player as unknown as { runPlaybackTick: () => void }).runPlaybackTick()
    const stateAfterWait = player.getState()
    expect(stateAfterWait.timelineMs).toBe(120)

    vi.useRealTimers()
  })

  it('L16-T4 playback ticker also drives animation adapter render frames', async () => {
    vi.useFakeTimers()

    const runtimeNode = {
      tagName: 'DIV',
      style: {},
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
                      duration: 400
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

    const renderFrame = vi.fn<(frameNowMs: number) => void>()
    const animationAdapter: AnimationAdapter = {
      run: () => [],
      stop: () => {
        return
      },
      pause: () => {
        return
      },
      resume: () => {
        return
      },
      seek: () => {
        return
      },
      renderFrame
    }

    const player = new PlayerFacade({
      animationAdapter,
      createElementOptions: {
        nodeFactory: () => runtimeNode
      }
    })

    await player.init(scene)
    await player.play()

    ;(player as unknown as { runPlaybackTick: (frameNowMs?: number) => void }).runPlaybackTick(42)

    expect(renderFrame).toHaveBeenCalled()

    vi.useRealTimers()
  })
})

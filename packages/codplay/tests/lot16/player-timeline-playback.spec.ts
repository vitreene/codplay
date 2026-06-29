import { describe, expect, it, vi } from 'vitest'

import { createAnimationAdapter, type AnimeImplementation } from '../../src/animation/adapter'
import type { AnimationAdapter } from '../../src/animation/types'
import { PlayerFacade } from '../../src/player/create-player'
import type { SceneDoc } from '../../src/player/types'

type PersoFixture = SceneDoc['stories'][string]['persos'][number]

/**
 * Creates one strict scene fixture with root mount/start hooks.
 */
function temp__createStrictSceneFixture(input: {
  sceneId: string
  storyId: string
  persos: PersoFixture[]
  tracks: Record<string, unknown>
}): SceneDoc {
  return {
    id: input.sceneId,
    rootStories: [input.storyId],
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      [input.storyId]: {
        id: input.storyId,
        initial: undefined,
        persos: input.persos,
        straps: undefined,
        listen: []
      }
    },
    init(scene, options) {
      options.mount(scene.rootStories[0])
    },
    onStart(scene, options) {
      options.schedule(scene.rootStories[0])
    },
    tracks: input.tracks
  }
}

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
        if (property === 'targets' || property === 'duration' || property === 'delay' || property === 'ease' || property === 'composition' || property === 'stagger' || property === 'loopDelay' || property === 'reversed' || property === 'alternate' || property === 'loop') {
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

    const scene: SceneDoc = temp__createStrictSceneFixture({
      sceneId: 'scene-main',
      storyId: 'story-main',
      persos: [
        {
          id: 'title',
          type: 'tag',
          initial: { move: '@root' },
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
      ],
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
    })

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

    const scene: SceneDoc = temp__createStrictSceneFixture({
      sceneId: 'scene-main',
      storyId: 'story-main',
      persos: [
        {
          id: 'title',
          type: 'tag',
          initial: { move: '@root' },
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
      ],
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
    })

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

  it('L16-T3 playback stays active after deterministic end until sequence:end', async () => {
    vi.useFakeTimers()

    const runtimeNode = {
      tagName: 'DIV',
      style: {
        x: 0
      },
      attributes: {}
    }

    const scene: SceneDoc = temp__createStrictSceneFixture({
      sceneId: 'scene-main',
      storyId: 'story-main',
      persos: [
        {
          id: 'title',
          type: 'tag',
          initial: { move: '@root' },
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
      ],
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
    })

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
    expect(stateAfterEnd.status).toBe('playing')
    expect(stateAfterEnd.timelineMs).toBeGreaterThanOrEqual(1000)

    await vi.advanceTimersByTimeAsync(1000)
    ;(player as unknown as { runPlaybackTick: () => void }).runPlaybackTick()
    const stateAfterWait = player.getState()
    expect(stateAfterWait.timelineMs).toBeGreaterThan(stateAfterEnd.timelineMs)

    vi.useRealTimers()
  })

  it('L16-T4 playback ticker also drives animation adapter render frames', async () => {
    vi.useFakeTimers()

    const runtimeNode = {
      tagName: 'DIV',
      style: {},
      attributes: {}
    }

    const scene: SceneDoc = temp__createStrictSceneFixture({
      sceneId: 'scene-main',
      storyId: 'story-main',
      persos: [
        {
          id: 'title',
          type: 'tag',
          initial: { move: '@root' },
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
      ],
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
    })

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

  it('L16-T4 first-play zero-offset story start animations begin from playing state', async () => {
    const runtimeNode = {
      tagName: 'DIV',
      style: {
        opacity: 0
      },
      attributes: {}
    }

    const animationStatusesAtStart: string[] = []
    let player: PlayerFacade

    const animeImplementation = vi.fn<AnimeImplementation>(() => {
      animationStatusesAtStart.push(player.getState().status)
      runtimeNode.style.opacity = 1
      return { pause: vi.fn() }
    })

    const scene: SceneDoc = {
      id: 'scene-story-start-zero-offset',
      rootStories: ['story-main'],
      initial: undefined,
      straps: undefined,
      listen: [],
      stories: {
        'story-main': {
          id: 'story-main',
          initial: undefined,
          persos: [
            {
              id: 'title',
              type: 'tag',
              initial: {
                move: '@root',
                style: {
                  opacity: 0
                }
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
          ],
          straps: undefined,
          listen: [],
          eventimes: [
            {
              name: 'intro',
              startAt: 0
            }
          ]
        }
      },
      init(sceneDoc, options) {
        options.mount(sceneDoc.rootStories[0])
      },
      onStart(sceneDoc, options) {
        options.schedule(sceneDoc.rootStories[0])
      },
      tracks: {}
    }

    const animationAdapter = createAnimationAdapter(animeImplementation)
    player = new PlayerFacade({
      animationAdapter,
      createElementOptions: {
        nodeFactory: () => runtimeNode
      }
    })

    await player.init(scene)

    expect(animationStatusesAtStart).toEqual([])

    await player.play()

    expect(animationStatusesAtStart).toEqual(['playing'])
    expect(runtimeNode.style.opacity).toBe(1)
  })

  it('L16-T5 first-play zero-offset transitions render on the initial play frame', async () => {
    const runtimeNode = {
      tagName: 'DIV',
      style: {
        opacity: 0
      },
      attributes: {}
    }

    const pendingFrames: Array<() => void> = []
    const renderFrame = vi.fn<(frameNowMs: number) => void>(() => {
      while (pendingFrames.length > 0) {
        pendingFrames.shift()?.()
      }
    })

    const animationAdapter: AnimationAdapter = {
      run: (transitions) => {
        for (const transition of transitions) {
          pendingFrames.push(() => {
            ;(transition.target as { style?: Record<string, unknown> }).style ??= {}
            ;(transition.target as { style: Record<string, unknown> }).style[transition.property] = transition.to
          })
        }

        return transitions.map((transition) => ({
          transitionId: transition.transitionId,
          target: transition.target,
          stop: () => {
            return
          }
        }))
      },
      stop: () => {
        pendingFrames.length = 0
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

    const scene: SceneDoc = {
      id: 'scene-story-start-zero-offset-render-frame',
      rootStories: ['story-main'],
      initial: undefined,
      straps: undefined,
      listen: [],
      stories: {
        'story-main': {
          id: 'story-main',
          initial: undefined,
          persos: [
            {
              id: 'title',
              type: 'tag',
              initial: { move: '@root' },
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
          ],
          straps: undefined,
          listen: [],
          eventimes: [
            {
              name: 'intro',
              startAt: 0
            }
          ]
        }
      },
      init(sceneDoc, options) {
        options.mount(sceneDoc.rootStories[0])
      },
      onStart(sceneDoc, options) {
        options.schedule(sceneDoc.rootStories[0])
      },
      tracks: {}
    }

    const player = new PlayerFacade({
      animationAdapter,
      createElementOptions: {
        nodeFactory: () => runtimeNode
      }
    })

    await player.init(scene)
    await player.play()

    expect(renderFrame).toHaveBeenCalled()
    expect(runtimeNode.style.opacity).toBe(1)
  })
})

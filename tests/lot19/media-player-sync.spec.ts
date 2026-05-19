import { describe, expect, it, vi } from 'vitest'

import type { MediaComponentApi } from '../../src/runtime/components/media-component'
import type { AnimationResolvedAction } from '../../src/animation/types'
import { PlayerFacade } from '../../src/player/create-player'
import type { SceneDoc } from '../../src/player/types'
import { RUNTIME_OBJECT_EVENT_HANDLERS } from '../../src/runtime/create-element'
import { createMediaSyncModule } from '../../src/runtime/modules/media-sync'
import type { RuntimePersos } from '../../src/runtime/types'

type RuntimeNodeFixture = {
  tagName: string
  style: Record<string, unknown>
  attributes: Record<string, unknown>
  className?: string
  textContent?: string
  src?: string
  currentTime?: number
  duration?: number
  paused?: boolean
  __mediaDurationSeconds?: number
  mediaNode?: RuntimeNodeFixture
  play?: ReturnType<typeof vi.fn>
  pause?: ReturnType<typeof vi.fn>
  [RUNTIME_OBJECT_EVENT_HANDLERS]?: Record<string, () => void>
}

/**
 * Creates one runtime node fixture suitable for media/player sync tests.
 */
function createRuntimeNodeFixture(tagName: string, options: { durationSeconds?: number } = {}): RuntimeNodeFixture {
  const node: RuntimeNodeFixture = {
    tagName,
    style: {},
    attributes: {}
  }

  if (tagName === 'VIDEO') {
    node.currentTime = 0
    node.duration = options.durationSeconds ?? 12
    node.paused = true
    node.play = vi.fn(() => {
      node.paused = false
    })
    node.pause = vi.fn(() => {
      node.paused = true
    })
  }

  if (tagName === 'DIV' && options.durationSeconds !== undefined) {
    node.__mediaDurationSeconds = options.durationSeconds
  }

  return node
}

/**
 * Creates one media-focused scene with one long hold event for deterministic seek tests.
 */
function createMediaSyncScene(options: {
  isMaster?: boolean
  startAtMs?: number
  durationMs?: number
  onSequenceEnd?: () => void
} = {}): SceneDoc {
  const startAtMs = options.startAtMs ?? 4000

  return {
    id: 'media-sync-scene',
    rootStories: ['media-sync-story'],
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      'media-sync-story': {
        id: 'media-sync-story',
        entries: ['media-sync-item', 'media-sync-hold'],
        initial: undefined,
        persos: [
          {
            id: 'media-sync-item',
            type: 'media',
            initial: {
              tag: 'video',
              src: '/assets/1_7b_e.mp3',
              master: options.isMaster === true,
              style: {
                width: '1px',
                height: '1px',
                opacity: 0
              }
            },
            actions: {
              'media:sync:start': {
                broadcast: {
                  type: 'START',
                  startAt: startAtMs
                }
              },
              'media-sync-item': null
            }
          },
          {
            id: 'media-sync-hold',
            type: 'text',
            initial: {
              tag: 'div',
              content: '',
              style: {
                opacity: 0
              }
            },
            actions: {
              'media:sync:hold': {
                style: {
                  opacity: {
                    from: 0,
                    to: 0,
                    duration: options.durationMs ?? 10000
                  }
                }
              },
              'media-sync-hold': null
            }
          }
        ],
        straps: undefined,
        listen: [],
        eventimes: [
          {
            name: 'media:sync:hold',
            startAt: 0
          },
          {
            name: 'media:sync:start',
            startAt: 2000
          }
        ]
      }
    },
    init(_scene, runtime) {
      runtime.mount('media-sync-story')
    },
    onStart(_scene, runtime) {
      runtime.schedule('media-sync-story')
    },
    onSequenceEnd() {
      options.onSequenceEnd?.()
    },
    tracks: {}
  }
}

describe('Lot 19 - media player sync', () => {
  it('emits one component event from media ref ended on wrapped video', async () => {
    const scene: SceneDoc = {
      id: 'media-emit-scene',
      rootStories: ['story-media'],
      initial: undefined,
      straps: undefined,
      listen: [],
      stories: {
        'story-media': {
          id: 'story-media',
          entries: ['media-item', 'text-item'],
          initial: undefined,
          persos: [
            {
              id: 'media-item',
              type: 'media',
              initial: {
                src: '/assets/1_7b_e.mp3'
              },
              emit: {
                ended: {
                  ref: 'media',
                  event: { name: 'media:done' }
                }
              },
              actions: {
                'media-item': null
              }
            },
            {
              id: 'text-item',
              type: 'text',
              initial: {
                content: 'pending'
              },
              actions: {
                'media:done': {
                  content: 'done'
                },
                'text-item': null
              }
            }
          ],
          straps: undefined,
          listen: []
        }
      },
      init(_scene, runtime) {
        runtime.mount('story-media')
      },
      tracks: {}
    }

    const player = new PlayerFacade()
    expect(await player.init(scene)).toEqual({ ok: true })

    const mediaRoot = player.getRuntimeRegistry().getNodeById('media-item') as RuntimeNodeFixture | null
    const mediaNode = mediaRoot?.mediaNode ?? null
    expect(mediaNode).not.toBeNull()

    mediaNode?.[RUNTIME_OBJECT_EVENT_HANDLERS]?.ended?.()
    await new Promise((resolve) => setTimeout(resolve, 0))

    const textNode = player.getRuntimeRegistry().getNodeById('text-item') as HTMLElement | null
    expect(textNode?.textContent).toBe('done')
  })

  it('warns when one emit ref is unknown on media component', async () => {
    const traces: Array<{ eventName: string; payload?: Record<string, unknown> }> = []
    const scene: SceneDoc = {
      id: 'media-ref-warning-scene',
      rootStories: ['story-media'],
      initial: undefined,
      straps: undefined,
      listen: [],
      stories: {
        'story-media': {
          id: 'story-media',
          entries: ['media-item'],
          initial: undefined,
          persos: [
            {
              id: 'media-item',
              type: 'media',
              initial: {
                src: '/assets/1_7b_e.mp3'
              },
              emit: {
                ended: {
                  ref: 'missing-ref',
                  event: { name: 'media:done' }
                }
              },
              actions: {
                'media-item': null
              }
            }
          ],
          straps: undefined,
          listen: []
        }
      },
      init(_scene, runtime) {
        runtime.mount('story-media')
      },
      tracks: {}
    }

    const player = new PlayerFacade()
    player.onTrace((row) => {
      traces.push({ eventName: row.eventName, payload: row.payload as Record<string, unknown> | undefined })
    })

    expect(await player.init(scene)).toEqual({ ok: true })
    expect(traces.some((row) => row.eventName === 'renderer:error' && row.payload?.code === 'AUTHOR_COMPONENT_REF_UNKNOWN')).toBe(true)
  })

  it('does not re-seek or replay one media on every sync tick while playback is healthy', () => {
    const component = {
      currentTimeMs: 4000,
      durationMs: 12000,
      paused: true,
      seekTo: vi.fn((mediaMs: number) => {
        component.currentTimeMs = mediaMs
      }),
      play: vi.fn(() => {
        component.paused = false
      }),
      pause: vi.fn(() => {
        component.paused = true
      }),
      stopAt: vi.fn((mediaMs: number) => {
        component.currentTimeMs = mediaMs
        component.paused = true
      }),
      getCurrentTimeMs: vi.fn(() => component.currentTimeMs),
      getDurationMs: vi.fn(() => component.durationMs),
      isPaused: vi.fn(() => component.paused)
    }

    const runtimePersos: RuntimePersos = {
      id: 'media-sync-runtime',
      persos: {
        'media-sync-item': {
          id: 'media-sync-item',
          storyId: 'story-media',
          type: 'media',
          initial: {
            master: false
          },
          actions: {}
        }
      }
    }

    const startAction: AnimationResolvedAction = {
      eventId: 'evt-media-start',
      eventName: 'media:sync:start',
      listenerId: 'media-sync-item',
      actionKey: 'media:sync:start',
      action: {
        broadcast: {
          type: 'START',
          startAt: 4000
        }
      }
    }

    const mediaSync = createMediaSyncModule({
      getComponentById: () => component
    })

    mediaSync.loadRuntimePersos(runtimePersos)
    mediaSync.applyResolvedActions(2000, [startAction])
    mediaSync.syncTimeline(2000, 'playing')

    expect(component.seekTo).toHaveBeenCalledTimes(1)
    expect(component.play).toHaveBeenCalledTimes(1)

    component.currentTimeMs = 4200
    mediaSync.syncTimeline(2200, 'playing')

    expect(component.seekTo).toHaveBeenCalledTimes(1)
    expect(component.play).toHaveBeenCalledTimes(1)
    expect(component.pause).not.toHaveBeenCalled()
  })

  it('aligns media currentTime with sequence seek and start offset', async () => {
    const player = new PlayerFacade({
      createElementOptions: {
        nodeFactory: (item) =>
          createRuntimeNodeFixture(item.type === 'list' ? 'SECTION' : 'DIV')
      }
    })

    expect(await player.init(createMediaSyncScene())).toEqual({ ok: true })
    expect(await player.play()).toEqual({ ok: true })
    expect(await player.seek(6000)).toEqual({ ok: true })

    const mediaComponent = player.getRuntimeRegistry().getComponentById('media-sync-item') as MediaComponentApi | null
    expect(mediaComponent?.getCurrentTimeMs()).toBeCloseTo(8000, 0)
    expect(mediaComponent?.isPaused()).toBe(true)
  })

  it('keeps one ended media stopped when sequence pause/play toggles later', async () => {
    const player = new PlayerFacade({
      createElementOptions: {
        nodeFactory: (item) =>
          createRuntimeNodeFixture(item.type === 'list' ? 'SECTION' : 'DIV', {
            durationSeconds: 9
          })
      }
    })

    expect(await player.init(createMediaSyncScene())).toEqual({ ok: true })
    expect(await player.play()).toEqual({ ok: true })
    expect(await player.seek(10000)).toEqual({ ok: true })

    const mediaComponent = player.getRuntimeRegistry().getComponentById('media-sync-item') as MediaComponentApi | null
    const mediaRoot = player.getRuntimeRegistry().getNodeById('media-sync-item') as RuntimeNodeFixture | null
    const mediaNode = mediaRoot?.mediaNode
    expect(mediaComponent?.getCurrentTimeMs()).toBeCloseTo(9000, 0)

    expect(await player.play()).toEqual({ ok: true })
    expect(mediaNode?.paused).toBe(true)
    expect(mediaComponent?.isPaused()).toBe(true)
  })

  it('uses active master media currentTime plus offset to resolve timeline', async () => {
    const player = new PlayerFacade({
      createElementOptions: {
        nodeFactory: (item) =>
          createRuntimeNodeFixture(item.type === 'list' ? 'SECTION' : 'DIV')
      }
    })

    expect(await player.init(createMediaSyncScene({ isMaster: true }))).toEqual({ ok: true })
    expect(await player.play()).toEqual({ ok: true })
    expect(await player.seek(6000)).toEqual({ ok: true })
    expect(await player.play()).toEqual({ ok: true })

    const mediaRoot = player.getRuntimeRegistry().getNodeById('media-sync-item') as RuntimeNodeFixture | null
    const mediaNode = mediaRoot?.mediaNode
    if (mediaNode) {
      mediaNode.currentTime = 8.8
    }

    expect(player.getState().timelineMs).toBeCloseTo(6800, 0)
  })

  it('stops active media on sequence end cleanup', () => {
    const component = {
      currentTimeMs: 4000,
      durationMs: 12000,
      paused: false,
      seekTo: vi.fn((mediaMs: number) => {
        component.currentTimeMs = mediaMs
      }),
      play: vi.fn(() => {
        component.paused = false
      }),
      pause: vi.fn(() => {
        component.paused = true
      }),
      stopAt: vi.fn((mediaMs: number) => {
        component.currentTimeMs = mediaMs
        component.paused = true
      }),
      getCurrentTimeMs: vi.fn(() => component.currentTimeMs),
      getDurationMs: vi.fn(() => component.durationMs),
      isPaused: vi.fn(() => component.paused)
    }

    const runtimePersos: RuntimePersos = {
      id: 'media-sync-runtime',
      persos: {
        'media-sync-item': {
          id: 'media-sync-item',
          storyId: 'story-media',
          type: 'media',
          initial: {
            master: false
          },
          actions: {}
        }
      }
    }

    const startAction: AnimationResolvedAction = {
      eventId: 'evt-media-start',
      eventName: 'media:sync:start',
      listenerId: 'media-sync-item',
      actionKey: 'media:sync:start',
      action: {
        broadcast: {
          type: 'START',
          startAt: 4000
        }
      }
    }

    const mediaSync = createMediaSyncModule({
      getComponentById: () => component
    })

    mediaSync.loadRuntimePersos(runtimePersos)
    mediaSync.applyResolvedActions(2000, [startAction])
    mediaSync.handleSequenceEnd(6000)

    expect(component.stopAt).toHaveBeenCalledTimes(1)
    expect(component.stopAt).toHaveBeenCalledWith(8000)
    expect(component.paused).toBe(true)
  })
})

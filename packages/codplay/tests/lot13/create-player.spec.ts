import { describe, expect, it } from 'vitest'

import { createAnimationAdapter } from '../../src/animation/adapter'
import type { AnimationAdapter, TransitionRequest } from '../../src/animation/types'
import { PlayerFacade } from '../../src/player/create-player'
import type { SceneDoc } from '../../src/player/types'

const EXPECTED_PLAYER_STATUS = {
  idle: 'idle',
  ready: 'ready',
  playing: 'playing',
  paused: 'paused'
} as const

type SeekableTween = {
  target: Record<string, unknown>
  property: string
  from: number
  to: number
  durationMs: number
}

type PersoFixture = SceneDoc['stories'][string]['persos'][number]

/**
 * Creates one strict scene fixture with root mount/start hooks.
 */
function temp__createStrictSceneFixture(input: {
  sceneId: string
  storyId: string
  persos: PersoFixture[]
  tracks?: Record<string, unknown>
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
        entries: input.persos.map((perso) => perso.id),
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
    tracks: input.tracks ?? {}
  }
}

/**
 * Creates one minimal scene fixture for player API tests.
 */
function temp__createSceneFixture(): SceneDoc {
  return temp__createStrictSceneFixture({
    sceneId: 'scene-main',
    storyId: 'story-main',
    persos: [
      {
        id: 'title',
        type: 'tag',
        initial: {
          content: 'hello'
        },
        actions: {}
      }
    ]
  })
}

/**
 * Creates one scene fixture used to verify transient runtime event insert modes.
 */
function temp__createRuntimeEventSceneFixture(): SceneDoc {
  return temp__createStrictSceneFixture({
    sceneId: 'scene-runtime-event',
    storyId: 'story-runtime-event',
    persos: [
      {
        id: 'message',
        type: 'tag',
        initial: {
          content: 'base'
        },
        actions: {
          reveal: {
            content: 'revealed'
          }
        }
      }
    ]
  })
}


/**
 * Creates one scene fixture with a timed animation event for seek synchronization tests.
 */
function temp__createSeekSceneFixture(): SceneDoc {
  return temp__createStrictSceneFixture({
    sceneId: 'scene-seek',
    storyId: 'story-seek',
    persos: [
      {
        id: 'box',
        type: 'tag',
        initial: {
          content: 'seek-box'
        },
        actions: {
          'box:move': {
            style: {
              x: {
                from: 0,
                to: 100,
                duration: 1000
              }
            }
          }
        }
      }
    ],
    tracks: {
      'track-seek': {
        id: 'track-seek',
        source: 'story',
        order: 0,
        events: [
          {
            id: 'evt-box-move',
            ms: 1000,
            name: 'box:move',
            index: 0,
            source: 'story'
          }
        ]
      }
    }
  })
}

/**
 * Creates one scene fixture where the second animation depends on the first animation progress.
 */
function temp__createCascadeSeekSceneFixture(): SceneDoc {
  return temp__createStrictSceneFixture({
    sceneId: 'scene-seek-cascade',
    storyId: 'story-seek-cascade',
    persos: [
      {
        id: 'box',
        type: 'tag',
        initial: {
          content: 'seek-cascade'
        },
        actions: {
          'box:move-1': {
            style: {
              x: {
                from: 0,
                to: 100,
                duration: 2000
              }
            }
          },
          'box:move-2': {
            style: {
              x: {
                to: 200,
                duration: 1000
              }
            }
          }
        }
      }
    ],
    tracks: {
      'track-seek-cascade': {
        id: 'track-seek-cascade',
        source: 'story',
        order: 0,
        events: [
          {
            id: 'evt-box-move-1',
            ms: 0,
            name: 'box:move-1',
            index: 0,
            source: 'story'
          },
          {
            id: 'evt-box-move-2',
            ms: 1000,
            name: 'box:move-2',
            index: 1,
            source: 'story'
          }
        ]
      }
    }
  })
}

describe('Lot 13 - createPlayer API and state runtime', () => {
  it('L13-T1 init/destroy are idempotent and keep stable state', async () => {
    const player = new PlayerFacade()

    expect(player.getState().status).toBe(EXPECTED_PLAYER_STATUS.idle)

    expect(await player.init(temp__createSceneFixture())).toEqual({ ok: true })
    expect(player.getState()).toMatchObject({
      initialized: true,
      status: EXPECTED_PLAYER_STATUS.ready,
      sceneId: 'scene-main'
    })

    expect(await player.init(temp__createSceneFixture())).toEqual({ ok: true })
    expect(player.getState().status).toBe(EXPECTED_PLAYER_STATUS.ready)

    expect(await player.destroy()).toEqual({ ok: true })
    expect(player.getState()).toMatchObject({
      initialized: false,
      status: EXPECTED_PLAYER_STATUS.idle,
      timelineMs: 0
    })

    expect(await player.destroy()).toEqual({ ok: true })
    expect(player.getState().status).toBe(EXPECTED_PLAYER_STATUS.idle)
  })

  it('L13-T2 play/pause/seek update player state deterministically', async () => {
    const player = new PlayerFacade()
    await player.init(temp__createSceneFixture())

    expect(await player.play()).toEqual({ ok: true })
    expect(player.getState().status).toBe(EXPECTED_PLAYER_STATUS.playing)

    expect(await player.pause()).toEqual({ ok: true })
    expect(player.getState().status).toBe('paused')

    expect(await player.seek(1200)).toEqual({ ok: true })
    expect(player.getState()).toMatchObject({
      status: 'paused',
      timelineMs: 1200
    })

    expect(await player.rewind()).toEqual({ ok: true })
    expect(player.getState()).toMatchObject({
      status: 'paused',
      timelineMs: 0
    })
  })

  it('L13-T3 invalid state commands are rejected with explicit code', async () => {
    const player = new PlayerFacade()

    const playBeforeInit = await player.play()
    expect(playBeforeInit).toMatchObject({
      ok: false,
      error: {
        code: 'PLAYER_NOT_INITIALIZED'
      }
    })

    await player.init(temp__createSceneFixture())
    const pauseFromReady = await player.pause()
    expect(pauseFromReady).toMatchObject({
      ok: false,
      error: {
        code: 'INVALID_PLAYER_STATE'
      }
    })

    const restrictedPlayer = new PlayerFacade({
      runtimePolicy: {
        allowedRebuildModes: ['state']
      }
    })
    await restrictedPlayer.init(temp__createSceneFixture())
    const forbiddenRebuild = await restrictedPlayer.rebuild('full')
    expect(forbiddenRebuild).toMatchObject({
      ok: false,
      error: {
        code: 'MODE_NOT_ALLOWED_BY_POLICY'
      }
    })
  })

  it('L13-T4 command traces and state subscriptions are emitted', async () => {
    const player = new PlayerFacade()
    const traceEvents: string[] = []
    const statuses: string[] = []

    const unsubscribeTrace = player.onTrace((row) => {
      traceEvents.push(`${row.status}:${row.eventName}`)
    })
    const unsubscribeState = player.onStateChange((state) => {
      statuses.push(state.status)
    })

    await player.init(temp__createSceneFixture())
    await player.play()
    await player.pause()

    unsubscribeTrace()
    unsubscribeState()

    expect(statuses).toEqual(['ready', 'playing', 'paused'])
    expect(traceEvents).toEqual(
      expect.arrayContaining([
        'applied:player:init:started',
        'applied:player:init:done',
        'applied:player:play',
        'applied:player:pause'
      ])
    )
  })

  it('L13-T5 seek rebuilds runtime, syncs active animations, and ends paused', async () => {
    const seekCalls: Array<{ timelineMs: number; eventMs: number | undefined }> = []
    let pauseCalls = 0

    const animationAdapter: AnimationAdapter = {
      run: (transitions: TransitionRequest[]) => {
        return transitions.map((transition) => ({
          transitionId: transition.transitionId,
          target: transition.target,
          stop: () => {
            return
          }
        }))
      },
      stop: () => {
        return
      },
      pause: () => {
        pauseCalls += 1
      },
      seek: (timelineMs, eventMsByEventId) => {
        seekCalls.push({
          timelineMs,
          eventMs: eventMsByEventId.get('evt-box-move')
        })
      }
    }

    const runtimeNode = {
      tagName: 'DIV',
      style: {},
      attributes: {}
    }

    const player = new PlayerFacade({
      animationAdapter,
      createElementOptions: {
        nodeFactory: () => runtimeNode
      }
    })

    await player.init(temp__createSeekSceneFixture())
    await player.play()

    expect(await player.seek(1500)).toEqual({ ok: true })
    expect(player.getState()).toMatchObject({
      status: 'paused',
      timelineMs: 1500
    })

    expect(pauseCalls).toBeGreaterThan(0)
    expect(seekCalls).toHaveLength(2)
    expect(seekCalls[0]).toEqual({
      timelineMs: 1000,
      eventMs: 1000
    })
    expect(seekCalls[1]).toEqual({
      timelineMs: 1500,
      eventMs: 1000
    })
  })

  it('L13-T6 seek places animated properties at matching timeline progress', async () => {
    const activeTweens: SeekableTween[] = []
    const seekTimes: number[] = []
    let runCount = 0

    const animationAdapter = createAnimationAdapter((parameters) => {
      runCount += 1
      const target = parameters.targets
      if (typeof target !== 'object' || target === null) {
        return {
          pause: () => {
            return
          },
          seek: () => {
            return
          }
        }
      }

      const targetObject = target as Record<string, unknown>
      const durationMs = typeof parameters.duration === 'number' ? parameters.duration : 0
      const delayMs = typeof parameters.delay === 'number' ? parameters.delay : 0

      for (const [property, value] of Object.entries(parameters)) {
        if (property === 'targets' || property === 'duration' || property === 'delay' || property === 'ease' || property === 'composition' || property === 'stagger' || property === 'loopDelay' || property === 'reversed' || property === 'alternate' || property === 'loop') {
          continue
        }

        if (typeof value !== 'object' || value === null || !('to' in value)) {
          continue
        }

        const tweenValue = value as { from?: unknown; to: unknown }
        if (typeof tweenValue.to !== 'number') {
          continue
        }

        const from = typeof tweenValue.from === 'number' ? tweenValue.from : 0
        activeTweens.push({
          target: targetObject,
          property,
          from,
          to: tweenValue.to,
          durationMs,
        })
      }

      return {
        pause: () => {
          return
        },
        seek: (time: number) => {
          seekTimes.push(time)
          const effectiveTimeMs = Math.max(0, time - delayMs)
          for (const tween of activeTweens.filter((entry) => entry.target === targetObject)) {
            const progress = tween.durationMs <= 0 ? 1 : Math.min(1, effectiveTimeMs / tween.durationMs)
            tween.target[tween.property] = tween.from + (tween.to - tween.from) * progress
          }
        }
      }
    })

    const runtimeNode: Record<string, unknown> = {
      tagName: 'DIV',
      style: {},
      attributes: {},
      x: 0
    }

    const player = new PlayerFacade({
      animationAdapter,
      createElementOptions: {
        nodeFactory: () => runtimeNode
      }
    })

    await player.init(temp__createSeekSceneFixture())
    await player.play()
    await player.seek(1500)

    expect(player.getState()).toMatchObject({ status: 'paused', timelineMs: 1500 })
    expect(runCount).toBeGreaterThan(0)
    expect(activeTweens.length).toBeGreaterThan(0)
    expect(seekTimes).toEqual([500])
    expect(runtimeNode.x).toBe(50)
  })

  it('L13-T7 seek replays intermediate animation state before later dynamic transitions', async () => {
    const animationAdapter = createAnimationAdapter((parameters) => {
      const target = parameters.targets
      if (typeof target !== 'object' || target === null) {
        return {
          pause: () => {
            return
          },
          seek: () => {
            return
          }
        }
      }

      const targetObject = target as Record<string, unknown>
      const durationMs = typeof parameters.duration === 'number' ? parameters.duration : 0
      const delayMs = typeof parameters.delay === 'number' ? parameters.delay : 0
      const localTweens: SeekableTween[] = []

      for (const [property, value] of Object.entries(parameters)) {
        if (property === 'targets' || property === 'duration' || property === 'delay' || property === 'ease' || property === 'composition' || property === 'stagger' || property === 'loopDelay' || property === 'reversed' || property === 'alternate' || property === 'loop') {
          continue
        }

        if (typeof value !== 'object' || value === null || !('to' in value)) {
          continue
        }

        const tweenValue = value as { from?: unknown; to: unknown }
        if (typeof tweenValue.to !== 'number') {
          continue
        }

        const fallbackFrom = targetObject[property]
        const from =
          typeof tweenValue.from === 'number'
            ? tweenValue.from
            : typeof fallbackFrom === 'number'
              ? fallbackFrom
              : 0

        localTweens.push({
          target: targetObject,
          property,
          from,
          to: tweenValue.to,
          durationMs,
        })
      }

      return {
        pause: () => {
          return
        },
        seek: (time: number) => {
          const effectiveTimeMs = Math.max(0, time - delayMs)
          for (const tween of localTweens) {
            const progress = tween.durationMs <= 0 ? 1 : Math.min(1, effectiveTimeMs / tween.durationMs)
            tween.target[tween.property] = tween.from + (tween.to - tween.from) * progress
          }
        }
      }
    })

    const runtimeNode: Record<string, unknown> = {
      tagName: 'DIV',
      style: {},
      attributes: {},
      x: 0
    }

    const player = new PlayerFacade({
      animationAdapter,
      createElementOptions: {
        nodeFactory: () => runtimeNode
      }
    })

    await player.init(temp__createCascadeSeekSceneFixture())
    await player.play()
    await player.seek(1500)

    expect(player.getState()).toMatchObject({ status: 'paused', timelineMs: 1500 })
    expect(runtimeNode.x).toBe(125)
  })

  it('L13-T8 scheduling one already mounted story does not reload renderer during play', async () => {
    const player = new PlayerFacade()

    const scene: SceneDoc = {
      id: 'scene-mounted-start',
      rootStories: ['story-main'],
      initial: undefined,
      straps: undefined,
      listen: [],
      stories: {
        'story-main': {
          id: 'story-main',
          entries: ['title-main'],
          initial: undefined,
          persos: [
            {
              id: 'title-main',
              type: 'tag',
              initial: { content: 'main' },
              actions: {}
            }
          ],
          straps: undefined,
          listen: []
        },
        'story-wait': {
          id: 'story-wait',
          entries: ['title-wait'],
          initial: undefined,
          persos: [
            {
              id: 'title-wait',
              type: 'tag',
              initial: { content: 'wait' },
              actions: {
                reveal: {
                  className: { add: 'revealed' }
                }
              }
            }
          ],
          straps: undefined,
          listen: [],
          eventimes: [
            {
              name: 'reveal',
              startAt: 0
            }
          ]
        }
      },
      init(_scene, options) {
        options.mount('story-main')
        options.mount('story-wait')
      },
      onStart(_scene, options) {
        options.schedule('story-main')
        options.schedule('story-wait')
      },
      tracks: {}
    }

    expect(await player.init(scene)).toEqual({ ok: true })

    const runtimeRevisionBefore = player.getState().runtimeRevision

    expect(await player.play()).toEqual({ ok: true })

    expect(player.getState().runtimeRevision).toBe(runtimeRevisionBefore)
  })

  it('L13-T9 paused user emit is rejected explicitly', async () => {
    const pendingTransitions: TransitionRequest[] = []

    const animationAdapter: AnimationAdapter = {
      run: (transitions) => {
        pendingTransitions.push(...transitions)
        return transitions.map((transition) => ({
          transitionId: transition.transitionId,
          target: transition.target,
          stop: () => {
            return
          }
        }))
      },
      stop: () => {
        pendingTransitions.length = 0
      },
      renderFrame: () => {
        for (const transition of pendingTransitions.splice(0)) {
          const target = transition.target as Record<string, unknown> & { style?: Record<string, unknown> }
          if (typeof target.style === 'object' && target.style !== null) {
            target.style[transition.property] = transition.to
            continue
          }

          target[transition.property] = transition.to
        }
      }
    }

    const runtimeNode = {
      tagName: 'DIV',
      style: {},
      attributes: {}
    }

    const player = new PlayerFacade({
      animationAdapter,
      createElementOptions: {
        nodeFactory: () => runtimeNode
      }
    })

    await player.init(temp__createSeekSceneFixture())
    await player.play()
    await player.pause()

    expect(await player.emit({ name: 'box:move' })).toMatchObject({
      ok: false,
      error: {
        code: 'PLAYER_USER_EVENTS_PAUSED'
      }
    })

    expect(runtimeNode.style.x).toBeUndefined()
  })

  it('L13-T10 seeking user emit is rejected explicitly', async () => {
    const pendingTransitions: TransitionRequest[] = []

    const animationAdapter: AnimationAdapter = {
      run: (transitions) => {
        pendingTransitions.push(...transitions)
        return transitions.map((transition) => ({
          transitionId: transition.transitionId,
          target: transition.target,
          stop: () => {
            return
          }
        }))
      },
      stop: () => {
        pendingTransitions.length = 0
      },
      renderFrame: () => {
        for (const transition of pendingTransitions.splice(0)) {
          const target = transition.target as Record<string, unknown> & { style?: Record<string, unknown> }
          if (typeof target.style === 'object' && target.style !== null) {
            target.style[transition.property] = transition.to
            continue
          }

          target[transition.property] = transition.to
        }
      }
    }

    const runtimeNode = {
      tagName: 'DIV',
      style: {},
      attributes: {}
    }

    const player = new PlayerFacade({
      animationAdapter,
      createElementOptions: {
        nodeFactory: () => runtimeNode
      }
    })

    await player.init(temp__createSeekSceneFixture())
    await player.play()

    const seekPromise = player.seek(150)

    expect(await player.emit({ name: 'box:move' })).toMatchObject({
      ok: false,
      error: {
        code: 'PLAYER_USER_EVENTS_PAUSED'
      }
    })

    await seekPromise
  })

  it('L13-T11 persist-only stores one replay event without applying it immediately', async () => {
    const player = new PlayerFacade()

    expect(await player.init(temp__createRuntimeEventSceneFixture())).toEqual({ ok: true })

    const messageNodeBeforeReplay = player.getRuntimeRegistry().getNodeById('message') as { textContent?: string } | null
    expect(messageNodeBeforeReplay?.textContent).toBe('base')

    expect(await player.emit({ name: 'reveal', mode: 'persist-only' })).toEqual({ ok: true })
    expect((player.getRuntimeRegistry().getNodeById('message') as { textContent?: string } | null)?.textContent).toBe('base')

    expect(await player.seek(0)).toEqual({ ok: true })
    expect((player.getRuntimeRegistry().getNodeById('message') as { textContent?: string } | null)?.textContent).toBe('revealed')
  })

  it('L13-T12 persist-future defers one replay event until its target time', async () => {
    const player = new PlayerFacade()

    expect(await player.init(temp__createRuntimeEventSceneFixture())).toEqual({ ok: true })
    expect(await player.emit({ name: 'reveal', ms: 500, mode: 'persist-future' })).toEqual({ ok: true })

    expect((player.getRuntimeRegistry().getNodeById('message') as { textContent?: string } | null)?.textContent).toBe('base')

    expect(await player.seek(499)).toEqual({ ok: true })
    expect((player.getRuntimeRegistry().getNodeById('message') as { textContent?: string } | null)?.textContent).toBe('base')

    expect(await player.seek(500)).toEqual({ ok: true })
    expect((player.getRuntimeRegistry().getNodeById('message') as { textContent?: string } | null)?.textContent).toBe('revealed')
  })

})

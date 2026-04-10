import { describe, expect, it } from 'vitest'

import { PlayerFacade } from '../../src/player/create-player'
import type { SceneDoc } from '../../src/player/types'

/**
 * Creates one minimal scene fixture for player API tests.
 */
function createSceneFixture(): SceneDoc {
  return {
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
              id: 'title',
              content: 'hello'
            },
            actions: {}
          }
        }
      }
    },
    tracks: {}
  }
}

describe('Lot 13 - createPlayer API and state runtime', () => {
  it('L13-T1 init/destroy are idempotent and keep stable state', async () => {
    const player = new PlayerFacade()

    expect(player.getState().status).toBe('idle')

    expect(await player.init(createSceneFixture())).toEqual({ ok: true })
    expect(player.getState()).toMatchObject({
      initialized: true,
      status: 'ready',
      sceneId: 'scene-main',
      activeStoryId: 'story-main'
    })

    expect(await player.init(createSceneFixture())).toEqual({ ok: true })
    expect(player.getState().status).toBe('ready')

    expect(await player.destroy()).toEqual({ ok: true })
    expect(player.getState()).toMatchObject({ initialized: false, status: 'idle', timelineMs: 0 })

    expect(await player.destroy()).toEqual({ ok: true })
    expect(player.getState().status).toBe('idle')
  })

  it('L13-T2 play/pause/seek update player state deterministically', async () => {
    const player = new PlayerFacade()
    await player.init(createSceneFixture())

    expect(await player.play()).toEqual({ ok: true })
    expect(player.getState().status).toBe('playing')

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

    await player.init(createSceneFixture())
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
    await restrictedPlayer.init(createSceneFixture())
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

    await player.init(createSceneFixture())
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
})

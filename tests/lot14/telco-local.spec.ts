import { describe, expect, it } from 'vitest'

import { createPlayer } from '../../src/player/create-player'
import type { SceneDoc } from '../../src/player/types'
import { createLocalTelco } from '../../src/telco-local/create-local-telco'

/**
 * Creates one minimal scene fixture compatible with createPlayer.
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
    }
  }
}

describe('Lot 14 - telco locale composant', () => {
  it('L14-T1 dispatch executes player commands with deterministic request ids', async () => {
    const player = createPlayer()
    await player.init(createSceneFixture())

    const telco = createLocalTelco({ player })
    const firstResult = await telco.dispatch({ name: 'play' })
    const secondResult = await telco.dispatch({ name: 'pause' })

    expect(firstResult).toMatchObject({
      requestId: 'telco-request-1',
      commandName: 'play',
      ok: true,
      playerState: {
        status: 'playing'
      }
    })

    expect(secondResult).toMatchObject({
      requestId: 'telco-request-2',
      commandName: 'pause',
      ok: true,
      playerState: {
        status: 'paused'
      }
    })
  })

  it('L14-T2 telco state subscription mirrors player state changes', async () => {
    const player = createPlayer()
    await player.init(createSceneFixture())

    const telco = createLocalTelco({ player })
    const observedStates: string[] = []
    const unsubscribe = telco.onStateChange((state) => {
      observedStates.push(state.status)
    })

    await telco.dispatch({ name: 'play' })
    await telco.dispatch({ name: 'pause' })
    unsubscribe()

    expect(observedStates).toEqual(['playing', 'paused'])
  })

  it('L14-T3 invalid seek payload is rejected by telco', async () => {
    const player = createPlayer()
    await player.init(createSceneFixture())

    const telco = createLocalTelco({ player })
    const result = await telco.dispatch({
      name: 'seek',
      payload: {
        targetTimelineMs: Number.NaN
      }
    })

    expect(result).toMatchObject({
      commandName: 'seek',
      ok: false,
      error: {
        code: 'INVALID_TELCO_COMMAND_PAYLOAD'
      }
    })
  })

  it('L14-T4 command result subscription receives applied and rejected outcomes', async () => {
    const player = createPlayer()
    await player.init(createSceneFixture())

    const telco = createLocalTelco({ player })
    const events: string[] = []
    const unsubscribe = telco.onCommandResult((result) => {
      events.push(`${result.commandName}:${result.ok ? 'ok' : result.error?.code ?? 'error'}`)
    })

    await telco.dispatch({ name: 'play' })
    await telco.dispatch({
      name: 'seek',
      payload: {
        targetTimelineMs: Number.NaN
      }
    })

    unsubscribe()
    expect(events).toEqual(['play:ok', 'seek:INVALID_TELCO_COMMAND_PAYLOAD'])
  })
})

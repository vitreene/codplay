import { describe, expect, it } from 'vitest'

import { PlayerFacade } from '../../src/player/create-player'
import type { SceneDoc } from '../../src/player/types'
import { createLocalTelco } from '../../src/telco-local/create-local-telco'

type PersoFixture = SceneDoc['stories'][string]['persos'][number]

/**
 * Creates one strict scene fixture with root mount/start hooks.
 */
function temp__createStrictSceneFixture(input: {
  sceneId: string
  storyId: string
  persos: PersoFixture[]
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
      options.start(scene.rootStories[0])
    },
    tracks: {}
  }
}

/**
 * Creates one minimal scene fixture compatible with createPlayer.
 */
function temp__createSceneFixture(): SceneDoc {
  return temp__createStrictSceneFixture({
    sceneId: 'scene-main',
    storyId: 'story-main',
    persos: [
      {
        id: 'title',
        type: 'text',
        initial: {
          content: 'hello'
        },
        actions: {}
      }
    ]
  })
}

describe('Lot 14 - telco locale composant', () => {
  it('L14-T1 dispatch executes player commands with deterministic request ids', async () => {
    const player = new PlayerFacade()
    await player.init(temp__createSceneFixture())

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
    const player = new PlayerFacade()
    await player.init(temp__createSceneFixture())

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
    const player = new PlayerFacade()
    await player.init(temp__createSceneFixture())

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
    const player = new PlayerFacade()
    await player.init(temp__createSceneFixture())

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

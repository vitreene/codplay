import { describe, expect, it } from 'vitest'

import { createBuilder } from '../../src/builder/create-builder'
import type { SceneDef } from '../../src/builder/types'
import { createPlayerV1Adapter } from '../../src/player/create-player-v1-adapter'

type RuntimeNodeFixture = {
  tagName: string
  style: Record<string, unknown>
  attributes: Record<string, unknown>
  className?: string
  textContent?: string
}

/**
 * Creates one plain runtime node fixture for adapter tests.
 */
function createRuntimeNodeFixture(tagName: string): RuntimeNodeFixture {
  return {
    tagName,
    style: {},
    attributes: {}
  }
}

/**
 * Creates one valid scene fixture in authored V1 format.
 */
function createSceneFixture(): SceneDef {
  return {
    id: 'scene-v1-adapter',
    rootStories: ['story-main'],
    initial: undefined,
    straps: undefined,
    listen: [],
    tracks: {},
    stories: {
      'story-main': {
        id: 'story-main',
        entries: ['title-perso'],
        initial: undefined,
        persos: [
          {
            id: 'title-perso',
            type: 'text',
            initial: {
              id: 'title-perso',
              content: 'Adapter title'
            },
            actions: {
              'title-perso': null,
              'sequence:demo:start': {
                style: {
                  opacity: {
                    from: 0,
                    to: 1,
                    duration: 120
                  }
                }
              }
            }
          }
        ],
        straps: undefined,
        listen: []
      }
    }
  }
}

/**
 * Compiles one V1 scene fixture and returns the compiled artifact.
 */
function createCompiledSceneFixture() {
  const builder = createBuilder()
  const compileResult = builder.compile({ scene: createSceneFixture() })

  expect(compileResult.ok).toBe(true)
  if (!compileResult.ok) {
    throw new Error(compileResult.error.code)
  }

  return compileResult.data.compiledScene
}

describe('V1 - player adapter', () => {
  it('initializes from compiled scene and exposes V1 state shape', async () => {
    const player = createPlayerV1Adapter({
      createElementOptions: {
        nodeFactory: (item) => createRuntimeNodeFixture(item.type === 'list' ? 'SECTION' : 'DIV')
      }
    })

    const initResult = await player.init({
      mountTarget: {},
      compiledScene: createCompiledSceneFixture()
    })

    expect(initResult.ok).toBe(true)
    expect(player.getState()).toEqual({
      status: 'ready',
      timelineMs: 0,
      clockSource: 'ticker',
      activeMasterPersoId: undefined
    })
  })

  it('supports play/pause/resume/stop/seek through the adapter facade', async () => {
    const player = createPlayerV1Adapter({
      createElementOptions: {
        nodeFactory: (item) => createRuntimeNodeFixture(item.type === 'list' ? 'SECTION' : 'DIV')
      }
    })

    await player.init({
      mountTarget: {},
      compiledScene: createCompiledSceneFixture()
    })

    expect(await player.play()).toEqual({ ok: true, data: undefined })
    expect(player.getState().status).toBe('playing')

    expect(await player.pause()).toEqual({ ok: true, data: undefined })
    expect(player.getState().status).toBe('paused')

    expect(await player.resume()).toEqual({ ok: true, data: undefined })
    expect(player.getState().status).toBe('playing')

    expect(await player.stop()).toEqual({ ok: true, data: undefined })
    expect(player.getState()).toMatchObject({
      status: 'paused',
      timelineMs: 0
    })

    expect(await player.seek({ timelineMs: 250 })).toEqual({ ok: true, data: undefined })
    expect(player.getState()).toMatchObject({
      status: 'paused',
      timelineMs: 250
    })
  })

  it('forwards emit and destroy calls to the underlying runtime', async () => {
    const player = createPlayerV1Adapter({
      createElementOptions: {
        nodeFactory: (item) => createRuntimeNodeFixture(item.type === 'list' ? 'SECTION' : 'DIV')
      }
    })

    await player.init({
      mountTarget: {},
      compiledScene: createCompiledSceneFixture()
    })

    const emitResult = await player.emit({
      name: 'sequence:demo:start'
    })
    expect(emitResult).toEqual({ ok: true, data: undefined })

    const destroyResult = await player.destroy()
    expect(destroyResult).toEqual({ ok: true, data: undefined })
    expect(player.getState().status).toBe('idle')
  })

  it('exposes onChange and onTrace subscriptions', async () => {
    const player = createPlayerV1Adapter({
      createElementOptions: {
        nodeFactory: (item) => createRuntimeNodeFixture(item.type === 'list' ? 'SECTION' : 'DIV')
      }
    })

    const statuses: string[] = []
    const traces: string[] = []

    const unsubscribeState = player.onChange((state) => {
      statuses.push(state.status)
    })

    const unsubscribeTrace = player.onTrace((traceRow) => {
      traces.push(`${traceRow.status}:${traceRow.eventName}`)
    })

    await player.init({
      mountTarget: {},
      compiledScene: createCompiledSceneFixture()
    })
    await player.play()
    await player.pause()

    unsubscribeState()
    unsubscribeTrace()

    expect(statuses).toEqual(['ready', 'playing', 'paused'])
    expect(traces).toEqual(
      expect.arrayContaining([
        'applied:player:init:started',
        'applied:player:init:done',
        'applied:player:play',
        'applied:player:pause'
      ])
    )
  })

  it('returns a compatibility warning when init runtimePolicy is provided', async () => {
    const player = createPlayerV1Adapter({
      createElementOptions: {
        nodeFactory: (item) => createRuntimeNodeFixture(item.type === 'list' ? 'SECTION' : 'DIV')
      }
    })

    const initResult = await player.init({
      mountTarget: {},
      compiledScene: createCompiledSceneFixture(),
      runtimePolicy: {
        masterClock: {
          unique: true
        }
      }
    })

    expect(initResult.ok).toBe(true)

    if (!initResult.ok) {
      return
    }

    expect(initResult.warnings).toEqual([
      {
        code: 'PLAYER_RUNTIME_POLICY_IGNORED',
        message: 'runtimePolicy from init input is accepted but not yet applied by this adapter.'
      }
    ])
  })
})

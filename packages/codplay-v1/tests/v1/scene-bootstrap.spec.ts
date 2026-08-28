import { describe, expect, it } from 'vitest'

import { BuilderFacade } from '../../src/builder/create-builder'
import { Player } from '../../src/player'
import type { StrapCollection } from '../../src/player'
import type { SceneDef } from '../../src/builder/types'

type RuntimeNodeFixture = {
  tagName: string
  style: Record<string, unknown>
  attributes: Record<string, unknown>
  className?: string
  textContent?: string
}

/**
 * Creates one plain runtime node fixture for one authored perso.
 */
function createRuntimeNodeFixture(tagName: string): RuntimeNodeFixture {
  return {
    tagName,
    style: {},
    attributes: {}
  }
}

/**
 * Creates one scene fixture that routes scene:start through scene.listen.
 */
function createBootstrapSceneFixture(): SceneDef {
    return {
      id: 'scene-bootstrap',
      initial: undefined,
      straps: undefined,
    listen: [
      {
        on: 'scene:start',
        emit: [{ name: 'story:start' }]
      }
      ],
      tracks: {},
      onStart(scene, options) {
        options.schedule('story-main')
      },
      stories: {
        'story-main': {
          id: 'story-main',
        initial: { move: '@root' },
        persos: [
          {
            id: 'title',
            type: 'tag',
            initial: { content: 'bootstrap', move: '@root' },
            actions: {
              'story:start': {
                className: { add: 'story-started' }
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
 * Creates one scene fixture where one local story event must both apply itself and emit one child event.
 */
function createStoryListenPassthroughSceneFixture(): SceneDef {
  return {
    id: 'scene-story-listen-passthrough',
    initial: undefined,
    straps: undefined,
    listen: [],
    tracks: {},
    onStart(scene, options) {
      options.schedule('story-main')
    },
    stories: {
      'story-main': {
        id: 'story-main',
        initial: { move: '@root' },
        persos: [
          {
            id: 'title',
            type: 'tag',
            initial: { content: 'bootstrap', move: '@root' },
            actions: {
              intro: {
                className: { add: 'intro-applied' }
              },
              'intro-side': {
                className: { add: 'intro-side-applied' }
              }
            }
          }
        ],
        straps: undefined,
        listen: [
          {
            on: 'intro',
            emit: [{ name: 'intro-side' }]
          }
        ],
        eventimes: [
          {
            name: 'intro',
            startAt: 0
          }
        ]
      }
    }
  }
}

/**
 * Creates one scene fixture where one persisted-only author event emits one child runtime event.
 */
function createPersistOnlyParentSceneFixture(): SceneDef {
  return {
    id: 'scene-persist-only-parent',
    initial: undefined,
    straps: undefined,
    listen: [],
    tracks: {},
    stories: {
      'story-main': {
        id: 'story-main',
        initial: { move: '@root' },
        persos: [
          {
            id: 'title',
            type: 'tag',
            initial: { content: 'bootstrap', move: '@root' },
            actions: {
              reveal: {
                className: { add: 'revealed' }
              }
            }
          }
        ],
        straps: undefined,
        listen: [
          {
            on: 'raw:end',
            emit: [{ name: 'reveal' }]
          }
        ]
      }
    }
  }
}

/**
 * Creates one scene fixture where one transform-derived child event has no
 * explicit mode of its own. It must default to apply-now regardless of the
 * triggering event's mode: apply-now is never inherited or overridden implicitly.
 */
function createTransformDefaultModeSceneFixture(): SceneDef {
  return {
    id: 'scene-transform-default-mode',
    initial: undefined,
    straps: undefined,
    listen: [],
    tracks: {},
    stories: {
      'story-main': {
        id: 'story-main',
        initial: { move: '@root' },
        persos: [
          {
            id: 'title',
            type: 'tag',
            initial: { content: 'bootstrap', move: '@root' },
            actions: {
              reveal: {
                className: { add: 'revealed' }
              }
            }
          }
        ],
        straps: undefined,
        listen: [
          {
            on: 'raw:end',
            transform: [() => [{ name: 'reveal', mode: 'persist-only' }]]
          }
        ]
      }
    }
  }
}

/**
 * Creates one scene fixture where one strap update must affect the next live decision immediately.
 */
function createImmediateStrapUpdateSceneFixture(): SceneDef {
  return {
    id: 'scene-immediate-strap-update',
    initial: undefined,
    straps: undefined,
    listen: [],
    tracks: {},
    stories: {
      'story-main': {
        id: 'story-main',
        initial: { move: '@root' },
        state: {
          side: 'a'
        },
        persos: [
          {
            id: 'title',
            type: 'tag',
            initial: { content: 'bootstrap', move: '@root' },
            actions: {
              reveal: {
                className: { add: 'revealed' }
              }
            }
          }
        ],
        listen: [
          { on: 'move:to-b', straps: ['set-b'] },
          { on: 'move:to-a', straps: ['resolve-return'] }
        ],
        straps: immediateStrapUpdateCollection
      }
    }
  }
}

const immediateStrapUpdateCollection: StrapCollection = {
  'set-b': () => ({ update: { side: 'b' } }),
  'resolve-return': ({ state }) => {
    return state.side === 'b'
      ? { events: [{ name: 'reveal' }] }
      : undefined
  }
}

describe('V1 - scene bootstrap', () => {
  it('routes scene:start through scene.listen into runtime actions', async () => {
    const builder = new BuilderFacade()
    const player = new Player({
      createElementOptions: {
        nodeFactory: (item) => createRuntimeNodeFixture(item.type === 'list' ? 'SECTION' : 'DIV')
      }
    })
    const compileResult = builder.compile({ scene: createBootstrapSceneFixture() })

    expect(compileResult.ok).toBe(true)
    if (!compileResult.ok) {
      return
    }

    const initResult = await player.init({
      mountTarget: {},
      compiledScene: compileResult.data.compiledScene,
      resourceManifest: compileResult.data.resourceManifest
    })

    expect(initResult.ok).toBe(true)

    const playResult = await player.play()
    expect(playResult.ok).toBe(true)

    expect(player.getRuntimeRegistry().getNodeById('title')).toMatchObject({
      className: 'story-started'
    })
  })

  it('keeps the original story event runtime effects when one local listen rule emits child events', async () => {
    const builder = new BuilderFacade()
    const player = new Player({
      createElementOptions: {
        nodeFactory: (item) => createRuntimeNodeFixture(item.type === 'list' ? 'SECTION' : 'DIV')
      }
    })
    const compileResult = builder.compile({ scene: createStoryListenPassthroughSceneFixture() })

    expect(compileResult.ok).toBe(true)
    if (!compileResult.ok) {
      return
    }

    expect(await player.init({
      mountTarget: {},
      compiledScene: compileResult.data.compiledScene,
      resourceManifest: compileResult.data.resourceManifest
    })).toEqual({ ok: true, data: undefined })

    expect(await player.play()).toEqual({ ok: true, data: undefined })

    expect(player.getRuntimeRegistry().getNodeById('title')).toMatchObject({
      className: 'intro-applied intro-side-applied'
    })
  })

  it('keeps child events of one persist-only author event on default runtime insertion mode', async () => {
    const builder = new BuilderFacade()
    const player = new Player({
      createElementOptions: {
        nodeFactory: (item) => createRuntimeNodeFixture(item.type === 'list' ? 'SECTION' : 'DIV')
      }
    })
    const compileResult = builder.compile({ scene: createPersistOnlyParentSceneFixture() })

    expect(compileResult.ok).toBe(true)
    if (!compileResult.ok) {
      return
    }

    expect(await player.init({
      mountTarget: {},
      compiledScene: compileResult.data.compiledScene,
      resourceManifest: compileResult.data.resourceManifest
    })).toEqual({ ok: true, data: undefined })

    const routeSceneEvent = (player as unknown as {
      routeSceneEvent: (
        event: { name: string; data?: Record<string, unknown>; cascade?: boolean },
        source: 'system' | 'user' | 'story',
        scopeStoryId?: string,
        depth?: number,
        scope?: Record<string, unknown>
      ) => Promise<{ ok: true; data: undefined } | { ok: false; error: { code: string; message: string } }>
    }).routeSceneEvent.bind(player)

    expect(await routeSceneEvent(
      { name: 'raw:end' },
      'system',
      'story-main',
      0,
      {
        scopeStoryId: 'story-main',
        source: 'system',
        ms: 0,
        eventInsertMode: 'persist-only'
      }
    )).toEqual({ ok: true, data: undefined })

    expect(player.getRuntimeRegistry().getNodeById('title')).toMatchObject({
      className: 'revealed'
    })

    expect(await player.seek({ timelineMs: 0 })).toEqual({ ok: true, data: undefined })
    expect(player.getRuntimeRegistry().getNodeById('title')).toMatchObject({
      className: 'revealed'
    })
  })

  it('applies transform-derived child events live by default, even when the triggering event is persist-only', async () => {
    const builder = new BuilderFacade()
    const player = new Player({
      createElementOptions: {
        nodeFactory: (item) => createRuntimeNodeFixture(item.type === 'list' ? 'SECTION' : 'DIV')
      }
    })
    const compileResult = builder.compile({ scene: createTransformDefaultModeSceneFixture() })

    expect(compileResult.ok).toBe(true)
    if (!compileResult.ok) {
      return
    }

    expect(await player.init({
      mountTarget: {},
      compiledScene: compileResult.data.compiledScene,
      resourceManifest: compileResult.data.resourceManifest
    })).toEqual({ ok: true, data: undefined })

    const routeSceneEvent = (player as unknown as {
      routeSceneEvent: (
        event: { name: string; data?: Record<string, unknown>; cascade?: boolean },
        source: 'system' | 'user' | 'story',
        scopeStoryId?: string,
        depth?: number,
        scope?: Record<string, unknown>
      ) => Promise<{ ok: true; data: undefined } | { ok: false; error: { code: string; message: string } }>
    }).routeSceneEvent.bind(player)

    expect(await routeSceneEvent(
      { name: 'raw:end' },
      'system',
      'story-main',
      0,
      {
        scopeStoryId: 'story-main',
        source: 'system',
        ms: 0,
        eventInsertMode: 'persist-only'
      }
    )).toEqual({ ok: true, data: undefined })

    expect(player.getRuntimeRegistry().getNodeById('title')).toMatchObject({
      className: 'revealed'
    })
  })

  it('applies strap state updates immediately for subsequent live events', async () => {
    const builder = new BuilderFacade()
    const player = new Player({
      createElementOptions: {
        nodeFactory: (item) => createRuntimeNodeFixture(item.type === 'list' ? 'SECTION' : 'DIV')
      }
    })
    const compileResult = builder.compile({ scene: createImmediateStrapUpdateSceneFixture() })

    expect(compileResult.ok).toBe(true)
    if (!compileResult.ok) {
      return
    }

    expect(await player.init({
      mountTarget: {},
      compiledScene: compileResult.data.compiledScene,
      resourceManifest: compileResult.data.resourceManifest,
      strapCollection: immediateStrapUpdateCollection
    })).toEqual({ ok: true, data: undefined })

    const routeSceneEvent = (player as unknown as {
      routeSceneEvent: (
        event: { name: string; data?: Record<string, unknown>; cascade?: boolean },
        source: 'system' | 'user' | 'story',
        scopeStoryId?: string,
        depth?: number,
        scope?: Record<string, unknown>
      ) => Promise<{ ok: true; data: undefined } | { ok: false; error: { code: string; message: string } }>
    }).routeSceneEvent.bind(player)

    expect(await routeSceneEvent(
      { name: 'move:to-b' },
      'user',
      'story-main',
      0,
      { scopeStoryId: 'story-main', source: 'user', ms: 0 }
    )).toEqual({ ok: true, data: undefined })

    expect(await routeSceneEvent(
      { name: 'move:to-a' },
      'user',
      'story-main',
      0,
      { scopeStoryId: 'story-main', source: 'user', ms: 0 }
    )).toEqual({ ok: true, data: undefined })

    expect(player.getRuntimeRegistry().getNodeById('title')).toMatchObject({
      className: 'revealed'
    })
  })

  it('applies strap-emitted events live even when the triggering event is persist-only', async () => {
    const builder = new BuilderFacade()
    const player = new Player({
      createElementOptions: {
        nodeFactory: (item) => createRuntimeNodeFixture(item.type === 'list' ? 'SECTION' : 'DIV')
      }
    })

    const straps: StrapCollection = {
      'resolver': () => ({
        events: [{ name: 'resolved', data: {} }]
      })
    }

    const compileResult = builder.compile({
      scene: {
        id: 'scene-strap-persist-only',
        initial: undefined,
        straps: ['resolver'],
        listen: [],
        tracks: {},
        stories: {
          'story-main': {
            id: 'story-main',
            initial: { move: '@root' },
            persos: [{
              id: 'title',
              type: 'tag',
              initial: { content: 'base', move: '@root' },
              actions: {
                resolved: { className: { add: 'resolved' } }
              }
            }],
            straps,
            listen: [{ on: 'raw:end', straps: ['resolver'] }]
          }
        }
      } as unknown as import('../../src/builder/types').SceneDef
    })

    expect(compileResult.ok).toBe(true)
    if (!compileResult.ok) return

    expect(await player.init({
      mountTarget: {},
      compiledScene: compileResult.data.compiledScene,
      resourceManifest: compileResult.data.resourceManifest,
      strapCollection: straps
    })).toEqual({ ok: true, data: undefined })

    const routeSceneEvent = (player as unknown as {
      routeSceneEvent: (
        event: { name: string },
        source: string,
        scopeStoryId: string,
        depth: number,
        scope: Record<string, unknown>
      ) => Promise<{ ok: boolean }>
    }).routeSceneEvent.bind(player)

    expect(await routeSceneEvent(
      { name: 'raw:end' },
      'system',
      'story-main',
      0,
      { scopeStoryId: 'story-main', source: 'system', ms: 0, eventInsertMode: 'persist-only' }
    )).toEqual({ ok: true, data: undefined })

    expect(player.getRuntimeRegistry().getNodeById('title')).toMatchObject({
      className: 'resolved'
    })
  })
})

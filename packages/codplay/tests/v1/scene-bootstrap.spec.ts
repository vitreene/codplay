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
      rootStories: ['story-main'],
      initial: undefined,
      straps: undefined,
    listen: [
      {
        on: 'scene:start',
        emit: [{ name: 'story:start' }]
      }
      ],
      tracks: {},
      init(scene, options) {
        options.mount(scene.rootStories[0])
      },
      onStart(scene, options) {
        options.schedule(scene.rootStories[0])
      },
      stories: {
        'story-main': {
          id: 'story-main',
          entries: ['title'],
        initial: undefined,
        persos: [
          {
            id: 'title',
            type: 'tag',
            initial: { content: 'bootstrap' },
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
    rootStories: ['story-main'],
    initial: undefined,
    straps: undefined,
    listen: [],
    tracks: {},
    init(scene, options) {
      options.mount(scene.rootStories[0])
    },
    onStart(scene, options) {
      options.schedule(scene.rootStories[0])
    },
    stories: {
      'story-main': {
        id: 'story-main',
        entries: ['title'],
        initial: undefined,
        persos: [
          {
            id: 'title',
            type: 'tag',
            initial: { content: 'bootstrap' },
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
    rootStories: ['story-main'],
    initial: undefined,
    straps: undefined,
    listen: [],
    tracks: {},
    init(scene, options) {
      options.mount(scene.rootStories[0])
    },
    stories: {
      'story-main': {
        id: 'story-main',
        entries: ['title'],
        initial: undefined,
        persos: [
          {
            id: 'title',
            type: 'tag',
            initial: { content: 'bootstrap' },
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
 * Creates one scene fixture where one transform-derived child event must inherit persist-only timing.
 */
function createPersistOnlyTransformSceneFixture(): SceneDef {
  return {
    id: 'scene-persist-only-transform',
    rootStories: ['story-main'],
    initial: undefined,
    straps: undefined,
    listen: [],
    tracks: {},
    init(scene, options) {
      options.mount(scene.rootStories[0])
    },
    stories: {
      'story-main': {
        id: 'story-main',
        entries: ['title'],
        initial: undefined,
        persos: [
          {
            id: 'title',
            type: 'tag',
            initial: { content: 'bootstrap' },
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
            transform: [() => [{ name: 'reveal' }]]
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
    rootStories: ['story-main'],
    initial: undefined,
    straps: undefined,
    listen: [],
    tracks: {},
    init(scene, options) {
      options.mount(scene.rootStories[0])
    },
    stories: {
      'story-main': {
        id: 'story-main',
        entries: ['title'],
        initial: undefined,
        state: {
          side: 'a'
        },
        persos: [
          {
            id: 'title',
            type: 'tag',
            initial: { content: 'bootstrap' },
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

  it('keeps transform-derived child events of one persist-only author event off the live runtime', async () => {
    const builder = new BuilderFacade()
    const player = new Player({
      createElementOptions: {
        nodeFactory: (item) => createRuntimeNodeFixture(item.type === 'list' ? 'SECTION' : 'DIV')
      }
    })
    const compileResult = builder.compile({ scene: createPersistOnlyTransformSceneFixture() })

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
      className: ''
    })

    expect(await player.seek({ timelineMs: 0 })).toEqual({ ok: true, data: undefined })
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
        rootStories: ['story-main'],
        initial: undefined,
        straps: ['resolver'],
        listen: [],
        tracks: {},
        init(scene, options) {
          options.mount(scene.rootStories[0])
        },
        stories: {
          'story-main': {
            id: 'story-main',
            entries: ['title'],
            initial: undefined,
            persos: [{
              id: 'title',
              type: 'tag',
              initial: { content: 'base' },
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

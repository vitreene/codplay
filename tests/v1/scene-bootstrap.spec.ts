import { describe, expect, it } from 'vitest'

import { BuilderFacade } from '../../src/builder/create-builder'
import { Player } from '../../src/player'
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
            type: 'text',
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
            type: 'text',
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
})

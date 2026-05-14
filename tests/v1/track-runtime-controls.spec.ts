import { describe, expect, it } from 'vitest'

import { PlayerFacade } from '../../src/player/create-player'
import type { SceneDoc } from '../../src/player/types'
import { RUNTIME_OBJECT_EVENT_HANDLERS } from '../../src/runtime/create-element'

type RuntimeNodeFixture = {
  tagName: string
  style: Record<string, unknown>
  attributes: Record<string, unknown>
  className?: string
  textContent?: string
  [RUNTIME_OBJECT_EVENT_HANDLERS]?: Record<string, () => void>
}

const TRACE_EVENT = {
  initDone: 'player:init:done',
  emit: 'player:emit',
  trackControl: 'player:track-control',
  trackControlWarning: 'player:track-control:warning'
} as const

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
 * Creates one scene fixture with default and declared tracks.
 */
function createTrackDeclarationSceneFixture(): SceneDoc {
  return {
    id: 'scene-track-declare',
    rootStories: ['story-main'],
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      'story-main': {
        id: 'story-main',
        name: 'main',
        tracks: {
          visemes: {
            active: false
          }
        },
        entries: ['story-main__title'],
        initial: undefined,
        persos: [
          {
            id: 'story-main__title',
            name: 'title',
            type: 'text',
            initial: { content: 'hello' },
            actions: {
              'story-main__title': null,
              'title:clicked': {
                className: { add: 'clicked' }
              }
            },
            emit: {
              click: {
                event: {
                  name: 'title:clicked'
                }
              }
            }
          }
        ],
        straps: undefined,
        listen: []
      }
    },
    init(scene, options) {
      options.mount(scene.rootStories[0])
    },
    tracks: {}
  }
}

/**
 * Creates one scene fixture with explicit language tracks toggled by runtime control events.
 */
function createTrackToggleSceneFixture(): SceneDoc {
  return {
    id: 'scene-track-toggle',
    rootStories: ['story-main'],
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      'story-main': {
        id: 'story-main',
        name: 'main',
        entries: ['story-main__title'],
        initial: undefined,
        persos: [
          {
            id: 'story-main__title',
            name: 'title',
            type: 'text',
            initial: { content: 'base' },
            actions: {
              'story-main__title': null,
              'lang:fr': {
                content: 'fr'
              },
              'lang:en': {
                content: 'en'
              }
            }
          }
        ],
        straps: undefined,
        listen: []
      }
    },
    init(scene, options) {
      options.mount(scene.rootStories[0])
    },
    tracks: {
      fr: {
        active: true,
        order: 0,
        events: [
          {
            id: 'evt-fr',
            ms: 100,
            name: 'lang:fr',
            index: 0,
            source: 'story'
          }
        ]
      },
      en: {
        active: false,
        order: 1,
        events: [
          {
            id: 'evt-en',
            ms: 100,
            name: 'lang:en',
            index: 0,
            source: 'story'
          }
        ]
      }
    }
  }
}

describe('V1 - track runtime controls', () => {
  it('builds global and story default tracks at scene init', async () => {
    const traces: Array<Record<string, unknown>> = []
    const player = new PlayerFacade()
    player.onTrace((row) => {
      if (row.eventName === TRACE_EVENT.initDone && row.payload) {
        traces.push(row.payload)
      }
    })

    expect(await player.init(createTrackDeclarationSceneFixture())).toEqual({ ok: true })
    expect(traces.at(-1)).toMatchObject({
      loadedTrackCount: 3,
      activeTrackCount: 2
    })
  })

  it('routes emitted events to story.id by default and external events to global', async () => {
    const traces: Array<Record<string, unknown>> = []
    const player = new PlayerFacade({
      createElementOptions: {
        nodeFactory: (item) => createRuntimeNodeFixture(item.type === 'list' ? 'SECTION' : 'DIV')
      }
    })
    player.onTrace((row) => {
      if (row.eventName === TRACE_EVENT.emit && row.payload) {
        traces.push(row.payload)
      }
    })

    expect(await player.init(createTrackDeclarationSceneFixture())).toEqual({ ok: true })

    const node = player.getRuntimeRegistry().getNodeById('story-main__title') as RuntimeNodeFixture | null
    node?.[RUNTIME_OBJECT_EVENT_HANDLERS]?.click?.()

    expect(traces.at(-1)).toMatchObject({
      eventName: 'title:clicked',
      trackId: 'story-main'
    })

    expect(await player.emit({ name: 'external:ping' })).toEqual({ ok: true })
    expect(traces.at(-1)).toMatchObject({
      eventName: 'external:ping',
      trackId: 'global'
    })
  })

  it('toggles explicit tracks by scene-level control event and ignores unknown tracks with warning', async () => {
    const controlTraces: Array<Record<string, unknown>> = []
    const warningTraces: Array<Record<string, unknown>> = []
    const player = new PlayerFacade({
      createElementOptions: {
        nodeFactory: (item) => createRuntimeNodeFixture(item.type === 'list' ? 'SECTION' : 'DIV')
      }
    })
    player.onTrace((row) => {
      if (row.eventName === TRACE_EVENT.trackControl && row.payload) {
        controlTraces.push(row.payload)
      }

      if (row.eventName === TRACE_EVENT.trackControlWarning && row.payload) {
        warningTraces.push(row.payload)
      }
    })

    expect(await player.init(createTrackToggleSceneFixture())).toEqual({ ok: true })
    expect(await player.seek(150)).toEqual({ ok: true })
    expect(player.getRuntimeRegistry().getNodeById('story-main__title')).toMatchObject({
      textContent: 'fr'
    })

    expect(await player.rewind()).toEqual({ ok: true })
    expect(await player.emit({
      name: 'track:toggle',
      payload: {
        trackIds: ['fr', 'en', 'missing']
      }
    })).toEqual({ ok: true })

    expect(controlTraces.at(-1)).toMatchObject({
      eventName: 'track:toggle',
      appliedTrackIds: ['fr', 'en'],
      ignoredTrackIds: ['missing']
    })
    expect(warningTraces.at(-1)).toMatchObject({
      code: 'RUNTIME_TRACK_UNKNOWN_IGNORED',
      ignoredTrackIds: ['missing']
    })

    expect(await player.seek(150)).toEqual({ ok: true })
    expect(player.getRuntimeRegistry().getNodeById('story-main__title')).toMatchObject({
      textContent: 'en'
    })
  })
})

import { describe, expect, it } from 'vitest'

import {
  materializeScene,
  createStrapTrackId,
  resolveScene,
  RuntimeEventDispatcher,
  RuntimeStateStore,
  RuntimeTrackJournal,
} from '../../../src/runtime/player'
import type { CompiledScene } from '../../../src/scene/compiled'

const scene: CompiledScene = {
  schemaVersion: 'codplay.v2.scene.v1',
  createdAt: '2026-08-19T00:00:00.000Z',
  scene: {
    id: 'runtime-dispatcher-scene',
    listen: [{
      on: 'global:start',
      emit: [{ name: 'global:done', cascade: true }],
    }],
    tracks: {},
    stories: {
      main: {
        id: 'main',
        state: { count: 0 },
        straps: ['record'],
        listen: [
          {
            on: 'source:event',
            straps: ['record'],
            emit: [{ name: 'story:done', data: { className: { add: 'story-done' } } }],
          },
          {
            on: 'story:done',
            emit: [{ name: 'follow:event', data: { className: { add: 'follow' } } }],
          },
        ],
        persos: [{
          id: 'root',
          type: 'tag',
          initial: { className: 'idle' },
          actions: {
            'source:event': { className: { add: 'source' } },
            'strap:event': { className: { add: 'strap' } },
            'planned:event': { className: { add: 'planned' } },
            'story:done': null,
            'follow:event': null,
            'global:done': { className: { add: 'global' } },
          },
        }],
      },
    },
  },
  resources: { entries: [] },
  rootNodeIds: [],
  requirements: { components: [], services: [], modules: [], resources: [] },
  actionTargetIndex: {},
}

describe('runtime event dispatch', () => {
  it('executes locally declared straps through the same dispatcher circuit', async () => {
    let sceneCalls = 0
    let storyCalls = 0
    const inlineScene: CompiledScene = {
      ...scene,
      scene: {
        ...scene.scene,
        straps: { 'scene-local': { ref: 'fn:scene-local' } },
        listen: [{ on: 'global:start', straps: ['scene-local'] }],
        stories: {
          main: {
            ...scene.scene.stories.main!,
            straps: { 'story-local': { ref: 'fn:story-local' } },
            listen: [{ on: 'source:event', straps: ['story-local'] }],
          },
        },
      },
    }
    const journal = new RuntimeTrackJournal(inlineScene)
    const dispatcher = new RuntimeEventDispatcher({
      scene: inlineScene,
      journal,
      functions: {
        'fn:scene-local': () => {
          sceneCalls += 1
          return undefined
        },
        'fn:story-local': () => {
          storyCalls += 1
          return undefined
        },
      },
    })

    await dispatcher.dispatch({ name: 'global:start', applyAtMs: 10 })
    await dispatcher.dispatch({ name: 'source:event', storyId: 'main', applyAtMs: 20 })

    expect(sceneCalls).toBe(1)
    expect(storyCalls).toBe(1)
  })

  it('journals source, strap, and recursive listen emissions for replay', async () => {
    let strapCalls = 0
    const journal = new RuntimeTrackJournal(scene)
    const stateStore = new RuntimeStateStore(scene)
    const dispatcher = new RuntimeEventDispatcher({
      scene,
      journal,
      stateStore,
      strapCollections: {
        scene: {},
        stories: {
          main: {
            record: () => {
              strapCalls += 1
              return [
                { events: [{ name: 'strap:event' }], update: { count: 1 } },
                { offsetMs: 20, step: { event: { name: 'planned:event' } } },
              ]
            },
          },
        },
      },
    })

    const result = await dispatcher.dispatch({
      name: 'source:event',
      storyId: 'main',
      applyAtMs: 100,
    })

    expect(result.ok).toBe(true)
    expect(strapCalls).toBe(1)
    expect(result.events.map((event) => event.name)).toEqual([
      'source:event',
      'strap:event',
      'runtime:state:update',
      'planned:event',
      'story:done',
      'follow:event',
    ])
    expect(journal.getEvents('strap-main-record')).toHaveLength(3)
    expect(stateStore.snapshot('story', 'main')).toMatchObject({ count: 1 })

    const resolved = resolveScene(materializeScene(scene, 121, journal))
    expect(resolved.persos['main:root']?.state.className).toEqual(
      expect.stringContaining('source'),
    )
    expect(resolved.persos['main:root']?.state.className).toEqual(
      expect.stringContaining('strap'),
    )
    expect(resolved.persos['main:root']?.state.className).toEqual(
      expect.stringContaining('planned'),
    )
    expect(resolved.persos['main:root']?.state.className).toEqual(
      expect.stringContaining('story-done'),
    )
    expect(resolved.persos['main:root']?.state.className).toEqual(
      expect.stringContaining('follow'),
    )
    expect(materializeScene(scene, 121, journal).storyStates.main).toMatchObject({ count: 1 })

    materializeScene(scene, 121, journal)
    expect(strapCalls).toBe(1)
  })

  it('cascades global emissions to story materialization without duplicating tracks', async () => {
    const journal = new RuntimeTrackJournal(scene)
    const dispatcher = new RuntimeEventDispatcher({ scene, journal })

    const result = await dispatcher.dispatch({ name: 'global:start', applyAtMs: 40 })

    expect(result.ok).toBe(true)
    expect(result.events.map((event) => [event.name, event.trackId, event.cascade])).toEqual([
      ['global:start', 'global', true],
      ['global:done', 'global', true],
    ])
    const resolved = resolveScene(materializeScene(scene, 41, journal))
    expect(resolved.persos['main:root']?.state.className).toEqual(
      expect.stringContaining('global'),
    )
  })

  it('reinjects immediate events returned by a story strap into scene listen', async () => {
    let aggregateCalls = 0
    const chainedScene: CompiledScene = {
      ...scene,
      scene: {
        ...scene.scene,
        straps: { aggregate: { ref: 'fn:aggregate' } },
        listen: [
          { on: 'source:event', straps: ['record'] },
          { on: 'strap:event', straps: ['aggregate'] },
        ],
      },
    }
    const journal = new RuntimeTrackJournal(chainedScene)
    const stateStore = new RuntimeStateStore(chainedScene)
    const dispatcher = new RuntimeEventDispatcher({
      scene: chainedScene,
      journal,
      stateStore,
      functions: {
        'fn:aggregate': () => {
          aggregateCalls += 1
          return { update: { aggregated: true } }
        },
      },
      strapCollections: {
        scene: {},
        stories: {
          main: {
            record: () => ({ events: [{ name: 'strap:event' }] }),
          },
        },
      },
    })

    const result = await dispatcher.dispatch({
      name: 'source:event',
      storyId: 'main',
      applyAtMs: 100,
    })

    expect(result.ok).toBe(true)
    expect(aggregateCalls).toBe(1)
    expect(stateStore.snapshot('scene')).toMatchObject({ aggregated: true })
    expect(materializeScene(chainedScene, 101, journal).sceneState).toMatchObject({ aggregated: true })
    expect(journal.getEvents('strap-main-record').filter((event) => event.name === 'strap:event')).toHaveLength(1)
    expect(result.events.map((event) => event.name)).toEqual([
      'source:event',
      'strap:event',
      'runtime:state:update',
      'story:done',
      'follow:event',
    ])
  })

  it('keeps multiple straps on their own declared tracks', async () => {
    const multiStrapScene: CompiledScene = {
      ...scene,
      scene: {
        ...scene.scene,
        stories: {
          ...scene.scene.stories,
          main: {
            ...scene.scene.stories.main!,
            straps: ['first', 'second'],
            listen: [{ on: 'source:event', straps: ['first', 'second'] }],
          },
        },
      },
    }
    const journal = new RuntimeTrackJournal(multiStrapScene)
    const dispatcher = new RuntimeEventDispatcher({
      scene: multiStrapScene,
      journal,
      strapCollections: {
        scene: {},
        stories: {
          main: {
            first: () => ({ events: [{ name: 'first:event' }] }),
            second: () => ({ events: [{ name: 'second:event' }] }),
          },
        },
      },
    })

    const result = await dispatcher.dispatch({ name: 'source:event', storyId: 'main', applyAtMs: 10 })

    expect(result.ok).toBe(true)
    expect(journal.getEvents(createStrapTrackId('main', 'first')).map((event) => event.name))
      .toEqual(['first:event'])
    expect(journal.getEvents(createStrapTrackId('main', 'second')).map((event) => event.name))
      .toEqual(['second:event'])
  })
})

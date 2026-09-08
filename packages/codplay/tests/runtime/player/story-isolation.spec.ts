import { describe, expect, it } from 'vitest'

import {
  materializeScene,
  RuntimeEventDispatcher,
  RuntimePlayer,
  RuntimeTrackJournal,
} from '../../../src/runtime/player'
import { RuntimeCapabilityCatalog } from '../../../src/runtime/catalog'
import { RuntimeEngine } from '../../../src/runtime/engine'
import type { CompiledScene } from '../../../src/scene/compiled'

const scene: CompiledScene = {
  schemaVersion: 'codplay.v2.scene.v1',
  createdAt: '2026-09-08T00:00:00.000Z',
  scene: {
    id: 'story-isolation-scene',
    listen: [],
    tracks: {},
    stories: {
      first: {
        id: 'first',
        listen: [
          { on: 'first:enter', active: true },
          { on: 'first:leave', active: false },
          { on: 'first:reset', active: true, reset: true },
        ],
        persos: [{
          id: 'first-root',
          type: 'tag',
          initial: { className: 'initial' },
          actions: {
            'future:old': { className: { add: 'old' } },
            'future:new': { className: { add: 'new' } },
          },
        }],
      },
      second: {
        id: 'second',
        listen: [
          { on: 'second:enter', active: true },
          { on: 'second:leave', active: false },
        ],
        persos: [{
          id: 'second-root',
          type: 'tag',
          initial: { className: 'second-initial' },
          actions: { 'second:future': { className: { add: 'second-future' } } },
        }],
      },
    },
  },
  resources: { entries: [] },
  rootNodeIds: [],
  requirements: { components: [], services: [], modules: [], resources: [] },
  actionTargetIndex: {},
}

function createDispatcher(journal: RuntimeTrackJournal): RuntimeEventDispatcher {
  return new RuntimeEventDispatcher({ scene, journal })
}

describe('declarative story isolation', () => {
  it('keeps an inactive story in the journal without projecting its ordinary events', async () => {
    const journal = new RuntimeTrackJournal(scene)
    const dispatcher = createDispatcher(journal)

    const ignored = await dispatcher.dispatch({
      name: 'future:old',
      storyId: 'first',
      applyAtMs: 10,
    })

    expect(ignored.ok).toBe(true)
    expect(journal.getAllEvents()).toHaveLength(1)
    expect(materializeScene(scene, 11, journal).persos['first:first-root']?.actions).toEqual([])
  })

  it('wakes the addressed inactive story and closes the previous story period atomically', async () => {
    const journal = new RuntimeTrackJournal(scene)
    const dispatcher = createDispatcher(journal)

    await dispatcher.dispatch({ name: 'first:enter', storyId: 'first', applyAtMs: 0 })
    await dispatcher.dispatch({ name: 'future:old', storyId: 'first', applyAtMs: 10 })
    const secondEntry = await dispatcher.dispatch({ name: 'second:enter', storyId: 'second', applyAtMs: 20 })
    expect(secondEntry.ok).toBe(true)
    expect(secondEntry.isolationClosedStoryIds).toEqual(['first'])
    expect(journal.isStoryIsolationActive('first')).toBe(false)
    expect(journal.isStoryIsolationActive('second')).toBe(true)
    await dispatcher.dispatch({ name: 'future:old', storyId: 'first', applyAtMs: 30 })
    await dispatcher.dispatch({ name: 'first:enter', storyId: 'first', applyAtMs: 35 })
    await dispatcher.dispatch({ name: 'future:new', storyId: 'first', applyAtMs: 40 })

    expect(journal.isStoryIsolationActive('first')).toBe(true)
    expect(journal.isStoryIsolationActive('second')).toBe(false)
    expect(journal.getAllEvents().filter((event) => event.name === 'future:old')).toHaveLength(2)
    expect(materializeScene(scene, 50, journal).persos['first:first-root']?.actions.map((action) => action.name))
      .toEqual(['future:new'])
  })

  it('makes active:true and reset:true one transition and keeps deactivation idempotent', async () => {
    const journal = new RuntimeTrackJournal(scene)
    const dispatcher = createDispatcher(journal)

    const inactiveClose = await dispatcher.dispatch({ name: 'first:leave', storyId: 'first', applyAtMs: 0 })
    expect(inactiveClose.ok).toBe(true)
    expect(journal.isStoryIsolationActive('first')).toBe(false)

    await dispatcher.dispatch({ name: 'first:reset', storyId: 'first', applyAtMs: 10 })
    const resetEvent = journal.getEvents('first').find((event) => event.name === 'first:reset')
    expect(resetEvent?.activationId).toBeDefined()
    expect(journal.isStoryResetEvent('first', resetEvent!)).toBe(true)

    await dispatcher.dispatch({ name: 'second:enter', storyId: 'second', applyAtMs: 20 })
    const secondClose = await dispatcher.dispatch({ name: 'first:leave', storyId: 'first', applyAtMs: 30 })
    expect(secondClose.ok).toBe(true)
    expect(journal.isStoryIsolationActive('second')).toBe(true)
  })

  it('leaves scene-scope facts visible independently of story isolation', async () => {
    const sceneEventScene: CompiledScene = {
      ...scene,
      scene: {
        ...scene.scene,
        listen: [{ on: 'scene:mark' }],
        stories: {
          ...scene.scene.stories,
          first: {
            ...scene.scene.stories.first!,
            persos: [{
              ...scene.scene.stories.first!.persos[0]!,
              actions: { ...scene.scene.stories.first!.persos[0]!.actions, 'scene:mark': { className: { add: 'scene' } } },
            }],
          },
        },
      },
    }
    const journal = new RuntimeTrackJournal(sceneEventScene)
    const dispatcher = new RuntimeEventDispatcher({ scene: sceneEventScene, journal })

    await dispatcher.dispatch({ name: 'scene:mark', applyAtMs: 10 })

    expect(materializeScene(sceneEventScene, 11, journal).persos['first:first-root']?.actions.map((action) => action.name))
      .toEqual(['scene:mark'])
  })

  it('routes an immediate targeted eventime through listen so the public target can wake a story', async () => {
    const player = new RuntimePlayer(
      'story-isolation-eventime-instance',
      new RuntimeEngine(new RuntimeCapabilityCatalog()),
      scene,
    )
    expect(player.init().ok).toBe(true)

    const result = await player.emitEventime(
      { name: 'first:enter' },
      { scope: 'story', storyId: 'first' },
    )

    expect(result.events[0]?.activationId).toBeDefined()
    expect(player.trackJournal.isStoryIsolationActive('first')).toBe(true)
    player.destroy()
  })
})

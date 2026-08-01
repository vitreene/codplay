import { describe, expect, it } from 'vitest'

import {
  buildTrackRegistry,
  createStrapTrackId,
  materializeScene,
  resolveScene,
  RuntimeTrackJournal,
  STRAP_SCOPE_STORY,
  solveScene,
  TRACK_EVENT_ACTIVATE,
  TRACK_EVENT_DEACTIVATE,
} from '../../../src/runtime/player'
import type { CompiledScene } from '../../../src/scene/compiled'

const scene: CompiledScene = {
  schemaVersion: 'codplay.v2.scene.v1',
  createdAt: '2026-08-01T00:00:00.000Z',
  scene: {
    id: 'pipeline-scene',
    listen: [],
    tracks: { main: { active: true }, disabled: { active: false } },
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: 'root',
          type: 'tag',
          initial: { className: 'is-idle', style: { opacity: 0, backgroundColor: '#000000' } },
          actions: {
            'demo:show': {
              className: { add: 'is-active', remove: 'is-idle' },
              style: {
                opacity: { from: 0, to: 1, duration: 100, ease: 'linear' },
                backgroundColor: { from: '#000000', to: '#ffffff', duration: 100, ease: 'linear' },
              },
            },
            'data:show': null,
          },
        }],
        listen: [],
        eventimes: [
          { name: 'demo:show', startAt: 200 },
          { name: 'demo:show', startAt: 100 },
          { name: 'sequence:anchor', startAt: 300, events: [{ name: 'demo:show', startAt: 25 }] },
          { name: 'data:show', startAt: 400, data: { className: { add: 'data-active' } } },
        ],
      },
    },
  },
  resources: { entries: [] },
  rootNodeIds: ['main:root'],
  requirements: { components: [], services: [], modules: [], resources: [] },
}

describe('materialize -> resolve -> solve', () => {
  it('materializes only active occurrences in chronological order', () => {
    const materialized = materializeScene(scene, 250)
    const actions = materialized.persos['main:root']?.actions

    expect(actions).toHaveLength(2)
    expect(actions?.map((action) => [action.startAt, action.elapsedMs])).toEqual([[100, 150], [200, 50]])
    expect(actions?.[0]).toMatchObject({ trackId: 'main', trackOrder: 1 })

    const nestedActions = materializeScene(scene, 325).persos['main:root']?.actions
    expect(nestedActions?.map((action) => action.startAt)).toEqual([100, 200, 325])
    expect(nestedActions?.[2]?.declarationPath).toEqual([2, 0])
  })

  it('consolidates the static track registry in declaration order', () => {
    const registry = buildTrackRegistry(scene)

    expect(registry.order).toEqual(['global', 'main', 'disabled'])
    expect(registry.tracks.main).toMatchObject({ id: 'main', order: 1, active: true })
    expect(registry.tracks.disabled).toMatchObject({ id: 'disabled', order: 2, active: false })
  })

  it('does not materialize events from an inactive track', () => {
    const inactiveScene: CompiledScene = {
      ...scene,
      scene: { ...scene.scene, tracks: { main: { active: false } } },
    }

    expect(materializeScene(inactiveScene, 150).persos['main:root']?.actions).toHaveLength(0)
  })

  it('appends live events only to declared tracks and preserves event sequence', () => {
    const journal = new RuntimeTrackJournal(scene)
    const first = journal.appendLiveEvent({
      eventId: 'live-a',
      trackId: 'main',
      storyId: 'main',
      name: 'data:show',
      applyAtMs: 250,
      data: { className: { add: 'live-a' } },
    })
    const second = journal.appendLiveEvent({
      eventId: 'live-b',
      trackId: 'main',
      storyId: 'main',
      name: 'data:show',
      applyAtMs: 250,
      data: { className: { add: 'live-b' } },
    })

    expect(first).toMatchObject({ ok: true, data: { eventSeq: 0 } })
    expect(second).toMatchObject({ ok: true, data: { eventSeq: 1 } })
    expect(journal.appendLiveEvent({
      eventId: 'unknown', trackId: 'missing', name: 'data:show', applyAtMs: 250,
    })).toMatchObject({ ok: false, code: 'RUNTIME_TRACK_UNKNOWN' })

    const liveActions = materializeScene(scene, 260, journal).persos['main:root']?.actions
    expect(liveActions?.filter((action) => action.eventId !== undefined).map((action) => action.eventSeq)).toEqual([0, 1])
  })

  it('controls declared track activity without creating tracks', () => {
    const journal = new RuntimeTrackJournal(scene)

    expect(journal.applyControlEvent(TRACK_EVENT_DEACTIVATE, { trackIds: ['main'] })).toMatchObject({
      ok: true,
      data: { deactivated: ['main'] },
    })
    expect(journal.applyControlEvent(TRACK_EVENT_ACTIVATE, { trackIds: ['main', 'missing'] })).toMatchObject({
      ok: true,
      data: { activated: ['main'], ignored: ['missing'] },
    })
    expect(journal.registry.tracks.missing).toBeUndefined()
  })

  it('anchors relative live eventimes without changing the track registry', () => {
    const journal = new RuntimeTrackJournal(scene)
    const result = journal.appendAnchoredEventimes({
      trackId: 'main',
      storyId: 'main',
      anchorMs: 100,
      eventimes: [{
        name: 'data:show',
        startAt: 10,
        events: [{ name: 'data:show', startAt: 20, data: { className: { add: 'anchored' } } }],
      }],
    })

    expect(result).toMatchObject({ ok: true, data: { appendedCount: 2 } })
    if (result.ok) expect(result.data.events.map((event) => event.applyAtMs)).toEqual([110, 130])
    expect(journal.registry.order).toEqual(['global', 'main', 'disabled'])
    expect(resolveScene(materializeScene(scene, 131, journal)).persos['main:root']?.state.className)
      .toContain('anchored')
  })

  it('materializes strap outputs on their declared dedicated track', () => {
    const strapScene: CompiledScene = {
      ...scene,
      scene: {
        ...scene.scene,
        stories: {
          ...scene.scene.stories,
          main: { ...scene.scene.stories.main!, straps: ['counter'] },
        },
      },
    }
    const journal = new RuntimeTrackJournal(strapScene)
    const result = journal.appendStrapOutput({
      scope: STRAP_SCOPE_STORY,
      storyId: 'main',
      strapName: 'counter',
      anchorMs: 200,
      output: {
        events: [{ name: 'data:show', data: { className: { add: 'immediate' } } }],
        updates: [{ count: 1 }],
        planned: [{ offsetMs: 25, step: { event: { name: 'data:show', data: { className: { add: 'planned' } } } } }],
        warnings: [],
        issues: [],
      },
    })

    expect(result).toMatchObject({
      ok: true,
      data: { trackId: createStrapTrackId('main', 'counter'), ignoredUpdateCount: 1 },
    })
    expect(resolveScene(materializeScene(strapScene, 226, journal)).persos['main:root']?.state.className)
      .toMatch(/immediate.*planned|planned.*immediate/)
  })

  it('resolves discrete patches and ACE values without mutating compiled data', () => {
    const materialized = materializeScene(scene, 150)
    const resolved = resolveScene(materialized)

    expect(resolved.persos['main:root']?.state).toMatchObject({
      className: 'is-active',
      style: {
        opacity: 0.5,
        backgroundColor: { kind: 'color', space: 'srgb', coords: [0.5, 0.5, 0.5], alpha: 1 },
      },
    })
    expect(scene.scene.stories.main.persos[0]?.initial).toEqual({
      className: 'is-idle',
      style: { opacity: 0, backgroundColor: '#000000' },
    })

    const dataResolved = resolveScene(materializeScene(scene, 450))
    expect(dataResolved.persos['main:root']?.state.className).toContain('data-active')
  })

  it('exposes a stable solve output without claiming hierarchy support', () => {
    const solved = solveScene(resolveScene(materializeScene(scene, 150)))

    expect(solved.timeMs).toBe(150)
    expect(solved.persos['main:root']?.key).toBe('main:root')
    expect(solved.persos['main:root']?.state.className).toBe('is-active')
  })

  it('rejects invalid materialization times before evaluation', () => {
    expect(() => materializeScene(scene, -1)).toThrow(/non-negative/)
    expect(() => materializeScene(scene, Number.NaN)).toThrow(/finite/)
  })
})

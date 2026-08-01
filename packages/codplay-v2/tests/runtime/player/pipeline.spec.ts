import { describe, expect, it } from 'vitest'

import { materializeScene, resolveScene, solveScene } from '../../../src/runtime/player'
import type { CompiledScene } from '../../../src/scene/compiled'

const scene: CompiledScene = {
  schemaVersion: 'codplay.v2.scene.v1',
  createdAt: '2026-08-01T00:00:00.000Z',
  scene: {
    id: 'pipeline-scene',
    listen: [],
    tracks: {},
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
          },
        }],
        listen: [],
        eventimes: [{ name: 'demo:show', startAt: 200 }, { name: 'demo:show', startAt: 100 }],
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

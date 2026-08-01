import { describe, expect, it } from 'vitest'

import { evaluateTemporaryScene } from '../../../src/runtime/player'
import type { CompiledScene } from '../../../src/scene/compiled'

const scene: CompiledScene = {
  schemaVersion: 'codplay.v2.scene.v1',
  createdAt: '2026-07-31T00:00:00.000Z',
  scene: {
    id: 'scene-a',
    listen: [],
    tracks: {},
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: 'title',
          type: 'text',
          initial: { className: 'idle', style: { opacity: 0, backgroundColor: '#000000' } },
          actions: {
            'scene:start': {
              className: { add: 'active', remove: 'idle' },
              style: {
                opacity: { from: 0, to: 1, duration: 100, ease: 'linear' },
                backgroundColor: { from: '#000000', to: '#ffffff', duration: 100, ease: 'linear' },
              },
            },
            title: null,
          },
        }, {
          id: 'badge',
          type: 'tag',
          initial: { className: 'idle', style: { backgroundColor: '#ff0000' } },
          actions: {
            'scene:start': {
              className: { add: 'active', remove: 'idle' },
              style: { backgroundColor: { from: '#ff0000', to: '#0000ff', duration: 100, ease: 'linear' } },
            },
          },
        }],
        listen: [],
        eventimes: [{ name: 'scene:start', startAt: 100 }],
      },
    },
  },
  resources: { entries: [] },
  rootNodeIds: [],
  requirements: { components: [], services: [], modules: [], resources: [] },
}

describe('evaluateTemporaryScene', () => {
  it('evaluates two items with discrete, scalar, and color tween states', () => {
    expect(evaluateTemporaryScene(scene, 0)['main:title']).toMatchObject({
      className: 'idle',
      style: { opacity: 0, backgroundColor: { kind: 'color', coords: [0, 0, 0], alpha: 1 } },
    })
    expect(evaluateTemporaryScene(scene, 100)['main:title']).toMatchObject({ className: 'active', style: { opacity: 0 } })
    expect(evaluateTemporaryScene(scene, 150)['main:title']).toMatchObject({
      className: 'active',
      style: {
        opacity: 0.5,
        backgroundColor: { kind: 'color', space: 'srgb', coords: [0.5, 0.5, 0.5], alpha: 1 },
      },
    })
    expect(evaluateTemporaryScene(scene, 200)['main:title']).toMatchObject({ className: 'active', style: { opacity: 1 } })
    expect(evaluateTemporaryScene(scene, 150)['main:badge']).toMatchObject({
      className: 'active',
      style: { backgroundColor: { kind: 'color', space: 'srgb', coords: [0.5, 0, 0.5], alpha: 1 } },
    })
  })
})

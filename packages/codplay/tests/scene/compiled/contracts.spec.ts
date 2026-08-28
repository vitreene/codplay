import { describe, expect, it } from 'vitest'

import type { CompiledScene } from '../../../src/scene/compiled'

describe('CompiledScene contracts', () => {
  it('keeps the V2 envelope and declares V2 requirements', () => {
    const artifact = {
      schemaVersion: 'v2',
      createdAt: '2026-07-31T00:00:00.000Z',
      scene: {
        id: 'scene-a',
        stories: {},
        listen: [],
        tracks: {},
      },
      resources: { entries: [] },
      rootNodeIds: [],
      requirements: {
        components: ['tag'],
        services: ['style'],
        modules: [],
        resources: [],
      },
      actionTargetIndex: {},
    } satisfies CompiledScene

    expect(artifact.scene.tracks).toEqual({})
    expect(artifact.requirements.services).toEqual(['style'])
  })
})

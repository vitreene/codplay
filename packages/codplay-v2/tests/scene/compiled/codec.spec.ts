import { describe, expect, it, vi } from 'vitest'

import { CompiledSceneCodec } from '../../../src/scene/compiled'
import type { CompiledScene } from '../../../src/scene/compiled'

const artifact: CompiledScene = {
  schemaVersion: 'codplay.v2.scene.v1',
  createdAt: '2026-07-31T00:00:00.000Z',
  scene: { id: 'scene-a', stories: {}, listen: [], tracks: {} },
  resources: { entries: [] },
  rootNodeIds: [],
  requirements: { components: [], services: [], modules: [], resources: [] },
}

describe('CompiledSceneCodec', () => {
  it('round-trips and freezes a valid compiled envelope', () => {
    const codec = new CompiledSceneCodec({ diagnosticOutput: vi.fn() })
    const decoded = codec.decode(codec.encode(artifact))

    expect(decoded.ok).toBe(true)
    if (decoded.ok) {
      expect(decoded.value).toEqual(artifact)
      expect(Object.isFrozen(decoded.value)).toBe(true)
      expect(Object.isFrozen(decoded.value.scene)).toBe(true)
    }
  })

  it('rejects invalid JSON and invalid envelope versions', () => {
    const codec = new CompiledSceneCodec({ diagnosticOutput: vi.fn() })

    expect(codec.decode('{')).toMatchObject({ ok: false })
    expect(codec.decode(JSON.stringify({ ...artifact, schemaVersion: 'other' }))).toMatchObject({ ok: false })
  })

  it('rejects semantically inconsistent roots, self-actions, and requirements', () => {
    const codec = new CompiledSceneCodec({ diagnosticOutput: vi.fn() })
    const invalid = {
      ...artifact,
      scene: {
        ...artifact.scene,
        stories: {
          main: {
            id: 'main',
            persos: [{
              id: 'item',
              type: 'tag',
              initial: {},
              actions: { item: { invalid: true } },
            }],
            listen: [],
          },
        },
      },
      rootNodeIds: ['missing'],
      requirements: { components: [], services: [], modules: [], resources: [] },
    }

    const decoded = codec.decode(JSON.stringify(invalid))

    expect(decoded.ok).toBe(false)
    if (!decoded.ok) {
      expect(decoded.diagnostics.errors.map((diagnostic) => diagnostic.code)).toEqual(expect.arrayContaining([
        'COMPILED_PERSO_SELF_ACTION_INVALID',
        'COMPILED_ROOT_ID_UNKNOWN',
        'COMPILED_REQUIREMENTS_COMPONENTS_INCONSISTENT',
      ]))
    }
  })

  it('rejects duplicate perso ids and inconsistent resource requirements', () => {
    const codec = new CompiledSceneCodec({ diagnosticOutput: vi.fn() })
    const invalid = {
      ...artifact,
      scene: {
        ...artifact.scene,
        stories: {
          main: {
            id: 'main',
            persos: [
              { id: 'item', type: 'tag', initial: {}, actions: { item: null } },
              { id: 'item', type: 'tag', initial: {}, actions: { item: null } },
            ],
            listen: [],
          },
        },
      },
      resources: {
        entries: [{
          url: '/asset.png',
          type: 'image',
          policy: { cache: 'default' },
        }],
      },
      requirements: {
        components: ['tag'],
        services: [],
        modules: [],
        resources: [],
      },
    }

    const decoded = codec.decode(JSON.stringify(invalid))

    expect(decoded.ok).toBe(false)
    if (!decoded.ok) {
      expect(decoded.diagnostics.errors.map((diagnostic) => diagnostic.code)).toEqual(expect.arrayContaining([
        'COMPILED_PERSO_ID_DUPLICATE',
        'COMPILED_REQUIREMENTS_RESOURCES_INCONSISTENT',
      ]))
    }
  })
})

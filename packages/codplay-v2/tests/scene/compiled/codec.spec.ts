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
})

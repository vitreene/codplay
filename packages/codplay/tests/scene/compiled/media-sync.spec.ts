import { describe, expect, it } from 'vitest'
import { createCoreRuntimeCatalog } from '../../../src/runtime/catalog'
import { CompiledSceneCodec, SceneBuilder } from '../../../src/scene/compiled'
import type { SceneDoc } from '../../../src/scene/types'

/** Builds a media fixture through the shared component validation catalog. */
function buildMedia(initial: Record<string, unknown>, action: Record<string, unknown> = {}) {
  const scene: SceneDoc = {
    id: 'media-clock-contract',
    stories: {
      main: {
        id: 'main',
        persos: [{ id: 'video', type: 'media', initial: { src: '/fixture.mp4', ...initial }, actions: { command: action } }],
      },
    },
  }
  return new SceneBuilder(createCoreRuntimeCatalog().validationSnapshot()).build(scene)
}

describe('media clock declaration', () => {
  it.each([undefined, 'auto', 'master', 'independent'])('compiles and round-trips sync %s', (sync) => {
    const result = buildMedia(sync === undefined ? {} : { sync })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Media fixture did not compile')
    const codec = new CompiledSceneCodec()
    const decoded = codec.decode(codec.encode(result.compiledScene))
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) throw new Error('Media fixture did not decode')
    expect(decoded.value.scene.stories.main?.persos[0]?.initial.sync).toBe(sync)
  })

  it.each(['free', true, null, 1])('rejects invalid sync %s', (sync) => {
    const result = buildMedia({ sync })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.errors.map((entry) => entry.code)).toContain('AUTHOR_MEDIA_SYNC_INVALID')
  })

  it.each([true, false])('rejects the replaced master boolean %s', (master) => {
    const result = buildMedia({ master })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.errors.map((entry) => entry.code)).toContain('AUTHOR_MEDIA_MASTER_REMOVED')
  })

  it('rejects an action that changes the initial clock relationship', () => {
    const result = buildMedia({ sync: 'auto' }, { sync: 'independent' })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.errors.map((entry) => entry.code)).toContain('AUTHOR_MEDIA_SYNC_INITIAL_ONLY')
  })
})

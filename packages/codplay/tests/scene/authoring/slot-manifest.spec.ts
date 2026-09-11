import { describe, expect, it } from 'vitest'
import { resolveSlotManifestEntry, slotManifest } from '../../../src/scene/authoring'

describe('slotManifest', () => {
  const scene = {
    id: 'layout',
    stories: {
      main: {
        id: 'main',
        persos: [
          { id: 'header-host', name: 'header', type: 'slot' as const },
          { id: 'body-host', name: 'body', type: 'slot' as const },
        ],
      },
    },
  }

  it('lists generated slot names with their declaration paths', () => {
    expect(slotManifest(scene)).toEqual([
      {
        slot: 'header',
        storyId: 'main',
        persoId: 'header-host',
        sourcePath: 'stories.main.persos[0].name',
      },
      {
        slot: 'body',
        storyId: 'main',
        persoId: 'body-host',
        sourcePath: 'stories.main.persos[1].name',
      },
    ])
  })

  it('returns explicit diagnostics for unknown and ambiguous names', () => {
    const manifest = slotManifest(scene)
    const unknown = resolveSlotManifestEntry(manifest, 'footer', {
      sceneId: 'layout',
      storyId: 'main',
      referencePath: 'view.slots.footer',
    })
    expect(unknown.ok).toBe(false)
    if (!unknown.ok) {
      expect(unknown.diagnostic).toMatchObject({
        code: 'AUTHOR_SLOT_NAME_UNKNOWN',
        sceneId: 'layout',
        referencePath: 'view.slots.footer',
        available: ['body', 'header'],
      })
    }

    const duplicate = resolveSlotManifestEntry([
      ...manifest,
      { ...manifest[1]!, persoId: 'body-host-2', sourcePath: 'stories.main.persos[2].name' },
    ], 'body', { storyId: 'main' })
    expect(duplicate.ok).toBe(false)
    if (!duplicate.ok) expect(duplicate.diagnostic.code).toBe('AUTHOR_SLOT_NAME_AMBIGUOUS')
  })
})

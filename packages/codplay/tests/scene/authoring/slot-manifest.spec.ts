import { describe, expect, it } from 'vitest'
import { normalizeReplaceSlotCommand } from '../../../src/runtime/capabilities/replace-slot'
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

  it('retains every supported replacement profile for the slot host', () => {
    const profiles = [
      { transition: 'fade', duration: 300 },
      { transition: 'fade-in', duration: 400 },
      { transition: 'mask-reveal', shape: { path: 'M50 0 L100 100 L0 100 Z', viewBox: '0 0 100 100' }, duration: 500 },
      { transition: 'curtain', duration: 600 },
      {
        transition: 'wipe',
        duration: 700,
        split: 'cells',
        shape: 'circle',
        cellSize: 8,
        staggerPattern: 'row-wave',
        stagger: 1_000,
      },
      { transition: 'slide-over', duration: 800 },
      { transition: 'stack', duration: 900 },
      {
        transition: 'mask-reveal',
        split: 'cells',
        staggerPattern: 'manhattan',
        direction: 'center',
      },
    ] as const
    const profiledScene = {
      id: 'layout-profiles',
      stories: {
        main: {
          id: 'main',
          persos: profiles.map((replace, index) => ({
            id: `host-${index}`,
            name: `slot-${index}`,
            type: 'slot' as const,
            initial: { replace },
          })),
        },
      },
    }

    expect(slotManifest(profiledScene).map((entry) => entry.replace)).toEqual(profiles)
  })

  it('uses the runtime slot profile rules when discovering authored replace data', () => {
    const invalidProfile = { transition: 'wipe', stagger: 80 }
    const profiledScene = {
      id: 'layout-invalid-profile',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'body-host',
            name: 'body',
            type: 'slot' as const,
            initial: { replace: invalidProfile },
          }],
        },
      },
    }

    expect(normalizeReplaceSlotCommand(invalidProfile)).toBeUndefined()
    expect(slotManifest(profiledScene)[0]?.replace).toBeUndefined()
  })
})

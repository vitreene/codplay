import { describe, expect, it } from 'vitest'

import { CodPlay } from '../../src/creator/creator-facade'
import type { Perso, StoryDef } from '../../src/builder/types'

/**
 * Creates one minimal strict perso fixture.
 */
function createPersoFixture(): Perso {
  return {
    id: 'title',
    type: 'text',
    initial: {
      content: 'hello'
    },
    actions: {}
  }
}

/**
 * Creates one minimal strict story fixture.
 */
function createStoryFixture(): StoryDef {
  const perso = createPersoFixture()

  return {
    id: 'story-main',
    children: [],
    entries: [perso.id],
    initial: undefined,
    persos: [perso],
    straps: undefined,
    listen: [],
    init: () => undefined
  }
}

describe('Creator API V1', () => {
  it('creates and exports one strict scene doc', () => {
    const creator = new CodPlay()

    expect(creator.create({ id: 'scene-main' })).toEqual({ ok: true, data: undefined })
    expect(creator.scene.rootStories.set({ value: ['story-main'] })).toEqual({ ok: true, data: undefined })
    expect(creator.scene.initial.set({ value: { locale: 'fr' } })).toEqual({ ok: true, data: undefined })
    expect(creator.scene.tracks.set({ value: {} })).toEqual({ ok: true, data: undefined })
    expect(creator.upsertStory({ story: createStoryFixture() })).toEqual({ ok: true, data: undefined })

    const exportResult = creator.exportSceneDoc()
    expect(exportResult.ok).toBe(true)

    if (!exportResult.ok) {
      return
    }

    expect(exportResult.data).toMatchObject({
      id: 'scene-main',
      rootStories: ['story-main'],
      initial: { locale: 'fr' },
      tracks: {},
      stories: {
        'story-main': {
          id: 'story-main',
          entries: ['title'],
          persos: [
            {
              id: 'title',
              type: 'text',
              initial: { content: 'hello' },
              actions: {}
            }
          ]
        }
      }
    })
  })

  it('rejects authoring updates before create is called', () => {
    const creator = new CodPlay()

    expect(creator.exportSceneDoc()).toMatchObject({
      ok: false,
      error: {
        code: 'CREATOR_NOT_INITIALIZED'
      }
    })
  })
})

import { describe, expect, it } from 'vitest'

import { SceneDocEditor } from '../../../authoring/scene-factory/src/scene-doc-editor'
import type { Perso, StoryDef } from '../../src/builder/types'

function createPersoFixture(): Perso {
  return {
    id: 'title',
    name: 'title',
    type: 'tag',
    initial: { content: 'hello', move: '@root' },
    actions: {}
  }
}

function createStoryFixture(): StoryDef {
  const perso = createPersoFixture()
  return {
    id: 'story-main',
    name: 'main',
    initial: undefined,
    persos: [perso],
    straps: undefined,
    listen: [],
    init: () => undefined
  }
}

describe('Creator API V1', () => {
  it('creates one story and one perso with generated name/id pairs', () => {
    const creator = new SceneDocEditor()

    expect(creator.create({ id: 'scene-main' })).toEqual({ ok: true, data: undefined })

    const storyResult = creator.createStory({ name: 'intro' })
    expect(storyResult).toEqual({
      ok: true,
      data: { storyId: 'story-intro', storyName: 'intro' }
    })

    const persoResult = creator.createPerso({ storyId: 'story-intro', type: 'tag', name: 'title' })
    expect(persoResult).toEqual({
      ok: true,
      data: { persoId: 'story-intro__title', persoName: 'title' }
    })

    const exportResult = creator.exportSceneDoc()
    expect(exportResult.ok).toBe(true)
    if (!exportResult.ok) return

    expect(exportResult.data.stories['story-intro']).toMatchObject({
      id: 'story-intro',
      name: 'intro',
      persos: [{
        id: 'story-intro__title',
        name: 'title',
        type: 'tag',
        initial: { move: '@root' },
        actions: { 'story-intro__title': null }
      }]
    })
  })

  it('creates and exports one strict scene doc', () => {
    const creator = new SceneDocEditor()

    expect(creator.create({ id: 'scene-main' })).toEqual({ ok: true, data: undefined })
    expect(creator.scene.rootStories.set({ value: ['story-main'] })).toEqual({ ok: true, data: undefined })
    expect(creator.scene.initial.set({ value: { locale: 'fr' } })).toEqual({ ok: true, data: undefined })
    expect(creator.scene.tracks.set({ value: {} })).toEqual({ ok: true, data: undefined })
    expect(creator.upsertStory({ story: createStoryFixture() })).toEqual({ ok: true, data: undefined })

    const exportResult = creator.exportSceneDoc()
    expect(exportResult.ok).toBe(true)
    if (!exportResult.ok) return

    expect(exportResult.data).toMatchObject({
      id: 'scene-main',
      rootStories: ['story-main'],
      initial: { locale: 'fr' },
      tracks: {},
      stories: {
        'story-main': {
          id: 'story-main',
          name: 'main',
          persos: [{ id: 'title', name: 'title', type: 'tag', initial: { content: 'hello', move: '@root' }, actions: {} }]
        }
      }
    })
  })

  it('upserts and removes scene tracks explicitly', () => {
    const creator = new SceneDocEditor()

    expect(creator.create({ id: 'scene-main' })).toEqual({ ok: true, data: undefined })
    expect(creator.scene.tracks.upsert({ trackId: 'track-main', track: { id: 'track-main', order: 0 } })).toEqual({ ok: true, data: undefined })
    expect(creator.scene.tracks.remove({ trackId: 'track-main' })).toEqual({ ok: true, data: undefined })

    const exportResult = creator.exportSceneDoc()
    expect(exportResult.ok).toBe(true)
    if (!exportResult.ok) return

    expect(exportResult.data.tracks).toEqual({})
  })

  it('rejects authoring updates before create is called', () => {
    const creator = new SceneDocEditor()

    expect(creator.exportSceneDoc()).toMatchObject({
      ok: false,
      error: { code: 'CREATOR_NOT_INITIALIZED' }
    })
  })
})

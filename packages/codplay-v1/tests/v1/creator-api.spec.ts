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
    initial: { move: '@root' },
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
    expect(creator.scene.initial.set({ value: { locale: 'fr' } })).toEqual({ ok: true, data: undefined })
    expect(creator.scene.tracks.set({ value: {} })).toEqual({ ok: true, data: undefined })
    expect(creator.upsertStory({ story: createStoryFixture() })).toEqual({ ok: true, data: undefined })

    const exportResult = creator.exportSceneDoc()
    expect(exportResult.ok).toBe(true)
    if (!exportResult.ok) return

    expect(exportResult.data).toMatchObject({
      id: 'scene-main',
      initial: { locale: 'fr' },
      tracks: {},
      stories: {
        'story-main': {
          id: 'story-main',
          name: 'main',
          initial: { move: '@root' },
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

  it('creates a story and a perso with an explicit id when given, instead of a generated slug', () => {
    const creator = new SceneDocEditor()
    creator.create({ id: 'scene-main' })

    expect(creator.createStory({ id: 'story-fixed', name: 'intro' })).toEqual({
      ok: true,
      data: { storyId: 'story-fixed', storyName: 'intro' }
    })
    expect(creator.createPerso({ storyId: 'story-fixed', type: 'tag', id: 'perso-fixed', name: 'title' })).toEqual({
      ok: true,
      data: { persoId: 'perso-fixed', persoName: 'title' }
    })

    const exportResult = creator.exportSceneDoc()
    if (!exportResult.ok) throw new Error('export failed')
    expect(exportResult.data.stories['story-fixed']?.persos[0]?.id).toBe('perso-fixed')
  })

  it('rejects an explicit story id that collides with an existing one, without overwriting it', () => {
    const creator = new SceneDocEditor()
    creator.create({ id: 'scene-main' })
    creator.createStory({ id: 'story-fixed' })

    expect(creator.createStory({ id: 'story-fixed' })).toMatchObject({
      ok: false,
      error: { code: 'CREATOR_STORY_ID_COLLISION' }
    })
  })

  it('rejects an explicit perso id that collides with an existing one in the same story', () => {
    const creator = new SceneDocEditor()
    creator.create({ id: 'scene-main' })
    creator.createStory({ id: 'story-fixed' })
    creator.createPerso({ storyId: 'story-fixed', type: 'tag', id: 'perso-fixed' })

    expect(creator.createPerso({ storyId: 'story-fixed', type: 'tag', id: 'perso-fixed' })).toMatchObject({
      ok: false,
      error: { code: 'CREATOR_PERSO_ID_COLLISION' }
    })
  })

  it('accepts an optional name at create, exported alongside id', () => {
    const creator = new SceneDocEditor()
    expect(creator.create({ id: 'scene-main', name: 'Ma scène' })).toEqual({ ok: true, data: undefined })

    const exportResult = creator.exportSceneDoc()
    if (!exportResult.ok) throw new Error('export failed')
    expect(exportResult.data.id).toBe('scene-main')
    expect(exportResult.data.name).toBe('Ma scène')
  })

  it('sets scene.state, distinct from any story-level state, round-tripped through exportSceneDoc', () => {
    const creator = new SceneDocEditor()
    creator.create({ id: 'scene-main' })

    expect(creator.scene.state.set({ value: { globalScore: 0 } })).toEqual({ ok: true, data: undefined })

    const exportResult = creator.exportSceneDoc()
    if (!exportResult.ok) throw new Error('export failed')
    expect(exportResult.data.state).toEqual({ globalScore: 0 })
  })

  it('sets scene.onStart and scene.onSequenceEnd, round-tripped through exportSceneDoc', () => {
    const creator = new SceneDocEditor()
    creator.create({ id: 'scene-main' })

    const onStart = (): void => {}
    const onSequenceEnd = (): void => {}
    expect(creator.scene.onStart.set({ value: onStart })).toEqual({ ok: true, data: undefined })
    expect(creator.scene.onSequenceEnd.set({ value: onSequenceEnd })).toEqual({ ok: true, data: undefined })

    const exportResult = creator.exportSceneDoc()
    if (!exportResult.ok) throw new Error('export failed')
    expect(exportResult.data.onStart).toBe(onStart)
    expect(exportResult.data.onSequenceEnd).toBe(onSequenceEnd)
  })

  it('preserves StoryDef.trackId and Perso.list across upsertStory/upsertPerso (clone fidelity)', () => {
    const creator = new SceneDocEditor()
    creator.create({ id: 'scene-main' })

    const story = createStoryFixture()
    story.trackId = 'track-story-main'
    creator.upsertStory({ story })

    creator.upsertPerso({
      storyId: 'story-main',
      perso: { id: 'listy', type: 'list', initial: { move: '@root' }, list: { autoAnimate: { durationMs: 200 } }, actions: {} }
    })

    const exportResult = creator.exportSceneDoc()
    if (!exportResult.ok) throw new Error('export failed')
    expect(exportResult.data.stories['story-main']?.trackId).toBe('track-story-main')
    expect(exportResult.data.stories['story-main']?.persos.find((p) => p.id === 'listy')?.list).toEqual({
      autoAnimate: { durationMs: 200 }
    })
  })
})

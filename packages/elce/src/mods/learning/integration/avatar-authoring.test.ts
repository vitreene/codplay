import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import { applyDocumentCommand } from '../../../domain/commands/document-commands'
import { LearningDocument } from '../document/learning-document'
import { learningControllerMachine } from '../authoring/learning-controller-machine'
import { LearningPageSceneCatalog } from '../reading/learning-page-scene-catalog'
import { projectCarouselCues } from '../../../resources/bdcs/carousel/domain/carousel-service'
import { createAvatarDocumentFixture, createAvatarTakeFixture } from './fixtures/avatar-document-fixture'

/** Returns the test Carousel, whose identity and values belong to this suite. */
function carouselIn(document: LearningDocument) {
  return document.bdcs.find((bdc) => bdc.id === 'carousel-test')!.carousel!
}

describe('Avatar authoring through Learning commands', () => {
  it('keeps one sibling Avatar and rejects a second Avatar or an unsupported placement', () => {
    const document = createAvatarDocumentFixture()
    expect(document.pages.find((page) => page.id === 'page-avatar')?.bdcIds).toEqual(['carousel-test', 'avatar-test'])
    expect(() => applyDocumentCommand(document, { type: 'bdc.create', bdcId: 'avatar-second', bdcType: 'avatar', presetId: 'avatar-matt', placement: { kind: 'page', pageId: 'page-avatar' } })).toThrow('un seul Avatar')
    expect(() => applyDocumentCommand(document, { type: 'bdc.move', bdcId: 'avatar-test', placement: { kind: 'page', pageId: 'page-a' } })).toThrow('Diapo')
    expect(() => applyDocumentCommand(document, { type: 'bdc.move', bdcId: 'avatar-test', placement: { kind: 'parent', parentBdcId: 'carousel-test' } })).toThrow('Cartes et des Graphes')
  })

  it('requires an Avatar placed in a Diapo to have its sibling Carousel', () => {
    const source = createAvatarDocumentFixture()
    expect(() => applyDocumentCommand(source, { type: 'bdc.remove', bdcId: 'carousel-test' })).toThrow('à côté de son Carousel')
    const withoutAvatar = applyDocumentCommand(source, { type: 'bdc.remove', bdcId: 'avatar-test' })
    const withoutCarousel = applyDocumentCommand(withoutAvatar, { type: 'bdc.remove', bdcId: 'carousel-test' })
    expect(() => applyDocumentCommand(withoutCarousel, {
      type: 'bdc.create', bdcId: 'avatar-new', bdcType: 'avatar', presetId: 'avatar-matt',
      placement: { kind: 'page', pageId: 'page-avatar' },
    })).toThrow('à côté de son Carousel')
    expect(() => applyDocumentCommand(withoutCarousel, {
      type: 'bdc.create', bdcId: 'avatar-wrong-profile', bdcType: 'avatar', presetId: 'avatar-unknown' as 'avatar-matt',
      placement: { kind: 'catalog' },
    })).toThrow('profil configuré')
  })

  it('distinguishes repeated words and projects cues through the existing Carousel durations', () => {
    const document = createAvatarDocumentFixture()
    const content = carouselIn(document)
    expect(content.cards.map((entry) => entry.cue)).toEqual([
      { startAtMs: 0 },
      { startAtMs: 2400, word: { avatarBdcId: 'avatar-test', takeId: 'take-test', wordIndex: 1 } },
      { startAtMs: 6800, word: { avatarBdcId: 'avatar-test', takeId: 'take-test', wordIndex: 2 } },
    ])
    expect(projectCarouselCues(content, 12_000).cards.map((entry) => entry.durationMs)).toEqual([2400, 4400, 5200])
    expect(() => applyDocumentCommand(document, { type: 'bdc.carousel.word.set', bdcId: 'carousel-test', cardBdcId: 'card-one', avatarBdcId: 'avatar-test', wordIndex: 1, startAtMs: 2400 })).toThrow('première')
    expect(() => applyDocumentCommand(document, { type: 'bdc.carousel.word.set', bdcId: 'carousel-test', cardBdcId: 'card-two', avatarBdcId: 'avatar-test', wordIndex: 2, startAtMs: 6800 })).toThrow('croissants')
  })

  it('clears associations on replacement, preserves exact starts and reassociates to the new sound', () => {
    const source = createAvatarDocumentFixture()
    const replaced = applyDocumentCommand(source, { type: 'bdc.avatar.take.set', bdcId: 'avatar-test', take: createAvatarTakeFixture('take-new', 350) })
    expect(carouselIn(replaced).cards.map((entry) => entry.cue)).toEqual([{ startAtMs: 0 }, { startAtMs: 2400 }, { startAtMs: 6800 }])
    const associated = applyDocumentCommand(replaced, { type: 'bdc.carousel.word.set', bdcId: 'carousel-test', cardBdcId: 'card-two', avatarBdcId: 'avatar-test', wordIndex: 1, startAtMs: 2750 })
    expect(carouselIn(associated).cards.map((entry) => entry.cue?.startAtMs)).toEqual([0, 2750, 6800])
    expect(carouselIn(associated).cards[1]?.cue?.word?.takeId).toBe('take-new')
    expect(LearningDocument.fromJSON(associated.toJSON()).toJSON()).toEqual(associated.toJSON())
  })

  it('retains cue times through removal, catalogue return and Carousel moves without stale links', () => {
    const source = createAvatarDocumentFixture()
    for (const command of [
      { type: 'bdc.avatar.delete', bdcId: 'avatar-test' },
      { type: 'bdc.remove', bdcId: 'avatar-test' },
    ] as const) {
      const next = applyDocumentCommand(source, command)
      expect(carouselIn(next).cards.map((entry) => entry.cue)).toEqual([{ startAtMs: 0 }, { startAtMs: 2400 }, { startAtMs: 6800 }])
    }
    const withoutAvatar = applyDocumentCommand(source, { type: 'bdc.remove', bdcId: 'avatar-test' })
    const movedCarousel = applyDocumentCommand(withoutAvatar, { type: 'bdc.move', bdcId: 'carousel-test', placement: { kind: 'page', pageId: 'page-a' } })
    expect(carouselIn(movedCarousel).cards.map((entry) => entry.cue)).toEqual([{ startAtMs: 0 }, { startAtMs: 2400 }, { startAtMs: 6800 }])
    const catalog = new LearningPageSceneCatalog().build(movedCarousel, {})
    const sourceScene = catalog.scenes['scene-page-a']!
    const scene = 'sceneDoc' in sourceScene ? sourceScene.sceneDoc : sourceScene
    const story = Object.values(scene.stories).find((candidate) => candidate.id.includes('carousel-test'))!
    const cueStarts = story.eventimes
      ?.filter((event) => typeof event.name === 'string' && event.name.endsWith(':intro'))
      .map((event) => event.startAt)
    expect(cueStarts).toEqual([2400, 6800])
  })

  it('restores the complete take and associations with controller Undo and Redo', () => {
    const actor = createActor(learningControllerMachine, { input: {} }).start()
    actor.send({ type: 'document.replace', document: createAvatarDocumentFixture() })
    actor.send({ type: 'editor.access.activate' })
    actor.send({ type: 'document.apply', command: { type: 'bdc.avatar.take.set', bdcId: 'avatar-test', take: createAvatarTakeFixture('take-new', 350) } })
    expect(carouselIn(actor.getSnapshot().context.document).cards[1]?.cue?.word).toBeUndefined()
    actor.send({ type: 'history.undo' })
    expect(carouselIn(actor.getSnapshot().context.document).cards[1]?.cue?.word?.takeId).toBe('take-test')
    actor.send({ type: 'history.redo' })
    expect(carouselIn(actor.getSnapshot().context.document).cards[1]?.cue).toEqual({ startAtMs: 2400 })
    actor.stop()
  })

  it('builds the narrated page from persisted BDCs and keeps ordinary pages without voice', () => {
    const document = createAvatarDocumentFixture()
    const catalog = new LearningPageSceneCatalog().build(document, { 'voice-test': '/test/voice.wav' })
    const source = catalog.scenes['scene-page-avatar']!
    const scene = 'sceneDoc' in source ? source.sceneDoc : source
    expect(scene).toMatchObject({ stories: { 'page-avatar-diapo-page': {
      eventimes: expect.arrayContaining([{ name: 'sequence:end', startAt: 12_000 }]),
      listen: expect.arrayContaining([{ on: 'sequence:end', emit: [{ name: 'elce:page:finished', visibility: 'public', data: { pageId: 'page-avatar' } }] }]),
      persos: expect.arrayContaining([expect.objectContaining({ type: 'media', initial: expect.objectContaining({ src: '/test/voice.wav', sync: 'master' }) })]),
    } } })
    expect(JSON.stringify(catalog.scenes['scene-page-a'])).not.toContain('/test/voice.wav')
    expect(JSON.stringify(scene)).not.toContain('completion-marker')
    expect(JSON.stringify(scene)).not.toContain('navigation-host')
  })
})

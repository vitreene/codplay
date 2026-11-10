import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import { applyDocumentCommand } from '../../../domain/commands/document-commands'
import { LearningDocument } from '../document/learning-document'
import { learningControllerMachine } from '../authoring/learning-controller-machine'
import { LearningPageSceneCatalog } from '../reading/learning-page-scene-catalog'
import { resolveCarouselViewStarts } from '../../../resources/bdcs/carousel/domain/carousel-service'
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

  it('distinguishes repeated words and stores the resulting Carousel durations', () => {
    const document = createAvatarDocumentFixture()
    const content = carouselIn(document)
    expect(content.cards.map((entry) => entry.cue)).toEqual([
      undefined,
      { word: { avatarBdcId: 'avatar-test', takeId: 'take-test', wordIndex: 1 } },
      { word: { avatarBdcId: 'avatar-test', takeId: 'take-test', wordIndex: 2 } },
    ])
    expect(content.cards.map((entry) => entry.durationMs)).toEqual([2400, 4400, 5200])
    expect(resolveCarouselViewStarts(content)).toEqual([0, 2400, 6800])
    expect(() => applyDocumentCommand(document, { type: 'bdc.carousel.word.set', bdcId: 'carousel-test', cardBdcId: 'card-one', avatarBdcId: 'avatar-test', wordIndex: 1, startAtMs: 2400 })).toThrow('première')
  })

  it('migrates v11 absolute starts into per-view durations in the current document format', () => {
    const source = createAvatarDocumentFixture()
    const starts = [0, 2400, 6800]
    const legacy = {
      ...source.toJSON(),
      version: 11,
      bdcs: source.bdcs.map((bdc) => bdc.carousel == null ? bdc : {
        ...bdc,
        carousel: {
          ...bdc.carousel,
          cards: bdc.carousel.cards.map((entry, index) => ({
            ...entry,
            cue: { startAtMs: starts[index], ...(entry.cue?.word === undefined ? {} : { word: entry.cue.word }) },
          })),
        },
      }),
    }

    const migrated = LearningDocument.fromJSON(legacy)

    expect(migrated.data.version).toBe(14)
    expect(carouselIn(migrated).cards.map((entry) => entry.durationMs)).toEqual([2400, 4400, 5200])
    expect(carouselIn(migrated).cards.map((entry) => entry.cue)).toEqual([
      undefined,
      { word: { avatarBdcId: 'avatar-test', takeId: 'take-test', wordIndex: 1 } },
      { word: { avatarBdcId: 'avatar-test', takeId: 'take-test', wordIndex: 2 } },
    ])
  })

  it('keeps word links with their Cards and recalculates durations across reorder and return', () => {
    const source = createAvatarDocumentFixture()
    const original = carouselIn(source)
    const reordered = applyDocumentCommand(source, {
      type: 'bdc.carousel.update',
      bdcId: 'carousel-test',
      carousel: { ...original, cards: [original.cards[0]!, original.cards[2]!, original.cards[1]!] },
      movedBdcId: 'card-three',
    })

    expect(carouselIn(reordered).cards.map((entry) => entry.cue?.word?.wordIndex)).toEqual([undefined, 2, 1])
    expect(carouselIn(reordered).cards.map((entry) => entry.durationMs)).toEqual([6800, 2600, 2600])
    expect(resolveCarouselViewStarts(carouselIn(reordered))).toEqual([0, 6800, 9400])

    const restored = applyDocumentCommand(reordered, {
      type: 'bdc.carousel.update',
      bdcId: 'carousel-test',
      carousel: { ...carouselIn(reordered), cards: [original.cards[0]!, original.cards[1]!, original.cards[2]!] },
      movedBdcId: 'card-two',
    })

    expect(carouselIn(restored).cards.map((entry) => entry.durationMs)).toEqual([2400, 4400, 5200])
    expect(resolveCarouselViewStarts(carouselIn(restored))).toEqual([0, 2400, 6800])
  })

  it('accepts a future word on one Card, clears overtaken links and reallocates durations', () => {
    const source = createAvatarDocumentFixture()
    const take = source.bdcs.find((bdc) => bdc.id === 'avatar-test')?.avatar?.take
    if (take == null) throw new Error('The fixture Avatar has no take.')
    const withFutureWord = applyDocumentCommand(source, {
      type: 'bdc.avatar.take.set',
      bdcId: 'avatar-test',
      take: { ...take, words: [...take.words, { text: 'plus tard', startAtMs: 9000, endAtMs: 9400 }] },
    })

    const associated = applyDocumentCommand(withFutureWord, {
      type: 'bdc.carousel.word.set',
      bdcId: 'carousel-test',
      cardBdcId: 'card-two',
      avatarBdcId: 'avatar-test',
      wordIndex: 3,
      startAtMs: 9000,
    })

    expect(carouselIn(associated).cards.map((entry) => entry.cue)).toEqual([
      undefined,
      { word: { avatarBdcId: 'avatar-test', takeId: 'take-test', wordIndex: 3 } },
      undefined,
    ])
    expect(carouselIn(associated).cards.map((entry) => entry.durationMs)).toEqual([9000, 1500, 1500])
    expect(resolveCarouselViewStarts(carouselIn(associated))).toEqual([0, 9000, 10_500])
  })

  it('converts old associations to durations on replacement and reassociates to the new sound', () => {
    const source = createAvatarDocumentFixture()
    const replaced = applyDocumentCommand(source, { type: 'bdc.avatar.take.set', bdcId: 'avatar-test', take: createAvatarTakeFixture('take-new', 350) })
    expect(carouselIn(replaced).cards.map((entry) => entry.cue)).toEqual([undefined, undefined, undefined])
    expect(carouselIn(replaced).cards.map((entry) => entry.durationMs)).toEqual([2400, 4400, 5200])
    const associated = applyDocumentCommand(replaced, { type: 'bdc.carousel.word.set', bdcId: 'carousel-test', cardBdcId: 'card-two', avatarBdcId: 'avatar-test', wordIndex: 1, startAtMs: 2750 })
    expect(carouselIn(associated).cards.map((entry) => entry.durationMs)).toEqual([2750, 4400, 4850])
    expect(carouselIn(associated).cards[1]?.cue?.word.takeId).toBe('take-new')
    expect(LearningDocument.fromJSON(associated.toJSON()).toJSON()).toEqual(associated.toJSON())

    const laterAssociation = applyDocumentCommand(replaced, { type: 'bdc.carousel.word.set', bdcId: 'carousel-test', cardBdcId: 'card-three', avatarBdcId: 'avatar-test', wordIndex: 2, startAtMs: 7150 })
    const earlierAssociation = applyDocumentCommand(laterAssociation, { type: 'bdc.carousel.word.set', bdcId: 'carousel-test', cardBdcId: 'card-two', avatarBdcId: 'avatar-test', wordIndex: 1, startAtMs: 2750 })
    expect(carouselIn(earlierAssociation).cards.map((entry) => entry.durationMs)).toEqual([2750, 4400, 4850])
    expect(carouselIn(earlierAssociation).cards[2]?.cue?.word).toEqual({ avatarBdcId: 'avatar-test', takeId: 'take-new', wordIndex: 2 })
  })

  it('retains durations through removal, catalogue return and Carousel moves without stale links', () => {
    const source = createAvatarDocumentFixture()
    for (const command of [
      { type: 'bdc.avatar.delete', bdcId: 'avatar-test' },
      { type: 'bdc.remove', bdcId: 'avatar-test' },
    ] as const) {
      const next = applyDocumentCommand(source, command)
      expect(carouselIn(next).cards.map((entry) => entry.cue)).toEqual([undefined, undefined, undefined])
      expect(carouselIn(next).cards.map((entry) => entry.durationMs)).toEqual([2400, 4400, 5200])
    }
    const withoutAvatar = applyDocumentCommand(source, { type: 'bdc.remove', bdcId: 'avatar-test' })
    const movedCarousel = applyDocumentCommand(withoutAvatar, { type: 'bdc.move', bdcId: 'carousel-test', placement: { kind: 'page', pageId: 'page-a' } })
    expect(carouselIn(movedCarousel).cards.map((entry) => entry.cue)).toEqual([undefined, undefined, undefined])
    expect(carouselIn(movedCarousel).cards.map((entry) => entry.durationMs)).toEqual([2400, 4400, 5200])
    expect(resolveCarouselViewStarts(carouselIn(movedCarousel))).toEqual([0, 2400, 6800])
    const catalog = new LearningPageSceneCatalog().build(movedCarousel, {})
    expect(catalog.scenes['scene-page-a']).toBeDefined()
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
    expect(carouselIn(actor.getSnapshot().context.document).cards[1]?.cue).toBeUndefined()
    expect(carouselIn(actor.getSnapshot().context.document).cards.map((entry) => entry.durationMs)).toEqual([2400, 4400, 5200])
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

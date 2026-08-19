import { describe, expect, it } from 'vitest'
import { MoveTransitionJournal } from '../../../src/runtime/player'
import type { CompiledScene } from '../../../src/scene/compiled'

/** Creates one compiled scene containing nested static move occurrences. */
function compiledScene(): CompiledScene {
  return {
    schemaVersion: 'v2',
    createdAt: '2026-08-18T00:00:00.000Z',
    scene: {
      id: 'journal-scene',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'item',
            type: 'tag',
            initial: { move: '@root' },
            actions: {
              move: { move: { target: 'target', flipMode: 'local', transition: { duration: 100 } } },
            },
          }],
          listen: [],
          eventimes: [{
            name: 'move',
            startAt: 50,
            events: [{ name: 'move', startAt: 25 }],
          }],
        },
      },
      listen: [],
      tracks: {},
    },
    resources: { entries: [] },
    rootNodeIds: [],
    requirements: { components: [], services: [], modules: [], resources: [] },
  }
}

describe('MoveTransitionJournal', () => {
  it('indexes nested compiled move occurrences by their absolute time', () => {
    const journal = new MoveTransitionJournal(compiledScene())

    expect(journal.findActive(80).map((occurrence) => occurrence.startAt)).toEqual([50, 75])
    expect(journal.findActive(80)[1]).toMatchObject({
      captureId: 'compiled:main:item:move:0.0:75',
      eventId: 'main:item:move:0.0',
      declarationPath: [0, 0],
      endAt: 175,
      sourceTimeMs: 74.9999,
      destinationTimeMs: 75,
      flipMode: 'local',
    })
    expect(journal.findActive(49)).toEqual([])
  })

  it('keeps occurrence identity stable across journal reconstruction', () => {
    const first = new MoveTransitionJournal(compiledScene()).findActive(80)
    const second = new MoveTransitionJournal(compiledScene()).findActive(80)

    expect(first.map((occurrence) => occurrence.captureId)).toEqual(second.map((occurrence) => occurrence.captureId))
    expect(first[1]!.sourceTimeMs).toBe(74.9999)
    expect(first[1]!.destinationTimeMs).toBe(75)
  })

  it('finds movers that start inside an enclosing capture interval', () => {
    const journal = new MoveTransitionJournal(compiledScene())

    expect(journal.findStartingBetween(50, 100).map((occurrence) => occurrence.startAt)).toEqual([75])
    expect(journal.findStartingBetween(50, 75).map((occurrence) => occurrence.startAt)).toEqual([75])
    expect(journal.findStartingBetween(75, 100)).toEqual([])
  })

  it('keeps only the last declaration for one same-tick perso move', () => {
    const journal = new MoveTransitionJournal({
      ...compiledScene(),
      scene: {
        ...compiledScene().scene,
        stories: {
          main: {
            ...compiledScene().scene.stories.main!,
            eventimes: [{ name: 'move', startAt: 50 }, { name: 'move', startAt: 50 }],
          },
        },
      },
    })

    expect(journal.findActive(75)).toHaveLength(2)
    expect(journal.findActiveEffective(75)).toHaveLength(1)
    expect(journal.findActiveEffective(75)[0]?.declarationPath).toEqual([1])
  })
})

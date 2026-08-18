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
      flipMode: 'local',
    })
    expect(journal.findActive(49)).toEqual([])
  })
})

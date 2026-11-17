import { describe, expect, it } from 'vitest'
import { executeStrapsSequentially } from 'codplay/runtime/player'
import { ListService } from '../domain/list-service'
import { ListSceneBuilder } from './list-scene-builder'

describe('List scene builder', () => {
  it('applies the shared interval before the first row and keeps reveal waits as planned CodPlay events', async () => {
    const list = new ListService().createDefault('row-first')
    const configuredList = {
      ...list,
      intervalMs: 250,
      rows: [
        { id: 'row-first', text: 'Première ligne', delayMs: null },
        { id: 'row-second', text: 'Deuxième ligne', delayMs: null },
      ],
    }
    const build = new ListSceneBuilder().build({
      list: configuredList,
      idPrefix: 'test',
      partId: 'test:list',
      entryEventName: 'card:enter',
      entryTriggerMode: 'live',
    })

    const result = await executeStrapsSequentially(
      ['test:list:reveal'],
      build.straps,
      { event: { name: 'card:enter', applyAtMs: 0 }, state: {}, meta: {} },
    )

    expect(result).toEqual({
      events: [],
      updates: [{ 'test:list:pending-reveals': [250, 500] }],
      planned: [
        {
          offsetMs: 250,
          step: { event: { name: 'test:list:row:row-first:reveal' } },
        },
        {
          offsetMs: 500,
          step: { event: { name: 'test:list:row:row-second:reveal' } },
        },
      ],
      warnings: [],
      issues: [],
    })
  })
})

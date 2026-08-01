import { describe, expect, it } from 'vitest'

import { executeStrapsSequentially, type StrapCollection } from '../../../src/runtime/player'

const input = {
  event: { name: 'source:event', data: { value: 4 } },
  state: { count: 2 },
  meta: { storyId: 'main' },
  context: {},
} as const

describe('sequential strap executor', () => {
  it('awaits straps in declaration order and flattens nested outputs', async () => {
    const order: string[] = []
    const collection: StrapCollection = {
      first: async ({ strapName }) => {
        order.push(strapName)
        await Promise.resolve()
        return [
          { events: [{ name: 'first:event' }] },
          [{ offsetMs: 25, step: { event: { name: 'planned:event' } } }],
        ]
      },
      second: ({ strapName }) => {
        order.push(strapName)
        return { update: { count: 3 }, warnings: ['author warning'] }
      },
    }

    await expect(executeStrapsSequentially(['first', 'second'], collection, input)).resolves.toEqual({
      events: [{ name: 'first:event' }],
      updates: [{ count: 3 }],
      planned: [{ offsetMs: 25, step: { event: { name: 'planned:event' } } }],
      warnings: ['author warning'],
      issues: [],
    })
    expect(order).toEqual(['first', 'second'])
  })

  it('continues with a warning issue when a strap is missing or fails', async () => {
    const collection: StrapCollection = {
      broken: () => { throw new Error('broken strap') },
    }

    const result = await executeStrapsSequentially(['missing', 'broken'], collection, input)

    expect(result.issues).toEqual([
      { code: 'RUNTIME_STRAP_MISSING', message: 'Strap is not available: missing', strapName: 'missing' },
      { code: 'RUNTIME_STRAP_FAILED', message: 'broken strap', strapName: 'broken' },
    ])
  })

  it('exposes only finite planned helpers to strap functions', async () => {
    const result = await executeStrapsSequentially(['planned'], {
      planned: ({ context }) => context.planned.repeat(
        { eachMs: 20, times: 2 },
        { event: { name: 'planned:event' } },
      ),
    }, input)

    expect(result.planned.map((occurrence) => occurrence.offsetMs)).toEqual([0, 20])
  })
})

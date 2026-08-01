import { describe, expect, it } from 'vitest'

import { executeListenPipeline, propagateListenEvent } from '../../../src/runtime/player'
import type { CompiledFunctionCollection, CompiledListenRule } from '../../../src/scene/compiled'

const input = {
  eventId: 'event-a',
  eventSeq: 4,
  name: 'source:event',
  applyAtMs: 100,
  trackId: 'main',
  storyId: 'main',
  data: { value: 'raw' },
} as const

describe('listen -> transform -> emit', () => {
  it('passes events through when the story has no listen filters', () => {
    expect(propagateListenEvent([], input)).toEqual({ events: [input], pendingStraps: [], issues: [] })
  })

  it('transforms data, emits declared events, and exposes pending straps', () => {
    const rules: readonly CompiledListenRule[] = [{
      on: 'source:event',
      transform: [{ ref: 'fn:normalize' }],
      emit: [{ name: 'target:event', data: { value: 'emitted' } }],
      straps: ['save-result'],
    }]
    const functions: CompiledFunctionCollection = {
      'fn:normalize': (value) => ({ value: String((value as { data?: { value?: string } }).data?.value).toUpperCase() }),
    }

    expect(propagateListenEvent(rules, input, functions)).toEqual({
      events: [{ ...input, name: 'target:event', data: { value: 'emitted' } }],
      pendingStraps: ['save-result'],
      issues: [],
    })
  })

  it('uses transformed data when a matching rule emits without an explicit payload', () => {
    const rules: readonly CompiledListenRule[] = [{
      on: 'source:event',
      transform: [{ ref: 'fn:normalize' }],
    }]
    const functions: CompiledFunctionCollection = {
      'fn:normalize': () => ({ value: 'normalized' }),
    }

    expect(propagateListenEvent(rules, input, functions).events).toEqual([
      { ...input, data: { value: 'normalized' } },
    ])
  })

  it('reports missing transforms and does not match unrelated events', () => {
    const rules: readonly CompiledListenRule[] = [{
      on: 'source:event',
      transform: [{ ref: 'fn:missing' }],
    }]

    expect(propagateListenEvent(rules, input).issues).toMatchObject([{
      code: 'RUNTIME_LISTEN_FUNCTION_MISSING',
      functionRef: 'fn:missing',
    }])
    expect(propagateListenEvent(rules, { ...input, name: 'other:event' }).events).toEqual([])
  })

  it('executes straps before declared emissions', async () => {
    const order: string[] = []
    const result = await executeListenPipeline({
      rules: [{ on: 'source:event', straps: ['prepare'], emit: [{ name: 'target:event' }] }],
      event: input,
      straps: {
        prepare: async () => {
          await Promise.resolve()
          order.push('strap')
          return { events: [{ name: 'strap:event' }] }
        },
      },
    })

    order.push('emit')
    expect(result.events).toEqual([{ ...input, name: 'target:event' }])
    expect(result.straps[0]?.result.events).toEqual([{ name: 'strap:event' }])
    expect(order).toEqual(['strap', 'emit'])
  })
})

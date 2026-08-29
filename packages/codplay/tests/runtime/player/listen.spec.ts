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

  it('fans out transformed events, emits declared events, and exposes pending straps', () => {
    const rules: readonly CompiledListenRule[] = [{
      on: 'source:event',
      transform: [{ ref: 'fn:normalize' }],
      emit: [{ name: 'target:event', data: { value: 'emitted' } }],
      straps: ['save-result'],
    }]
    const functions: CompiledFunctionCollection = {
      'fn:normalize': (value) => [{
        name: 'normalized:event',
        data: { value: String((value as { data?: { value?: string } }).data?.value).toUpperCase() },
      }],
    }

    expect(propagateListenEvent(rules, input, functions)).toEqual({
      events: [
        { ...input, name: 'normalized:event', data: { value: 'RAW' } },
        { ...input, name: 'target:event', data: { value: 'emitted' } },
      ],
      pendingStraps: ['save-result'],
      issues: [],
    })
  })

  it('does not produce a pass-through event when a transform returns no events', () => {
    const rules: readonly CompiledListenRule[] = [{
      on: 'source:event',
      transform: [{ ref: 'fn:normalize' }],
    }]
    const functions: CompiledFunctionCollection = {
      'fn:normalize': () => [],
    }

    expect(propagateListenEvent(rules, input, functions).events).toEqual([])
  })

  it('preserves declaration order and gives every transform the source event', () => {
    const seen: unknown[] = []
    const rules: readonly CompiledListenRule[] = [{
      on: 'source:event',
      transform: [{ ref: 'fn:first' }, { ref: 'fn:second' }],
    }]
    const functions: CompiledFunctionCollection = {
      'fn:first': (value) => {
        seen.push((value as { data?: { value?: string } }).data?.value)
        return [{ name: 'first:event' }]
      },
      'fn:second': (value) => {
        seen.push((value as { data?: { value?: string } }).data?.value)
        return [{ name: 'second:event' }]
      },
    }

    expect(propagateListenEvent(rules, input, functions).events.map((event) => event.name)).toEqual([
      'first:event',
      'second:event',
    ])
    expect(seen).toEqual(['raw', 'raw'])
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

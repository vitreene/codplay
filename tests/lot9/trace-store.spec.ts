import { describe, expect, it } from 'vitest'

import type { AnimationTraceEntry } from '../../src/animation/types'
import type { ListTraceEntry } from '../../src/runtime/list-plugin/types'
import {
  appendAnimationTraceEntries,
  appendListTraceEntries,
  appendWaitTraceEntries,
  createRuntimeTraceStore
} from '../../src/runtime/trace-store'
import type { WaitTraceEntry } from '../../src/runtime/wait-flow'

describe('Lot 09 - trace/debug retention and export', () => {
  it('L9-T1 retention drops oldest rows when maxEntries is reached', () => {
    const traceStore = createRuntimeTraceStore({
      maxEntries: 3,
      nowProvider: () => 100
    })

    traceStore.append({ scope: 'runtime', eventName: 'event-1', status: 'info' })
    traceStore.append({ scope: 'runtime', eventName: 'event-2', status: 'info' })
    traceStore.append({ scope: 'runtime', eventName: 'event-3', status: 'info' })
    traceStore.append({ scope: 'runtime', eventName: 'event-4', status: 'info' })

    expect(traceStore.size()).toBe(3)
    expect(traceStore.list().map((row) => row.eventName)).toEqual(['event-2', 'event-3', 'event-4'])
  })

  it('L9-T2 list applies filters and limit deterministically', () => {
    const traceStore = createRuntimeTraceStore({ nowProvider: () => 1000 })

    traceStore.append({ scope: 'animation', eventName: 'anim:one', status: 'applied', correlationId: 'c-1' })
    traceStore.append({ scope: 'animation', eventName: 'anim:two', status: 'applied', correlationId: 'c-2' })
    traceStore.append({ scope: 'scenario', eventName: 'wait:start', status: 'applied', correlationId: 'c-1' })

    const filteredRows = traceStore.list({ scope: 'animation', correlationId: 'c-1', limit: 1 })

    expect(filteredRows).toHaveLength(1)
    expect(filteredRows[0]?.eventName).toBe('anim:one')
  })

  it('L9-T3 exportJson and exportNdjson include only filtered rows', () => {
    const traceStore = createRuntimeTraceStore({ nowProvider: () => 42 })

    traceStore.append({ scope: 'animation', eventName: 'anim:one', status: 'applied' })
    traceStore.append({ scope: 'scenario', eventName: 'wait:start', status: 'applied' })

    const jsonExport = traceStore.exportJson({ scope: 'animation' })
    const ndjsonExport = traceStore.exportNdjson({ scope: 'scenario' })

    const parsedJson = JSON.parse(jsonExport) as Array<{ eventName: string }>
    expect(parsedJson).toHaveLength(1)
    expect(parsedJson[0]?.eventName).toBe('anim:one')

    const ndjsonLines = ndjsonExport.split('\n').filter((line) => line.length > 0)
    expect(ndjsonLines).toHaveLength(1)
    expect(JSON.parse(ndjsonLines[0] ?? '{}')).toMatchObject({ eventName: 'wait:start' })
  })

  it('L9-T4 animation trace adapter maps batch trace shape to runtime rows', () => {
    const traceStore = createRuntimeTraceStore({ nowProvider: () => 7 })
    const animationEntries: AnimationTraceEntry[] = [
      {
        traceId: 'anim-trace-1',
        eventId: 'evt-1',
        eventName: 'intro',
        transitionId: 'tr-1',
        property: 'x',
        status: 'applied'
      }
    ]

    appendAnimationTraceEntries(traceStore, animationEntries, 'corr-anim')

    expect(traceStore.list()).toEqual([
      expect.objectContaining({
        traceId: 'anim-trace-1',
        scope: 'animation',
        eventName: 'intro',
        status: 'applied',
        sourceId: 'tr-1',
        correlationId: 'corr-anim',
        payload: {
          eventId: 'evt-1',
          property: 'x'
        }
      })
    ])
  })

  it('L9-T5 wait/list trace adapters append rows with source identifiers', () => {
    const traceStore = createRuntimeTraceStore({ nowProvider: () => 9 })

    const waitEntries: WaitTraceEntry[] = [
      {
        traceId: 'wait-trace-1',
        eventName: 'scenario:wait:start',
        waitId: 'wait-1',
        mode: 'parallel',
        payload: { reason: 'network' }
      }
    ]

    const listEntries: ListTraceEntry[] = [
      {
        traceId: 'list-trace-1',
        eventName: 'list:diff:computed',
        runtimeListId: 'list-42',
        payload: { added: ['a'] }
      }
    ]

    appendWaitTraceEntries(traceStore, waitEntries, 'corr-shared')
    appendListTraceEntries(traceStore, listEntries, 'corr-shared')

    const scenarioRows = traceStore.list({ scope: 'scenario' })
    const listRows = traceStore.list({ scope: 'list' })

    expect(scenarioRows[0]).toMatchObject({
      eventName: 'scenario:wait:start',
      sourceId: 'wait-1',
      correlationId: 'corr-shared'
    })

    expect(listRows[0]).toMatchObject({
      eventName: 'list:diff:computed',
      sourceId: 'list-42',
      correlationId: 'corr-shared'
    })
  })
})

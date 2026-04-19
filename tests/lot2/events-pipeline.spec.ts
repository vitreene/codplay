import { describe, expect, it } from 'vitest'

import { collectEventsWindow } from '../../src/core/events/collect-window'
import { dispatchEvents } from '../../src/core/events/dispatch'
import { flattenEventNodes } from '../../src/core/events/flatten'
import { sortRuntimeEvents } from '../../src/core/events/sort'
import type { TimelineEvent } from '../../src/core/events/types'

/**
 * Creates a timeline event with concise defaults for tests.
 */
function temp__makeEvent(partial: Partial<TimelineEvent> & Pick<TimelineEvent, 'id' | 'ms' | 'name' | 'index' | 'source'>): TimelineEvent {
  return {
    id: partial.id,
    ms: partial.ms,
    name: partial.name,
    index: partial.index,
    source: partial.source,
    payload: partial.payload,
    trackId: partial.trackId
  }
}

describe('Lot 02 - events pipeline', () => {
  it('L2-T1 flattens nested event nodes with absolute milliseconds', () => {
    const result = flattenEventNodes([
      {
        name: 'intro',
        startAt: 100,
        events: [
          {
            name: 'intro-child',
            startAt: 20
          }
        ]
      },
      {
        name: 'outro',
        startAt: 300
      }
    ])

    expect(result.map((event) => event.name)).toEqual(['intro', 'intro-child', 'outro'])
    expect(result.map((event) => event.ms)).toEqual([100, 120, 300])
    expect(result.map((event) => event.index)).toEqual([0, 1, 2])
  })

  it('L2-T1b flattens deep nested nodes with cumulative milliseconds', () => {
    const result = flattenEventNodes([
      {
        name: 'level-1',
        startAt: 100,
        events: [
          {
            name: 'level-2',
            startAt: 40,
            events: [
              {
                name: 'level-3',
                startAt: 7
              }
            ]
          }
        ]
      }
    ])

    expect(result.map((event) => event.name)).toEqual(['level-1', 'level-2', 'level-3'])
    expect(result.map((event) => event.ms)).toEqual([100, 140, 147])
    expect(result.map((event) => event.index)).toEqual([0, 1, 2])
  })

  it('L2-T2 sorts events deterministically by ms, track order, index, source', () => {
    const input: TimelineEvent[] = [
      temp__makeEvent({ id: 'e4', ms: 20, name: 'n', index: 0, source: 'user', trackId: 't-main' }),
      temp__makeEvent({ id: 'e3', ms: 20, name: 'n', index: 0, source: 'story', trackId: 't-main' }),
      temp__makeEvent({ id: 'e1', ms: 10, name: 'n', index: 2, source: 'story', trackId: 't-low' }),
      temp__makeEvent({ id: 'e2', ms: 10, name: 'n', index: 1, source: 'story', trackId: 't-high' })
    ]

    const trackMeta = {
      't-main': { order: 1, source: 'story' as const },
      't-low': { order: 2, source: 'story' as const },
      't-high': { order: 1, source: 'story' as const }
    }

    const sortedFirst = sortRuntimeEvents(input, trackMeta)
    const sortedSecond = sortRuntimeEvents(input, trackMeta)

    expect(sortedFirst.map((event) => event.id)).toEqual(['e2', 'e1', 'e3', 'e4'])
    expect(sortedSecond.map((event) => event.id)).toEqual(['e2', 'e1', 'e3', 'e4'])
  })

  it('L2-T3 collects events in window (prevMs, nowMs + marginMs]', () => {
    const events: TimelineEvent[] = [
      temp__makeEvent({ id: 'e0', ms: 0, name: 'n', index: 0, source: 'story' }),
      temp__makeEvent({ id: 'e1', ms: 10, name: 'n', index: 1, source: 'story' }),
      temp__makeEvent({ id: 'e2', ms: 15, name: 'n', index: 2, source: 'story' }),
      temp__makeEvent({ id: 'e3', ms: 20, name: 'n', index: 3, source: 'story' })
    ]

    const noMargin = collectEventsWindow(events, 10, 15, 0)
    const withMargin = collectEventsWindow(events, 10, 15, 5)

    expect(noMargin.map((event) => event.id)).toEqual(['e2'])
    expect(withMargin.map((event) => event.id)).toEqual(['e2', 'e3'])
  })

  it('L2-T4 dispatches only exact event-name matches', () => {
    const events: TimelineEvent[] = [
      temp__makeEvent({ id: 'e1', ms: 10, name: 'pointer:click', index: 0, source: 'story' }),
      temp__makeEvent({ id: 'e2', ms: 20, name: 'pointer:down', index: 1, source: 'story' })
    ]

    const resolved = dispatchEvents(events, {
      listeners: [
        {
          listenerId: 'listener-a',
          actionsByEventName: {
            'pointer:click': { actionName: 'click-only' },
            'pointer:*': { actionName: 'wildcard-not-supported' }
          }
        }
      ]
    })

    expect(resolved).toHaveLength(1)
    expect(resolved[0]?.listenerId).toBe('listener-a')
    expect(resolved[0]?.eventName).toBe('pointer:click')
  })

  it('L2-T5 dispatches same event to listeners in declaration order', () => {
    const events: TimelineEvent[] = [
      temp__makeEvent({ id: 'e1', ms: 10, name: 'intro', index: 0, source: 'story' })
    ]

    const resolved = dispatchEvents(events, {
      listeners: [
        {
          listenerId: 'listener-first',
          actionsByEventName: {
            intro: { actionName: 'first' }
          }
        },
        {
          listenerId: 'listener-second',
          actionsByEventName: {
            intro: { actionName: 'second' }
          }
        }
      ]
    })

    expect(resolved.map((action) => action.listenerId)).toEqual(['listener-first', 'listener-second'])
  })
})

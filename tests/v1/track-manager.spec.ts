import { describe, expect, it } from 'vitest'

import { TrackManager } from '../../src/track-manager/create-track-manager'

describe('V1 - track manager', () => {
  it('loads deterministic scene tracks and collects due events in order', () => {
    const trackManager = new TrackManager()

    const loadResult = trackManager.load({
      tracks: {
        alpha: {
          order: 1,
          source: 'story',
          events: [
            { id: 'evt-2', ms: 200, name: 'second', index: 1, source: 'story' }
          ]
        },
        beta: {
          order: 0,
          source: 'story',
          events: [
            { id: 'evt-1', ms: 100, name: 'first', index: 0, source: 'story' }
          ]
        }
      },
      options: {
        emitRefs: true
      }
    })

    expect(loadResult).toEqual({ ok: true, data: undefined })
    expect(trackManager.state.loadedTrackIds).toEqual(['alpha', 'beta'])

    expect(trackManager.collectDueEvents({ nowMs: 150 })).toEqual({
      events: [
        {
          id: 'evt-1',
          ms: 100,
          name: 'first',
          index: 0,
          source: 'story',
          trackId: 'beta',
          payload: undefined
        }
      ],
      refs: [
        {
          eventOffset: 100,
          trackId: 'beta',
          index: 0,
          source: 'story'
        }
      ]
    })

    expect(trackManager.collectDueEvents({ nowMs: 250 }).events.map((event) => event.id)).toEqual(['evt-2'])
  })

  it('anchors portable eventimes at runtime and resyncs cursor on seek-like jumps', () => {
    const trackManager = new TrackManager()

    trackManager.load({ tracks: {} })

    const appendResult = trackManager.appendAnchoredEventimes({
      trackId: 'track-story-main',
      anchorMs: 500,
      storyId: 'story-main',
      eventimes: [
        {
          name: 'story:start',
          startAt: 0,
          events: [
            {
              name: 'story:step',
              startAt: 120
            }
          ]
        }
      ]
    })

    expect(appendResult).toEqual({
      ok: true,
      data: {
        appendedCount: 2
      }
    })

    expect(trackManager.getAllEvents().map((event) => ({ name: event.name, ms: event.ms }))).toEqual([
      { name: 'story:start', ms: 500 },
      { name: 'story:step', ms: 620 }
    ])

    trackManager.syncCursor({ nowMs: 500 })
    expect(trackManager.collectDueEvents({ nowMs: 800 }).events.map((event) => event.name)).toEqual(['story:step'])

    trackManager.syncCursor({ nowMs: 0 })
    expect(trackManager.collectDueEvents({ nowMs: 800 }).events.map((event) => event.name)).toEqual([
      'story:start',
      'story:step'
    ])
  })
})

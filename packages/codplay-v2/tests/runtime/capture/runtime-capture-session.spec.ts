import { describe, expect, it } from 'vitest'

import { EVENT_INSERT_MODE_PERSIST_ONLY } from '../../../src/runtime/config/event-insertion'
import { openRuntimeCaptureSession } from '../../../src/runtime/capture'

describe('runtime capture session', () => {
  it('keeps captureState private and adds it to the normal endEmit output', () => {
    const opened = openRuntimeCaptureSession({
      state: { value: 10 },
      startedAtMs: 100,
      declaration: {
        initCaptureState: ({ state }) => ({ value: state.value }),
        trackCommand: ({ sample, captureState }) => {
          const value = typeof sample.value === 'number' ? sample.value : 0
          return {
            captureState: { value },
            action: { actionName: 'drag', data: { value: captureState.value } },
          }
        },
        endEmit: {
          name: 'drag:end',
          data: { source: 'capture' },
        },
      },
    })

    expect(opened.ok).toBe(true)
    if (!opened.ok) return

    const tracked = opened.session.track({ value: 42 })
    expect(tracked).toMatchObject({ ok: true, sampleCount: 1 })
    if (!tracked.ok) return

    const ended = opened.session.end({ value: 42 }, {}, 140)
    expect(ended).toMatchObject({ ok: true })
    if (!ended.ok) return

    expect(ended.endEmitEvent).toEqual({
      name: 'drag:end',
      data: {
        source: 'capture',
        captureState: { value: 42 },
      },
      source: 'endEmit',
      applyAtMs: 140,
      mode: 'apply-now',
    })
    expect(ended.endCaptureEvents).toEqual([])
    expect(ended.warnings).toHaveLength(1)
  })

  it('does not require endEmit or endCapture and warns only about replayability', () => {
    const opened = openRuntimeCaptureSession({
      state: {},
      declaration: {},
    })

    expect(opened.ok).toBe(true)
    if (!opened.ok) return

    const ended = opened.session.end({})
    expect(ended).toMatchObject({ ok: true, events: [], endCaptureEvents: [] })
    if (!ended.ok) return
    expect(ended.warnings).toEqual([{
      code: 'CAPTURE_REPLAY_NOT_IDENTICAL',
      message: 'Capture has no persistent end event; replay and seek may differ.',
    }])
  })

  it('makes every endCapture event persist-only by placement', () => {
    const opened = openRuntimeCaptureSession({
      state: {},
      declaration: {
        endCapture: () => ({
          events: [{
            name: 'capture:stored',
            mode: 'apply-now',
          }],
        }),
      },
    })

    expect(opened.ok).toBe(true)
    if (!opened.ok) return

    const ended = opened.session.end({})
    expect(ended).toMatchObject({ ok: true })
    if (!ended.ok) return
    expect(ended.warnings).toEqual([])
    expect(ended.endCaptureEvents).toEqual([expect.objectContaining({
      name: 'capture:stored',
      source: 'endCapture',
      mode: EVENT_INSERT_MODE_PERSIST_ONLY,
      applyAtMs: -200,
    })])
  })

  it('resolves capture duration and propagates it only to missing transitions', () => {
    const opened = openRuntimeCaptureSession({
      state: {},
      startedAtMs: 100,
      declaration: {
        endCapture: () => ({
          duration: 12,
          durationMode: 'capture',
          events: [{
            name: 'capture:stored',
            data: {
              style: {
                x: { to: 40 },
                y: { to: 20, duration: 8 },
              },
            },
          }],
        }),
      },
    })

    expect(opened.ok).toBe(true)
    if (!opened.ok) return

    const ended = opened.session.end({}, {}, 350)
    expect(ended).toMatchObject({
      ok: true,
      startedAtMs: 100,
      endedAtMs: 350,
      resolvedDurationMs: 250,
      endCaptureApplyAtMs: 100,
    })
    if (!ended.ok) return
    expect(ended.endCaptureEvents[0]?.data).toEqual({
      style: {
        x: { to: 40, duration: 250 },
        y: { to: 20, duration: 8 },
      },
    })
  })

  it('returns updateState as a live-only track result', () => {
    const opened = openRuntimeCaptureSession({
      state: {},
      declaration: {
        trackCommand: ({ sample }) => {
          const value = typeof sample.value === 'number' ? sample.value : 0
          return {
            updateState: { current: value },
            captureState: { value },
          }
        },
      },
    })

    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    expect(opened.session.track({ value: 4 })).toEqual({
      ok: true,
      updateState: { current: 4 },
      captureState: { value: 4 },
      sampleCount: 1,
    })
  })

  it('allows cancellation and rejects subsequent tracking or ending', () => {
    const opened = openRuntimeCaptureSession({ state: {}, declaration: {} })
    expect(opened.ok).toBe(true)
    if (!opened.ok) return

    opened.session.cancel()
    expect(opened.session.getStatus()).toBe('cancelled')
    expect(opened.session.track({})).toEqual({
      ok: false,
      code: 'RUNTIME_CAPTURE_CLOSED',
      message: 'Capture session is no longer active.',
    })
    expect(opened.session.end({})).toEqual({
      ok: false,
      code: 'RUNTIME_CAPTURE_CLOSED',
      message: 'Capture session is no longer active.',
    })
  })
})

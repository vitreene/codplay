import { describe, expect, it } from 'vitest'

import {
  ExternalCoursePagePlaybackStore,
} from '../src/external-course-page/external-course-page-playback'
import type {
  ExternalCoursePageProgress,
} from '../src/external-course-page/external-course-page-playback'

describe('external course page playback transport', () => {
  it('publishes reader progress and serializes native seek requests', async () => {
    const store = new ExternalCoursePagePlaybackStore()
    const states: ExternalCoursePageProgress[] = []
    store.transport.onProgress((state) => states.push(state))
    store.setState({ timelineMs: 8_780, durationMs: 24_393, status: 'paused' })

    let resolveSeek: (() => void) | undefined
    let requestedTargetMs = 0
    store.setSeekHandler((targetMs) => {
      requestedTargetMs = targetMs
      return new Promise<void>((resolve) => { resolveSeek = resolve })
    })

    const seekResult = store.transport.seek(12_000)
    expect(store.transport.commandInFlight).toBe(true)
    expect(requestedTargetMs).toBe(12_000)
    expect(await store.transport.seek(2_000)).toMatchObject({ ok: false })

    resolveSeek?.()
    await expect(seekResult).resolves.toBeUndefined()
    expect(store.transport.commandInFlight).toBe(false)
    expect(store.transport.getProgress()).toEqual({ timelineMs: 8_780, durationMs: 24_393 })
    expect(states.at(-1)).toEqual({ timelineMs: 8_780, durationMs: 24_393, status: 'paused' })
  })

  it('notifies subscribers when source progress changes', () => {
    const store = new ExternalCoursePagePlaybackStore()
    const observed: ExternalCoursePageProgress[] = []
    const unsubscribe = store.transport.onProgress((state) => observed.push(state))

    store.setState({ timelineMs: 3_456, durationMs: 24_393, status: 'playing' })

    expect(observed).toEqual([{ timelineMs: 3_456, durationMs: 24_393, status: 'playing' }])
    unsubscribe()
  })
})

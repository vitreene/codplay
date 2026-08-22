import { describe, expect, it } from 'vitest'

import {
  PLAYER_LIFECYCLE_PAUSED,
  PLAYER_LIFECYCLE_PLAYING,
  PLAYER_LIFECYCLE_READY,
  type PlayerLifecycleState,
} from '../../../src/runtime/player'
import { createRuntimeTelco } from '../../../src/runtime/telco'
import type { FrameScheduler } from '../../../src/runtime/time'

class FakeScheduler implements FrameScheduler {
  private nextRequestId = 0
  private readonly callbacks = new Map<number, () => void>()

  /** Queues one deterministic progress callback. */
  request(callback: () => void): number {
    const requestId = this.nextRequestId
    this.nextRequestId += 1
    this.callbacks.set(requestId, callback)
    return requestId
  }

  /** Removes one queued progress callback. */
  cancel(requestId: number): void {
    this.callbacks.delete(requestId)
  }

  /** Flushes the next queued progress callback. */
  flush(): void {
    const entry = this.callbacks.entries().next().value as [number, () => void] | undefined
    if (entry === undefined) return
    this.callbacks.delete(entry[0])
    entry[1]()
  }
}

class FakeTransportTarget {
  status: PlayerLifecycleState = PLAYER_LIFECYCLE_READY
  timeMs = 0
  readonly calls: string[] = []

  /** Returns the fake lifecycle state. */
  getLifecycleState(): PlayerLifecycleState {
    return this.status
  }

  /** Returns the fake logical time. */
  getCurrentTimeMs(): number {
    return this.timeMs
  }

  /** Starts fake playback. */
  play(): void {
    this.calls.push('play')
    this.status = PLAYER_LIFECYCLE_PLAYING
  }

  /** Pauses fake playback. */
  pause(): void {
    this.calls.push('pause')
    this.status = PLAYER_LIFECYCLE_PAUSED
  }

  /** Seeks fake playback to one logical time. */
  seek(timeMs: number): Readonly<{ ok: boolean }> {
    this.calls.push(`seek:${timeMs}`)
    this.timeMs = timeMs
    return { ok: true }
  }
}

describe('Runtime telco', () => {
  it('delegates transport commands and publishes progress', async () => {
    const target = new FakeTransportTarget()
    const scheduler = new FakeScheduler()
    const telco = createRuntimeTelco({ target, durationMs: 1000, scheduler })
    const progress: number[] = []
    telco.onProgress((state) => progress.push(state.timelineMs))

    expect((await telco.play()).ok).toBe(true)
    target.timeMs = 240
    scheduler.flush()

    expect(target.calls).toEqual(['play'])
    expect(progress).toEqual([240])
    expect(telco.getState()).toMatchObject({
      status: PLAYER_LIFECYCLE_PLAYING,
      timelineMs: 240,
      initialized: true,
    })
    telco.destroy()
  })

  it('pauses before seek and rewinds through the same command surface', async () => {
    const target = new FakeTransportTarget()
    const telco = createRuntimeTelco({ target, durationMs: 1000, scheduler: new FakeScheduler() })

    await telco.play()
    await telco.seek(480)
    expect(target.calls).toEqual(['play', 'pause', 'seek:480'])
    expect(target.status).toBe(PLAYER_LIFECYCLE_PAUSED)

    await telco.rewind()
    expect(target.calls).toEqual(['play', 'pause', 'seek:480', 'seek:0'])
    expect(telco.getState().timelineMs).toBe(0)
    telco.destroy()
  })

  it('allows seeking from the initialized ready state', async () => {
    const target = new FakeTransportTarget()
    const telco = createRuntimeTelco({ target, durationMs: 1000, scheduler: new FakeScheduler() })

    expect((await telco.seek(320)).ok).toBe(true)
    expect(target.calls).toEqual(['seek:320'])
    expect(target.status).toBe(PLAYER_LIFECYCLE_READY)
    expect(telco.getState().timelineMs).toBe(320)
    telco.destroy()
  })

  it('clamps the sequence end and stops the target at the telco duration', async () => {
    const target = new FakeTransportTarget()
    const scheduler = new FakeScheduler()
    const telco = createRuntimeTelco({ target, durationMs: 600, scheduler })
    telco.onProgress(() => undefined)

    await telco.play()
    target.timeMs = 720
    scheduler.flush()

    expect(target.status).toBe(PLAYER_LIFECYCLE_PAUSED)
    expect(target.timeMs).toBe(600)
    expect(telco.getState().sequenceEnded).toBe(true)
    telco.destroy()
  })
})

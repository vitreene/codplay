import { describe, expect, it } from 'vitest'

import {
  PLAYER_LIFECYCLE_PAUSED,
  PLAYER_LIFECYCLE_PLAYING,
  PLAYER_LIFECYCLE_READY,
  type PlayerLifecycleState,
} from '../../../src/runtime/player'
import { createRuntimeTelco } from '../../../src/runtime/telco'

class FakeTransportTarget {
  status: PlayerLifecycleState = PLAYER_LIFECYCLE_READY
  timeMs = 0
  discoveredDurationMs: number | undefined
  rate = 1
  readonly calls: string[] = []
  private readonly listeners = new Set<() => void>()

  /** Returns the fake lifecycle state. */
  getLifecycleState(): PlayerLifecycleState {
    return this.status
  }

  /** Returns the fake logical time. */
  getCurrentTimeMs(): number {
    return this.timeMs
  }

  /** Returns the fake horizon discovered by the open sequence. */
  getDurationMs(): number | undefined {
    return this.discoveredDurationMs
  }

  /** Returns the fake playback rate. */
  getRate(): number {
    return this.rate
  }

  /** Subscribes to deterministic fake transport updates. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /** Publishes one deterministic fake transport update. */
  notify(): void {
    for (const listener of [...this.listeners]) listener()
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

  /** Changes the fake playback rate. */
  setRate(rate: number): void {
    this.calls.push(`rate:${rate}`)
    this.rate = rate
  }

  /** Seeks fake playback to one logical time. */
  seek(timeMs: number): Readonly<{ ok: boolean }> {
    this.calls.push(`seek:${timeMs}`)
    this.timeMs = timeMs
    this.notify()
    return { ok: true }
  }
}

describe('Runtime telco', () => {
  it('delegates transport commands and publishes progress', async () => {
    const target = new FakeTransportTarget()
    const telco = createRuntimeTelco({ target, durationMs: 1000 })
    const progress: number[] = []
    telco.onProgress((state) => progress.push(state.timelineMs))

    expect((await telco.play()).ok).toBe(true)
    target.timeMs = 240
    target.notify()

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
    const telco = createRuntimeTelco({ target, durationMs: 1000 })

    await telco.play()
    await telco.seek(480)
    expect(target.calls).toEqual(['play', 'pause', 'seek:480'])
    expect(target.status).toBe(PLAYER_LIFECYCLE_PAUSED)

    await telco.rewind()
    expect(target.calls).toEqual(['play', 'pause', 'seek:480', 'seek:0'])
    expect(telco.getState().timelineMs).toBe(0)
    telco.destroy()
  })

  it('toggles play and pause through the same command facade', async () => {
    const target = new FakeTransportTarget()
    const telco = createRuntimeTelco({ target, durationMs: 1000 })

    expect((await telco.togglePlay()).ok).toBe(true)
    expect(target.status).toBe(PLAYER_LIFECYCLE_PLAYING)

    expect((await telco.togglePlay()).ok).toBe(true)
    expect(target.status).toBe(PLAYER_LIFECYCLE_PAUSED)
    expect(target.calls).toEqual(['play', 'pause'])
    telco.destroy()
  })

  it('allows seeking from the initialized ready state', async () => {
    const target = new FakeTransportTarget()
    const telco = createRuntimeTelco({ target, durationMs: 1000 })

    expect((await telco.seek(320)).ok).toBe(true)
    expect(target.calls).toEqual(['seek:320'])
    expect(target.status).toBe(PLAYER_LIFECYCLE_READY)
    expect(telco.getState().timelineMs).toBe(320)
    telco.destroy()
  })

  it('exposes the playback rate through the same facade', () => {
    const target = new FakeTransportTarget()
    const telco = createRuntimeTelco({ target, durationMs: 1000 })

    telco.setRate(2)

    expect(telco.rate).toBe(2)
    expect(telco.getState().rate).toBe(2)
    expect(target.calls).toEqual(['rate:2'])
    telco.destroy()
  })

  it('keeps an open sequence unbounded while its discovered horizon follows the head', async () => {
    const target = new FakeTransportTarget()
    const telco = createRuntimeTelco({ target })

    await telco.play()
    target.timeMs = 1_200
    target.discoveredDurationMs = 1_200
    target.notify()

    expect(target.status).toBe(PLAYER_LIFECYCLE_PLAYING)
    expect(telco.getState()).toMatchObject({
      timelineMs: 1_200,
      durationMs: 1_200,
      sequenceEnded: false,
    })

    await telco.seek(2_000)
    expect(target.timeMs).toBe(2_000)
    expect(telco.getProgress().durationMs).toBe(2_000)
    telco.destroy()
  })

  it('clamps the sequence end and stops the target at the telco duration', async () => {
    const target = new FakeTransportTarget()
    const telco = createRuntimeTelco({ target, durationMs: 600 })
    telco.onProgress(() => undefined)

    await telco.play()
    target.timeMs = 720
    target.notify()
    await Promise.resolve()

    expect(target.status).toBe(PLAYER_LIFECYCLE_PAUSED)
    expect(target.timeMs).toBe(600)
    expect(telco.getState().sequenceEnded).toBe(true)
    telco.destroy()
  })
})

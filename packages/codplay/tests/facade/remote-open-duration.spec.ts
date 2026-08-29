/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'

import { createRemote } from '../../../authoring/remote/src/remote'

type TestRemoteState = Readonly<{
  status: string
  timelineMs: number
  durationMs: number
  rate: number
  initialized: boolean
  sequenceEnded: boolean
  runtimeRevision: number
}>

/** Creates the smallest transport stub needed to exercise the official remote. */
function createTransport(initial: TestRemoteState) {
  let state = initial
  const progressListeners = new Set<(next: TestRemoteState) => void>()
  const changeListeners = new Set<(next: TestRemoteState) => void>()
  return {
    getState: () => state,
    getProgress: () => ({ timelineMs: state.timelineMs, durationMs: state.durationMs }),
    get commandInFlight() { return false },
    get rate() { return state.rate },
    setRate: () => undefined,
    play: async () => ({ ok: true as const }),
    pause: async () => ({ ok: true as const }),
    togglePlay: async () => ({ ok: true as const }),
    seek: async () => ({ ok: true as const }),
    rewind: async () => ({ ok: true as const }),
    onChange: (listener: (next: TestRemoteState) => void) => {
      changeListeners.add(listener)
      return () => { changeListeners.delete(listener) }
    },
    onProgress: (listener: (next: TestRemoteState) => void) => {
      progressListeners.add(listener)
      return () => { progressListeners.delete(listener) }
    },
    publishProgress: (next: TestRemoteState) => {
      state = next
      for (const listener of progressListeners) listener(next)
    },
    publishChange: (next: TestRemoteState) => {
      state = next
      for (const listener of changeListeners) listener(next)
    },
  }
}

describe('official remote open duration', () => {
  let remote: ReturnType<typeof createRemote> | undefined

  afterEach(() => {
    remote?.destroy()
    remote = undefined
    document.body.replaceChildren()
  })

  it('updates the seek range when progress discovers a larger horizon', () => {
    const transport = createTransport({
      status: 'ready',
      timelineMs: 0,
      durationMs: 0,
      rate: 1,
      initialized: true,
      sequenceEnded: false,
      runtimeRevision: 0,
    })
    remote = createRemote({ telco: transport })
    const range = remote.element.querySelector<HTMLInputElement>('input[type="range"]')
    expect(range?.max).toBe('0')

    transport.publishProgress({
      status: 'playing',
      timelineMs: 1_500,
      durationMs: 1_500,
      rate: 1,
      initialized: true,
      sequenceEnded: false,
      runtimeRevision: 1,
    })

    expect(range?.max).toBe('1500')
    expect(range?.value).toBe('1500')
  })
})

/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest'

import { createV2DemoTelco } from './telco'

/** Creates the smallest V2 telco double needed by the layout control. */
function createTelco(): Parameters<typeof createV2DemoTelco>[0] {
  const state = {
    instanceId: 'layout-test',
    status: 'ready' as const,
    timelineMs: 0,
    durationMs: 1_000,
    rate: 1,
    initialized: true,
    sequenceEnded: false,
    runtimeRevision: 0,
  }
  return {
    commandInFlight: false,
    rate: 1,
    getState: () => state,
    getProgress: () => ({ timelineMs: state.timelineMs, durationMs: state.durationMs }),
    play: async () => undefined,
    pause: async () => undefined,
    togglePlay: async () => undefined,
    setRate: () => undefined,
    seek: async () => undefined,
    rewind: async () => undefined,
    onChange: () => () => undefined,
    onProgress: () => () => undefined,
  }
}

describe('V2 demo telco', () => {
  it('adds a circular reload control that calls the current scene remount', async () => {
    let reloadCount = 0
    const remote = createV2DemoTelco(createTelco(), {
      onLog: () => undefined,
      onReload: async () => {
        reloadCount += 1
      },
    })

    const reloadButton = remote.element.querySelector<HTMLButtonElement>('[data-v2-demo-telco-reload]')
    expect(reloadButton).not.toBeNull()
    expect(reloadButton?.getAttribute('aria-label')).toBe('Recharger la scène')
    reloadButton?.click()
    await Promise.resolve()
    await Promise.resolve()

    expect(reloadCount).toBe(1)
    remote.destroy()
  })
})

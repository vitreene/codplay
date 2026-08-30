/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadRuntimeVideo } from '../../../src/runtime/preload'

describe('runtime video preload handoff', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.replaceChildren()
  })

  it('keeps the ready video node available for component adoption', async () => {
    const load = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(function (this: HTMLMediaElement) {
      this.dispatchEvent(new Event('canplaythrough'))
    })
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)

    const result = await loadRuntimeVideo('/assets/retained-video.mp4', new AbortController().signal)
    const retainedNode = document.body.querySelector('video')

    expect(result.metadata).toMatchObject({ type: 'video' })
    expect(retainedNode).not.toBeNull()
    expect(retainedNode?.style.opacity).toBe('0')
    const lease = result.media.take()
    expect(lease?.node).toBe(retainedNode)
    expect(retainedNode?.parentNode).toBe(document.body)

    lease?.release()
    expect(document.body.querySelector('video')).toBeNull()
    expect(load).toHaveBeenCalledTimes(1)
  })
})

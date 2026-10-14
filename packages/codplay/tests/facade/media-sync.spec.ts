/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { CodPlay, type CodPlayInstance } from '../../src'
import type { SceneDoc } from '../../src/scene/types'

/** Declares the controls and sources owned by this integration test. */
function mediaScene(): SceneDoc {
  return {
    id: 'independent-video',
    stories: {
      main: {
        id: 'main',
        listen: [{ on: 'start' }, { on: 'pause' }, { on: 'stop' }],
        persos: [{
          id: 'video',
          type: 'media',
          initial: { src: '/owned-fixture.mp4', sync: 'independent', controls: true, move: '@root' },
          actions: {
            start: { broadcast: { type: 'START' } },
            pause: { broadcast: { type: 'PAUSE' } },
            stop: { broadcast: { type: 'STOP' } },
          },
        }],
      },
    },
  }
}

/** Emits an ordinary declared command through the public player journal. */
async function command(instance: CodPlayInstance, name: string): Promise<void> {
  await instance.events.emit({ name }, { scope: 'story', storyId: 'main' })
}

describe('independent media through the public HTML player', () => {
  let codplay: CodPlay | undefined

  afterEach(() => {
    codplay?.destroy()
    codplay = undefined
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('preserves native playback across seek, reset and rate, then stops at zero', async () => {
    const paused = new WeakMap<HTMLMediaElement, boolean>()
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
      paused.set(this, false)
      return Promise.resolve()
    })
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
      paused.set(this, true)
    })
    vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockImplementation(function (this: HTMLMediaElement) {
      return paused.get(this) ?? true
    })
    codplay = new CodPlay({ frameScheduler: { request: () => 1, cancel: () => undefined }, pauseOnDocumentHidden: false, engine: { idle: false } })
    const build = codplay.build({ scene: mediaScene() })
    if (!build.ok) throw new Error('Media integration fixture did not compile')
    codplay.resources.register({ loaded: ['/owned-fixture.mp4'], skipped: [], metadata: { '/owned-fixture.mp4': { type: 'video', durationMs: 10_000 } } })
    const root = document.createElement('div')
    document.body.appendChild(root)
    const instance = codplay.instances.create({ instanceId: 'video-player', compiledScene: build.compiledScene, functions: build.functions, root })
    const video = root.querySelector('video')!
    const source = video.src
    await instance.telco.play()
    await command(instance, 'start')
    expect(video.paused).toBe(false)
    video.currentTime = 4.2
    await instance.telco.pause()
    instance.telco.setRate(2)
    expect(video.paused).toBe(false)
    expect(video.playbackRate).toBe(1)
    await instance.telco.seek(300)
    expect(video.currentTime).toBe(4.2)
    expect(video.paused).toBe(false)
    await instance.telco.reset()
    expect(root.querySelector('video')).toBe(video)
    expect(video.src).toBe(source)
    expect(video.currentTime).toBe(4.2)
    expect(video.paused).toBe(false)
    await command(instance, 'pause')
    expect(video.currentTime).toBe(4.2)
    expect(video.paused).toBe(true)
    await video.play()
    video.currentTime = 5.1
    codplay.engine.advance(0)
    expect(video.paused).toBe(false)
    await command(instance, 'stop')
    expect(video.currentTime).toBe(0)
    expect(video.paused).toBe(true)
    expect(root.querySelector('video')).toBe(video)
    codplay.destroy()
    codplay = undefined
    expect(root.querySelector('video')).toBeNull()
  })
})

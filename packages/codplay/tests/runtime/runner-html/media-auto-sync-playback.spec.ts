/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCoreRuntimeCatalog } from '../../../src/runtime/catalog'
import { RuntimeEngine } from '../../../src/runtime/engine'
import { HtmlPlayerRunner } from '../../../src/runtime/runner-html'
import { SceneBuilder } from '../../../src/scene/compiled'
import type { SceneDoc } from '../../../src/scene/types'

const VIDEO_SRC = '/media/auto-sync.mp4'
const START_AT_MS = 2000

/** Declares one auto-synchronized video that starts from an authored broadcast. */
function createAutoSyncScene(): SceneDoc<string> {
  return {
    id: 'media-auto-sync-scene',
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: 'video',
          type: 'media',
          initial: { move: '@root', tag: 'video', src: VIDEO_SRC, sync: 'auto' },
          actions: { 'video:start': { broadcast: { type: 'START' } } },
        }],
        eventimes: [{ name: 'video:start', startAt: START_AT_MS }],
      },
    },
  }
}

describe('auto-synchronized media presentation', () => {
  let runner: HtmlPlayerRunner | undefined

  afterEach(() => {
    runner?.destroy()
    runner = undefined
    vi.restoreAllMocks()
    document.body.replaceChildren()
  })

  it('starts the native video once and does not write its position while it plays in sync', () => {
    const playCalls: HTMLMediaElement[] = []
    const pauseCalls: HTMLMediaElement[] = []
    let playing = false
    let currentSeconds = 0
    const positionWrites: number[] = []
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
      playCalls.push(this)
      playing = true
      return Promise.resolve()
    })
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
      pauseCalls.push(this)
      playing = false
    })

    const build = new SceneBuilder(createCoreRuntimeCatalog().validationSnapshot(), { createdAt: '2026-11-27T00:00:00.000Z' })
      .build(createAutoSyncScene())
    expect(build.ok).toBe(true)
    if (!build.ok) return
    const root = document.createElement('main')
    document.body.append(root)
    const resources = build.compiledScene.resources.entries
    const catalog = createCoreRuntimeCatalog()
    runner = new HtmlPlayerRunner({
      id: 'media-auto-sync-test',
      compiledScene: build.compiledScene,
      root,
      catalog,
      engine: new RuntimeEngine(catalog, { resources: resources.map((resource) => resource.url) }),
      resources: resources.map((resource) => resource.url),
      resourceMetadata: Object.fromEntries(resources.map((resource) => [resource.url, { type: resource.type }])),
      functions: build.functions,
    })
    expect(runner.init().ok).toBe(true)

    const video = root.querySelector('video')!
    const parent = video.parentNode
    Object.defineProperty(video, 'paused', { configurable: true, get: () => !playing })
    Object.defineProperty(video, 'currentTime', {
      configurable: true,
      get: () => currentSeconds,
      set: (value: number) => {
        positionWrites.push(value)
        currentSeconds = value
      },
    })

    runner.play()
    runner.advance(0)
    expect(playCalls).not.toContain(video)
    pauseCalls.length = 0 // Initial synchronization may park the node; only later pauses matter.

    runner.advance(START_AT_MS)
    expect(playCalls.filter((node) => node === video)).toHaveLength(1)

    // The native clock now runs by itself: later presentation frames only observe it.
    currentSeconds = 1.5
    runner.advance(3000)
    runner.advance(4000)
    expect(playCalls.filter((node) => node === video)).toHaveLength(1)
    expect(pauseCalls.filter((node) => node === video)).toHaveLength(0)
    expect(positionWrites).toEqual([])
    expect(currentSeconds).toBe(1.5)
    expect(video.parentNode).toBe(parent)
  })
})

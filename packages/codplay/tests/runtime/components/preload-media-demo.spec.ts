/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createCoreRuntimeCatalog } from '../../../src/runtime/catalog'
import { RuntimeEngine } from '../../../src/runtime/engine'
import { MediaComponent } from '../../../src/runtime/components/media'
import { createRuntimePreloadMediaHandle } from '../../../src/runtime/preload'
import { HtmlPlayerRunner } from '../../../src/runtime/runner-html'
import { SceneBuilder } from '../../../src/scene/compiled'
import { createScene } from '../../../../demos/src/v2/demos/preload-media/main'

const VIDEO_SRC = '/assets/LcXkmXyuZQ.mp4'

/** Builds the V2 media fixture with the same catalog used by the browser demo. */
function buildPreloadMediaScene() {
  return new SceneBuilder(createCoreRuntimeCatalog().validationSnapshot(), {
    createdAt: '2026-08-29T00:00:00.000Z',
  }).build(createScene())
}

describe('preload-media V2 demo', () => {
  let runner: HtmlPlayerRunner | undefined
  let releasePreloadedMedia = (): void => undefined

  afterEach(() => {
    runner?.destroy()
    runner = undefined
    releasePreloadedMedia()
    releasePreloadedMedia = (): void => undefined
    vi.restoreAllMocks()
    document.body.replaceChildren()
  })

  it('presents the media timeline through the V2 runtime', () => {
    const result = buildPreloadMediaScene()
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const root = document.createElement('main')
    document.body.append(root)
    const mediaUpdates = vi.spyOn(MediaComponent.prototype, 'update')
    const mediaSeeks = vi.spyOn(MediaComponent.prototype, 'seekTo')
    const playCalls: HTMLMediaElement[] = []
    const pauseCalls: HTMLMediaElement[] = []
    let videoPlaying = false
    let videoCurrentTimeSeconds = 0
    const videoCurrentTimeWrites: number[] = []
    const preloadedVideo = document.createElement('video')
    preloadedVideo.src = VIDEO_SRC
    preloadedVideo.style.cssText = 'position:absolute;width:0;height:0;opacity:0;pointer-events:none'
    document.body.append(preloadedVideo)
    const preloadedMedia = createRuntimePreloadMediaHandle(preloadedVideo, 'video')
    releasePreloadedMedia = preloadedMedia.release
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
      playCalls.push(this)
      if (this.tagName === 'VIDEO' && this.getAttribute('src') === VIDEO_SRC) videoPlaying = true
      return Promise.resolve()
    })
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
      pauseCalls.push(this)
      if (this.tagName === 'VIDEO' && this.getAttribute('src') === VIDEO_SRC) videoPlaying = false
    })
    const resources = result.compiledScene.resources.entries
    const resourceMetadata = Object.fromEntries(resources.map((resource) => [resource.url, { type: resource.type }]))
    const catalog = createCoreRuntimeCatalog()
    const engine = new RuntimeEngine(catalog, { resources: resources.map((resource) => resource.url) })
    runner = new HtmlPlayerRunner({
      id: 'v2-preload-media-demo-test',
      compiledScene: result.compiledScene,
      root,
      rootTargets: [{ id: 'root-host', storyId: 'main' }],
      catalog,
      engine,
      resources: resources.map((resource) => resource.url),
      resourceMetadata,
      resourceMedia: { [VIDEO_SRC]: preloadedMedia },
      functions: result.functions,
    })

    expect(runner.init().ok).toBe(true)

    const layout = runner.getPersoNode('main:media-container') as HTMLElement
    expect(layout.querySelectorAll('.preload-media-cell')).toHaveLength(4)

    const audioRoot = runner.getPersoNode('main:media-audio') as HTMLElement
    const videoRoot = runner.getPersoNode('main:media-video') as HTMLElement
    expect(audioRoot.querySelector('audio')).not.toBeNull()
    expect(audioRoot.querySelector('audio')?.style.display).toBe('none')
    const video = videoRoot.querySelector('video')
    expect(video).not.toBeNull()
    if (video === null) return
    expect(video).toBe(preloadedVideo)
    expect(video.parentNode).not.toBeNull()
    expect(videoRoot.parentNode).not.toBeNull()
    if (video.parentNode === null || videoRoot.parentNode === null) return
    const initialVideoParent = video.parentNode
    const initialVideoRootParent = videoRoot.parentNode
    const appendVideoRoot = vi.spyOn(initialVideoRootParent, 'appendChild')
    const removeVideoRoot = vi.spyOn(initialVideoRootParent, 'removeChild')
    expect(video?.style.display).toBe('block')
    expect(video?.style.objectFit).toBe('cover')
    expect(video?.hasAttribute('controls')).toBe(true)
    Object.defineProperty(video, 'paused', {
      configurable: true,
      get: () => !videoPlaying,
    })
    Object.defineProperty(video, 'currentTime', {
      configurable: true,
      get: () => videoCurrentTimeSeconds,
      set: (value: number) => {
        videoCurrentTimeWrites.push(value)
        videoCurrentTimeSeconds = value
      },
    })

    const imageA = runner.getPersoNode('main:media-img-a') as HTMLElement
    const imageB = runner.getPersoNode('main:media-img-b') as HTMLElement
    expect(imageA.querySelector('img')?.getAttribute('src')).toBe('/assets/35c8ec5a07fc.jpg')
    expect(imageB.querySelector('img')?.getAttribute('src')).toBe('/assets/28970388742_2f75d527d6_z.jpg')
    expect(imageA.style.opacity).toBe('0')
    expect(imageB.style.opacity).toBe('0')

    runner.play()
    runner.advance(0)
    expect(playCalls).not.toContain(video)
    mediaSeeks.mockClear()
    pauseCalls.length = 0

    runner.advance(2_000)
    expect(playCalls).toContain(video)
    expect(mediaSeeks).toHaveBeenCalledTimes(1)
    expect(videoCurrentTimeWrites).toEqual([])
    const videoUpdatesAtPlaybackStart = mediaUpdates.mock.calls.filter(
      ([input]) => input.state.src === VIDEO_SRC,
    )
    expect(videoUpdatesAtPlaybackStart.map(([input]) => input.timeMs)).toEqual([0, 2_000])

    runner.advance(3_000)
    videoCurrentTimeSeconds = 1.5
    runner.advance(4_000)
    expect(imageA.style.opacity).toBe('1')

    runner.advance(5_000)
    expect(imageB.style.opacity).toBe('1')
    expect(mediaSeeks).toHaveBeenCalledTimes(1)
    expect(playCalls.filter((node) => node === video)).toHaveLength(1)
    expect(pauseCalls.filter((node) => node === video)).toHaveLength(0)
    expect(videoCurrentTimeSeconds).toBe(1.5)
    expect(video.parentNode).toBe(initialVideoParent)
    expect(videoRoot.parentNode).toBe(initialVideoRootParent)
    expect(appendVideoRoot).not.toHaveBeenCalled()
    expect(removeVideoRoot).not.toHaveBeenCalled()
    expect(mediaUpdates.mock.calls.filter(([input]) => input.state.src === VIDEO_SRC)).toHaveLength(
      videoUpdatesAtPlaybackStart.length,
    )
  })
})

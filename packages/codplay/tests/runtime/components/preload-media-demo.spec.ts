/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createCoreRuntimeCatalog } from '../../../src/runtime/catalog'
import { HtmlPlayerRunner } from '../../../src/runtime/runner-html'
import { SceneBuilder } from '../../../src/scene/compiled'
import { createScene, SCENE_DURATION_MS } from '../../../../demos/src/v2/demos/preload-media/main'

/** Builds the V2 media fixture with the same catalog used by the browser demo. */
function buildPreloadMediaScene() {
  return new SceneBuilder(createCoreRuntimeCatalog().validationSnapshot(), {
    createdAt: '2026-08-29T00:00:00.000Z',
  }).build(createScene())
}

describe('preload-media V2 demo', () => {
  let runner: HtmlPlayerRunner | undefined

  afterEach(() => {
    runner?.destroy()
    runner = undefined
    vi.restoreAllMocks()
    document.body.replaceChildren()
  })

  it('compiles the V1 media timeline and derives every preload resource', () => {
    const result = buildPreloadMediaScene()

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.compiledScene.resources.entries).toEqual([
      expect.objectContaining({ url: '/assets/uBMXdJ0AyY.mp3', type: 'audio' }),
      expect.objectContaining({ url: '/assets/LcXkmXyuZQ.mp4', type: 'video' }),
      expect.objectContaining({ url: '/assets/35c8ec5a07fc.jpg', type: 'image' }),
      expect.objectContaining({ url: '/assets/28970388742_2f75d527d6_z.jpg', type: 'image' }),
    ])
    expect(result.compiledScene.scene.stories.main?.eventimes).toEqual([
      { name: 'media:audio:start', startAt: 0 },
      { name: 'media:video:start', startAt: 2_000 },
      { name: 'media:img-a:show', startAt: 4_000 },
      { name: 'media:img-b:show', startAt: 5_000 },
      { name: 'sequence:end', startAt: SCENE_DURATION_MS },
    ])
  })

  it('materializes the layout, native media nodes, and timed image states through V2', () => {
    const result = buildPreloadMediaScene()
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const root = document.createElement('main')
    document.body.append(root)
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    const resources = result.compiledScene.resources.entries
    const resourceMetadata = Object.fromEntries(resources.map((resource) => [resource.url, { type: resource.type }]))
    const catalog = createCoreRuntimeCatalog()
    runner = new HtmlPlayerRunner({
      id: 'v2-preload-media-demo-test',
      compiledScene: result.compiledScene,
      root,
      rootTargets: [{ id: 'root-host', storyId: 'main' }],
      catalog,
      resources: resources.map((resource) => resource.url),
      resourceMetadata,
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
    expect(video?.style.display).toBe('block')
    expect(video?.style.objectFit).toBe('cover')
    expect(video?.hasAttribute('autoplay')).toBe(false)
    expect(video?.hasAttribute('controls')).toBe(true)
    expect(videoRoot.hasAttribute('autoplay')).toBe(false)
    expect(videoRoot.hasAttribute('controls')).toBe(false)

    const imageA = runner.getPersoNode('main:media-img-a') as HTMLElement
    const imageB = runner.getPersoNode('main:media-img-b') as HTMLElement
    expect(imageA.querySelector('img')?.getAttribute('src')).toBe('/assets/35c8ec5a07fc.jpg')
    expect(imageB.querySelector('img')?.getAttribute('src')).toBe('/assets/28970388742_2f75d527d6_z.jpg')
    expect(imageA.style.opacity).toBe('0')
    expect(imageB.style.opacity).toBe('0')

    expect(runner.seek(5_000).ok).toBe(true)
    expect(imageA.style.opacity).toBe('1')
    expect(imageB.style.opacity).toBe('1')
  })
})

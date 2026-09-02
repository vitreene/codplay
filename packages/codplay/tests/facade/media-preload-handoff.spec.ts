/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { CodPlay } from '../../src'
import { createRuntimePreloadMediaHandle } from '../../src/runtime/preload'
import { createScene } from '../../../demos/src/v2/demos/preload-media/main'

const VIDEO_SRC = '/assets/LcXkmXyuZQ.mp4'

describe('CodPlay media preload registration', () => {
  let codplay: CodPlay | undefined

  afterEach(() => {
    codplay?.destroy()
    codplay = undefined
    vi.restoreAllMocks()
    document.body.replaceChildren()
  })

  it('transfers the retained video node through resources.register to the media component', () => {
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    codplay = new CodPlay()
    const build = codplay.build({ scene: createScene() })
    expect(build.ok).toBe(true)
    if (!build.ok) return

    const root = document.createElement('main')
    document.body.append(root)
    const preloadedVideo = document.createElement('video')
    preloadedVideo.src = VIDEO_SRC
    document.body.append(preloadedVideo)
    const media = createRuntimePreloadMediaHandle(preloadedVideo, 'video')
    const resources = build.compiledScene.resources.entries

    codplay.resources.register({
      loaded: resources.map((resource) => resource.url),
      skipped: [],
      metadata: Object.fromEntries(resources.map((resource) => [resource.url, { type: resource.type }])),
      media: { [VIDEO_SRC]: media },
    })
    media.release()
    codplay.instances.create({
      instanceId: 'preload-handoff',
      compiledScene: build.compiledScene,
      functions: build.functions,
      root,
    })

    expect(root.querySelector('video')).toBe(preloadedVideo)
  })
})

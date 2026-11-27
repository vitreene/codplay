/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { CodPlay } from '../../src'
import { createRuntimePreloadMediaHandle } from '../../src/runtime/preload'
import type { SceneDoc } from '../../src/scene/types'

const VIDEO_SRC = '/media/handoff.mp4'

/** Declares one video component whose source is a compiled scene resource. */
function createVideoScene(): SceneDoc<string> {
  return {
    id: 'preload-handoff-scene',
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: 'video',
          type: 'media',
          initial: { move: '@root', tag: 'video', src: VIDEO_SRC },
          actions: {},
        }],
        eventimes: [],
      },
    },
  }
}

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
    const build = codplay.build({ scene: createVideoScene() })
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

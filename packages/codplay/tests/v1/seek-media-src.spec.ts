// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { PlayerFacade } from '../../src/player/create-player'
import type { SceneDoc } from '../../src/player/types'

const SRC_A = '/a.mp4'
const SRC_B = '/b.mp4'

/**
 * Media perso whose src is swapped by an action at 1000ms.
 */
function createMediaSwapSceneFixture(): SceneDoc {
  return {
    id: 'scene-media-src-seek',
    rootStories: ['story-main'],
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      'story-main': {
        id: 'story-main',
        name: 'main',
        entries: ['story-main__media'],
        initial: undefined,
        persos: [
          {
            id: 'story-main__media',
            name: 'media',
            type: 'media',
            initial: { tag: 'video', src: SRC_A, master: false },
            actions: { swap: { src: SRC_B } }
          }
        ],
        straps: undefined,
        listen: [],
        eventimes: [{ name: 'swap', startAt: 1000 }]
      }
    },
    init(scene, options) {
      options.mount(scene.rootStories[0])
    },
    onStart(scene, options) {
      options.schedule(scene.rootStories[0])
    },
    tracks: {}
  }
}

function readMediaSrc(root: HTMLElement | null): string | null {
  return root?.querySelector('video')?.getAttribute('src') ?? null
}

describe('V1 - seek reconstructs media src (node-per-src)', () => {
  it('restores the authored initial media src when seeking back before a swap', async () => {
    const player = new PlayerFacade({})

    expect(await player.init(createMediaSwapSceneFixture())).toEqual({ ok: true })
    expect(await player.play()).toEqual({ ok: true })

    const root = player.getRuntimeRegistry().getNodeById('story-main__media') as HTMLElement | null
    expect(root).not.toBeNull()
    expect(readMediaSrc(root)).toBe(SRC_A)

    // Past the swap.
    expect(await player.seek(2000)).toEqual({ ok: true })
    expect(root?.querySelectorAll('video').length).toBe(1)
    expect(readMediaSrc(root)).toBe(SRC_B)

    // Back before the swap: the initial media node is re-attached.
    expect(await player.seek(0)).toEqual({ ok: true })
    expect(root?.querySelectorAll('video').length).toBe(1)
    expect(readMediaSrc(root)).toBe(SRC_A)
  })
})

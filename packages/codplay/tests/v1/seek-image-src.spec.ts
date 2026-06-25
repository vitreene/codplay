// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { PlayerFacade } from '../../src/player/create-player'
import type { SceneDoc } from '../../src/player/types'

const SRC_A = '/a.jpg'
const SRC_B = '/b.jpg'

/**
 * Scene with one image perso whose src is swapped by an action at 1000ms.
 * Used to verify seek reconstructs the authored initial src when seeking back
 * before the swap.
 */
function createImageSwapSceneFixture(): SceneDoc {
  return {
    id: 'scene-image-src-seek',
    rootStories: ['story-main'],
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      'story-main': {
        id: 'story-main',
        name: 'main',
        entries: ['story-main__img'],
        initial: undefined,
        persos: [
          {
            id: 'story-main__img',
            name: 'img',
            type: 'img',
            initial: {
              src: SRC_A
            },
            actions: {
              swap: { src: SRC_B }
            }
          }
        ],
        straps: undefined,
        listen: [],
        eventimes: [
          { name: 'swap', startAt: 1000 }
        ]
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

function readImgSrc(root: HTMLElement | null): string | null {
  return root?.querySelector('img')?.getAttribute('src') ?? null
}

describe('V1 - seek reconstructs image src', () => {
  it('restores the authored initial src when seeking back before a src swap', async () => {
    const player = new PlayerFacade({})

    expect(await player.init(createImageSwapSceneFixture())).toEqual({ ok: true })
    expect(await player.play()).toEqual({ ok: true })

    const root = player.getRuntimeRegistry().getNodeById('story-main__img') as HTMLElement | null
    expect(root).not.toBeNull()
    expect(readImgSrc(root)).toBe(SRC_A)

    // Seek past the swap: the action applies SRC_B.
    expect(await player.seek(2000)).toEqual({ ok: true })
    expect(readImgSrc(root)).toBe(SRC_B)

    // Seek back before the swap: no swap event is due, so the img must return to SRC_A.
    expect(await player.seek(0)).toEqual({ ok: true })
    expect(readImgSrc(root)).toBe(SRC_A)
  })

  it('does not reassign a stable src across repeated seeks (decode preserved)', async () => {
    const player = new PlayerFacade({})

    expect(await player.init(createImageSwapSceneFixture())).toEqual({ ok: true })
    expect(await player.play()).toEqual({ ok: true })

    const root = player.getRuntimeRegistry().getNodeById('story-main__img') as HTMLElement | null
    const img = root?.querySelector('img') as HTMLImageElement | null
    expect(img).not.toBeNull()
    if (img === null) {
      return
    }

    // Count actual src reassignments (a reassignment is what restarts decode).
    let srcWrites = 0
    const descriptor = Object.getOwnPropertyDescriptor(
      globalThis.HTMLImageElement.prototype,
      'src'
    )
    Object.defineProperty(img, 'src', {
      get() {
        return descriptor?.get?.call(img)
      },
      set(value: string) {
        srcWrites += 1
        descriptor?.set?.call(img, value)
      },
      configurable: true
    })

    // Scrub within the stable initial region: src stays SRC_A, so it must never be reassigned.
    for (let i = 0; i < 5; i++) {
      expect(await player.seek(0)).toEqual({ ok: true })
    }

    expect(readImgSrc(root)).toBe(SRC_A)
    expect(srcWrites).toBe(0)
  })

  it('does not reassign a stable src across repeated seeks in a post-mutation region', async () => {
    const player = new PlayerFacade({})

    expect(await player.init(createImageSwapSceneFixture())).toEqual({ ok: true })
    expect(await player.play()).toEqual({ ok: true })

    const root = player.getRuntimeRegistry().getNodeById('story-main__img') as HTMLElement | null
    const img = root?.querySelector('img') as HTMLImageElement | null
    expect(img).not.toBeNull()
    if (img === null) {
      return
    }

    // Land in the post-mutation region first (src becomes SRC_B), then start counting.
    expect(await player.seek(2000)).toEqual({ ok: true })
    expect(readImgSrc(root)).toBe(SRC_B)

    let srcWrites = 0
    const descriptor = Object.getOwnPropertyDescriptor(
      globalThis.HTMLImageElement.prototype,
      'src'
    )
    Object.defineProperty(img, 'src', {
      get() {
        return descriptor?.get?.call(img)
      },
      set(value: string) {
        srcWrites += 1
        descriptor?.set?.call(img, value)
      },
      configurable: true
    })

    // Repeated seeks within the post-mutation region must not churn the src: the replayed
    // swap reapplies SRC_B idempotently and the deferred commit does not touch it.
    for (let i = 0; i < 5; i++) {
      expect(await player.seek(2000)).toEqual({ ok: true })
    }

    expect(readImgSrc(root)).toBe(SRC_B)
    expect(srcWrites).toBe(0)
  })

  it('attaches one node per active src and reuses the same persistent node on return', async () => {
    const player = new PlayerFacade({})

    expect(await player.init(createImageSwapSceneFixture())).toEqual({ ok: true })
    expect(await player.play()).toEqual({ ok: true })

    const root = player.getRuntimeRegistry().getNodeById('story-main__img') as HTMLElement | null
    expect(root).not.toBeNull()
    if (root === null) {
      return
    }

    // Exactly one img attached, showing SRC_A.
    expect(root.querySelectorAll('img').length).toBe(1)
    const aNode = root.querySelector('img')
    expect(aNode?.getAttribute('src')).toBe(SRC_A)

    // Past the swap: still one img attached, a different node, showing SRC_B.
    expect(await player.seek(2000)).toEqual({ ok: true })
    expect(root.querySelectorAll('img').length).toBe(1)
    const bNode = root.querySelector('img')
    expect(bNode?.getAttribute('src')).toBe(SRC_B)
    expect(bNode).not.toBe(aNode)

    // Back before the swap: the original SRC_A node is re-attached (decode preserved, not recreated).
    expect(await player.seek(0)).toEqual({ ok: true })
    expect(root.querySelectorAll('img').length).toBe(1)
    expect(root.querySelector('img')).toBe(aNode)

    // Forward again: the same SRC_B node is re-attached.
    expect(await player.seek(2000)).toEqual({ ok: true })
    expect(root.querySelector('img')).toBe(bNode)
  })
})

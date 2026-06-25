// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { PlayerFacade } from '../../src/player/create-player'
import type { SceneDoc } from '../../src/player/types'

/**
 * Scene with a layout entry (grid) and a child moved into it. Built without a
 * nodeFactory so the runtime creates real DOM nodes (jsdom), exercising the same
 * detach/attach paths a browser would and the decode-sensitive media case.
 */
function createGridChildSceneFixture(): SceneDoc {
  return {
    id: 'scene-seek-no-detach',
    rootStories: ['story-main'],
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      'story-main': {
        id: 'story-main',
        name: 'main',
        entries: ['story-main__grid'],
        initial: undefined,
        persos: [
          {
            id: 'story-main__grid',
            name: 'grid',
            type: 'layout',
            initial: {
              markup: '<div></div>'
            },
            actions: {}
          },
          {
            id: 'story-main__child',
            name: 'child',
            type: 'tag',
            initial: {
              move: { parentId: 'story-main__grid' },
              tag: 'p',
              content: 'child'
            },
            actions: {
              'child:flash': {
                className: { add: 'flashed' }
              }
            }
          }
        ],
        straps: undefined,
        listen: [],
        eventimes: [
          {
            name: 'child:flash',
            startAt: 0
          }
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

describe('V1 - seek leaves unchanged nodes attached', () => {
  it('never removes/re-appends a stable child from its parent across repeated seeks', async () => {
    const player = new PlayerFacade({})

    expect(await player.init(createGridChildSceneFixture())).toEqual({ ok: true })
    expect(await player.play()).toEqual({ ok: true })

    const registry = player.getRuntimeRegistry()
    const grid = registry.getNodeById('story-main__grid') as HTMLElement | null
    const child = registry.getNodeById('story-main__child') as HTMLElement | null
    expect(grid).not.toBeNull()
    expect(child).not.toBeNull()
    if (grid === null || child === null) {
      return
    }

    // Child is attached to its grid parent after initial mount.
    expect(child.parentNode).toBe(grid)

    // Spy the parent's DOM mutations for THIS child. A detach is grid.removeChild(child);
    // a redundant re-append is grid.appendChild(child) (which detaches+reinserts in the DOM
    // and interrupts an in-flight <img>/<video> decode). Both must be zero on a stable seek.
    let removeCount = 0
    let appendCount = 0
    const realRemove = grid.removeChild.bind(grid)
    const realAppend = grid.appendChild.bind(grid)
    grid.removeChild = ((node: Node) => {
      if (node === child) removeCount += 1
      return realRemove(node as never)
    }) as typeof grid.removeChild
    grid.appendChild = ((node: Node) => {
      if (node === child) appendCount += 1
      return realAppend(node as never)
    }) as typeof grid.appendChild

    // A burst of seeks (mimics slider scrubbing).
    for (let i = 0; i < 5; i++) {
      expect(await player.seek(0)).toEqual({ ok: true })
    }

    // Node identity preserved and still attached to the same parent.
    expect(registry.getNodeById('story-main__child')).toBe(child)
    expect(child.parentNode).toBe(grid)
    // The core guarantee: zero DOM churn on the unchanged child across the whole burst.
    expect(removeCount).toBe(0)
    expect(appendCount).toBe(0)
  })
})

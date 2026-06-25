// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { PlayerFacade } from '../../src/player/create-player'
import type { SceneDoc } from '../../src/player/types'

/**
 * Text perso inside a layout cell, replaced A->B at 1500 with a simple (clone-based) transition.
 */
function createTextReplaceSceneFixture(): SceneDoc {
  return {
    id: 'scene-text-replace',
    rootStories: ['story-main'],
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      'story-main': {
        id: 'story-main',
        name: 'main',
        entries: ['cell', 'txt'],
        initial: undefined,
        persos: [
          {
            id: 'cell',
            name: 'cell',
            type: 'layout',
            initial: { markup: '<div><span data-part="cell:slot"></span></div>' },
            actions: { cell: null }
          },
          {
            id: 'txt',
            name: 'txt',
            type: 'tag',
            initial: { move: { parentId: 'cell:slot' }, tag: 'p', content: 'A' },
            actions: {
              swap: { content: 'B', replace: { transition: 'swipe-left', duration: 500 } }
            }
          }
        ],
        straps: undefined,
        listen: [],
        eventimes: [{ name: 'swap', startAt: 1500 }]
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

function cloneCount(): number {
  return globalThis.document.querySelectorAll('[id$="-clone-outro"], [id$="-clone-intro"]').length
}

describe('V1 - replace transition clones do not leak across seeks', () => {
  it('leaves no residual clone after repeated round-trips through the transition', async () => {
    const player = new PlayerFacade()

    expect(await player.init(createTextReplaceSceneFixture())).toEqual({ ok: true })
    expect(await player.play()).toEqual({ ok: true })

    // Round-trips landing inside the transition window (1500..2000) then before it.
    for (let i = 0; i < 6; i++) {
      expect(await player.seek(1700)).toEqual({ ok: true })
      expect(await player.seek(0)).toEqual({ ok: true })
    }

    // At rest before the transition, no clone should remain.
    expect(cloneCount()).toBe(0)
  })
})

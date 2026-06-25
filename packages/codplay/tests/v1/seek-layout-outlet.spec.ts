// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { PlayerFacade } from '../../src/player/create-player'
import type { SceneDoc } from '../../src/player/types'

/**
 * Layout with one declared outlet, a child moved into it, and an event to allow seeking.
 */
function createLayoutOutletSceneFixture(): SceneDoc {
  return {
    id: 'scene-layout-seek',
    rootStories: ['story-main'],
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      'story-main': {
        id: 'story-main',
        name: 'main',
        entries: ['scene-layout', 'story-main__title'],
        initial: undefined,
        persos: [
          {
            id: 'scene-layout',
            name: 'layout',
            type: 'layout',
            initial: {
              markup: '<section class="shell"><main data-part="scene-layout:slot"></main></section>'
            },
            actions: { 'scene-layout': null }
          },
          {
            id: 'story-main__title',
            name: 'title',
            type: 'tag',
            initial: { move: { parentId: 'scene-layout:slot' }, content: 'hello' },
            actions: { tick: { content: 'world' } }
          }
        ],
        straps: undefined,
        listen: [],
        eventimes: [{ name: 'tick', startAt: 1000 }]
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

describe('V1 - layout outlet survives seek', () => {
  it('does not warn AUTHOR_LAYOUT_OUTLET_NOT_FOUND across repeated seeks', async () => {
    const player = new PlayerFacade()
    const warnings: string[] = []
    player.onTrace((row: { eventName: string; payload?: Record<string, unknown> }) => {
      if (
        row.eventName === 'renderer:error' &&
        row.payload?.['code'] === 'AUTHOR_LAYOUT_OUTLET_NOT_FOUND'
      ) {
        warnings.push(String(row.payload?.['persoId']))
      }
    })

    expect(await player.init(createLayoutOutletSceneFixture())).toEqual({ ok: true })
    expect(await player.play()).toEqual({ ok: true })

    for (let i = 0; i < 3; i++) {
      expect(await player.seek(2000)).toEqual({ ok: true })
      expect(await player.seek(0)).toEqual({ ok: true })
    }

    const slot = player.getRuntimeRegistry().getNodeById('scene-layout:slot') as Element | null
    const title = player.getRuntimeRegistry().getNodeById('story-main__title') as Element | null
    expect(title?.parentNode).toBe(slot)
    expect(warnings).toEqual([])
  })
})

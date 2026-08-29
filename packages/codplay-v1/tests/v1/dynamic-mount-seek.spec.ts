// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { PlayerFacade } from '../../src/player/create-player'
import type { SceneDoc } from '../../src/player/types'

/**
 * Same shape as move-off-detach.spec.ts's fixture, but `panel` has NO static
 * `initial.move` at all and is not listed in `entries` — its only attachment
 * ever comes from track-driven actions (`attach`/`detach`), exactly the
 * pattern used by quiz-hunt's trial/final panels. See
 * 2026-06-29-entries-removal-and-dynamic-move-seek-plan.md, défaut 2: before
 * the fix, a perso with no static `initial.move` was never reset to any
 * baseline by `loadPersos`, so a seek landing before its first ever attach
 * event left it frozen at whatever attachment state a prior live session had
 * produced.
 */
function createDynamicMountSceneFixture(): SceneDoc {
  return {
    id: 'scene-dynamic-mount',
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      'story-main': {
        id: 'story-main',
        name: 'main',
        initial: { move: '@root' },
        persos: [
          {
            id: 'scene-layout',
            name: 'layout',
            type: 'layout',
            initial: {
              move: '@root',
              markup: '<section class="container"><main data-part="scene-layout:slot"></main></section>'
            },
            actions: { 'scene-layout': null }
          },
          {
            id: 'panel',
            name: 'panel',
            type: 'tag',
            initial: { content: 'hello' },
            actions: {
              attach: { move: { parentId: 'scene-layout:slot' } },
              detach: { move: '@off' }
            }
          }
        ],
        straps: undefined,
        listen: [],
        eventimes: [
          { name: 'attach', startAt: 1000 },
          { name: 'detach', startAt: 1500 }
        ]
      }
    },
    onStart(scene, options) {
      options.schedule('story-main')
    },
    tracks: {}
  }
}

describe('V1 - seek reconstructs a perso whose attachment is entirely track-driven (no static initial.move)', () => {
  it('starts detached: no initial.move means no attachment at all before the first attach event', async () => {
    const player = new PlayerFacade()
    expect(await player.init(createDynamicMountSceneFixture())).toEqual({ ok: true })
    expect(await player.play()).toEqual({ ok: true })

    const panelNode = player.getRuntimeRegistry().getNodeById('panel') as Element
    expect(panelNode.parentNode).toBeNull()
    expect(player.getRuntimeRegistry().isMounted('panel')).toBe(false)
  })

  it('reconstructs attached/detached state on seek exactly like a perso with a static initial.move', async () => {
    const player = new PlayerFacade()
    expect(await player.init(createDynamicMountSceneFixture())).toEqual({ ok: true })
    expect(await player.play()).toEqual({ ok: true })

    const slot = player.getRuntimeRegistry().getNodeById('scene-layout:slot') as Element

    // Cold seek directly into the attached window: attached.
    expect(await player.seek(1200)).toEqual({ ok: true })
    expect((player.getRuntimeRegistry().getNodeById('panel') as Element).parentNode).toBe(slot)
    expect(player.getRuntimeRegistry().isMounted('panel')).toBe(true)

    // Cold seek into the detached window (after `detach`): detached again.
    expect(await player.seek(1600)).toEqual({ ok: true })
    expect((player.getRuntimeRegistry().getNodeById('panel') as Element).parentNode).toBeNull()
    expect(player.getRuntimeRegistry().isMounted('panel')).toBe(false)

    // Seeking back into the attached window from there: attached again, same node.
    const panelNodeBeforeReattach = player.getRuntimeRegistry().getNodeById('panel')
    expect(await player.seek(1200)).toEqual({ ok: true })
    expect(player.getRuntimeRegistry().getNodeById('panel')).toBe(panelNodeBeforeReattach)
    expect((player.getRuntimeRegistry().getNodeById('panel') as Element).parentNode).toBe(slot)
    expect(player.getRuntimeRegistry().isMounted('panel')).toBe(true)
  })

  it('seeking before the very first attach event detaches a perso that a prior live session left attached', async () => {
    const player = new PlayerFacade()
    expect(await player.init(createDynamicMountSceneFixture())).toEqual({ ok: true })
    expect(await player.play()).toEqual({ ok: true })

    // Real, live replay through the attach event: panel becomes attached.
    expect(await player.seek(1200)).toEqual({ ok: true })
    expect(player.getRuntimeRegistry().isMounted('panel')).toBe(true)

    // Seek back to before the attach event ever fired. There is no static
    // initial.move to fall back to and no due event establishes any parent —
    // the resolved state is "never attached", which must detach the node,
    // not leave it frozen at the live state from the previous seek.
    expect(await player.seek(0)).toEqual({ ok: true })
    expect((player.getRuntimeRegistry().getNodeById('panel') as Element).parentNode).toBeNull()
    expect(player.getRuntimeRegistry().isMounted('panel')).toBe(false)
  })
})

// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'

import { PlayerFacade } from '../../src/player/create-player'
import type { SceneDoc } from '../../src/player/types'

/**
 * Layout with one outlet, and a content perso attached to it, detached via
 * `move:"@off"` then reattached — the minimal shape exercised by Phase 3 of
 * 2026-06-28-unify-action-execution-and-move-off-plan.md.
 */
function createMoveOffSceneFixture(): SceneDoc {
  return {
    id: 'scene-move-off',
    rootStories: ['story-main'],
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      'story-main': {
        id: 'story-main',
        name: 'main',
        initial: undefined,
        persos: [
          {
            id: 'scene-layout',
            name: 'layout',
            type: 'layout',
            initial: {
              move: '@root',
              markup: '<section class="shell"><main data-part="scene-layout:slot"></main></section>'
            },
            actions: { 'scene-layout': null }
          },
          {
            id: 'panel',
            name: 'panel',
            type: 'tag',
            initial: { move: { parentId: 'scene-layout:slot' }, content: 'hello' },
            actions: {
              detach: { move: '@off' },
              attach: { move: { parentId: 'scene-layout:slot' } }
            }
          }
        ],
        straps: undefined,
        listen: [],
        eventimes: [
          { name: 'detach', startAt: 500 },
          { name: 'attach', startAt: 1000 }
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

/**
 * Same shape as `createMoveOffSceneFixture`, but `detach` is a perso-level
 * `ActionSequence` chaining a TweenAction fade into `move:"@off"` — the exact
 * shape used by the dedicated move-off demo. Exercises the seek mounted-state
 * pre-pass's ability to decompose a sequence it has never replayed before.
 */
function createMoveOffSequenceSceneFixture(): SceneDoc {
  return {
    id: 'scene-move-off-sequence',
    rootStories: ['story-main'],
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      'story-main': {
        id: 'story-main',
        name: 'main',
        initial: undefined,
        persos: [
          {
            id: 'scene-layout',
            name: 'layout',
            type: 'layout',
            initial: {
              move: '@root',
              markup: '<section class="shell"><main data-part="scene-layout:slot"></main></section>'
            },
            actions: { 'scene-layout': null }
          },
          {
            id: 'panel',
            name: 'panel',
            type: 'tag',
            initial: { move: { parentId: 'scene-layout:slot' }, content: 'hello', style: { opacity: '1' } },
            actions: {
              detach: [
                { action: { fn: ({ progress }: { progress: number }) => ({ style: { opacity: String(1 - progress) } }), duration: 200 } },
                { action: { move: '@off' } }
              ],
              attach: { move: { parentId: 'scene-layout:slot' }, style: { opacity: '1' } }
            }
          }
        ],
        straps: undefined,
        listen: [],
        eventimes: [
          { name: 'detach', startAt: 500 },
          { name: 'attach', startAt: 1500 }
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
  } as unknown as SceneDoc
}

describe('V1 - move:"@off" explicit DOM detachment', () => {
  it('detaches the node physically (not just bookkeeping) and emits no missing-outlet warning', async () => {
    const player = new PlayerFacade()
    const warnings: string[] = []
    player.onTrace((row: { eventName: string; payload?: Record<string, unknown> }) => {
      if (row.eventName === 'renderer:error' && row.payload?.['code'] === 'AUTHOR_LAYOUT_OUTLET_NOT_FOUND') {
        warnings.push(String(row.payload?.['persoId']))
      }
    })

    expect(await player.init(createMoveOffSceneFixture())).toEqual({ ok: true })
    expect(await player.play()).toEqual({ ok: true })

    const slot = player.getRuntimeRegistry().getNodeById('scene-layout:slot') as Element
    const panelNode = player.getRuntimeRegistry().getNodeById('panel') as Element
    expect(panelNode.parentNode).toBe(slot)

    expect(await player.seek(700)).toEqual({ ok: true })

    expect(panelNode.parentNode).toBeNull()
    expect(player.getRuntimeRegistry().isMounted('panel')).toBe(false)
    expect(warnings).toEqual([])
  })

  it('reattaches using the same node (no recreation) and the same parentId chain resolves through the outlet', async () => {
    const player = new PlayerFacade()
    expect(await player.init(createMoveOffSceneFixture())).toEqual({ ok: true })
    expect(await player.play()).toEqual({ ok: true })

    const panelNodeBeforeDetach = player.getRuntimeRegistry().getNodeById('panel')
    const panelComponent = player.getRuntimeRegistry().getComponentById('panel')

    expect(await player.seek(700)).toEqual({ ok: true })
    expect(await player.seek(1500)).toEqual({ ok: true })

    const slot = player.getRuntimeRegistry().getNodeById('scene-layout:slot') as Element
    const panelNodeAfterReattach = player.getRuntimeRegistry().getNodeById('panel') as Element

    expect(panelNodeAfterReattach).toBe(panelNodeBeforeDetach)
    expect(player.getRuntimeRegistry().getComponentById('panel')).toBe(panelComponent)
    expect(panelNodeAfterReattach.parentNode).toBe(slot)
    expect(player.getRuntimeRegistry().isMounted('panel')).toBe(true)
    expect(player.getRuntimeRegistry().getParentListId('panel')).toBe('scene-layout:slot')
  })

  it('reconstructs the correct attached/detached state for a seek landing before, during, or after the detach window', async () => {
    const player = new PlayerFacade()
    expect(await player.init(createMoveOffSceneFixture())).toEqual({ ok: true })
    expect(await player.play()).toEqual({ ok: true })

    const slot = player.getRuntimeRegistry().getNodeById('scene-layout:slot') as Element

    // Before the detach event: attached.
    expect(await player.seek(200)).toEqual({ ok: true })
    expect((player.getRuntimeRegistry().getNodeById('panel') as Element).parentNode).toBe(slot)
    expect(player.getRuntimeRegistry().isMounted('panel')).toBe(true)

    // Cold seek directly into the detached window: detached.
    expect(await player.seek(700)).toEqual({ ok: true })
    expect((player.getRuntimeRegistry().getNodeById('panel') as Element).parentNode).toBeNull()
    expect(player.getRuntimeRegistry().isMounted('panel')).toBe(false)

    // After the reattach event: attached again.
    expect(await player.seek(1500)).toEqual({ ok: true })
    expect((player.getRuntimeRegistry().getNodeById('panel') as Element).parentNode).toBe(slot)
    expect(player.getRuntimeRegistry().isMounted('panel')).toBe(true)

    // Seeking back into the detached window from a later, attached position: detached again.
    expect(await player.seek(800)).toEqual({ ok: true })
    expect((player.getRuntimeRegistry().getNodeById('panel') as Element).parentNode).toBeNull()
    expect(player.getRuntimeRegistry().isMounted('panel')).toBe(false)

    // And seeking back before the detach event from there: attached again.
    expect(await player.seek(100)).toEqual({ ok: true })
    expect((player.getRuntimeRegistry().getNodeById('panel') as Element).parentNode).toBe(slot)
    expect(player.getRuntimeRegistry().isMounted('panel')).toBe(true)
  })

  it('does not refresh a detached perso while seeking within the detached window (cost reduction)', async () => {
    const player = new PlayerFacade()
    expect(await player.init(createMoveOffSceneFixture())).toEqual({ ok: true })
    expect(await player.play()).toEqual({ ok: true })

    const panelComponent = player.getRuntimeRegistry().getComponentById('panel') as { _init: () => void }
    const initSpy = vi.spyOn(panelComponent, '_init')

    expect(await player.seek(700)).toEqual({ ok: true })
    expect(initSpy).not.toHaveBeenCalled()

    expect(await player.seek(900)).toEqual({ ok: true })
    expect(initSpy).not.toHaveBeenCalled()
  })

  it('resolves a sequence-chained move:"@off" correctly on the very first seek that crosses it (cold, never replayed before)', async () => {
    const player = new PlayerFacade()
    expect(await player.init(createMoveOffSequenceSceneFixture())).toEqual({ ok: true })
    expect(await player.play()).toEqual({ ok: true })

    const panelComponent = player.getRuntimeRegistry().getComponentById('panel') as { _init: () => void }
    const initSpy = vi.spyOn(panelComponent, '_init')

    // A cold seek straight into the detached window: the `detach` ActionSequence
    // has never been replayed before, so its move:"@off" continuation step has
    // never been materialized into the track. The mounted-state pre-pass must
    // still resolve "not mounted" by decomposing the sequence itself — not by
    // relying on a continuation event that doesn't exist yet.
    expect(await player.seek(1000)).toEqual({ ok: true })

    expect((player.getRuntimeRegistry().getNodeById('panel') as Element).parentNode).toBeNull()
    expect(player.getRuntimeRegistry().isMounted('panel')).toBe(false)
    expect(initSpy).not.toHaveBeenCalled()
  })

  it('reattaches correctly on a cold seek landing exactly on a later event due in the same batch as the trigger', async () => {
    const player = new PlayerFacade()
    expect(await player.init(createMoveOffSequenceSceneFixture())).toEqual({ ok: true })
    expect(await player.play()).toEqual({ ok: true })

    // Single seek straight to ms1500: `detach` (ms500) and `attach` (ms1500) are
    // BOTH due in the SAME collectDueEvents batch, collected before either one's
    // handler runs. `detach`'s ActionSequence materializes its move:"@off"
    // continuation step (due at ms700) into the track from inside its own
    // handler — chronologically BEFORE `attach`, which is already queued in
    // this same batch. The continuation step must still be picked up (not
    // silently dropped), and `attach` must not be replayed twice.
    expect(await player.seek(1500)).toEqual({ ok: true })

    const panelNode = player.getRuntimeRegistry().getNodeById('panel') as Element
    expect(panelNode.parentNode).not.toBeNull()
    expect(player.getRuntimeRegistry().isMounted('panel')).toBe(true)
    expect(panelNode.style.opacity).toBe('1')
  })
})

import { describe, expect, it } from 'vitest'

import { PlayerFacade } from '../../src/player/create-player'
import { createDefaultAnimationAdapter } from '../../src/animation/create-default-adapter'
import type { SceneDoc } from '../../src/player/types'

/**
 * `2026-07-25-perso-state-at-t-plan.md` — end-to-end integration: a real `PlayerFacade`, a real
 * anime.js-backed `AnimationAdapter` (`createDefaultAnimationAdapter`, same as production), a real
 * `seek()`. Verifies `getPersoStates()` returns the perso's own value at `t`, matching what the
 * runtime node itself receives at the same instant — proving the two channels (node write, perso
 * state capture) stay in agreement, per the plan's fidelity requirement.
 */

function temp__createSeekSceneFixture(): SceneDoc {
  return {
    id: 'scene-perso-states',
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      'story-perso-states': {
        id: 'story-perso-states',
        initial: { move: '@root' },
        persos: [
          {
            id: 'box',
            type: 'tag',
            initial: {
              content: 'seek-box',
              move: '@root'
            },
            actions: {
              'box:move': {
                style: {
                  x: {
                    from: 0,
                    to: 100,
                    duration: 1000
                  }
                }
              }
            }
          }
        ],
        straps: undefined,
        listen: []
      }
    },
    onStart(scene, options) {
      options.schedule('story-perso-states')
    },
    tracks: {
      'track-perso-states': {
        id: 'track-perso-states',
        source: 'story',
        order: 0,
        events: [
          {
            id: 'evt-box-move',
            ms: 1000,
            name: 'box:move',
            index: 0,
            source: 'story'
          }
        ]
      }
    }
  } as unknown as SceneDoc
}

describe('V1 - Player.getPersoStates matches the real node at the same seek instant', () => {
  it('returns the perso x value matching runtimeNode.x at the transition midpoint', async () => {
    const runtimeNode: Record<string, unknown> = {
      tagName: 'DIV',
      style: {},
      attributes: {},
      x: 0
    }

    const player = new PlayerFacade({
      animationAdapter: createDefaultAnimationAdapter(),
      createElementOptions: {
        nodeFactory: () => runtimeNode
      }
    })

    await player.init(temp__createSeekSceneFixture())
    await player.play()
    await player.seek(1500)

    expect(player.getState()).toMatchObject({ status: 'paused', timelineMs: 1500 })

    // Real node received a resolved, intermediate (not 0, not 100) value from anime.js.
    expect(runtimeNode.x).toBeGreaterThan(0)
    expect(runtimeNode.x).toBeLessThan(100)

    // Perso state, captured independently (never reading `runtimeNode`), agrees with it exactly.
    const persoStates = player.getPersoStates()
    expect(persoStates.get('box')).toMatchObject({ x: runtimeNode.x })
  })

  it('returns an empty map before any seek/transition has run', async () => {
    const player = new PlayerFacade({
      animationAdapter: createDefaultAnimationAdapter(),
      createElementOptions: {
        nodeFactory: () => ({ tagName: 'DIV', style: {}, attributes: {} })
      }
    })

    await player.init(temp__createSeekSceneFixture())

    expect(player.getPersoStates().size).toBe(0)
  })
})

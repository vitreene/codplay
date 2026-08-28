// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'

import { createAnimationAdapter, type AnimeImplementation } from '../../src/animation/adapter'
import { BuilderFacade } from '../../src/builder/create-builder'
import { Player } from '../../src/player'
import type { SceneDef } from '../../src/builder/types'

/**
 * The real animation adapter (anime.js) only reaches the `to` value through genuine tween
 * ticks over `duration` — this repo's convention for asserting a resolved style value through
 * the real `Player`/`ListComponent` pipeline (not the legacy `applyResolvedActions()` synchronous
 * patch path) is to inject a fake `animeImplementation` that applies `to` immediately
 * (`tests/v1/reference-scenes.spec.ts`'s `createApplyingAnimeImplementation`) rather than waiting
 * out real interpolation in jsdom.
 */
function createApplyingAnimeImplementation() {
  return vi.fn<AnimeImplementation>((parameters) => {
    const targets = Array.isArray(parameters.targets)
      ? (parameters.targets as Record<string, unknown>[])
      : [parameters.targets as Record<string, unknown>]

    for (const target of targets) {
      if (typeof target !== 'object' || target === null) continue
      const mutableTarget = target as Record<string, unknown>
      const mutableStyle =
        typeof mutableTarget.style === 'object' && mutableTarget.style !== null
          ? (mutableTarget.style as Record<string, unknown>)
          : null

      for (const [property, value] of Object.entries(parameters)) {
        if (['targets', 'duration', 'delay', 'ease', 'composition', 'stagger', 'loopDelay', 'reversed', 'alternate', 'loop'].includes(property)) continue
        const resolvedValue = typeof value === 'object' && value !== null && 'to' in value ? (value as { to: unknown }).to : value
        if (mutableStyle !== null) mutableStyle[property] = resolvedValue
        else mutableTarget[property] = resolvedValue
      }
    }

    return { pause: vi.fn() }
  })
}

/**
 * Isolated precedent check for ed2's Builder (`2026-07-08-builder-plan.md` step 6, nested
 * capsule). Existing demos have `list`-in-`list` nesting (`chrono-story.ts`'s
 * `chrono-root -> chrono-wrapper -> chrono-needle`) but always with an inert wrapper
 * (`actions: {}`). Existing demos also have a `list` perso that self-transitions while parenting
 * children (`s4-quiz-reference-scene.ts`'s `quiz-question-panel`), but its own parent is a layout
 * outlet, not another `list`. No demo or test in this repo combines both — a `list` perso that
 * (a) is itself parented under another non-root `list` perso, AND (b) carries its own named
 * intro/outro action while ALSO parenting further children. This test builds exactly that minimal
 * combination through the real pipeline (`BuilderFacade.compile()` -> `Player.init()` ->
 * `player.emit()`) to confirm it works before the Builder relies on it.
 */
function createNestedListSceneFixture(): SceneDef {
  return {
    id: 'scene-nested-list-self-transition',
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
            id: 'capsule-a',
            name: 'capsule-a',
            type: 'list',
            initial: { move: '@root', style: { opacity: 0 } },
            actions: {
              'capsule-a-show': { style: { opacity: { from: 0, to: 1, duration: 200 } } },
              'capsule-a-hide': { style: { opacity: { from: 1, to: 0, duration: 200 } } },
            },
          },
          {
            id: 'item-1',
            name: 'item-1',
            type: 'tag',
            initial: { content: 'hello', move: { parentId: 'capsule-a', flip: false } },
            actions: {},
          },
        ],
        straps: undefined,
        listen: [],
      },
    },
    tracks: {},
  }
}

describe('V1 - nested list, self-transitioning while parenting a non-root list', () => {
  it('mounts item-1 under capsule-a, and capsule-a own transition applies via player.emit', async () => {
    const builder = new BuilderFacade()
    const compileResult = builder.compile({ scene: createNestedListSceneFixture() })

    expect(compileResult.ok).toBe(true)
    if (!compileResult.ok) return

    const player = new Player({ animationAdapter: createAnimationAdapter(createApplyingAnimeImplementation()) })
    const initResult = await player.init({
      mountTarget: document.createElement('div'),
      compiledScene: compileResult.data.compiledScene,
      resourceManifest: compileResult.data.resourceManifest,
    })
    expect(initResult).toEqual({ ok: true, data: undefined })
    expect(await player.play()).toEqual({ ok: true, data: undefined })

    const registry = player.getRuntimeRegistry()
    const capsuleA = registry.getNodeById('capsule-a') as HTMLElement | null
    const item1 = registry.getNodeById('item-1') as HTMLElement | null

    expect(capsuleA).not.toBeNull()
    expect(item1).not.toBeNull()
    expect(item1?.parentNode).toBe(capsuleA)
    expect(capsuleA?.style.opacity).toBe('0')

    expect(
      await player.emit({
        name: 'capsule-a-show',
        scopeStoryId: 'story-main',
        ms: 0,
      }),
    ).toEqual({ ok: true, data: undefined })

    await new Promise((resolve) => setTimeout(resolve, 0))

    const refreshedRegistry = player.getRuntimeRegistry()
    const refreshedCapsuleA = refreshedRegistry.getNodeById('capsule-a') as HTMLElement | null
    const refreshedItem1 = refreshedRegistry.getNodeById('item-1') as HTMLElement | null

    // The nested list's own transition applied, and its child survived the same tick's update.
    expect(refreshedCapsuleA?.style.opacity).toBe('1')
    expect(refreshedItem1).not.toBeNull()
    expect(refreshedItem1?.parentNode).toBe(refreshedCapsuleA)
    expect(refreshedItem1?.textContent).toBe('hello')
  })
})

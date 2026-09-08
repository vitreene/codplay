import { describe, expect, it } from 'vitest'

import type { SolvedScene } from '../../../src/runtime/player'
import { HtmlMotionContainerResolver } from '../../../src/runtime/runner-html/motion-container'

describe('HtmlMotionContainerResolver', () => {
  it('keeps a single-story move in that story container', () => {
    const root = element('scene-root')
    const storyRoot = element('story-root')
    const resolver = new HtmlMotionContainerResolver(
      root,
      new Map([['main:root', storyRoot]]),
    )

    const result = resolver.resolve({
      root,
      scenes: [solvedScene('main')],
      itemIds: ['main:item'],
      storyIds: ['main'],
    })

    expect(result.element).toBe(storyRoot)
  })

  it('uses the scene root when a boundary crosses stories', () => {
    const root = element('scene-root')
    const resolver = new HtmlMotionContainerResolver(
      root,
      new Map([['main:root', element('main-root')]]),
    )

    const result = resolver.resolve({
      root,
      scenes: [solvedScene('main'), solvedScene('other')],
      itemIds: ['main:item'],
      storyIds: ['main', 'other'],
    })

    expect(result.element).toBe(root)
  })

  it('falls back to the scene root for several visual roots in one story', () => {
    const root = element('scene-root')
    const resolver = new HtmlMotionContainerResolver(
      root,
      new Map([
        ['main:root-a', element('main-root-a')],
        ['main:root-b', element('main-root-b')],
      ]),
    )

    const result = resolver.resolve({
      root,
      scenes: [solvedScene('main', ['root-a', 'root-b'])],
      itemIds: ['main:item'],
      storyIds: ['main'],
    })

    expect(result.element).toBe(root)
  })
})

/** Creates a minimal solved scene sufficient for logical container resolution. */
function solvedScene(storyId: string, rootIds: readonly string[] = ['root']): SolvedScene {
  const persos = Object.fromEntries(rootIds.map((persoId) => {
    const key = `${storyId}:${persoId}`
    return [key, {
      key,
      storyId,
      persoId,
      type: 'tag',
      placement: { mounted: true },
    }]
  }))
  return {
    persos,
    graph: { parentByPerso: {} },
  } as unknown as SolvedScene
}

/** Creates an element-like object accepted across browser realms. */
function element(name: string): Element {
  return { name, nodeType: 1, parentElement: null } as unknown as Element
}

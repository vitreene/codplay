/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest'

import { captureHtmlLayoutSnapshot } from '../../../src/runtime/runner-html/layout-snapshot'
import type { SolvedScene } from '../../../src/runtime/player'

describe('HTML layout snapshot coordinates', () => {
  it('keeps story-local coordinates without reading outside the story root', () => {
    const outer = document.createElement('section')
    const storyRoot = document.createElement('main')
    const item = document.createElement('article')
    outer.append(storyRoot)
    storyRoot.append(item)
    document.body.append(outer)

    outer.style.width = '400px'
    outer.style.height = '400px'
    storyRoot.style.width = '200px'
    storyRoot.style.height = '200px'
    item.style.width = '20px'
    item.style.height = '20px'
    defineRect(storyRoot, { left: 100, top: 100, width: 200, height: 200 })
    defineRect(item, { left: 120, top: 120, width: 20, height: 20 })
    Object.defineProperty(outer, 'getBoundingClientRect', {
      configurable: true,
      value: () => { throw new Error('outside story root must not be measured') },
    })
    const storyRootKey = 'story:root'
    const itemKey = 'story:item'
    const snapshot = captureHtmlLayoutSnapshot(
      storyRoot,
      new Map([[storyRootKey, storyRoot], [itemKey, item]]),
      createScene(storyRootKey, itemKey),
      new Set([itemKey]),
      'motion-story-story',
    )

    const captured = snapshot.items.get(itemKey)
    expect(captured?.localPose.origin[0]).toBeCloseTo(20)
    expect(captured?.localPose.origin[1]).toBeCloseTo(20)
    expect(captured?.rootPose.origin.x).toBeCloseTo(20)
    expect(captured?.rootPose.origin.y).toBeCloseTo(20)
  })
})

/** Creates the smallest solved story graph needed for the coordinate assertion. */
function createScene(storyRootKey: string, itemKey: string): SolvedScene {
  return {
    timeMs: 0,
    persos: {
      [storyRootKey]: {
        key: storyRootKey,
        storyId: 'story',
        placement: { mounted: true },
      },
      [itemKey]: {
        key: itemKey,
        storyId: 'story',
        placement: { mounted: true },
      },
    },
    graph: {
      revision: 'layout-snapshot-test',
      targetByPerso: {
        [storyRootKey]: 'story:stage',
        [itemKey]: 'story:outlet',
      },
      parentByPerso: { [itemKey]: storyRootKey },
      childrenByTarget: {
        'story:stage': [storyRootKey],
        'story:outlet': [itemKey],
      },
    },
  } as unknown as SolvedScene
}

/** Installs deterministic viewport geometry for one jsdom element. */
function defineRect(
  node: HTMLElement,
  rect: Readonly<{ left: number; top: number; width: number; height: number }>,
): void {
  Object.defineProperty(node, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({ ...rect }),
    }),
  })
}

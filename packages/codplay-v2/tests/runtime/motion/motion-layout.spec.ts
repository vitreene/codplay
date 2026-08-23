import { describe, expect, it } from 'vitest'

import {
  buildNaturalLayoutTimeline,
  createMotionRootPose,
  resolveNaturalLayout,
  type LayoutItemSnapshot,
  type LayoutSnapshot,
  type MotionBoundary,
  type MotionIntent,
  type RelativeMotionPose,
} from '../../../src/runtime/motion'
import type { HtmlMatrix } from '../../../src/runtime/motion/html-types'

const IDENTITY: HtmlMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

describe('natural motion layout timeline', () => {
  it('keeps the captured before/after layout at each absolute boundary', () => {
    const firstBefore = createSnapshot(100, 'first-before', [createItem('a', 0), createItem('b', 10)])
    const firstAfter = createSnapshot(100, 'first-after', [createItem('a', 20), createItem('b', 10)])
    const secondBefore = createSnapshot(200, 'second-before', [createItem('a', 20), createItem('b', 10)])
    const secondAfter = createSnapshot(200, 'second-after', [createItem('a', 30)])

    const timeline = buildNaturalLayoutTimeline([
      createBoundary(100, firstBefore, firstAfter),
      createBoundary(200, secondBefore, secondAfter),
    ])

    expect(resolveNaturalLayout(timeline, 50).items.get('a')?.rootPose.origin.x).toBe(0)
    expect(resolveNaturalLayout(timeline, 100).items.get('a')?.rootPose.origin.x).toBe(20)
    expect(resolveNaturalLayout(timeline, 150).items.get('b')?.rootPose.origin.x).toBe(10)
    expect(resolveNaturalLayout(timeline, 200).items.get('a')?.rootPose.origin.x).toBe(30)
    expect(resolveNaturalLayout(timeline, 200).items.has('b')).toBe(false)
  })

  it('returns a stable empty layout when no movement boundary exists', () => {
    const timeline = buildNaturalLayoutTimeline([])
    const first = resolveNaturalLayout(timeline, 10)
    const second = resolveNaturalLayout(timeline, 10)

    expect(first.items.size).toBe(0)
    expect(first.revision).toBe(second.revision)
    expect(first.rootPose).toEqual(createMotionRootPose())
  })

  it('does not apply a delayed after layout at the action start', () => {
    const before = createSnapshot(100, 'delayed-before', [createItem('a', 0)])
    const after = createSnapshot(200, 'delayed-after', [createItem('a', 20)])
    const timeline = buildNaturalLayoutTimeline([createBoundary(100, before, after)])

    expect(resolveNaturalLayout(timeline, 100).items.get('a')?.rootPose.origin.x).toBe(0)
    expect(resolveNaturalLayout(timeline, 150).items.get('a')?.rootPose.origin.x).toBe(0)
    expect(resolveNaturalLayout(timeline, 200).items.get('a')?.rootPose.origin.x).toBe(20)
  })

  it('does not let a dependency snapshot overwrite an item with its own motion track', () => {
    const parentBefore = createSnapshot(0, 'parent-before', [createItem('parent', 0, 'root')])
    const parentAfter = createSnapshot(10_000, 'parent-after', [createItem('parent', 100, 'root')])
    const childBefore = createSnapshot(1_000, 'child-before', [
      createItem('parent', 25, 'root'),
      createItem('child', 0, 'root'),
    ])
    const childAfter = createSnapshot(2_000, 'child-after', [
      createItem('parent', 25, 'root'),
      createItem('child', 20, 'root'),
    ])

    const timeline = buildNaturalLayoutTimeline([
      createBoundary(0, parentBefore, parentAfter, 'parent'),
      createBoundary(1_000, childBefore, childAfter, 'child'),
    ])

    expect(resolveNaturalLayout(timeline, 1_000).items.get('parent')?.rootPose.origin.x).toBe(0)
    expect(resolveNaturalLayout(timeline, 1_000).items.get('child')?.rootPose.origin.x).toBe(0)
    expect(resolveNaturalLayout(timeline, 2_000).items.get('child')?.rootPose.origin.x).toBe(20)
  })

  it('keeps a future direct mover when it is a structural reflow participant', () => {
    const firstBefore = createSnapshot(100, 'first-before', [
      createItem('moving-a', 0, 'source-list'),
      createItem('moving-b', 20, 'source-list'),
    ])
    const firstAfter = createSnapshot(100, 'first-after', [
      createItem('moving-b', 0, 'source-list'),
      createItem('moving-a', 0, 'target-list'),
    ])
    const secondBefore = createSnapshot(200, 'second-before', [createItem('moving-b', 0, 'source-list')])
    const secondAfter = createSnapshot(200, 'second-after', [createItem('moving-b', 20, 'target-list')])
    const firstIntent: MotionIntent = {
      id: 'move:100:a',
      itemId: 'moving-a',
      startAt: 100,
      duration: 100,
      ease: 'linear',
      presentationMode: 'reparent',
      targetReflow: true,
    }
    const secondIntent: MotionIntent = {
      id: 'move:200:b',
      itemId: 'moving-b',
      startAt: 200,
      duration: 100,
      ease: 'linear',
      presentationMode: 'reparent',
      targetReflow: true,
    }

    const timeline = buildNaturalLayoutTimeline([
      { id: 'boundary:100', timeMs: 100, before: firstBefore, after: firstAfter, intents: [firstIntent] },
      { id: 'boundary:200', timeMs: 200, before: secondBefore, after: secondAfter, intents: [secondIntent] },
    ])

    expect(resolveNaturalLayout(timeline, 100).items.get('moving-b')?.rootPose.origin.x).toBe(0)
  })
})

/** Creates one direct boundary with a shared timing contract. */
function createBoundary(
  timeMs: number,
  before: LayoutSnapshot,
  after: LayoutSnapshot,
  itemId = 'a',
): MotionBoundary {
  const intent: MotionIntent = {
    id: `move:${timeMs}`,
    itemId,
    startAt: timeMs,
    duration: 100,
    ease: 'linear',
    presentationMode: 'local',
  }
  return { id: `boundary:${timeMs}`, timeMs, before, after, intents: [intent] }
}

/** Creates one complete test snapshot from root-local item positions. */
function createSnapshot(
  timeMs: number,
  revision: string,
  items: readonly LayoutItemSnapshot[],
): LayoutSnapshot {
  return {
    timeMs,
    revision,
    rootPose: createMotionRootPose(),
    items: new Map(items.map((item) => [item.itemId, item])),
  }
}

/** Creates one root-level item with a horizontal natural position. */
function createItem(itemId: string, x: number, targetId = 'root'): LayoutItemSnapshot {
  const localPose: RelativeMotionPose = {
    origin: [x, 0],
    matrix: IDENTITY,
    width: 20,
    height: 20,
  }
  return {
    itemId,
    targetId,
    localPose,
    rootPose: {
      ...createMotionRootPose(),
      origin: { x, y: 0 },
      rect: { left: x, top: 0, width: 20, height: 20 },
    },
  }
}

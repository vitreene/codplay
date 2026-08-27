import { describe, expect, it } from 'vitest'

import {
  buildNaturalLayoutTimeline,
  createMotionRootPose,
  resolveNaturalLayout,
  resolveNaturalLayoutBefore,
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

  it('uses the committed reflow slots at a structural move start', () => {
    const before = createSnapshot(1_200, 'reflow-before', [
      createItem('list', 0),
      createNestedItem('moving', 'list', 'list-content', 0, 0),
      createNestedItem('sibling', 'list', 'list-content', 35, 35),
    ])
    const after = createSnapshot(2_200, 'reflow-after', [
      createItem('list', 700),
      createNestedItem('moving', 'target-list', 'target-content', 0, 700),
      createNestedItem('sibling', 'list', 'list-content', 0, 700),
    ])
    const intent: MotionIntent = {
      id: 'move:moving',
      itemId: 'moving',
      startAt: 1_200,
      duration: 1_000,
      ease: 'linear',
      presentationMode: 'reparent',
      targetReflow: true,
    }

    const timeline = buildNaturalLayoutTimeline([{
      id: 'boundary:reflow',
      timeMs: 1_200,
      before,
      after,
      intents: [intent],
    }])
    const natural = resolveNaturalLayout(timeline, 1_200)

    expect(natural.items.get('moving')?.localPose.origin[0]).toBe(0)
    expect(natural.items.get('sibling')?.localPose.origin[0]).toBe(0)
    // The sibling uses its committed local slot, but its parent remains at
    // the current FIRST pose until the parent's own transition starts.
    expect(natural.items.get('list')?.rootPose.origin.x).toBe(0)
    expect(natural.items.get('sibling')?.rootPose.origin.x).toBe(0)
  })

  it('uses the post-boundary slots instead of endpoint slots changed by a later event', () => {
    const before = createSnapshot(1_700, 'before', [
      createItem('list', 0),
      createNestedItem('moving', 'list', 'list-content', 0, 0),
      createNestedItem('sibling', 'list', 'list-content', 35, 35),
    ])
    const afterStart = createSnapshot(1_700, 'after-start', [
      createItem('list', 0),
      createNestedItem('moving', 'target-list', 'target-content', 0, 700),
      createNestedItem('sibling', 'list', 'list-content', 0, 0),
    ])
    const endpoint = createSnapshot(2_700, 'endpoint-after-later-event', [
      createItem('list', 0),
      createNestedItem('moving', 'target-list', 'target-content', 0, 700),
      createNestedItem('sibling', 'list', 'list-content', 35, 35),
    ])
    const intent: MotionIntent = {
      id: 'move:moving',
      itemId: 'moving',
      startAt: 1_700,
      duration: 1_000,
      ease: 'linear',
      presentationMode: 'reparent',
      targetReflow: true,
    }

    const timeline = buildNaturalLayoutTimeline([{
      id: 'boundary:later-event',
      timeMs: 1_700,
      before,
      afterStart,
      after: endpoint,
      intents: [intent],
    }])

    expect(resolveNaturalLayout(timeline, 1_700).items.get('sibling')?.localPose.origin[0]).toBe(0)
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

  it('keeps the exact pre-boundary source separate from the committed start layout', () => {
    const before = createSnapshot(100, 'before', [
      createItem('source', 0),
      createNestedItem('moving', 'source', 'source-content', 0, 0),
    ])
    const after = createSnapshot(200, 'after', [
      createItem('target', 100),
      createNestedItem('moving', 'target', 'target-content', 0, 100),
    ])
    const intent: MotionIntent = {
      id: 'move:moving',
      itemId: 'moving',
      startAt: 100,
      duration: 100,
      ease: 'linear',
      presentationMode: 'reparent',
      targetReflow: true,
    }
    const boundary: MotionBoundary = {
      id: 'boundary:source-start',
      timeMs: 100,
      before,
      after,
      intents: [intent],
    }
    const timeline = buildNaturalLayoutTimeline([boundary])

    expect(resolveNaturalLayoutBefore(timeline, 100, boundary.id).items.get('moving')?.parentItemId).toBe('source')
    expect(resolveNaturalLayout(timeline, 100).items.get('moving')?.parentItemId).toBe('target')
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
function createItem(itemId: string, x: number, targetId = 'root', targetOrder = 0): LayoutItemSnapshot {
  const localPose: RelativeMotionPose = {
    origin: [x, 0],
    matrix: IDENTITY,
    width: 20,
    height: 20,
  }
  return {
    itemId,
    targetId,
    targetOrder,
    localPose,
    rootPose: {
      ...createMotionRootPose(),
      origin: { x, y: 0 },
      rect: { left: x, top: 0, width: 20, height: 20 },
    },
  }
}

/** Creates one child item with an explicit parent-local and root pose. */
function createNestedItem(
  itemId: string,
  parentItemId: string,
  targetId: string,
  localX: number,
  rootX: number,
): LayoutItemSnapshot {
  return {
    ...createItem(itemId, rootX, targetId),
    parentItemId,
    localPose: {
      ...createItem(itemId, localX, targetId).localPose,
      origin: [localX, 0],
    },
  }
}

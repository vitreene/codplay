import { describe, expect, it } from 'vitest'
import { createRotateMatrix, preparePath } from '../../../src/ace'
import {
  buildMotionGraph,
  buildNaturalLayoutTimeline,
  composeMotionPose,
  createMotionRootPose,
  resolvePresentationFrame,
  resolveNaturalLayout,
  type LayoutItemSnapshot,
  type LayoutSnapshot,
  type MotionBoundary,
  type MotionIntent,
  type RelativeMotionPose,
} from '../../../src/runtime/motion'

const IDENTITY_MATRIX: RelativeMotionPose['matrix'] = Object.freeze({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })

/** Defines one item in the synthetic logical layout used by graph tests. */
type ItemDefinition = Readonly<{
  id: string
  parentId?: string
  targetId: string
  x: number
  y?: number
  matrix?: RelativeMotionPose['matrix']
}>

describe('motion graph', () => {
  it('resolves one reparented item between independently moving source and destination parents', () => {
    const initial = snapshot(0, [
      item('Q', 'root', 0),
      item('K', 'root', 300),
      item('C', 'Q:content', 10, 'Q'),
    ])
    const afterParentMove = snapshot(0, [
      item('Q', 'root', 100),
      item('K', 'root', 300),
      item('C', 'Q:content', 10, 'Q'),
    ])
    const beforeTransfer = snapshot(500, [
      item('Q', 'root', 100),
      item('K', 'root', 300),
      item('C', 'Q:content', 10, 'Q'),
    ])
    const afterTransfer = snapshot(500, [
      item('Q', 'root', 100),
      item('K', 'root', 200),
      item('C', 'K:content', 20, 'K'),
    ])
    const graph = buildMotionGraph([
      boundary('parent-source', 0, initial, afterParentMove, [intent('Q', 0, 1000)]),
      boundary('transfer', 500, beforeTransfer, afterTransfer, [
        intent('K', 500, 1000),
        intent('C', 500, 1000),
      ]),
    ])

    expect(originX(resolvePresentationFrame(graph, afterTransfer, 500), 'C')).toBeCloseTo(60)
    expect(resolvePresentationFrame(graph, afterTransfer, 750).items.get('C')?.representation).toBe('reparent')
    expect(originX(resolvePresentationFrame(graph, afterTransfer, 1000), 'Q')).toBeCloseTo(100)
    expect(originX(resolvePresentationFrame(graph, afterTransfer, 1000), 'K')).toBeCloseTo(250)
    expect(originX(resolvePresentationFrame(graph, afterTransfer, 1000), 'C')).toBeCloseTo(190)
    expect(originX(resolvePresentationFrame(graph, afterTransfer, 1500), 'C')).toBeCloseTo(220)
  })

  it('composes a reparented child against the destination ancestor current pose', () => {
    const beforeParent = snapshot(100, [
      item('C', 'root', 0),
      item('D', 'root', 300),
      item('K', 'D:content', 10, 'D'),
    ])
    const afterParent = snapshot(9100, [
      item('C', 'root', 100),
      item('D', 'root', 300),
      item('K', 'D:content', 10, 'D'),
    ])
    const beforeReparent = snapshot(100, [
      item('C', 'root', 0),
      item('D', 'root', 300),
      item('K', 'D:content', 10, 'D'),
    ])
    const afterReparent = snapshot(100, [
      item('C', 'root', 0),
      item('D', 'root', 300),
      item('K', 'C:content', 10, 'C'),
    ])
    const graph = buildMotionGraph([
      boundary('destination-parent-pose', 100, beforeParent, afterParent, [{
        ...intent('C', 100, 9000),
        targetReflow: false,
      }]),
      boundary('child-reparent', 100, beforeReparent, afterReparent, [{
        ...intent('K', 100, 8000),
        targetReflow: true,
      }]),
    ])

    const frame = resolvePresentationFrame(graph, afterReparent, 8100)

    expect(graph.tracksByItem.has('C')).toBe(true)
    expect(graph.tracksByItem.has('K')).toBe(true)
    expect(originX(frame, 'C')).toBeCloseTo(88.888, 2)
    // K ends against C's interpolated pose, not against C's FIRST pose.
    expect(originX(frame, 'K')).toBeCloseTo(98.888, 2)
  })

  it('uses the destination context at LAST when the target mounts after FIRST', () => {
    const before = snapshot(1_200, [
      item('source', 'root', 0),
      item('moving', 'source:content', 10, 'source'),
    ])
    const after = snapshot(2_200, [
      item('target', 'root', 300),
      item('moving', 'target:content', 20, 'target'),
    ])
    const graph = buildMotionGraph([
      boundary('target-mounted-at-last', 1_200, before, after, [{
        ...intent('moving', 1_200, 1_000),
        targetReflow: true,
      }]),
    ])

    expect(originX(resolvePresentationFrame(graph, after, 1_200), 'moving')).toBeCloseTo(10)
    expect(originX(resolvePresentationFrame(graph, after, 2_200), 'moving')).toBeCloseTo(320)
  })

  it('uses a measured property endpoint before the enclosing move endpoint', () => {
    const before = snapshot(1_000, [item('C', 'root', 0)])
    const rotationEnd = snapshot(1_360, [rotatedItem('C', 'root', 0, 14)])
    const after = snapshot(9_150, [rotatedItem('C', 'root', 100, 14)])
    const graph = buildMotionGraph([{
      ...boundary('container-with-short-rotation', 1_000, before, after, [{
        ...intent('C', 1_000, 8_150),
        targetReflow: true,
      }]),
      keyframes: [rotationEnd],
    }])

    const frame = resolvePresentationFrame(graph, after, 2_050)
    const pose = frame.items.get('C')?.pose
    if (pose === undefined) throw new Error('Measured keyframe item is missing.')

    expect(pose.matrix.a).toBeCloseTo(Math.cos(14 * Math.PI / 180), 6)
    expect(pose.matrix.b).toBeCloseTo(Math.sin(14 * Math.PI / 180), 6)
  })

  it('keeps a structural mover aimed at LAST while natural layout is still at afterStart', () => {
    const before = snapshot(0, [item('moving', 'source', 0)])
    const afterStart = snapshot(0, [item('moving', 'target', 50)])
    const after = snapshot(1_000, [item('moving', 'target', 100)])
    const graph = buildMotionGraph([{
      ...boundary('last-destination', 0, before, after, [{
        ...intent('moving', 0, 1_000),
        targetReflow: true,
      }]),
      afterStart,
    }])

    // The natural layout remains at the committed afterStart slot while the
    // overlay is active; the sovereign structural mover must still use LAST.
    expect(originX(resolvePresentationFrame(graph, afterStart, 500), 'moving')).toBeCloseTo(50)
    expect(originX(resolvePresentationFrame(graph, afterStart, 1_000), 'moving')).toBeCloseTo(100)
  })

  it('keeps natural placement and exposes both endpoint constraints for an active reparent', () => {
    const before = snapshot(0, [
      item('source', 'root', 0),
      item('moving', 'source:content', 10, 'source'),
    ])
    const after = snapshot(0, [
      item('target', 'root', 100),
      item('target-first', 'target:content', 0, 'target'),
      item('moving', 'target:content', 10, 'target'),
    ])
    const graph = buildMotionGraph([
      boundary('reparent-placement', 0, before, after, [{
        ...intent('moving', 0, 1000),
        targetReflow: true,
      }]),
    ])

    expect(resolvePresentationFrame(graph, before, 500).items.get('moving')).toMatchObject({
      parentItemId: 'source',
      targetId: 'source:content',
      targetOrder: 0,
      representation: 'reparent',
      overlayStacking: {
        sourceParentItemId: 'source',
        targetParentItemId: 'target',
        sourceAncestorItemIds: ['source'],
        targetAncestorItemIds: ['target'],
        targetId: 'target:content',
        targetOrder: 1,
      },
    })
  })

  it('keeps original overlay endpoints when a sibling reflow retargets an active reparent', () => {
    const beforeFirst = snapshot(0, [
      item('source', 'root', 0),
      item('target', 'root', 100),
      item('moving', 'source:content', 0, 'source'),
      item('sibling', 'target:content', 0, 'target'),
    ])
    const afterFirst = snapshot(0, [
      item('source', 'root', 0),
      item('target', 'root', 100),
      item('moving', 'target:content', 10, 'target'),
      item('sibling', 'target:content', 20, 'target'),
    ])
    const beforeSecond = snapshot(500, [
      item('source', 'root', 0),
      item('target', 'root', 100),
      item('moving', 'target:content', 10, 'target'),
      item('sibling', 'target:content', 20, 'target'),
    ])
    const afterSecond = snapshot(500, [
      item('source', 'root', 0),
      item('target', 'root', 100),
      item('moving', 'target:content', 30, 'target'),
      item('sibling', 'source:content', 20, 'source'),
    ])
    const graph = buildMotionGraph([
      boundary('moving-first', 0, beforeFirst, afterFirst, [intent('moving', 0, 1_000)]),
      boundary('sibling-reflow', 500, beforeSecond, afterSecond, [intent('sibling', 500, 1_000)]),
    ])

    expect(resolvePresentationFrame(graph, afterSecond, 750).items.get('moving')?.overlayStacking)
      .toMatchObject({
        sourceParentItemId: 'source',
        targetParentItemId: 'target',
        sourceAncestorItemIds: ['source'],
        targetAncestorItemIds: ['target'],
      })
  })

  it('resolves a child against the parent pose at the child endpoint when the parent starts later', () => {
    const childBefore = snapshot(1_200, [
      item('source-list', 'source:content', 0),
      item('moving', 'source:list', 10, 'source-list'),
    ])
    const childAfter = snapshot(2_200, [
      item('target-frame', 'root', 700),
      item('target-list', 'target:content', 0, 'target-frame'),
      item('moving', 'target:list', 10, 'target-list'),
    ])
    const parentBefore = snapshot(2_000, [
      item('target-frame', 'root', 300),
      item('target-list', 'target:content', 0, 'target-frame'),
    ])
    const parentAfter = snapshot(10_000, [
      item('target-frame', 'root', 700),
      item('target-list', 'target:content', 0, 'target-frame'),
    ])
    const graph = buildMotionGraph([
      boundary('child-starts-first', 1_200, childBefore, childAfter, [{
        ...intent('moving', 1_200, 1_000),
        targetReflow: true,
      }]),
      boundary('parent-starts-later', 2_000, parentBefore, parentAfter, [intent('target-frame', 2_000, 8_000)]),
    ])

    const atChildStart = resolvePresentationFrame(graph, childBefore, 1_200)
    const frame = resolvePresentationFrame(graph, childBefore, 1_500)
    const atChildLast = resolvePresentationFrame(graph, childBefore, 2_200)

    // At 1500 ms, K has not started its own move. Qa must head toward K's
    // source pose, not toward K's eventual 700 pose.
    expect(originX(atChildStart, 'moving')).toBeCloseTo(10)
    expect(originX(frame, 'moving')).toBeCloseTo(100)
    // At Qa's LAST, K is 200 ms into its own 8000 ms transition: 300 + 10
    // for the target list, then the item's local offset 10.
    expect(originX(atChildLast, 'moving')).toBeCloseTo(320)
  })

  it('prepares future ancestor tracks before retargeting an active child', () => {
    const childBefore = snapshot(1_200, [
      item('source', 'root', 0),
      item('target-frame', 'root', 100),
      item('target-list', 'target-frame:content', 0, 'target-frame'),
      item('moving', 'source:content', 0, 'source'),
      item('sibling', 'target-list:content', 20, 'target-list'),
    ])
    const childAfter = snapshot(2_075, [
      item('source', 'root', 0),
      item('target-frame', 'root', 500),
      item('target-list', 'target-frame:content', 0, 'target-frame'),
      item('moving', 'target-list:content', 0, 'target-list'),
      item('sibling', 'target-list:content', 20, 'target-list'),
    ])
    const reflowBefore = snapshot(1_700, [
      item('source', 'root', 0),
      item('target-frame', 'root', 100),
      item('target-list', 'target-frame:content', 0, 'target-frame'),
      item('moving', 'target-list:content', 0, 'target-list'),
      item('sibling', 'target-list:content', 20, 'target-list'),
    ])
    const reflowAfter = snapshot(1_700, [
      item('source', 'root', 0),
      item('target-frame', 'root', 100),
      item('target-list', 'target-frame:content', 0, 'target-frame'),
      item('moving', 'target-list:content', 10, 'target-list'),
      item('sibling', 'source:content', 20, 'source'),
    ])
    const parentBefore = snapshot(2_000, [
      item('source', 'root', 0),
      item('target-frame', 'root', 100),
      item('target-list', 'target-frame:content', 0, 'target-frame'),
      item('moving', 'target-list:content', 10, 'target-list'),
      item('sibling', 'source:content', 20, 'source'),
    ])
    const parentAfter = snapshot(3_000, [
      item('source', 'root', 0),
      item('target-frame', 'root', 500),
      item('target-list', 'target-frame:content', 0, 'target-frame'),
      item('moving', 'target-list:content', 10, 'target-list'),
      item('sibling', 'source:content', 20, 'source'),
    ])
    const graph = buildMotionGraph([
      {
        ...boundary('child-starts-first', 1_200, childBefore, childAfter, [{
          ...intent('moving', 1_200, 875),
          targetReflow: true,
        }]),
        afterStart: snapshot(1_200, [
          item('source', 'root', 0),
          item('target-frame', 'root', 100),
          item('target-list', 'target-frame:content', 0, 'target-frame'),
          item('sibling', 'target-list:content', 20, 'target-list'),
        ]),
      },
      boundary('sibling-leaves', 1_700, reflowBefore, reflowAfter, [{
        ...intent('sibling', 1_700, 875),
        targetReflow: true,
      }]),
      boundary('ancestor-starts-later', 2_000, parentBefore, parentAfter, [{
        ...intent('target-frame', 2_000, 1_000),
        targetReflow: false,
      }]),
    ])

    const beforeBoundary = resolvePresentationFrame(graph, reflowBefore, 1_699.999).items.get('moving')?.pose
    const atBoundary = resolvePresentationFrame(graph, reflowAfter, 1_700).items.get('moving')?.pose
    if (beforeBoundary === undefined || atBoundary === undefined) throw new Error('Future ancestor retarget test item is missing.')

    expect(graph.tracksByItem.has('target-frame')).toBe(true)
    expect(atBoundary.rect.left).toBeCloseTo(beforeBoundary.rect.left, 3)
    expect(atBoundary.rect.top).toBeCloseTo(beforeBoundary.rect.top, 3)
  })

  it('holds an action pose during its delay and resolves it from the same graph', () => {
    const before = snapshot(0, [item('A', 'root', 0)])
    const after = snapshot(0, [item('A', 'root', 100)])
    const graph = buildMotionGraph([
      boundary('delayed-action', 0, before, after, [{
        ...intent('A', 0, 1000),
        delay: 200,
      }]),
    ])

    expect(originX(resolvePresentationFrame(graph, after, 100), 'A')).toBeCloseTo(0)
    expect(originX(resolvePresentationFrame(graph, after, 700), 'A')).toBeCloseTo(50)
    expect(originX(resolvePresentationFrame(graph, after, 1200), 'A')).toBeCloseTo(100)
    expect(graph.tracksByItem.get('A')?.segments[0]?.endAt).toBe(1200)
  })

  it('keeps unchanged descendants out of the presentation frame', () => {
    const before = snapshot(0, nestedDefinitions(0))
    const after = snapshot(0, nestedDefinitions(100))
    const graph = buildMotionGraph([
      boundary('deep-parent', 0, before, after, [intent('P1', 0, 1000)]),
    ])
    const frame = resolvePresentationFrame(graph, after, 500)

    expect([...graph.tracksByItem.keys()]).toEqual(['P1'])
    expect(originX(frame, 'P1')).toBeCloseTo(50)
    expect(frame.items.has('P5')).toBe(false)
  })

  it('keeps an independently animated context ancestor out of the FLIP tracks', () => {
    const before = snapshot(100, [
      item('C', 'root', 0),
      item('D', 'root', 300),
      item('M', 'C:content', 10, 'C'),
    ])
    const after = snapshot(100, [
      item('C', 'root', 100),
      item('D', 'root', 300),
      item('M', 'D:content', 10, 'D'),
    ])
    const graph = buildMotionGraph([
      boundary('move-child', 100, before, after, [intent('M', 100, 1000)]),
    ])

    expect([...graph.tracksByItem.keys()]).toEqual(['M'])
    const frame = resolvePresentationFrame(graph, after, 500)
    expect(frame.items.has('C')).toBe(false)
    expect(frame.items.get('M')?.representation).toBe('reparent')
  })

  it('prepares only the affected branch for frame resolution', () => {
    const before = snapshot(0, [
      item('A', 'root', 0),
      item('A-child', 'A:content', 10, 'A'),
      item('unrelated', 'other', 500),
    ])
    const after = snapshot(0, [
      item('A', 'root', 100),
      item('A-child', 'A:content', 10, 'A'),
      item('unrelated', 'other', 500),
    ])
    const graph = buildMotionGraph([
      boundary('branch', 0, before, after, [intent('A', 0, 1000)]),
    ])

    expect(graph.presentationItemIds).toEqual(['A'])
    expect(resolvePresentationFrame(graph, after, 500).items.has('unrelated')).toBe(false)
  })

  it('retargets from the already resolved pose when a second boundary overlaps the first', () => {
    const beforeFirst = snapshot(0, [item('A', 'root', 0), item('B', 'root', 0)])
    const afterFirst = snapshot(0, [item('A', 'root', 100), item('B', 'root', 0)])
    const beforeSecond = snapshot(500, [item('A', 'root', 100), item('B', 'root', 0)])
    const afterSecond = snapshot(500, [item('A', 'root', 200), item('B', 'root', 100)])
    const graph = buildMotionGraph([
      boundary('first', 0, beforeFirst, afterFirst, [intent('A', 0, 1000)]),
      boundary('second', 500, beforeSecond, afterSecond, [intent('B', 500, 1000)]),
    ])

    expect(originX(resolvePresentationFrame(graph, afterFirst, 499), 'A')).toBeCloseTo(49.9)
    expect(originX(resolvePresentationFrame(graph, afterSecond, 500), 'A')).toBeCloseTo(50)
    expect(originX(resolvePresentationFrame(graph, afterSecond, 750), 'A')).toBeCloseTo(125)
    expect(originX(resolvePresentationFrame(graph, afterSecond, 1500), 'A')).toBeCloseTo(200)
    expect(graph.tracksByItem.get('A')?.segments).toHaveLength(1)
  })

  it('retargets a curved direct path without a positional jump at a sibling boundary', () => {
    const beforeFirst = snapshot(0, [item('A', 'root', 0), item('B', 'root', 0)])
    const afterFirst = snapshot(0, [item('A', 'root', 100), item('B', 'root', 0)])
    const beforeSecond = snapshot(500, [item('A', 'root', 100), item('B', 'root', 0)])
    const afterSecond = snapshot(500, [item('A', 'root', 200), item('B', 'root', 100)])
    const graph = buildMotionGraph([
      boundary('curved-first', 0, beforeFirst, afterFirst, [{
        ...intent('A', 0, 1000),
        path: preparePath({ control: [0.5, 1] }),
      }]),
      boundary('curved-second', 500, beforeSecond, afterSecond, [intent('B', 500, 1000)]),
    ])

    const beforeBoundary = resolvePresentationFrame(graph, afterFirst, 499.999)
    const atBoundary = resolvePresentationFrame(graph, afterSecond, 500)
    const beforeRect = beforeBoundary.items.get('A')?.pose.rect
    const boundaryRect = atBoundary.items.get('A')?.pose.rect
    if (beforeRect === undefined || boundaryRect === undefined) throw new Error('Curved retarget test item is missing.')

    expect(boundaryRect.left).toBeCloseTo(beforeRect.left, 3)
    expect(boundaryRect.top).toBeCloseTo(beforeRect.top, 3)
    expect(graph.tracksByItem.get('A')?.segments).toHaveLength(1)
    expect(graph.tracksByItem.get('A')?.segments[0]?.path).toBeDefined()
  })

  it('resolves an active mover against its committed slot before a later reflow', () => {
    const beforeFirst = snapshot(0, [item('A', 'root', 0), item('B', 'root', 0)])
    const afterFirstStart = snapshot(0, [item('A', 'root', 100), item('B', 'root', 0)])
    const afterFirstEndpoint = snapshot(1_000, [item('A', 'root', 200), item('B', 'root', 100)])
    const beforeSecond = snapshot(500, [item('A', 'root', 100), item('B', 'root', 0)])
    const afterSecond = snapshot(1_500, [item('A', 'root', 200), item('B', 'root', 100)])
    const path = preparePath({ control: [0.5, 1] }, { traversal: 'parameter' })
    const graph = buildMotionGraph([
      {
        ...boundary('first-slot', 0, beforeFirst, afterFirstEndpoint, [{
          ...intent('A', 0, 1_000),
          path,
          targetReflow: true,
        }]),
        afterStart: afterFirstStart,
      },
      boundary('second-slot', 500, beforeSecond, afterSecond, [{
        ...intent('B', 500, 1_000),
        targetReflow: true,
      }]),
    ])
    const timeline = buildNaturalLayoutTimeline([
      {
        ...boundary('first-slot', 0, beforeFirst, afterFirstEndpoint, [{
          ...intent('A', 0, 1_000),
          path,
          targetReflow: true,
        }]),
        afterStart: afterFirstStart,
      },
      boundary('second-slot', 500, beforeSecond, afterSecond, [{
        ...intent('B', 500, 1_000),
        targetReflow: true,
      }]),
    ])

    const naturalBeforeReflow = resolveNaturalLayout(timeline, 499)
    const beforeReflow = resolvePresentationFrame(graph, naturalBeforeReflow, 499).items.get('A')?.pose
    const atReflow = resolvePresentationFrame(graph, resolveNaturalLayout(timeline, 500), 500).items.get('A')?.pose
    if (beforeReflow === undefined || atReflow === undefined) throw new Error('Slot retarget test item is missing.')

    expect(naturalBeforeReflow.items.get('A')?.localPose.origin[0]).toBe(100)
    expect(Math.abs(atReflow.rect.left - beforeReflow.rect.left)).toBeLessThan(0.5)
    expect(Math.abs(atReflow.rect.top - beforeReflow.rect.top)).toBeLessThan(0.5)
  })

  it('resolves a retarget destination through an ancestor already in motion', () => {
    const beforeFirst = snapshot(0, [
      item('parent', 'root', 0),
      item('list', 'parent:content', 0, 'parent'),
      item('source', 'root', 300),
      item('moving', 'source:content', 0, 'source'),
      item('leaving', 'list:content', 0, 'list'),
    ])
    const afterFirst = snapshot(1_000, [
      item('parent', 'root', 100),
      item('list', 'parent:content', 0, 'parent'),
      item('source', 'root', 300),
      item('moving', 'list:content', 10, 'list'),
      item('leaving', 'list:content', 0, 'list'),
    ])
    const beforeSecond = snapshot(500, [
      item('parent', 'root', 0),
      item('list', 'parent:content', 0, 'parent'),
      item('source', 'root', 300),
      item('moving', 'list:content', 10, 'list'),
      item('leaving', 'list:content', 0, 'list'),
    ])
    const afterSecond = snapshot(500, [
      item('parent', 'root', 0),
      item('list', 'parent:content', 0, 'parent'),
      item('source', 'root', 300),
      item('moving', 'list:content', 20, 'list'),
      item('leaving', 'source:content', 0, 'source'),
    ])
    const graph = buildMotionGraph([
      boundary('moving-start', 0, beforeFirst, afterFirst, [
        { ...intent('parent', 0, 1_000), targetReflow: false },
        { ...intent('moving', 0, 1_000), targetReflow: true },
      ]),
      boundary('ancestor-reflow', 500, beforeSecond, afterSecond, [
        { ...intent('leaving', 500, 1_000), targetReflow: true },
      ]),
    ])

    const beforeBoundary = resolvePresentationFrame(graph, beforeSecond, 499.999).items.get('moving')?.pose
    const atBoundary = resolvePresentationFrame(graph, afterSecond, 500).items.get('moving')?.pose
    if (beforeBoundary === undefined || atBoundary === undefined) throw new Error('Ancestor retarget test item is missing.')

    expect(atBoundary.rect.left).toBeCloseTo(beforeBoundary.rect.left, 3)
    expect(atBoundary.rect.top).toBeCloseTo(beforeBoundary.rect.top, 3)
  })

  it('does not import a later sibling reflow into an earlier boundary', () => {
    const before = snapshot(1_700, [
      item('list', 'root', 0),
      item('target', 'root', 700),
      item('moving', 'list:content', 0, 'list'),
      item('sibling', 'list:content', 35, 'list'),
    ])
    const afterStart = snapshot(1_700, [
      item('list', 'root', 0),
      item('target', 'root', 700),
      item('moving', 'target:content', 0, 'target'),
      item('sibling', 'list:content', 0, 'list'),
    ])
    const endpoint = snapshot(2_700, [
      item('list', 'root', 0),
      item('target', 'root', 700),
      item('moving', 'target:content', 0, 'target'),
      item('sibling', 'list:content', 35, 'list'),
    ])
    const graph = buildMotionGraph([{ ...boundary('earlier-boundary', 1_700, before, endpoint, [{
      ...intent('moving', 1_700, 1_000),
      targetReflow: true,
    }]),
      afterStart,
    }])

    expect(graph.tracksByItem.get('sibling')?.segments[0]?.to.localPose.origin[0]).toBe(0)
    expect(originX(resolvePresentationFrame(graph, afterStart, 1_700), 'sibling')).toBeCloseTo(35)
    expect(originX(resolvePresentationFrame(graph, afterStart, 2_700), 'sibling')).toBeCloseTo(0)
  })

  it('returns the same absolute frame independently of evaluation history', () => {
    const before = snapshot(0, [item('A', 'root', 0)])
    const after = snapshot(0, [item('A', 'root', 100)])
    const graph = buildMotionGraph([
      boundary('absolute', 0, before, after, [intent('A', 0, 1000)]),
    ])

    const directSeek = resolvePresentationFrame(graph, after, 820)
    resolvePresentationFrame(graph, after, 100)
    resolvePresentationFrame(graph, after, 700)
    const playLikeEvaluation = resolvePresentationFrame(graph, after, 820)

    expect(playLikeEvaluation).toEqual(directSeek)
  })

  it('changes graph revision when geometry changes at otherwise identical boundaries', () => {
    const before = snapshot(0, [item('A', 'root', 0)])
    const firstAfter = snapshot(0, [item('A', 'root', 100)])
    const secondAfter = snapshot(0, [item('A', 'root', 200)])
    const firstGraph = buildMotionGraph([
      boundary('geometry', 0, before, firstAfter, [intent('A', 0, 1000)]),
    ])
    const secondGraph = buildMotionGraph([
      boundary('geometry', 0, before, secondAfter, [intent('A', 0, 1000)]),
    ])

    expect(secondGraph.revision).not.toBe(firstGraph.revision)
  })

  it('keeps same-target reflow local and honors an explicit overlay presentation', () => {
    const before = snapshot(0, [item('A', 'list', 0), item('B', 'list', 20)])
    const after = snapshot(0, [item('A', 'list', 20), item('B', 'list', 0)])
    const localGraph = buildMotionGraph([
      boundary('local-list', 0, before, after, [intent('A', 0, 1000)]),
    ])
    const overlayGraph = buildMotionGraph([
      boundary('forced-overlay', 0, before, after, [{
        ...intent('A', 0, 1000),
        presentationMode: 'reparent',
      }]),
    ])

    expect(resolvePresentationFrame(localGraph, after, 500).items.get('A')?.representation).toBe('local')
    expect(resolvePresentationFrame(localGraph, after, 500).items.get('B')?.representation).toBe('local')
    expect(resolvePresentationFrame(overlayGraph, after, 500).items.get('A')?.representation).toBe('reparent')
  })
})

/** Creates one synthetic layout snapshot and derives all root poses recursively. */
function snapshot(timeMs: number, definitions: readonly ItemDefinition[]): LayoutSnapshot {
  const byId = new Map(definitions.map((definition) => [definition.id, definition]))
  const targetOrders = new Map<string, number>()
  for (const definition of definitions) {
    const nextOrder = targetOrders.get(definition.targetId) ?? 0
    targetOrders.set(definition.targetId, nextOrder + 1)
    targetOrders.set(`${definition.targetId}:${definition.id}`, nextOrder)
  }
  const items = new Map<string, LayoutItemSnapshot>()
  const visiting = new Set<string>()
  for (const definition of definitions) resolve(definition.id)
  return Object.freeze({ timeMs, revision: JSON.stringify(definitions), items })

  function resolve(id: string): LayoutItemSnapshot {
    const existing = items.get(id)
    if (existing !== undefined) return existing
    if (visiting.has(id)) throw new Error(`Synthetic layout cycle: ${id}`)
    const definition = byId.get(id)
    if (definition === undefined) throw new Error(`Synthetic layout item is missing: ${id}`)
    visiting.add(id)
    const localPose = relativePose(definition.x, definition.y ?? 0, definition.matrix)
    const parentPose = definition.parentId === undefined
      ? createMotionRootPose()
      : resolve(definition.parentId).rootPose
    const resolved = Object.freeze({
      itemId: id,
      ...(definition.parentId === undefined ? {} : { parentItemId: definition.parentId }),
      targetId: definition.targetId,
      targetOrder: targetOrders.get(`${definition.targetId}:${definition.id}`) ?? Number.MAX_SAFE_INTEGER,
      localPose,
      rootPose: composeMotionPose(parentPose, localPose),
    })
    items.set(id, resolved)
    visiting.delete(id)
    return resolved
  }
}

/** Creates one synthetic translation-only local pose. */
function relativePose(x: number, y: number, matrix = IDENTITY_MATRIX): RelativeMotionPose {
  return Object.freeze({ origin: [x, y] as const, matrix, width: 10, height: 10 })
}

/** Creates one direct intent using a linear easing for exact assertions. */
function intent(itemId: string, startAt: number, duration: number, delay = 0): MotionIntent {
  return Object.freeze({ id: `${itemId}:${startAt}`, itemId, startAt, duration, delay, ease: 'linear', presentationMode: 'local' })
}

/** Creates one immutable synthetic event boundary. */
function boundary(
  id: string,
  timeMs: number,
  before: LayoutSnapshot,
  after: LayoutSnapshot,
  intents: readonly MotionIntent[],
): MotionBoundary {
  return Object.freeze({ id, timeMs, before, after, intents: Object.freeze([...intents]) })
}

/** Creates one concise synthetic item definition. */
function item(id: string, targetId: string, x: number, parentId?: string): ItemDefinition {
  return Object.freeze({ id, targetId, x, ...(parentId === undefined ? {} : { parentId }) })
}

/** Creates one synthetic item with a measured affine rotation. */
function rotatedItem(id: string, targetId: string, x: number, degrees: number, parentId?: string): ItemDefinition {
  return Object.freeze({
    ...item(id, targetId, x, parentId),
    matrix: createRotateMatrix(degrees * Math.PI / 180),
  })
}

/** Creates a five-level hierarchy whose root is the only moving attachment. */
function nestedDefinitions(rootX: number): readonly ItemDefinition[] {
  return [
    item('P1', 'root', rootX),
    item('P2', 'P1:content', 10, 'P1'),
    item('P3', 'P2:content', 10, 'P2'),
    item('P4', 'P3:content', 10, 'P3'),
    item('P5', 'P4:content', 10, 'P4'),
  ]
}

/** Reads one resolved root origin for an assertion. */
function originX(frame: ReturnType<typeof resolvePresentationFrame>, itemId: string): number {
  const itemPresentation = frame.items.get(itemId)
  if (itemPresentation === undefined) throw new Error(`Presentation item is missing: ${itemId}`)
  return itemPresentation.pose.origin.x
}

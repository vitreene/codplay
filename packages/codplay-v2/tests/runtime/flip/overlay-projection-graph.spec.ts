import { describe, expect, it } from 'vitest'

import {
  createOverlayCaptureNode,
  createOverlayHandoffNode,
  isOverlayNodeContinuing,
  resolveOverlayProjectionPose,
  type OverlayProjectionNode,
} from '../../../src/runtime/flip/overlay-projection-graph'
import { FlipHistoricalPoseCache } from '../../../src/runtime/flip/flip-pose-graph'
import type { FlipCapture, HtmlFlipProjection, HtmlPose } from '../../../src/runtime/flip/types'

/** Creates one translation-only numeric pose for a graph fixture. */
function pose(x: number, y = 0): HtmlPose {
  const matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
  return {
    rect: { left: x, top: y, width: 10, height: 10 },
    origin: { x, y },
    matrix,
    parentMatrix: matrix,
    rotationMatrix: matrix,
    scaleX: 1,
    scaleY: 1,
    localWidth: 10,
    localHeight: 10,
    frameWidth: 10,
    frameHeight: 10,
  }
}

/** Creates one direct overlay capture with a distinct lifetime. */
function capture(itemId: string, duration: number, offset: number): FlipCapture {
  return {
    captureId: itemId,
    hostContextId: 'graph-host',
    projectionEpoch: 1,
    startAt: 0,
    endAt: duration,
    duration,
    ease: 'linear',
    ancestors: [],
    entries: [{
      itemId,
      ancestorIds: [],
      mode: 'overlay-world',
      startAt: 0,
      endAt: duration,
      duration,
      ease: 'linear',
      from: pose(offset),
      to: pose(offset + 100),
    }],
  }
}

describe('recursive FLIP overlay projection graph', () => {
  it('composes a stable sibling reflow with its active parent trajectory', () => {
    const parentCapture: FlipCapture = {
      captureId: 'parent-motion',
      hostContextId: 'graph-host',
      projectionEpoch: 1,
      startAt: 0,
      endAt: 1_000,
      duration: 1_000,
      ease: 'inOutQuad',
      ancestors: [],
      entries: [{
        itemId: 'parent',
        ancestorIds: [],
        mode: 'overlay-world',
        startAt: 0,
        endAt: 1_000,
        duration: 1_000,
        ease: 'inOutQuad',
        from: pose(0),
        to: pose(100),
      }],
    }
    const siblingCapture: FlipCapture = {
      captureId: 'sibling-reflow',
      hostContextId: 'graph-host',
      projectionEpoch: 1,
      startAt: 200,
      endAt: 1_200,
      duration: 1_000,
      ease: 'linear',
      ancestors: [],
      entries: [{
        itemId: 'sibling',
        ancestorIds: [],
        destinationParentId: 'parent',
        isDirectMover: false,
        mode: 'overlay-world',
        startAt: 200,
        endAt: 1_200,
        duration: 1_000,
        ease: 'linear',
        from: pose(28),
        to: pose(140),
      }],
    }
    const captures = new Map([
      [parentCapture.captureId, parentCapture],
      [siblingCapture.captureId, siblingCapture],
    ])
    const nodes = new Map<string, OverlayProjectionNode>([
      ['parent', createOverlayCaptureNode({
        itemId: 'parent',
        captureId: parentCapture.captureId,
        handle: 'parent',
      })],
      ['sibling', createOverlayCaptureNode({
        itemId: 'sibling',
        captureId: siblingCapture.captureId,
        handle: 'sibling',
        captureParentItemId: 'parent',
      })],
    ])
    const resolved = resolveOverlayProjectionPose(
      nodes.get('sibling')!,
      nodes,
      600,
      (captureId) => captures.get(captureId),
      {} as Pick<HtmlFlipProjection, 'captureHistoricalPose'>,
      new FlipHistoricalPoseCache(),
    )

    // Parent at 600ms = 68 (inOutQuad); sibling local reflow at 40% = 28,
    // so the composed world pose is 96 rather than the independent-world 72.
    expect(resolved?.pose.rect.left).toBeCloseTo(96)
  })

  it('keeps a five-level handoff chain resolvable after every child LAST', () => {
    const captures = new Map<string, FlipCapture>()
    const nodes = new Map<string, OverlayProjectionNode>()
    const projection = {} as Pick<HtmlFlipProjection, 'captureHistoricalPose'>
    const historicalPoseCache = new FlipHistoricalPoseCache()

    for (let depth = 0; depth <= 5; depth += 1) {
      const itemId = `level-${depth}`
      const duration = 1_000 - depth * 100
      const itemCapture = capture(itemId, duration, depth * 10)
      captures.set(itemId, itemCapture)
      nodes.set(itemId, createOverlayCaptureNode({
        itemId,
        captureId: itemId,
        handle: itemId,
      }))
    }

    for (let depth = 5; depth >= 1; depth -= 1) {
      const itemId = `level-${depth}`
      const parentId = `level-${depth - 1}`
      const node = nodes.get(itemId)!
      const parent = nodes.get(parentId)!
      const handoff = createOverlayHandoffNode(
        node,
        parent,
        captures.get(itemId)!.endAt,
        nodes,
        (captureId) => captures.get(captureId),
        projection,
        historicalPoseCache,
      )
      expect(handoff).toBeDefined()
      nodes.set(itemId, handoff!)
    }

    for (let depth = 0; depth <= 5; depth += 1) {
      const node = nodes.get(`level-${depth}`)!
      expect(isOverlayNodeContinuing(
        node,
        nodes,
        900,
        false,
        (captureId) => captures.get(captureId),
      )).toBe(true)
      expect(resolveOverlayProjectionPose(
        node,
        nodes,
        900,
        (captureId) => captures.get(captureId),
        projection,
        historicalPoseCache,
      )).toBeDefined()
    }

    expect(isOverlayNodeContinuing(
      nodes.get('level-5')!,
      nodes,
      1_000,
      false,
      (captureId) => captures.get(captureId),
    )).toBe(false)
  })
})

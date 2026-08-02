import { describe, expect, it, vi } from 'vitest'

import { preparePath } from '../../../src/ace'
import { captureFlip, FlipCaptureCache } from '../../../src/runtime/flip/flip-capture'
import { FlipHistoricalPoseCache, resolveFlipPoseGraph } from '../../../src/runtime/flip/flip-pose-graph'
import { HtmlFlipRuntime } from '../../../src/runtime/flip/html-flip-runtime'
import type { FlipCapture, HtmlFlipProjection, HtmlMatrix, HtmlPose } from '../../../src/runtime/flip/types'

const identity: HtmlMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

function pose(left: number, top = 0, width = 10, height = 10, matrix: HtmlMatrix = identity): HtmlPose {
  return {
    rect: { left, top, width, height },
    matrix,
    parentMatrix: identity,
    rotationMatrix: identity,
    scaleX: Math.hypot(matrix.a, matrix.b),
    scaleY: Math.hypot(matrix.c, matrix.d),
    localWidth: width,
    localHeight: height,
    frameWidth: width * Math.hypot(matrix.a, matrix.b),
    frameHeight: height * Math.hypot(matrix.c, matrix.d),
  }
}

function scale(value: number): HtmlMatrix {
  return { a: value, b: 0, c: 0, d: value, e: 0, f: 0 }
}

function projectionFor(poses: Map<string, HtmlPose>, log: string[] = []): HtmlFlipProjection {
  return {
    getHostContextId: () => 'host-1',
    getProjectionEpoch: () => 1,
    resolveHandle: (itemId) => itemId,
    capturePose: (handle) => {
      const itemId = String(handle)
      log.push(`capture:${itemId}`)
      const captured = poses.get(itemId)
      if (captured === undefined) throw new Error(`Missing test pose: ${itemId}`)
      return captured
    },
    applyLocalPose: vi.fn(),
    beginOverlay: vi.fn(() => ({})),
    applyOverlayPose: vi.fn(),
    finishOverlay: vi.fn(),
    flush: vi.fn(),
  }
}

function captureWithHierarchy(): FlipCapture {
  return {
    captureId: 'move-1',
    hostContextId: 'host-1',
    projectionEpoch: 1,
    startAt: 0,
    endAt: 1000,
    duration: 1000,
    easing: 'linear',
    ancestors: [
      {
        ancestorId: 'container',
        regime: 'composited',
        from: pose(100, 0, 20, 20, scale(2)),
        to: pose(200, 0, 20, 20, scale(2)),
      },
    ],
    entries: [
      {
        itemId: 'item',
        ancestorIds: ['container'],
        mode: 'local',
        startAt: 0,
        endAt: 1000,
        duration: 1000,
        easing: 'linear',
        from: pose(110, 0, 10, 10, scale(2)),
        to: pose(220, 0, 10, 10, scale(2)),
      },
    ],
  }
}

describe('HTML FLIP V2', () => {
  it('captures every touched item around one shared mutation', () => {
    const poses = new Map([
      ['first', pose(0)],
      ['second', pose(20)],
    ])
    const log: string[] = []
    const cache = new FlipCaptureCache()
    const capture = captureFlip({
      captureId: 'move-1',
      hostContextId: 'host-1',
      projectionEpoch: 1,
      startAt: 100,
      duration: 1000,
      easing: 'linear',
      entries: [
        { itemId: 'first', ancestorIds: [] },
        { itemId: 'second', ancestorIds: [] },
      ],
      mutate: () => {
        log.push('mutate')
        poses.set('first', pose(100))
        poses.set('second', pose(120))
      },
    }, projectionFor(poses, log), cache)

    expect(log).toEqual(['capture:first', 'capture:second', 'mutate', 'capture:first', 'capture:second'])
    expect(capture.entries.map((entry) => [entry.itemId, entry.from.rect.left, entry.to.rect.left])).toEqual([
      ['first', 0, 100],
      ['second', 20, 120],
    ])
    expect(cache.get('move-1')).toBe(capture)
    expect(cache.findActive('host-1', 1, 1100)).toBe(capture)
    expect(cache.findActive('host-1', 1, 1101)).toBeUndefined()
  })

  it('resolves child layout offsets through a transformed ancestor', () => {
    const [resolved] = resolveFlipPoseGraph(captureWithHierarchy(), 500)

    expect(resolved?.pose.rect.left).toBeCloseTo(165)
    expect(resolved?.pose.rect.width).toBeCloseTo(20)
    expect(resolved?.progress).toBeCloseTo(0.5)
  })

  it('preserves exact FIRST and LAST AABB anchors under a transformed ancestor', () => {
    const capture = captureWithHierarchy()
    const [first] = resolveFlipPoseGraph(capture, 0)
    const [last] = resolveFlipPoseGraph(capture, 1000)

    expect(first?.pose.rect.left).toBeCloseTo(capture.entries[0]!.from.rect.left)
    expect(first?.pose.rect.top).toBeCloseTo(capture.entries[0]!.from.rect.top)
    expect(last?.pose.rect.left).toBeCloseTo(capture.entries[0]!.to.rect.left)
    expect(last?.pose.rect.top).toBeCloseTo(capture.entries[0]!.to.rect.top)
  })

  it('does not apply an ancestor matrix translation twice', () => {
    const translated = (left: number): HtmlPose => pose(left + 10, 0, 10, 10, { ...scale(2), e: 10 })
    const capture = captureWithHierarchy()
    const translatedCapture: FlipCapture = {
      ...capture,
      ancestors: [{
        ...capture.ancestors[0]!,
        from: translated(100),
        to: translated(200),
      }],
      entries: [{
        ...capture.entries[0]!,
        from: translated(110),
        to: translated(220),
      }],
    }

    const [resolved] = resolveFlipPoseGraph(translatedCapture, 500)

    expect(resolved?.pose.rect.left).toBeCloseTo(175)
  })

  it('uses the host historical pose at a layout ancestor cut', () => {
    const capture = captureWithHierarchy()
    const layoutCapture: FlipCapture = {
      ...capture,
      ancestors: capture.ancestors.map((ancestor) => ({ ...ancestor, regime: 'layout' as const })),
      entries: capture.entries.map((entry) => ({
        ...entry,
        from: pose(110),
        to: pose(220),
      })),
    }

    const historicalPoseCache = new FlipHistoricalPoseCache()
    const captureHistoricalPose = vi.fn(({ timeMs }: { timeMs: number }) => pose(100 + timeMs / 10, 0, 20, 20))
    const [resolved] = resolveFlipPoseGraph(layoutCapture, 500, { captureHistoricalPose }, historicalPoseCache)
    resolveFlipPoseGraph(layoutCapture, 500, { captureHistoricalPose }, historicalPoseCache)

    expect(resolved?.pose.rect.left).toBeCloseTo(157.5)
    expect(captureHistoricalPose).toHaveBeenCalledOnce()
  })

  it('resolves a normalized trajectory against the world anchor', () => {
    const capture: FlipCapture = {
      captureId: 'move-path',
      hostContextId: 'host-1',
      projectionEpoch: 1,
      startAt: 0,
      endAt: 1000,
      duration: 1000,
      easing: 'linear',
      ancestors: [],
      entries: [{
        itemId: 'item',
        ancestorIds: [],
        mode: 'local',
        startAt: 0,
        endAt: 1000,
        duration: 1000,
        easing: 'linear',
        from: pose(0),
        to: pose(100),
        path: preparePath({ control: [0.5, 1] }, { traversal: 'parameter' }),
      }],
    }

    const [resolved] = resolveFlipPoseGraph(capture, 500)

    expect(resolved?.pose.rect.left).toBeCloseTo(50)
    expect(resolved?.pose.rect.top).toBeCloseTo(50)
  })

  it('rejects an unresolved layout ancestor instead of using a baseline', () => {
    expect(() => resolveFlipPoseGraph({
      ...captureWithHierarchy(),
      ancestors: captureWithHierarchy().ancestors.map((ancestor) => ({ ...ancestor, regime: 'layout' as const })),
    }, 500)).toThrow(/layout ancestor measurement is unavailable/)
  })

  it('commits one final pose and one flush for a seek', () => {
    const poses = new Map([['item', pose(0)]])
    const projection = projectionFor(poses)
    const runtime = new HtmlFlipRuntime(projection)
    const capture = captureFlip({
      captureId: 'move-runtime',
      hostContextId: 'host-1',
      projectionEpoch: 1,
      startAt: 0,
      duration: 1000,
      easing: 'linear',
      entries: [{ itemId: 'item', ancestorIds: [] }],
      mutate: () => poses.set('item', pose(100)),
    }, projection, new FlipCaptureCache())

    runtime.seek(capture, 500)

    expect(projection.applyLocalPose).toHaveBeenCalledOnce()
    expect(projection.flush).toHaveBeenCalledOnce()
  })

  it('realizes a cold seek through the consumer resolver and caches it', () => {
    const poses = new Map([['item', pose(0)]])
    const projection = projectionFor(poses)
    const capture = captureFlip({
      captureId: 'move-cold',
      hostContextId: 'host-1',
      projectionEpoch: 1,
      startAt: 0,
      duration: 1000,
      easing: 'linear',
      entries: [{ itemId: 'item', ancestorIds: [] }],
      mutate: () => poses.set('item', pose(100)),
    }, projection, new FlipCaptureCache())
    const resolver = vi.fn(() => capture)
    const runtime = new HtmlFlipRuntime(projection, new FlipCaptureCache(), resolver)

    runtime.seekCached('host-1', 1, 500)
    runtime.seekCached('host-1', 1, 500)

    expect(resolver).toHaveBeenCalledOnce()
    expect(projection.applyLocalPose).toHaveBeenCalledTimes(2)
  })

  it('rejects a capture submitted from another host context', () => {
    const projection = projectionFor(new Map([['item', pose(0)]]))

    expect(() => captureFlip({
      captureId: 'foreign-move',
      hostContextId: 'host-2',
      projectionEpoch: 1,
      startAt: 0,
      duration: 1000,
      entries: [{ itemId: 'item', ancestorIds: [] }],
      mutate: () => undefined,
    }, projection, new FlipCaptureCache())).toThrow(/crosses host contexts/)
  })
})

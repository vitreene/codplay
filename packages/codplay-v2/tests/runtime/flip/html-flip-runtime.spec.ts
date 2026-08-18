import { describe, expect, it, vi } from 'vitest'

import { preparePath } from '../../../src/ace'
import { captureFlip, FlipCaptureCache } from '../../../src/runtime/flip/flip-capture'
import { FlipHistoricalPoseCache, resolveFlipPoseGraph } from '../../../src/runtime/flip/flip-pose-graph'
import { HtmlFlipRuntime } from '../../../src/runtime/flip/html-flip-runtime'
import type { FlipCapture, FlipCaptureDescriptor, HtmlFlipProjection, HtmlMatrix, HtmlPose, ResolvedFlipPose } from '../../../src/runtime/flip/types'

const identity: HtmlMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

function pose(left: number, top = 0, width = 10, height = 10, matrix: HtmlMatrix = identity): HtmlPose {
  return {
    rect: { left, top, width, height },
    origin: { x: left, y: top },
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
    captureHistoricalPose: ({ ancestorId }) => {
      const captured = poses.get(ancestorId)
      if (captured === undefined) throw new Error(`Missing test historical pose: ${ancestorId}`)
      return captured
    },
    applyLocalPose: vi.fn(),
    finishLocalPose: vi.fn(),
    cancelLocalPose: vi.fn(),
    beginOverlay: vi.fn(() => ({})),
    applyOverlayPose: vi.fn(),
    finishOverlay: vi.fn(),
    flush: vi.fn(),
  }
}

function captureValue(result: ReturnType<HtmlFlipRuntime['capture']>): FlipCapture {
  if (!result.ok) throw new Error(result.diagnostics.errors.map((entry) => entry.message).join('\n'))
  return result.value
}

function captureWithHierarchy(): FlipCapture {
  return {
    captureId: 'move-1',
    hostContextId: 'host-1',
    projectionEpoch: 1,
    startAt: 0,
    endAt: 1000,
    duration: 1000,
    ease: 'linear',
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
        ease: 'linear',
        from: pose(110, 0, 10, 10, scale(2)),
        to: pose(220, 0, 10, 10, scale(2)),
      },
    ],
  }
}

function captureWithGrandparentHierarchy(): FlipCapture {
  return {
    captureId: 'move-grandparent',
    hostContextId: 'host-1',
    projectionEpoch: 1,
    startAt: 0,
    endAt: 1000,
    duration: 1000,
    ease: 'linear',
    ancestors: [
      {
        ancestorId: 'stage',
        regime: 'composited',
        from: pose(100, 0, 40, 40, scale(2)),
        to: pose(200, 0, 40, 40, scale(2)),
      },
      {
        ancestorId: 'container',
        parentId: 'stage',
        regime: 'composited',
        from: pose(110, 0, 20, 20, scale(2)),
        to: pose(220, 0, 20, 20, scale(2)),
      },
    ],
    entries: [
      {
        itemId: 'item',
        ancestorIds: ['stage', 'container'],
        mode: 'local',
        startAt: 0,
        endAt: 1000,
        duration: 1000,
        ease: 'linear',
        from: pose(115, 0, 10, 10, scale(2)),
        to: pose(230, 0, 10, 10, scale(2)),
      },
    ],
  }
}

function captureWithCrossContainerOverlay(): FlipCapture {
  return {
    captureId: 'move-cross-container',
    hostContextId: 'host-1',
    projectionEpoch: 1,
    startAt: 0,
    endAt: 1000,
    duration: 1000,
    ease: 'linear',
    ancestors: [
      {
        ancestorId: 'container-a',
        regime: 'composited',
        from: pose(100, 0, 40, 40),
        to: pose(150, 0, 40, 40),
      },
      {
        ancestorId: 'container-b',
        regime: 'composited',
        from: pose(300, 0, 40, 40),
        to: pose(350, 0, 40, 40),
      },
    ],
    entries: [
      {
        itemId: 'item',
        ancestorIds: ['container-b'],
        mode: 'overlay-world',
        startAt: 0,
        endAt: 1000,
        duration: 1000,
        ease: 'linear',
        from: pose(120, 0, 10, 10),
        to: pose(320, 0, 10, 10),
      },
    ],
  }
}

/** Creates one positive-time capture used by the cold-seek convergence gate. */
function captureForColdSeek(captureId = 'cold-seek-gate', projectionEpoch = 1): FlipCapture {
  return {
    captureId,
    hostContextId: 'host-1',
    projectionEpoch,
    startAt: 100,
    endAt: 1100,
    duration: 1000,
    ease: 'linear',
    ancestors: [],
    entries: [{
      itemId: 'item',
      ancestorIds: [],
      mode: 'local',
      startAt: 100,
      endAt: 1100,
      duration: 1000,
      ease: 'linear',
      from: pose(0),
      to: pose(100),
    }],
  }
}

/** Returns the schedule descriptor corresponding to one persisted capture. */
function descriptorFor(capture: FlipCapture): FlipCaptureDescriptor {
  return { captureId: capture.captureId, startAt: capture.startAt, endAt: capture.endAt }
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
      ease: 'linear',
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

  it('resolves an item through both a parent and grandparent FLIP ancestor', () => {
    const capture = captureWithGrandparentHierarchy()
    const [first] = resolveFlipPoseGraph(capture, 0)
    const [middle] = resolveFlipPoseGraph(capture, 500)
    const [last] = resolveFlipPoseGraph(capture, 1000)

    expect(first?.pose.rect.left).toBeCloseTo(capture.entries[0]!.from.rect.left)
    expect(middle?.pose.rect.left).toBeGreaterThan(first?.pose.rect.left ?? 0)
    expect(last?.pose.rect.left).toBeCloseTo(capture.entries[0]!.to.rect.left)
  })

  it('resolves a cross-container overlay directly in world space', () => {
    const capture = captureWithCrossContainerOverlay()
    const [first] = resolveFlipPoseGraph(capture, 0)
    const [middle] = resolveFlipPoseGraph(capture, 500)
    const [last] = resolveFlipPoseGraph(capture, 1000)

    expect(first?.pose.rect.left).toBeCloseTo(120)
    expect(middle?.pose.rect.left).toBeCloseTo(220)
    expect(last?.pose.rect.left).toBeCloseTo(320)
  })

  it('resolves each layout ancestor through the historical host pose', () => {
    const capture: FlipCapture = {
      ...captureWithGrandparentHierarchy(),
      ancestors: captureWithGrandparentHierarchy().ancestors.map((ancestor) => ({ ...ancestor, regime: 'layout' as const })),
    }
    const historical = vi.fn(({ ancestorId, timeMs }: { ancestorId: string; timeMs: number }) =>
      pose(ancestorId === 'stage' ? 100 + timeMs / 10 : 110 + timeMs / 10, 0, 20, 20),
    )
    const cache = new FlipHistoricalPoseCache()

    resolveFlipPoseGraph(capture, 500, { captureHistoricalPose: historical }, cache)
    resolveFlipPoseGraph(capture, 500, { captureHistoricalPose: historical }, cache)

    expect(historical).toHaveBeenCalledTimes(2)
  })

  it('uses the highest layout ancestor as the historical cut before composing descendants', () => {
    const base = captureWithGrandparentHierarchy()
    const capture: FlipCapture = {
      ...base,
      ancestors: [
        { ...base.ancestors[0]!, regime: 'layout' },
        { ...base.ancestors[1]!, regime: 'composited' },
      ],
    }
    const historical = vi.fn(({ timeMs }: { timeMs: number }) => pose(100 + timeMs / 10, 0, 40, 40, scale(2)))

    const [resolved] = resolveFlipPoseGraph(capture, 500, { captureHistoricalPose: historical })

    expect(Number.isFinite(resolved?.pose.rect.left)).toBe(true)
    expect(historical).toHaveBeenCalledOnce()
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
      ease: 'linear',
      ancestors: [],
      entries: [{
        itemId: 'item',
        ancestorIds: [],
        mode: 'local',
        startAt: 0,
        endAt: 1000,
        duration: 1000,
        ease: 'linear',
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
      ease: 'linear',
      entries: [{ itemId: 'item', ancestorIds: [] }],
      mutate: () => poses.set('item', pose(100)),
    }, projection, new FlipCaptureCache())

    runtime.seek(capture, 500)

    expect(projection.applyLocalPose).toHaveBeenCalledOnce()
    expect(projection.flush).toHaveBeenCalledOnce()
  })

  it('finishes local ownership at the capture boundary and cancels it on retarget', () => {
    const poses = new Map([['item', pose(0)]])
    const projection = projectionFor(poses)
    const runtime = new HtmlFlipRuntime(projection)
    const first = captureValue(runtime.capture({
      captureId: 'local-first',
      hostContextId: 'host-1',
      projectionEpoch: 1,
      startAt: 0,
      duration: 1000,
      ease: 'linear',
      entries: [{ itemId: 'item', ancestorIds: [] }],
      mutate: () => poses.set('item', pose(100)),
    }))

    runtime.seek(first, 500)
    const second = captureValue(runtime.capture({
      captureId: 'local-second',
      hostContextId: 'host-1',
      projectionEpoch: 1,
      startAt: 1000,
      duration: 1000,
      ease: 'linear',
      entries: [{ itemId: 'item', ancestorIds: [] }],
      mutate: () => poses.set('item', pose(200)),
    }))

    runtime.seek(second, 1500)
    expect(projection.cancelLocalPose).toHaveBeenCalledWith('item', 'local-first')

    runtime.seek(second, 2000)
    expect(projection.finishLocalPose).toHaveBeenCalledWith('item', 'local-second')
  })

  it('cancels local ownership when playback is stopped', () => {
    const poses = new Map([['item', pose(0)]])
    const projection = projectionFor(poses)
    const runtime = new HtmlFlipRuntime(projection)
    const capture = captureValue(runtime.capture({
      captureId: 'local-cancel',
      hostContextId: 'host-1',
      projectionEpoch: 1,
      startAt: 0,
      duration: 1000,
      entries: [{ itemId: 'item', ancestorIds: [] }],
      mutate: () => poses.set('item', pose(100)),
    }))

    runtime.seek(capture, 500)
    runtime.cancel()

    expect(projection.cancelLocalPose).toHaveBeenCalledWith('item', 'local-cancel')
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
      ease: 'linear',
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

  it('converges cold seek at start, middle and end, including seek-back and repeated seek', () => {
    const capture = captureForColdSeek()
    const applied: ResolvedFlipPose[] = []
    const baseProjection = projectionFor(new Map([['item', pose(0)]]))
    const projection: HtmlFlipProjection = {
      ...baseProjection,
      applyLocalPose: vi.fn((_handle, resolved) => applied.push(resolved)),
    }
    const resolver = vi.fn(() => capture)
    const runtime = new HtmlFlipRuntime(projection, new FlipCaptureCache(), resolver, {
      getActiveCaptureDescriptors: (timeMs) => timeMs >= capture.startAt && timeMs <= capture.endAt
        ? [descriptorFor(capture)]
        : [],
    })

    expect(runtime.seekCached('host-1', 1, 0).ok).toBe(true)
    expect(runtime.seekCached('host-1', 1, 100).ok).toBe(true)
    expect(runtime.seekCached('host-1', 1, 600).ok).toBe(true)
    expect(runtime.seekCached('host-1', 1, 1100).ok).toBe(true)
    expect(runtime.seekCached('host-1', 1, 600).ok).toBe(true)
    expect(runtime.seekCached('host-1', 1, 600).ok).toBe(true)

    expect(resolver).toHaveBeenCalledOnce()
    expect(applied.map((entry) => entry.progress)).toEqual([0, 0.5, 1, 0.5, 0.5])
    expect(projection.flush).toHaveBeenCalledTimes(5)
  })

  it('uses the same resolved poses for direct play and cold seek', () => {
    const capture = captureForColdSeek('play-seek-gate')
    const playApplied: ResolvedFlipPose[] = []
    const playFlush = vi.fn()
    const playProjection: HtmlFlipProjection = {
      ...projectionFor(new Map([['item', pose(0)]])),
      applyLocalPose: vi.fn((_handle, resolved) => playApplied.push(resolved)),
      flush: playFlush,
    }
    const playRuntime = new HtmlFlipRuntime(playProjection)
    const seekApplied: ResolvedFlipPose[] = []
    const seekFlush = vi.fn()
    const seekProjection: HtmlFlipProjection = {
      ...projectionFor(new Map([['item', pose(0)]])),
      applyLocalPose: vi.fn((_handle, resolved) => seekApplied.push(resolved)),
      flush: seekFlush,
    }
    const seekRuntime = new HtmlFlipRuntime(seekProjection, new FlipCaptureCache(), () => capture, {
      getActiveCaptureDescriptors: () => [descriptorFor(capture)],
    })

    for (const timeMs of [100, 600, 1100]) {
      expect(playRuntime.seek(capture, timeMs).ok).toBe(true)
      expect(seekRuntime.seekCached('host-1', 1, timeMs).ok).toBe(true)
    }

    expect(seekApplied).toEqual(playApplied)
    expect(seekFlush).toHaveBeenCalledTimes(playFlush.mock.calls.length)
  })

  it('invalidates the old epoch and realizes the same cold seek in the new epoch', () => {
    let projectionEpoch = 1
    const firstCapture = captureForColdSeek('resize-cold-seek', 1)
    const secondCapture = captureForColdSeek('resize-cold-seek', 2)
    const baseProjection = projectionFor(new Map([['item', pose(0)]]))
    const projection: HtmlFlipProjection = {
      ...baseProjection,
      getProjectionEpoch: () => projectionEpoch,
    }
    const resolver = vi.fn(({ projectionEpoch: requestedEpoch }: { projectionEpoch: number }) => requestedEpoch === 1
      ? firstCapture
      : secondCapture)
    const runtime = new HtmlFlipRuntime(projection, new FlipCaptureCache(), resolver, {
      getActiveCaptureDescriptors: () => [descriptorFor(firstCapture)],
    })

    expect(runtime.seekCached('host-1', 1, 600).ok).toBe(true)
    projectionEpoch = 2
    expect(runtime.invalidateHost('host-1', 2).ok).toBe(true)
    expect(runtime.seekCached('host-1', 2, 600).ok).toBe(true)

    expect(resolver).toHaveBeenCalledTimes(2)
    expect(resolver.mock.calls.map(([input]) => input.projectionEpoch)).toEqual([1, 2])
    expect(projection.cancelLocalPose).toHaveBeenCalledWith('item', 'resize-cold-seek')
    expect(projection.flush).toHaveBeenCalledTimes(2)
  })

  it('resolves every missing active capture in one seek commit', () => {
    const projection = projectionFor(new Map([
      ['first', pose(0)],
      ['second', pose(20)],
    ]))
    const capture = (captureId: string, itemId: string): FlipCapture => ({
      captureId,
      hostContextId: 'host-1',
      projectionEpoch: 1,
      startAt: 0,
      endAt: 1000,
      duration: 1000,
      ease: 'linear',
      entries: [{
        itemId,
        ancestorIds: [],
        mode: 'local',
        startAt: 0,
        endAt: 1000,
        duration: 1000,
        ease: 'linear',
        from: pose(itemId === 'first' ? 0 : 20),
        to: pose(itemId === 'first' ? 100 : 120),
      }],
      ancestors: [],
    })
    const first = capture('compiled:first', 'first')
    const second = capture('compiled:second', 'second')
    const resolver = vi.fn(({ captures }: { captures: readonly { captureId: string }[] }) => {
      expect(captures.map((descriptor) => descriptor.captureId)).toEqual(['compiled:first', 'compiled:second'])
      return [first, second]
    })
    const runtime = new HtmlFlipRuntime(projection, new FlipCaptureCache(), resolver, {
      getActiveCaptureDescriptors: () => [
        { captureId: first.captureId, startAt: first.startAt, endAt: first.endAt },
        { captureId: second.captureId, startAt: second.startAt, endAt: second.endAt },
      ],
    })

    expect(runtime.seekCached('host-1', 1, 500).ok).toBe(true)
    expect(runtime.seekCached('host-1', 1, 500).ok).toBe(true)
    expect(resolver).toHaveBeenCalledOnce()
    expect(projection.applyLocalPose).toHaveBeenCalledTimes(4)
    expect(projection.flush).toHaveBeenCalledTimes(2)
  })

  it('resolves overlapping cached captures in one projection commit', () => {
    const poses = new Map([
      ['first', pose(0)],
      ['second', pose(20)],
    ])
    const projection = projectionFor(poses)
    const runtime = new HtmlFlipRuntime(projection)

    captureValue(runtime.capture({
      captureId: 'overlap-first',
      hostContextId: 'host-1',
      projectionEpoch: 1,
      startAt: 0,
      duration: 1000,
      ease: 'linear',
      entries: [{ itemId: 'first', ancestorIds: [] }],
      mutate: () => poses.set('first', pose(100)),
    }))
    captureValue(runtime.capture({
      captureId: 'overlap-second',
      hostContextId: 'host-1',
      projectionEpoch: 1,
      startAt: 100,
      duration: 1000,
      ease: 'linear',
      entries: [{ itemId: 'second', ancestorIds: [] }],
      mutate: () => poses.set('second', pose(220)),
    }))

    const result = runtime.seekCached('host-1', 1, 500)

    expect(result.ok).toBe(true)
    expect(projection.applyLocalPose).toHaveBeenCalledTimes(2)
    expect(projection.flush).toHaveBeenCalledOnce()
  })

  it('presents an active overlay before capturing a nested overlay mutation', () => {
    const poses = new Map([
      ['parent', pose(0)],
      ['child', pose(10)],
    ])
    const projection = projectionFor(poses)
    const runtime = new HtmlFlipRuntime(projection)

    const parent = captureValue(runtime.capture({
      captureId: 'overlay-parent',
      hostContextId: 'host-1',
      projectionEpoch: 1,
      startAt: 0,
      duration: 1000,
      ease: 'linear',
      entries: [{ itemId: 'parent', ancestorIds: [], mode: 'overlay-world' }],
      mutate: () => poses.set('parent', pose(100)),
    }))
    runtime.seek(parent, 500)

    captureValue(runtime.capture({
      captureId: 'overlay-child',
      hostContextId: 'host-1',
      projectionEpoch: 1,
      startAt: 500,
      duration: 500,
      ease: 'linear',
      entries: [{ itemId: 'child', ancestorIds: [], mode: 'overlay-world' }],
      mutate: () => poses.set('child', pose(110)),
    }))

    expect(projection.applyOverlayPose).toHaveBeenCalledTimes(3)
  })

  it('finishes an expired capture before resolving the next play frame', () => {
    const poses = new Map([['item', pose(0)]])
    const projection = projectionFor(poses)
    const runtime = new HtmlFlipRuntime(projection)
    const first = captureValue(runtime.capture({
      captureId: 'overlay-expired-first',
      hostContextId: 'host-1',
      projectionEpoch: 1,
      startAt: 0,
      duration: 1000,
      ease: 'linear',
      entries: [{ itemId: 'item', ancestorIds: [], mode: 'overlay-world' }],
      mutate: () => poses.set('item', pose(100)),
    }))
    runtime.seek(first, 500)

    captureValue(runtime.capture({
      captureId: 'overlay-expired-next',
      hostContextId: 'host-1',
      projectionEpoch: 1,
      startAt: 1000,
      duration: 1000,
      ease: 'linear',
      entries: [{ itemId: 'item', ancestorIds: [], mode: 'overlay-world' }],
      mutate: () => poses.set('item', pose(200)),
    }))

    runtime.seekCached('host-1', 1, 1500)

    expect(projection.finishOverlay).toHaveBeenCalledOnce()
    expect(projection.applyOverlayPose).toHaveBeenCalledTimes(2)
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

  it('returns a structured diagnostic at the runtime boundary for a bad capture', () => {
    const projection = projectionFor(new Map([['item', pose(0)]]))
    const output = vi.fn()
    const runtime = new HtmlFlipRuntime(projection, new FlipCaptureCache(), undefined, { diagnosticOutput: output })

    const result = runtime.capture({
      captureId: 'runtime-invalid',
      hostContextId: 'host-2',
      projectionEpoch: 1,
      startAt: 0,
      duration: 1000,
      entries: [{ itemId: 'item', ancestorIds: [] }],
      mutate: () => undefined,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.diagnostics.errors.map((entry) => entry.code)).toEqual(['RUNTIME_FLIP_CAPTURE_FAILED'])
    expect(output).toHaveBeenCalledOnce()
  })

  it('returns a structured diagnostic at the runtime boundary for a bad seek', () => {
    const projection = projectionFor(new Map([['item', pose(0)]]))
    const runtime = new HtmlFlipRuntime(projection)

    const result = runtime.seek({
      ...captureWithHierarchy(),
      hostContextId: 'host-2',
    }, 500)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.diagnostics.errors.map((entry) => entry.code)).toEqual(['RUNTIME_FLIP_SEEK_FAILED'])
  })

  it('rejects an ancestor cycle before capturing DOM poses', () => {
    const projection = projectionFor(new Map([['item', pose(0)]]))

    expect(() => captureFlip({
      captureId: 'cycle',
      hostContextId: 'host-1',
      projectionEpoch: 1,
      startAt: 0,
      duration: 1000,
      entries: [{ itemId: 'item', ancestorIds: [] }],
      ancestors: [
        { ancestorId: 'parent', parentId: 'grandparent', regime: 'composited' },
        { ancestorId: 'grandparent', parentId: 'parent', regime: 'composited' },
      ],
      mutate: () => undefined,
    }, projection, new FlipCaptureCache())).toThrow(/ancestor cycle detected/)
  })

  it('rejects an item ancestor chain that skips its declared parent', () => {
    const projection = projectionFor(new Map([['item', pose(0)]]))

    expect(() => captureFlip({
      captureId: 'unordered-chain',
      hostContextId: 'host-1',
      projectionEpoch: 1,
      startAt: 0,
      duration: 1000,
      entries: [{ itemId: 'item', ancestorIds: ['stage', 'container'] }],
      ancestors: [
        { ancestorId: 'stage', regime: 'composited' },
        { ancestorId: 'container', parentId: 'other', regime: 'composited' },
        { ancestorId: 'other', regime: 'composited' },
      ],
      mutate: () => undefined,
    }, projection, new FlipCaptureCache())).toThrow(/ancestor chain is not ordered/)
  })
})

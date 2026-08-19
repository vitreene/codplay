import { describe, expect, it, vi } from 'vitest'
import { HtmlFlipRuntime } from '../../../src/runtime/flip'
import type { HtmlFlipProjection, HtmlMatrix, HtmlPose } from '../../../src/runtime/flip'
import { HtmlPresentationTransaction } from '../../../src/runtime/runner'

const identity: HtmlMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

/** Creates one deterministic pose for the transaction read-phase assertions. */
function pose(left: number): HtmlPose {
  return {
    rect: { left, top: 0, width: 10, height: 10 },
    origin: { x: left, y: 0 },
    matrix: identity,
    parentMatrix: identity,
    rotationMatrix: identity,
    scaleX: 1,
    scaleY: 1,
    localWidth: 10,
    localHeight: 10,
    frameWidth: 10,
    frameHeight: 10,
  }
}

/** Creates a host projection that records all synchronous read and write calls. */
function projection(events: string[], left: { value: number }, overlayPhases?: string[]): HtmlFlipProjection {
  return {
    getHostContextId: () => 'host',
    getProjectionEpoch: () => 2,
    resolveHandle: (itemId) => itemId,
    capturePose: (handle) => {
      events.push(`read:${String(handle)}`)
      return pose(left.value)
    },
    ...(overlayPhases === undefined ? {} : {
      captureOverlayPose: (_handle: unknown, options?: Readonly<{ phase?: 'first' | 'last' }>) => {
        overlayPhases.push(options?.phase ?? 'missing')
        return pose(left.value)
      },
    }),
    captureHistoricalPose: () => pose(left.value),
    applyLocalPose: (handle) => events.push(`apply:${String(handle)}`),
    finishLocalPose: vi.fn(),
    cancelLocalPose: vi.fn(),
    beginOverlay: vi.fn(() => ({})),
    applyOverlayPose: vi.fn(),
    finishOverlay: vi.fn(),
    flush: vi.fn(() => events.push('flush')),
  }
}

describe('HtmlPresentationTransaction', () => {
  it('reads all FIRST poses before LAST writes and restores historical state', () => {
    const events: string[] = []
    const left = { value: 10 }
    const transaction = new HtmlPresentationTransaction({
      projection: projection(events, left),
      present: (current) => events.push(`present:${current.timeMs}`),
      restore: () => events.push('restore'),
    })

    const tree = transaction.measure({
      description: {
        hostContextId: 'host',
        projectionEpoch: 2,
        entries: [{ itemId: 'item', ancestorIds: ['ancestor'], mode: 'local' }],
        ancestors: [{ ancestorId: 'ancestor', regime: 'stable' }],
      },
      logicalTimeMs: 150,
      prepareFirst: () => events.push('prepare-first'),
      presentLast: () => {
        events.push('present-last')
        left.value = 90
      },
      restoreAfter: true,
    })

    expect(events).toEqual([
      'prepare-first',
      'read:ancestor',
      'read:item',
      'present-last',
      'read:ancestor',
      'read:item',
      'restore',
    ])
    expect(tree.items[0]?.first.rect.left).toBe(10)
    expect(tree.items[0]?.last.rect.left).toBe(90)
    expect(tree.ancestors[0]?.first.rect.left).toBe(10)
    expect(tree.ancestors[0]?.last.rect.left).toBe(90)
  })

  it('labels overlay reads so concurrent FIRST uses the current ghost pose', () => {
    const phases: string[] = []
    const transaction = new HtmlPresentationTransaction({
      projection: projection([], { value: 10 }, phases),
      present: () => undefined,
      restore: () => undefined,
    })

    transaction.measure({
      description: {
        hostContextId: 'host',
        projectionEpoch: 2,
        entries: [{ itemId: 'item', ancestorIds: [], mode: 'overlay-world' }],
        ancestors: [],
      },
      logicalTimeMs: 150,
      presentLast: () => undefined,
    })

    expect(phases).toEqual(['first', 'last'])
  })

  it('records a measurement tree and resolves one pose with one flush', () => {
    const events: string[] = []
    const htmlProjection = projection(events, { value: 100 })
    const runtime = new HtmlFlipRuntime(htmlProjection)
    const recorded = runtime.recordMeasurementTree({
      hostContextId: 'host',
      projectionEpoch: 2,
      logicalTimeMs: 50,
      items: [{
        itemId: 'item',
        ancestorIds: [],
        mode: 'local',
        first: pose(0),
        last: pose(100),
      }],
      ancestors: [],
    }, { captureId: 'stable-occurrence', startAt: 0, duration: 100, ease: 'linear' })

    expect(recorded.ok).toBe(true)
    if (!recorded.ok) return
    expect(runtime.seek(recorded.value, 50).ok).toBe(true)
    expect(events).toEqual(['apply:item', 'flush'])
  })
})

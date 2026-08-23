import { describe, expect, it } from 'vitest'

import { HtmlMotionSystem } from '../../../src/runtime/runner'
import type { HtmlMotionPresentationHost } from '../../../src/runtime/runner/html-motion-presentation-host'
import type { HtmlMatrix, HtmlPose } from '../../../src/runtime/motion/html-types'
import type {
  LayoutSnapshot,
  MotionBoundary,
  MotionIntent,
  PresentationFrame,
  RelativeMotionPose,
} from '../../../src/runtime/motion'

const IDENTITY_MATRIX: HtmlMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

describe('HtmlMotionSystem live capture handoff', () => {
  it('uses the live release pose only before seek and replays the persist-only path after clearing it', () => {
    const source = createSnapshot(0, 'list-a', 0)
    const target = createSnapshot(0, 'list-b', 100)
    const targetAtRelease = createSnapshot(100, 'list-b', 100)
    const liveRelease = createSnapshot(100, 'list-a', 60)
    const frames: PresentationFrame[] = []
    const host = {
      commit: (frame: PresentationFrame): void => {
        frames.push(frame)
      },
      prepareNaturalCapture: (): void => undefined,
      destroy: (): void => undefined,
    }
    const system = new HtmlMotionSystem({
      host: host as unknown as HtmlMotionPresentationHost,
      captureCurrent: () => targetAtRelease,
    })

    const replayBoundaries = [
      createBoundary(0, source, target, 'persist-only'),
      createBoundary(100, targetAtRelease, targetAtRelease, 'end-emit'),
    ]
    const liveBoundaries = [
      createBoundary(100, liveRelease, targetAtRelease, 'end-emit'),
    ]
    system.initialize()
    system.setBoundaries(liveBoundaries)
    system.present(100)
    expect(frames.at(-1)?.items.get('item')?.pose.origin.x).toBe(60)

    system.setBoundaries(replayBoundaries)
    system.present(100)
    expect(frames.at(-1)?.items.get('item')?.pose.origin.x).toBe(100)
  })

  it('replaces the live source when two captures close at one logical time', () => {
    const targetAtRelease = createSnapshot(100, 'list-b', 100)
    const firstLiveRelease = createSnapshot(100, 'list-a', 20)
    const secondLiveRelease = createSnapshot(100, 'list-a', 80)
    const frames: PresentationFrame[] = []
    const host = {
      commit: (frame: PresentationFrame): void => {
        frames.push(frame)
      },
      prepareNaturalCapture: (): void => undefined,
      destroy: (): void => undefined,
    }
    const system = new HtmlMotionSystem({
      host: host as unknown as HtmlMotionPresentationHost,
      captureCurrent: () => targetAtRelease,
    })

    system.setBoundaries([createBoundary(100, firstLiveRelease, targetAtRelease, 'end-emit')])
    system.initialize()
    system.setBoundaries([createBoundary(100, secondLiveRelease, targetAtRelease, 'end-emit')])
    system.present(100)

    expect(frames.at(-1)?.items.get('item')?.pose.origin.x).toBe(80)
  })

  it('uses the latest live source for each later boundary without replaying the earlier path', () => {
    const source = createSnapshot(100, 'list-a', 40)
    const firstTarget = createSnapshot(100, 'list-b', 100)
    const secondSource = createSnapshot(200, 'list-b', 140)
    const secondTarget = createSnapshot(200, 'list-a', 220)
    const frames: PresentationFrame[] = []
    const host = {
      commit: (frame: PresentationFrame): void => {
        frames.push(frame)
      },
      prepareNaturalCapture: (): void => undefined,
      destroy: (): void => undefined,
    }
    const system = new HtmlMotionSystem({
      host: host as unknown as HtmlMotionPresentationHost,
      captureCurrent: () => secondTarget,
    })

    system.setBoundaries([
      createBoundary(100, source, firstTarget, 'end-emit-1'),
      createBoundary(200, secondSource, secondTarget, 'end-emit-2'),
    ])
    system.initialize()
    system.present(200)

    const item = frames.at(-1)?.items.get('item')
    expect(item?.pose.origin.x).toBe(140)
    expect(item?.activeSegmentId).toContain('200')

    system.present(250)
    expect(frames.at(-1)?.items.get('item')?.pose.origin.x).toBe(180)
  })

  it('uses only the captured boundary data and current active layout', () => {
    const frames: PresentationFrame[] = []
    const host = {
      commit: (frame: PresentationFrame): void => {
        frames.push(frame)
      },
      prepareNaturalCapture: (): void => undefined,
      destroy: (): void => undefined,
    }
    const source = createSnapshot(0, 'list-a', 0)
    const target = createSnapshot(0, 'list-b', 100)
    let captureCalls = 0
    const system = new HtmlMotionSystem({
      host: host as unknown as HtmlMotionPresentationHost,
      boundaries: [createBoundary(0, source, target, 'move')],
      captureCurrent: () => {
        captureCalls += 1
        return target
      },
    })

    system.initialize()
    system.present(0)
    system.present(0)
    expect(captureCalls).toBe(2)
    expect(frames.at(-1)?.items.get('item')?.pose.origin.x).toBe(0)
  })

  it('clears the previous presentation before capturing natural geometry', () => {
    const order: string[] = []
    const host = {
      commit: (): void => {
        order.push('commit')
      },
      prepareNaturalCapture: (): void => {
        order.push('clear')
      },
      destroy: (): void => undefined,
    }
    const system = new HtmlMotionSystem({
      host: host as unknown as HtmlMotionPresentationHost,
      captureCurrent: () => {
        order.push('capture')
        return createSnapshot(0, 'list-a', 0)
      },
    })

    system.initialize()
    system.present(0)

    expect(order).toEqual(['clear', 'capture', 'commit'])
  })
})

/** Creates one direct movement intent for a captured boundary. */
function createIntent(id: string, startAt: number): MotionIntent {
  return {
    id,
    itemId: 'item',
    startAt,
    duration: 100,
    ease: 'linear',
    presentationMode: 'reparent',
  }
}

/** Creates one one-item before/after motion boundary. */
function createBoundary(
  timeMs: number,
  before: LayoutSnapshot,
  after: LayoutSnapshot,
  intentId: string,
): MotionBoundary {
  return {
    id: `boundary:${intentId}:${timeMs}`,
    timeMs,
    before,
    after,
    intents: [createIntent(intentId, timeMs)],
  }
}

/** Creates one one-item layout snapshot with a root-local horizontal pose. */
function createSnapshot(timeMs: number, targetId: string, x: number): LayoutSnapshot {
  const localPose: RelativeMotionPose = {
    origin: [x, 0],
    matrix: IDENTITY_MATRIX,
    width: 20,
    height: 20,
  }
  const rootPose = createPose(x)
  return {
    timeMs,
    revision: `${timeMs}:${targetId}:${x}`,
    items: new Map([[
      'item',
      {
        itemId: 'item',
        targetId,
        localPose,
        rootPose,
      },
    ]]),
  }
}

/** Creates the complete HTML pose required by the motion interpolation code. */
function createPose(x: number): HtmlPose {
  return {
    rect: { left: x, top: 0, width: 20, height: 20 },
    origin: { x, y: 0 },
    matrix: IDENTITY_MATRIX,
    parentMatrix: IDENTITY_MATRIX,
    rotationMatrix: IDENTITY_MATRIX,
    scaleX: 1,
    scaleY: 1,
    localWidth: 20,
    localHeight: 20,
    frameWidth: 20,
    frameHeight: 20,
  }
}

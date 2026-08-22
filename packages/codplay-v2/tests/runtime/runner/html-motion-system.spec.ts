import { describe, expect, it } from 'vitest'

import { HtmlMotionSystem } from '../../../src/runtime/runner'
import type { HtmlMotionPresentationHost } from '../../../src/runtime/runner/html-motion-presentation-host'
import type { HtmlMatrix, HtmlPose } from '../../../src/runtime/motion/html-types'
import type {
  LayoutSnapshot,
  PresentationFrame,
  RelativeMotionPose,
  ScheduledMotionIntent,
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
      destroy: (): void => undefined,
    }
    const replayIntents: readonly ScheduledMotionIntent[] = [
      createIntent('persist-only', 0),
      createIntent('end-emit', 100),
    ]
    const liveIntents: readonly ScheduledMotionIntent[] = [createIntent('end-emit', 100)]
    let includePersistOnly = true
    const system = new HtmlMotionSystem({
      host: host as unknown as HtmlMotionPresentationHost,
      intents: replayIntents,
      getIntents: () => includePersistOnly ? replayIntents : liveIntents,
      includePersistOnly: () => includePersistOnly,
      measureBefore: (timeMs) => timeMs === 0 ? source : targetAtRelease,
      measureAt: (timeMs) => timeMs === 0 ? target : targetAtRelease,
    })

    system.initialize()
    includePersistOnly = false
    system.setLiveFirstLayout(liveRelease)
    system.present(100)
    expect(frames.at(-1)?.items.get('item')?.pose.origin.x).toBe(60)

    includePersistOnly = true
    system.clearLiveFirstLayouts()
    system.present(100)
    expect(frames.at(-1)?.items.get('item')?.pose.origin.x).toBe(100)
  })

  it('replaces the live source when two captures close at one logical time', () => {
    const source = createSnapshot(0, 'list-a', 0)
    const target = createSnapshot(0, 'list-b', 100)
    const targetAtRelease = createSnapshot(100, 'list-b', 100)
    const firstLiveRelease = createSnapshot(100, 'list-a', 20)
    const secondLiveRelease = createSnapshot(100, 'list-a', 80)
    const frames: PresentationFrame[] = []
    const host = {
      commit: (frame: PresentationFrame): void => {
        frames.push(frame)
      },
      destroy: (): void => undefined,
    }
    let includePersistOnly = false
    const liveIntents = [createIntent('end-emit', 100)]
    const system = new HtmlMotionSystem({
      host: host as unknown as HtmlMotionPresentationHost,
      intents: liveIntents,
      getIntents: () => liveIntents,
      includePersistOnly: () => includePersistOnly,
      measureBefore: (timeMs) => timeMs === 0 ? source : targetAtRelease,
      measureAt: (timeMs) => timeMs === 0 ? target : targetAtRelease,
    })

    system.initialize()
    system.setLiveFirstLayout(firstLiveRelease)
    system.setLiveFirstLayout(secondLiveRelease)
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
      destroy: (): void => undefined,
    }
    const intents: readonly ScheduledMotionIntent[] = [
      createIntent('end-emit-1', 100),
      createIntent('end-emit-2', 200),
    ]
    const system = new HtmlMotionSystem({
      host: host as unknown as HtmlMotionPresentationHost,
      intents,
      includePersistOnly: () => false,
      measureBefore: (timeMs) => timeMs === 100 ? source : secondSource,
      measureAt: (timeMs) => timeMs === 100 ? firstTarget : secondTarget,
    })

    system.initialize()
    system.setLiveFirstLayout(source)
    system.setLiveFirstLayout(secondSource)
    system.present(200)

    const item = frames.at(-1)?.items.get('item')
    expect(item?.pose.origin.x).toBe(140)
    expect(item?.activeSegmentId).toContain('200')

    system.present(250)
    expect(frames.at(-1)?.items.get('item')?.pose.origin.x).toBe(180)
  })

  it('does not rebuild a dynamic schedule while its revision is unchanged', () => {
    const frames: PresentationFrame[] = []
    const host = {
      commit: (frame: PresentationFrame): void => {
        frames.push(frame)
      },
      destroy: (): void => undefined,
    }
    const intents: readonly ScheduledMotionIntent[] = []
    let revision = 0
    let getIntentsCalls = 0
    const system = new HtmlMotionSystem({
      host: host as unknown as HtmlMotionPresentationHost,
      intents,
      getIntents: () => {
        getIntentsCalls += 1
        return intents
      },
      getScheduleRevision: () => revision,
      measureBefore: () => createSnapshot(0, 'list-a', 0),
      measureAt: () => createSnapshot(0, 'list-a', 0),
    })

    system.initialize()
    const callsAfterInitialize = getIntentsCalls
    system.present(0)
    system.present(16)
    expect(getIntentsCalls).toBe(callsAfterInitialize)

    revision += 1
    system.present(32)
    expect(getIntentsCalls).toBe(callsAfterInitialize + 1)
  })
})

/** Creates one scheduled movement intent for a capture boundary. */
function createIntent(id: string, startAt: number): ScheduledMotionIntent {
  return {
    id,
    eventId: id,
    itemId: 'item',
    declarationPath: [Number.MAX_SAFE_INTEGER, startAt],
    startAt,
    duration: 100,
    ease: 'linear',
    presentationMode: 'reparent',
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

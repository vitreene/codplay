import { describe, expect, it, vi } from 'vitest'

import {
  captureHtmlMotionBoundaries,
  mergeCurrentPresentationPoses,
  resolveHtmlMotionActionTransition,
} from '../../../src/runtime/runner-html/motion-capture'
import type {
  ItemPresentation,
  LayoutSnapshot,
  PresentationFrame,
  RelativeMotionPose,
  ScheduledMotionIntent,
} from '../../../src/runtime/motion'
import type { RuntimePlayer, SolvedScene } from '../../../src/runtime/player'
import type { CompiledRecord } from '../../../src/scene/compiled'
import type { HtmlMatrix, HtmlPose } from '../../../src/runtime/motion/html-types'

describe('HTML motion boundary capture', () => {
  it('retains every canonical style endpoint instead of collapsing them to the longest duration', () => {
    const transition = resolveHtmlMotionActionTransition({
      style: {
        bottom: { from: '5%', to: '28%', duration: 8_150, ease: 'linear' },
        rotate: { from: '-10deg', to: '14deg', duration: 360, ease: 'linear' },
      },
    } as CompiledRecord)

    expect(transition).toMatchObject({ duration: 8_150, delay: 0, ease: 'linear' })
    expect(transition?.captureOffsetsMs).toEqual([360, 8_150])
  })

  it('leaves repeated style transforms to the ACE materializer instead of making one linear motion', () => {
    const transition = resolveHtmlMotionActionTransition({
      style: {
        translateX: { from: '0%', to: '100%', duration: 200, loop: 3, alternate: true, ease: 'linear' },
      },
    } as CompiledRecord)

    expect(transition).toBeUndefined()
  })

  it('captures a structural move LAST at its endpoint when the target mounts after FIRST', () => {
    const before = createSolvedScene(1_200, false)
    const afterStart = createSolvedScene(1_200, true)
    const keyframe = createSolvedScene(1_600, true)
    const after = createSolvedScene(2_200, true)
    const resolveSceneBeforeBoundary = vi.fn((timeMs: number) => {
      if (timeMs === 1_200) return before
      if (timeMs === 1_600) return keyframe
      if (timeMs === 2_200) return after
      throw new Error(`Unexpected boundary: ${timeMs}`)
    })
    const resolveSceneAt = vi.fn((timeMs: number) => {
      if (timeMs !== 1_200) throw new Error(`Endpoint must use left-boundary resolution: ${timeMs}`)
      return afterStart
    })
    const presentSceneForGeometryCapture = vi.fn()
    const player = {
      getSolvedScene: () => before,
      resolveSceneBeforeBoundary,
      resolveSceneAt,
      presentSceneForGeometryCapture,
    } as unknown as RuntimePlayer

    const boundaries = captureHtmlMotionBoundaries({
      player,
      root: {} as Element,
      nodes: new Map(),
      intents: [{ ...createIntent(), keyTimes: [1_600] }],
      includePersistOnly: false,
    })

    expect(resolveSceneBeforeBoundary).toHaveBeenCalledWith(1_200, false)
    expect(resolveSceneBeforeBoundary).toHaveBeenCalledWith(2_200, false)
    expect(resolveSceneBeforeBoundary).toHaveBeenCalledWith(1_600, false)
    expect(resolveSceneAt).toHaveBeenCalledWith(1_200, false)
    expect(boundaries).toHaveLength(1)
    expect(boundaries[0]?.before.timeMs).toBe(1_200)
    expect(boundaries[0]?.afterStart?.timeMs).toBe(1_200)
    expect(boundaries[0]?.after.timeMs).toBe(2_200)
    expect(boundaries[0]?.keyframes?.map((snapshot) => snapshot.timeMs)).toEqual([1_600])
    expect(presentSceneForGeometryCapture.mock.calls.map(([scene]) => (scene as SolvedScene).timeMs))
      .toEqual([1_200, 1_200, 1_600, 2_200, 1_200])
  })

  it('uses the active segment endpoint when a direct move replaces it', () => {
    const before = createSolvedScene(1_200, false)
    const afterStart = createSolvedScene(1_200, true)
    const after = createSolvedScene(2_000, true)
    const resolveSceneBeforeBoundary = vi.fn((timeMs: number) => {
      if (timeMs === 1_200) return before
      if (timeMs === 2_000) return after
      throw new Error(`Unexpected boundary: ${timeMs}`)
    })
    const resolveSceneAt = vi.fn((timeMs: number) => {
      if (timeMs !== 1_200) throw new Error(`Start must use left-boundary resolution: ${timeMs}`)
      return afterStart
    })
    const resolveActiveMotionEndAt = vi.fn((itemId: string, startAt: number, requestedEndAt: number) => {
      expect(itemId).toBe('main:item')
      expect(startAt).toBe(1_200)
      expect(requestedEndAt).toBe(2_200)
      return 2_000
    })
    const player = {
      getSolvedScene: () => before,
      resolveSceneBeforeBoundary,
      resolveSceneAt,
      presentSceneForGeometryCapture: vi.fn(),
    } as unknown as RuntimePlayer

    const boundaries = captureHtmlMotionBoundaries({
      player,
      root: {} as Element,
      nodes: new Map(),
      intents: [createIntent()],
      includePersistOnly: false,
      resolveActiveMotionEndAt,
    })

    expect(resolveActiveMotionEndAt).toHaveBeenCalledTimes(1)
    expect(resolveSceneBeforeBoundary).toHaveBeenCalledWith(2_000, false)
    expect(resolveSceneBeforeBoundary).not.toHaveBeenCalledWith(2_200, false)
    expect(boundaries[0]?.after.timeMs).toBe(2_000)
  })

  it('uses the latest presented item pose as transient live FIRST without journaling it', () => {
    const captured = createLayoutSnapshot(10)
    const frame: PresentationFrame = {
      timeMs: 500,
      graphRevision: 'graph:500',
      layoutRevision: 'layout:500',
      items: new Map<string, ItemPresentation>([
        ['main:item', {
          itemId: 'main:item',
          targetId: 'main:source',
          targetOrder: 0,
          pose: createPose(60),
          representation: 'reparent',
          progress: 0.6,
        }],
      ]),
    }

    const merged = mergeCurrentPresentationPoses(captured, frame, new Set(['main:item']))

    expect(captured.items.get('main:item')?.rootPose.origin.x).toBe(10)
    expect(merged.items.get('main:item')?.rootPose.origin.x).toBe(60)
    expect(merged.items.get('main:item')?.localPose.origin[0]).toBe(60)
    expect(merged.revision).toContain('current-presentation:500:graph:500')
  })
})

/** Creates the smallest solved scene needed to describe target availability. */
function createSolvedScene(timeMs: number, targetMounted: boolean): SolvedScene {
  return {
    timeMs,
    persos: {
      'main:item': {
        key: 'main:item',
        placement: {
          mounted: true,
          targetId: targetMounted ? 'main:target' : 'main:source',
        },
      },
    },
    graph: {
      revision: `scene:${timeMs}:${targetMounted}`,
      targetByPerso: { 'main:item': 'main:target' },
      parentByPerso: {},
      childrenByTarget: targetMounted ? { 'main:target': ['main:item'] } : {},
    },
  } as unknown as SolvedScene
}

/** Creates one structural move whose geometric endpoint is one second later. */
function createIntent(): ScheduledMotionIntent {
  return {
    id: 'motion:main:item:move:1200',
    eventId: 'main:item:move',
    itemId: 'main:item',
    declarationPath: [0],
    startAt: 1_200,
    duration: 1_000,
    delay: 0,
    endAt: 2_200,
    ease: 'linear',
    presentationMode: 'reparent',
    targetReflow: true,
  }
}

/** Creates one root-local item snapshot for the transient live handoff test. */
function createLayoutSnapshot(x: number): LayoutSnapshot {
  const localPose: RelativeMotionPose = {
    origin: [x, 0],
    layoutOrigin: [x, 0],
    matrix: IDENTITY_MATRIX,
    width: 20,
    height: 20,
  }
  return {
    timeMs: 500,
    revision: `snapshot:${x}`,
    items: new Map([[
      'main:item',
      {
        itemId: 'main:item',
        targetId: 'main:source',
        targetOrder: 0,
        localPose,
        rootPose: createPose(x),
      },
    ]]),
  }
}

const IDENTITY_MATRIX: HtmlMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

/** Creates one unrotated root-local pose for capture assertions. */
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

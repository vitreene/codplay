import { describe, expect, it, vi } from 'vitest'

import {
  captureHtmlMotionBoundaries,
  resolveHtmlMotionActionTransition,
} from '../../../src/runtime/runner-html/motion-capture'
import type { ScheduledMotionIntent } from '../../../src/runtime/motion'
import type { RuntimePlayer, SolvedScene } from '../../../src/runtime/player'
import type { CompiledRecord } from '../../../src/scene/compiled'

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

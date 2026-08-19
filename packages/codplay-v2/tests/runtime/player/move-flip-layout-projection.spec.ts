import { describe, expect, it, vi } from 'vitest'

import { HtmlFlipRuntime } from '../../../src/runtime/flip'
import type { HtmlFlipProjection, HtmlMatrix, HtmlPose } from '../../../src/runtime/flip'
import { MoveFlipLayoutProjection, buildSolvedGraph } from '../../../src/runtime/player'
import type { SolvedScene } from '../../../src/runtime/player'

const identity: HtmlMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

/** Creates one deterministic pose for the projection boundary test. */
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

/** Creates the smallest valid solved presentation snapshot. */
function scene(timeMs = 0): SolvedScene {
  return {
    scene: {} as SolvedScene['scene'],
    timeMs,
    sceneState: {},
    storyStates: {},
    persos: {},
    graph: buildSolvedGraph({}),
    moveIssues: [],
  }
}

/** Creates a host projection with no historical descriptors to resolve. */
function projection(): HtmlFlipProjection {
  return {
    getHostContextId: () => 'host',
    getProjectionEpoch: () => 0,
    resolveHandle: () => undefined,
    capturePose: () => pose(0),
    captureHistoricalPose: () => pose(0),
    applyLocalPose: vi.fn(),
    finishLocalPose: vi.fn(),
    cancelLocalPose: vi.fn(),
    beginOverlay: vi.fn(() => ({})),
    applyOverlayPose: vi.fn(),
    finishOverlay: vi.fn(),
    flush: vi.fn(),
  }
}

describe('MoveFlipLayoutProjection', () => {
  it('commits the structural scene before the shared FLIP lookup', () => {
    const order: string[] = []
    const base = { project: vi.fn(() => order.push('base')) }
    const flip = new HtmlFlipRuntime(projection())
    const seekCached = vi.spyOn(flip, 'seekCached').mockImplementation(() => {
      order.push('flip')
      return { ok: true, value: undefined, diagnostics: {} as never }
    })
    const wrapper = new MoveFlipLayoutProjection({
      base,
      flip,
      hostContextId: 'host',
      getProjectionEpoch: () => 0,
    })

    wrapper.project(scene(50), { moveDeltas: [] })

    expect(order).toEqual(['base', 'flip'])
    expect(seekCached).toHaveBeenCalledWith('host', 0, 50)
  })

  it('uses the same cached resolver for every scene commit', () => {
    const flip = new HtmlFlipRuntime(projection())
    const seekCached = vi.spyOn(flip, 'seekCached').mockImplementation(() => ({
      ok: true,
      value: undefined,
      diagnostics: {} as never,
    }))
    const wrapper = new MoveFlipLayoutProjection({
      base: { project: vi.fn() },
      flip,
      hostContextId: 'host',
      getProjectionEpoch: () => 0,
    })

    wrapper.project(scene(100), { moveDeltas: [] })
    wrapper.project(scene(250), { moveDeltas: [] })

    expect(seekCached.mock.calls.map(([host, epoch, time]) => [host, epoch, time])).toEqual([
      ['host', 0, 100],
      ['host', 0, 250],
    ])
  })
})

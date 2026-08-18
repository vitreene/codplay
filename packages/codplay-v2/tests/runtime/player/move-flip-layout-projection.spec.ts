import { describe, expect, it, vi } from 'vitest'

import { prepareSvgPath } from '../../../src/ace'
import { HtmlFlipRuntime } from '../../../src/runtime/flip'
import type { HtmlFlipProjection, HtmlMatrix, HtmlPose } from '../../../src/runtime/flip'
import { MoveFlipLayoutProjection } from '../../../src/runtime/player'
import type { MoveStateDelta } from '../../../src/runtime/player'
import type { SolvedScene } from '../../../src/runtime/player'

const identity: HtmlMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

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

function emptyScene(): SolvedScene {
  return {
    scene: {} as SolvedScene['scene'],
    timeMs: 0,
    sceneState: {},
    storyStates: {},
    persos: {},
    rootPersoKeys: [],
    childrenByTarget: {},
    moveIssues: [],
  }
}

describe('MoveFlipLayoutProjection', () => {
  it('captures before the base projection and advances the same capture afterward', () => {
    const path = prepareSvgPath('M 0 0 L 0.5 0.5 L 1 0')
    let itemLeft = 0
    const order: string[] = []
    const projection: HtmlFlipProjection = {
      getHostContextId: () => 'host-1',
      getProjectionEpoch: () => 1,
      resolveHandle: (itemId) => itemId,
      capturePose: (handle) => {
        order.push(`capture:${String(handle)}`)
        return pose(itemLeft)
      },
      captureHistoricalPose: ({ ancestorId }) => pose(Number(ancestorId)),
      applyLocalPose: (handle) => order.push(`apply:${String(handle)}`),
      finishLocalPose: vi.fn(),
      cancelLocalPose: vi.fn(),
      beginOverlay: vi.fn(() => ({})),
      applyOverlayPose: vi.fn(),
      finishOverlay: vi.fn(),
      flush: vi.fn(),
    }
    const flip = new HtmlFlipRuntime(projection)
    const base = {
      project: (_scene: SolvedScene): void => {
        order.push('project')
        itemLeft = 100
      },
    }
    const wrapper = new MoveFlipLayoutProjection({
      base,
      flip,
      hostContextId: 'host-1',
      getProjectionEpoch: () => 1,
      buildCapture: ({ deltas, preparedTransitions }) => {
        const transition = preparedTransitions.get(deltas.find((delta) => delta.transition !== undefined)?.persoKey ?? '')
        if (transition?.duration === undefined) return undefined
        return {
          captureId: 'move-1',
          hostContextId: 'host-1',
          projectionEpoch: 1,
          startAt: 0,
          duration: transition.duration,
          ease: transition.ease,
          entries: deltas.map((delta) => ({ itemId: delta.persoKey, ancestorIds: [], mode: 'local' as const, path: transition.path })),
        }
      },
    })
    const delta: MoveStateDelta = {
      operation: 'move',
      persoKey: 'item',
      mountedBefore: true,
      mountedAfter: true,
      transition: {
        duration: 100,
        ease: 'inOutQuad',
        path,
      },
    }

    wrapper.project(emptyScene(), { phase: 'frame', previousScene: emptyScene(), moveDeltas: [delta] })
    wrapper.advance(50)

    expect(order.slice(0, 3)).toEqual(['capture:item', 'project', 'capture:item'])
    expect(order.filter((entry) => entry === 'apply:item')).toHaveLength(2)
  })

  it('projects a seek directly without starting a FLIP capture', () => {
    const base = { project: vi.fn() }
    const flip = new HtmlFlipRuntime({
      getHostContextId: () => 'host-1',
      getProjectionEpoch: () => 1,
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
    })
    const wrapper = new MoveFlipLayoutProjection({
      base,
      flip,
      hostContextId: 'host-1',
      getProjectionEpoch: () => 1,
      buildCapture: () => undefined,
    })

    wrapper.project(emptyScene(), { phase: 'seek', previousScene: emptyScene(), moveDeltas: [] })

    expect(base.project).toHaveBeenCalledOnce()
  })
})

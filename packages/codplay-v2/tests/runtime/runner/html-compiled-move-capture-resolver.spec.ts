import { describe, expect, it, vi } from 'vitest'
import { resolveCompiledMoveCapture, resolveCompiledMoveCaptures } from '../../../src/runtime/runner'
import type { MoveFlipCaptureBuilder, MoveTransitionOccurrence, SolvedScene } from '../../../src/runtime/player'
import type { FlipCapture, HtmlMeasurementTree } from '../../../src/runtime/flip'

/** Creates one solved scene with the item in one of two logical outlets. */
function scene(timeMs: number, targetId: string): SolvedScene {
  return {
    scene: {} as SolvedScene['scene'],
    timeMs,
    sceneState: {},
    storyStates: {},
    persos: {
      'main:item': {
        key: 'main:item',
        storyId: 'main',
        persoId: 'item',
        type: 'tag',
        state: {},
        placement: {
          kind: 'parent',
          mounted: true,
          targetId,
          target: { id: targetId, kind: 'outlet', storyId: 'main', ownerId: `main:${targetId}` },
        },
        moveIssues: [],
      },
    },
    rootPersoKeys: [],
    childrenByTarget: { [targetId]: ['main:item'] },
    moveIssues: [],
  }
}

/** Creates one occurrence active between two historical presentations. */
function occurrence(): MoveTransitionOccurrence {
  return {
    captureId: 'compiled:main:item:move:0:500',
    eventId: 'main:item:move:0',
    storyId: 'main',
    persoKey: 'main:item',
    declarationPath: [0],
    startAt: 500,
    endAt: 600,
    sourceTimeMs: 499.9999,
    destinationTimeMs: 500,
    transition: { duration: 100, ease: 'linear' },
    flipMode: 'local',
  }
}

/** Creates the minimal persist-only capture returned by a fake FLIP runtime. */
function capture(): FlipCapture {
  return {
    captureId: 'compiled:main:item:move:0:500',
    hostContextId: 'host',
    projectionEpoch: 0,
    startAt: 500,
    endAt: 600,
    duration: 100,
    ease: 'linear',
    entries: [],
    ancestors: [],
  }
}

describe('resolveCompiledMoveCapture', () => {
  it('restores the current scene after historical FIRST/LAST measurement', () => {
    const active = occurrence()
    const current = scene(900, 'target')
    const presented: string[] = []
    const flipRuntime = {
      capture: vi.fn((request: { captureId: string; mutate: () => void }) => {
        expect(request.captureId).toBe(active.captureId)
        request.mutate()
        return { ok: true as const, value: capture(), diagnostics: emptyDiagnostics() }
      }),
    }
    const captureBuilder: MoveFlipCaptureBuilder = ({ deltas }) => ({
      captureId: 'builder-capture',
      hostContextId: 'host',
      projectionEpoch: 0,
      startAt: deltas[0]?.transitionStartAt ?? 0,
      duration: 100,
      ease: 'linear',
      entries: [{ itemId: 'main:item', ancestorIds: ['main:target'], mode: 'local' }],
      ancestors: [{ ancestorId: 'main:target', regime: 'stable' }],
    })

    const result = resolveCompiledMoveCapture({
      player: {
        getActiveMoveTransitionOccurrences: () => [active],
        resolveSceneAt: (timeMs) => timeMs < active.startAt ? scene(timeMs, 'source') : scene(timeMs, 'target'),
        getSolvedScene: () => current,
      },
      flipRuntime,
      captureBuilder,
      presentHistoricalScene: (historical) => presented.push(historical.persos['main:item']!.placement.targetId!),
    }, 550)

    expect(result).toEqual(capture())
    expect(presented).toEqual(['source', 'target', 'target'])
    expect(flipRuntime.capture).toHaveBeenCalledOnce()
  })

  it('uses the shared measurement transaction for a cold capture', () => {
    const active = occurrence()
    const current = scene(900, 'target')
    const presented: string[] = []
    const measurementTree: HtmlMeasurementTree = {
      hostContextId: 'host',
      projectionEpoch: 0,
      logicalTimeMs: 550,
      items: [],
      ancestors: [],
    }
    const recorded = vi.fn((tree: HtmlMeasurementTree, metadata: { captureId: string }) => {
      expect(tree).toBe(measurementTree)
      expect(metadata.captureId).toBe(active.captureId)
      return { ok: true as const, value: capture(), diagnostics: emptyDiagnostics() }
    })
    const result = resolveCompiledMoveCaptures({
      player: {
        getActiveMoveTransitionOccurrences: () => [active],
        resolveSceneAt: (timeMs) => timeMs < active.startAt ? scene(timeMs, 'source') : scene(timeMs, 'target'),
        getSolvedScene: () => current,
      },
      flipRuntime: { recordMeasurementTree: recorded },
      presentationTransaction: {
        measure: vi.fn((input) => {
          input.prepareFirst?.()
          input.presentLast()
          if (input.restoreAfter === true) presented.push('target')
          return measurementTree
        }),
      },
      captureBuilder: ({ deltas }) => ({
        captureId: 'builder-capture',
        hostContextId: 'host',
        projectionEpoch: 0,
        startAt: deltas[0]?.transitionStartAt ?? 0,
        duration: 100,
        ease: 'linear',
        entries: [{ itemId: 'main:item', ancestorIds: [], mode: 'local' }],
      }),
      presentHistoricalScene: (historical) => presented.push(historical.persos['main:item']!.placement.targetId!),
    }, 550)

    expect(result).toEqual([capture()])
    expect(presented).toEqual(['source', 'target', 'target'])
    expect(recorded).toHaveBeenCalledOnce()
  })

  it('restores the current scene when the historical capture fails', () => {
    const active = occurrence()
    const current = scene(900, 'target')
    const presented: string[] = []

    expect(() => resolveCompiledMoveCapture({
      player: {
        getActiveMoveTransitionOccurrences: () => [active],
        resolveSceneAt: (timeMs) => timeMs < active.startAt ? scene(timeMs, 'source') : scene(timeMs, 'target'),
        getSolvedScene: () => current,
      },
      flipRuntime: {
        capture: () => { throw new Error('capture failed') },
      },
      captureBuilder: () => ({
        captureId: 'builder-capture',
        hostContextId: 'host',
        projectionEpoch: 0,
        startAt: 500,
        duration: 100,
        entries: [{ itemId: 'main:item', ancestorIds: [], mode: 'local' }],
      }),
      presentHistoricalScene: (historical) => presented.push(historical.persos['main:item']!.placement.targetId!),
    }, 550)).toThrow('capture failed')

    expect(presented).toEqual(['source', 'target'])
  })
})

/** Creates the detached success diagnostics used by the fake runtime. */
function emptyDiagnostics() {
  return { all: [], warnings: [], errors: [] }
}

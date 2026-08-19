import { describe, expect, it, vi } from 'vitest'
import { resolveCompiledMoveCapture, resolveCompiledMoveCaptures } from '../../../src/runtime/runner'
import { buildSolvedGraph } from '../../../src/runtime/player'
import type { MoveFlipCaptureBuilder, MoveTransitionOccurrence, SolvedPerso, SolvedScene } from '../../../src/runtime/player'
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
          target: { id: targetId, kind: 'outlet', storyId: 'main' },
        },
        moveIssues: [],
      },
    },
    graph: buildSolvedGraph({
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
          target: { id: targetId, kind: 'outlet', storyId: 'main' },
        },
        moveIssues: [],
      },
    }),
    moveIssues: [],
  }
}

/** Creates a solved scene for a small set of independently moving items. */
function sceneWithTargets(timeMs: number, targets: Readonly<Record<string, string>>): SolvedScene {
  const persos: Record<string, SolvedPerso> = Object.fromEntries(
    Object.entries(targets).map(([key, targetId]) => [key, {
      key,
      storyId: 'main',
      persoId: key.replace('main:', ''),
      type: 'tag',
      state: {},
      placement: {
        kind: 'parent',
        mounted: true,
        targetId,
        target: { id: targetId, kind: 'outlet', storyId: 'main' },
      },
      moveIssues: [],
    }]),
  )
  return {
    scene: {} as SolvedScene['scene'],
    timeMs,
    sceneState: {},
    storyStates: {},
    persos,
    graph: buildSolvedGraph(persos),
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
  it('passes the event-local historical list touched set to the capture builder', () => {
    const active = occurrence()
    const touched: string[][] = []
    const result = resolveCompiledMoveCapture({
      player: {
        getActiveMoveTransitionOccurrences: () => [active],
        resolveSceneAt: (timeMs) => timeMs < active.startAt ? scene(timeMs, 'source') : scene(timeMs, 'target'),
        getSolvedScene: () => scene(900, 'target'),
        getHistoricalLayoutProjectionState: () => ({
          childrenByTarget: { source: ['main:item'], target: ['main:item'] },
          touchedItemIds: ['main:item', 'main:sibling'],
        }),
      },
      flipRuntime: {
        recordMeasurementTree: () => ({ ok: true as const, value: capture(), diagnostics: emptyDiagnostics() }),
      },
      captureBuilder: ({ touchedItemIds }) => {
        touched.push([...(touchedItemIds ?? [])])
        return {
          captureId: 'builder-capture',
          hostContextId: 'host',
          projectionEpoch: 0,
          startAt: active.startAt,
          duration: 100,
          entries: [{ itemId: 'main:item', ancestorIds: [], mode: 'local' as const }],
        }
      },
      presentHistoricalScene: () => undefined,
      presentationTransaction: {
        measure: vi.fn((input) => {
          input.prepareFirst?.()
          input.presentLast()
          return { hostContextId: 'host', projectionEpoch: 0, logicalTimeMs: 550, items: [], ancestors: [] }
        }),
      },
    }, 550)

    expect(result).toEqual(capture())
    expect(touched).toEqual([['main:item', 'main:sibling']])
  })

  it('restores the current scene after historical FIRST/LAST measurement', () => {
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
    const recorded = vi.fn(() => ({ ok: true as const, value: capture(), diagnostics: emptyDiagnostics() }))
    const flipRuntime = { recordMeasurementTree: recorded }
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
      presentationTransaction: {
        measure: vi.fn((input) => {
          input.prepareFirst?.()
          input.captureFirst?.()
          input.presentLast()
          return measurementTree
        }),
      },
    }, 550)

    expect(result).toEqual(capture())
    expect(presented).toEqual(['source', 'target'])
    expect(recorded).toHaveBeenCalledOnce()
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

  it('does not construct the same cold capture twice for a repeated occurrence identity', () => {
    const active = occurrence()
    const current = scene(900, 'target')
    const recorded = vi.fn(() => ({ ok: true as const, value: capture(), diagnostics: emptyDiagnostics() }))
    const duplicate = { ...active }

    const result = resolveCompiledMoveCaptures({
      player: {
        getActiveMoveTransitionOccurrences: () => [active, duplicate],
        resolveSceneAt: (timeMs) => timeMs < active.startAt ? scene(timeMs, 'source') : scene(timeMs, 'target'),
        getSolvedScene: () => current,
      },
      flipRuntime: { recordMeasurementTree: recorded },
      presentationTransaction: {
        measure: vi.fn((input) => {
          input.prepareFirst?.()
          input.presentLast()
          return { hostContextId: 'host', projectionEpoch: 0, logicalTimeMs: 550, items: [], ancestors: [] }
        }),
      },
      captureBuilder: ({ deltas }) => ({
        captureId: 'builder-capture',
        hostContextId: 'host',
        projectionEpoch: 0,
        startAt: deltas[0]?.transitionStartAt ?? 0,
        duration: 100,
        ease: 'linear',
        entries: [{ itemId: 'main:item', ancestorIds: [], mode: 'local' as const }],
      }),
      presentHistoricalScene: () => undefined,
    }, 550)

    expect(result).toHaveLength(1)
    expect(recorded).toHaveBeenCalledOnce()
  })

  it('does not re-capture an item already owned by another active occurrence', () => {
    const activeSibling: MoveTransitionOccurrence = {
      ...occurrence(),
      captureId: 'compiled:main:sibling:move:500:900',
      eventId: 'main:sibling:move:500',
      persoKey: 'main:sibling',
      endAt: 900,
      transition: { duration: 400, ease: 'linear' },
    }
    const current: MoveTransitionOccurrence = {
      ...occurrence(),
      captureId: 'compiled:main:item:move:700:800',
      eventId: 'main:item:move:700',
      startAt: 700,
      endAt: 800,
      sourceTimeMs: 699.9999,
      destinationTimeMs: 700,
    }
    const touched: string[][] = []
    const sceneAt = (timeMs: number): SolvedScene => sceneWithTargets(timeMs, {
      'main:item': timeMs < current.startAt ? 'source' : 'target',
      'main:sibling': timeMs < activeSibling.startAt ? 'left' : 'right',
    })
    const result = resolveCompiledMoveCaptures({
      player: {
        getActiveMoveTransitionOccurrences: () => [activeSibling, current],
        resolveSceneAt: sceneAt,
        getSolvedScene: () => sceneAt(900),
        getHistoricalLayoutProjectionState: () => ({
          childrenByTarget: { source: ['main:item'], target: ['main:item'] },
          touchedItemIds: ['main:item', 'main:sibling'],
        }),
      },
      flipRuntime: {
        recordMeasurementTree: () => ({ ok: true as const, value: capture(), diagnostics: emptyDiagnostics() }),
      },
      captureBuilder: ({ touchedItemIds }) => {
        touched.push([...(touchedItemIds ?? [])])
        return {
          captureId: current.captureId,
          hostContextId: 'host',
          projectionEpoch: 0,
          startAt: current.startAt,
          duration: 100,
          entries: [{ itemId: current.persoKey, ancestorIds: [], mode: 'local' as const }],
        }
      },
      presentHistoricalScene: () => undefined,
      presentationTransaction: {
        measure: vi.fn((input) => {
          input.prepareFirst?.()
          input.presentLast()
          return { hostContextId: 'host', projectionEpoch: 0, logicalTimeMs: 750, items: [], ancestors: [] }
        }),
      },
    }, 750, [current])

    expect(result).toHaveLength(1)
    expect(touched).toEqual([['main:item']])
  })

  it('does not animate a future mover toward its destination in an earlier capture', () => {
    const current: MoveTransitionOccurrence = {
      ...occurrence(),
      captureId: 'compiled:main:item:move:500:600',
      eventId: 'main:item:move:500',
      endAt: 600,
    }
    const future: MoveTransitionOccurrence = {
      ...occurrence(),
      captureId: 'compiled:main:sibling:move:550:650',
      eventId: 'main:sibling:move:550',
      persoKey: 'main:sibling',
      startAt: 550,
      endAt: 650,
      sourceTimeMs: 549.9999,
      destinationTimeMs: 550,
    }
    const touched: string[][] = []
    const sceneAt = (timeMs: number): SolvedScene => sceneWithTargets(timeMs, {
      'main:item': timeMs < current.startAt ? 'source' : 'target',
      'main:sibling': timeMs < future.startAt ? 'left' : 'right',
    })
    const result = resolveCompiledMoveCaptures({
      player: {
        getActiveMoveTransitionOccurrences: () => [current],
        getMoveTransitionOccurrencesStartingBetween: () => [future],
        resolveSceneAt: sceneAt,
        getSolvedScene: () => sceneAt(700),
        getHistoricalLayoutProjectionState: () => ({
          childrenByTarget: { source: ['main:item'], target: ['main:item'] },
          touchedItemIds: ['main:item', 'main:sibling'],
        }),
      },
      flipRuntime: {
        recordMeasurementTree: () => ({ ok: true as const, value: capture(), diagnostics: emptyDiagnostics() }),
      },
      captureBuilder: ({ touchedItemIds }) => {
        touched.push([...(touchedItemIds ?? [])])
        return {
          captureId: current.captureId,
          hostContextId: 'host',
          projectionEpoch: 0,
          startAt: current.startAt,
          duration: 100,
          entries: [{ itemId: current.persoKey, ancestorIds: [], mode: 'local' as const }],
        }
      },
      presentHistoricalScene: () => undefined,
      presentationTransaction: {
        measure: vi.fn((input) => {
          input.prepareFirst?.()
          input.presentLast()
          return { hostContextId: 'host', projectionEpoch: 0, logicalTimeMs: 550, items: [], ancestors: [] }
        }),
      },
    }, 550, [current])

    expect(result).toHaveLength(1)
    expect(touched).toEqual([['main:item']])
  })

  it('measures LAST with active parents at the child terminal phase', () => {
    const active = occurrence()
    const current = scene(900, 'target')
    const prepareCapture = vi.fn(() => ({ ok: true as const, value: undefined, diagnostics: emptyDiagnostics() }))
    const measurementTree: HtmlMeasurementTree = {
      hostContextId: 'host',
      projectionEpoch: 0,
      logicalTimeMs: 550,
      items: [],
      ancestors: [],
    }
    const presented: number[] = []
    const result = resolveCompiledMoveCaptures({
      player: {
        getActiveMoveTransitionOccurrences: () => [active],
        resolveSceneAt: (timeMs) => timeMs < active.startAt ? scene(timeMs, 'source') : scene(timeMs, 'target'),
        getSolvedScene: () => current,
      },
      flipRuntime: {
        prepareCapture,
        recordMeasurementTree: vi.fn(() => ({ ok: true as const, value: capture(), diagnostics: emptyDiagnostics() })),
      },
      presentationTransaction: {
        measure: vi.fn((input) => {
          input.prepareFirst?.()
          input.presentLast()
          return measurementTree
        }),
      },
      captureBuilder: ({ deltas }) => ({
        captureId: 'builder-capture',
        hostContextId: 'host',
        projectionEpoch: 0,
        startAt: deltas[0]?.transitionStartAt ?? 0,
        duration: 100,
        entries: [{ itemId: 'main:item', ancestorIds: [], mode: 'overlay-world' as const }],
      }),
      presentHistoricalScene: (historical) => presented.push(historical.timeMs),
    }, 550)

    expect(result).toEqual([capture()])
    expect(prepareCapture).toHaveBeenNthCalledWith(1, 'host', 0, 500)
    expect(prepareCapture).toHaveBeenNthCalledWith(2, 'host', 0, 600)
    expect(presented).toEqual([499.9999, 600])
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
        recordMeasurementTree: () => { throw new Error('capture failed') },
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
      presentationTransaction: {
        measure: vi.fn((input) => {
          input.prepareFirst?.()
          input.presentLast()
          throw new Error('capture failed')
        }),
      },
    }, 550)).toThrow('capture failed')

    expect(presented).toEqual(['source', 'target'])
  })
})

/** Creates the detached success diagnostics used by the fake runtime. */
function emptyDiagnostics() {
  return { all: [], warnings: [], errors: [] }
}

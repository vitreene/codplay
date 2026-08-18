import { describe, expect, it } from 'vitest'
import { createHtmlMoveCaptureBuilder } from '../../../src/runtime/runner'
import type { MoveStateDelta, PreparedMoveFlipTransition, SolvedPerso, SolvedScene } from '../../../src/runtime/player'

/** Creates the smallest solved scene carrying one deterministic timeline time. */
function scene(timeMs: number): SolvedScene {
  return {
    scene: {} as SolvedScene['scene'],
    timeMs,
    sceneState: {},
    storyStates: {},
    persos: {},
    rootPersoKeys: [],
    childrenByTarget: {},
    moveIssues: [],
  }
}

/** Creates one solved item mounted into an outlet owned by a parent component. */
function nestedScene(timeMs: number): SolvedScene {
  return {
    ...scene(timeMs),
    persos: {
      'main:layout': {
        key: 'main:layout',
        storyId: 'main',
        persoId: 'layout',
        type: 'layout',
        state: {},
        placement: {
          kind: 'root',
          mounted: true,
          targetId: 'root-host',
          target: { id: 'root-host', kind: 'root', storyId: 'main' },
        },
        moveIssues: [],
      },
      'main:item': {
        key: 'main:item',
        storyId: 'main',
        persoId: 'item',
        type: 'tag',
        state: {},
        placement: {
          kind: 'parent',
          mounted: true,
          targetId: 'layout:outlet',
          target: { id: 'layout:outlet', kind: 'outlet', storyId: 'main', ownerId: 'main:layout' },
        },
        moveIssues: [],
      },
    },
  }
}

/** Creates before/after child orders for a direct transfer between two lists. */
function listScene(
  timeMs: number,
  itemTarget: string,
  childrenByTarget: Readonly<Record<string, readonly string[]>>,
): SolvedScene {
  const base = nestedScene(timeMs)
  const item = base.persos['main:item']!
  const placement = {
    ...item.placement,
    targetId: itemTarget,
    target: { id: itemTarget, kind: 'outlet' as const, storyId: 'main', ownerId: 'main:layout' },
  }
  return {
    ...base,
    persos: {
      ...base.persos,
      'main:item': { ...item, placement },
      'main:sibling': { ...item, key: 'main:sibling', persoId: 'sibling', placement: { ...placement, targetId: 'source', target: { ...placement.target, id: 'source' } } },
      'main:other': { ...item, key: 'main:other', persoId: 'other', placement: { ...placement, targetId: 'target', target: { ...placement.target, id: 'target' } } },
    },
    childrenByTarget,
  }
}

/** Creates one item whose FIRST and LAST parent chains are different. */
function crossParentScene(timeMs: number, parentKey: string, outletId: string): SolvedScene {
  const parent: SolvedPerso = {
    key: parentKey,
    storyId: 'main',
    persoId: parentKey.split(':').at(-1)!,
    type: 'layout',
    state: {},
    placement: {
      kind: 'root',
      mounted: true,
      targetId: 'root-host',
      target: { id: 'root-host', kind: 'root', storyId: 'main' },
    },
    moveIssues: [],
  }
  const item: SolvedPerso = {
    key: 'main:item',
    storyId: 'main',
    persoId: 'item',
    type: 'tag',
    state: {},
    placement: {
      kind: 'parent',
      mounted: true,
      targetId: outletId,
      target: { id: outletId, kind: 'outlet', storyId: 'main', ownerId: parentKey },
      parentKey,
    },
    moveIssues: [],
  }
  return {
    ...scene(timeMs),
    persos: { [parentKey]: parent, 'main:item': item },
    childrenByTarget: { [outletId]: ['main:item'] },
  }
}

/** Creates one direct mounted move delta for the capture builder. */
function delta(transition?: MoveStateDelta['transition']): MoveStateDelta {
  return {
    operation: 'move',
    persoKey: 'main:item',
    fromTargetId: 'left',
    toTargetId: 'right',
    mountedBefore: true,
    mountedAfter: true,
    transition,
    transitionStartAt: transition === undefined ? undefined : 500,
  }
}

describe('createHtmlMoveCaptureBuilder', () => {
  it('builds one local direct-item capture at the solved move time', () => {
    const builder = createHtmlMoveCaptureBuilder({
      hostContextId: 'runner',
      getProjectionEpoch: () => 3,
    })
    const prepared: PreparedMoveFlipTransition = { duration: 1000, ease: 'linear' }

    const capture = builder({
      previousScene: scene(400),
      nextScene: scene(500),
      deltas: [delta({ duration: 1000, ease: 'linear' })],
      preparedTransitions: new Map([['main:item', prepared]]),
    })

    expect(capture).toEqual({
      captureId: 'runner:move:500:main:item',
      hostContextId: 'runner',
      projectionEpoch: 3,
      startAt: 500,
      duration: 1000,
      ease: 'linear',
      entries: [{ itemId: 'main:item', ancestorIds: [], mode: 'local' }],
    })
  })

  it('keeps mount, unmount and incomplete transition changes logical-only', () => {
    const builder = createHtmlMoveCaptureBuilder({ hostContextId: 'runner', getProjectionEpoch: () => 1 })
    const prepared: PreparedMoveFlipTransition = { duration: 1000 }

    expect(builder({
      previousScene: scene(0),
      nextScene: scene(100),
      deltas: [{ ...delta(), operation: 'mount', mountedBefore: false }],
      preparedTransitions: new Map([['main:item', prepared]]),
    })).toBeUndefined()
    expect(builder({
      previousScene: scene(0),
      nextScene: scene(100),
      deltas: [delta()],
      preparedTransitions: new Map(),
    })).toBeUndefined()
  })

  it('includes the solved outlet owner as a stable FLIP ancestor', () => {
    const builder = createHtmlMoveCaptureBuilder({ hostContextId: 'runner', getProjectionEpoch: () => 1 })
    const prepared: PreparedMoveFlipTransition = { duration: 1000 }
    const capture = builder({
      previousScene: nestedScene(0),
      nextScene: nestedScene(100),
      deltas: [delta({ duration: 1000 })],
      preparedTransitions: new Map([['main:item', prepared]]),
    })

    expect(capture?.entries).toEqual([
      { itemId: 'main:layout', ancestorIds: [], mode: 'local' },
      { itemId: 'main:item', ancestorIds: ['main:layout'], mode: 'local' },
    ])
    expect(capture?.ancestors).toEqual([{ ancestorId: 'main:layout', regime: 'stable' }])
  })

  it('captures the moved item and mounted siblings from both list orders', () => {
    const builder = createHtmlMoveCaptureBuilder({ hostContextId: 'runner', getProjectionEpoch: () => 1 })
    const prepared: PreparedMoveFlipTransition = { duration: 1000 }
    const capture = builder({
      previousScene: listScene(0, 'source', { source: ['main:item', 'main:sibling'], target: ['main:other'] }),
      nextScene: listScene(500, 'target', { source: ['main:sibling'], target: ['main:other', 'main:item'] }),
      deltas: [{ ...delta({ duration: 1000 }), fromTargetId: 'source', toTargetId: 'target' }],
      preparedTransitions: new Map([['main:item', prepared]]),
    })

    expect(capture?.captureId).toBe('runner:move:500:main:layout,main:item,main:sibling,main:other')
    expect(capture?.entries.map((entry) => entry.itemId)).toEqual(['main:layout', 'main:item', 'main:sibling', 'main:other'])
  })

  it('does not apply the destination ancestor chain to a cross-parent mover', () => {
    const builder = createHtmlMoveCaptureBuilder({ hostContextId: 'runner', getProjectionEpoch: () => 1 })
    const capture = builder({
      previousScene: crossParentScene(0, 'main:source-layout', 'source-outlet'),
      nextScene: crossParentScene(500, 'main:target-layout', 'target-outlet'),
      deltas: [{ ...delta({ duration: 1000 }), fromTargetId: 'source-outlet', toTargetId: 'target-outlet' }],
      preparedTransitions: new Map([['main:item', { duration: 1000 }]]),
    })

    expect(capture?.entries.find((entry) => entry.itemId === 'main:item')?.ancestorIds).toEqual([])
  })

  it('prefers the published list touched set over scene-order fallback', () => {
    const builder = createHtmlMoveCaptureBuilder({ hostContextId: 'runner', getProjectionEpoch: () => 1 })
    const prepared: PreparedMoveFlipTransition = { duration: 1000 }
    const capture = builder({
      previousScene: listScene(0, 'source', { source: ['main:item', 'main:sibling'], target: ['main:other'] }),
      nextScene: listScene(500, 'target', { source: ['main:sibling'], target: ['main:other', 'main:item'] }),
      deltas: [{ ...delta({ duration: 1000 }), fromTargetId: 'source', toTargetId: 'target' }],
      preparedTransitions: new Map([['main:item', prepared]]),
      touchedItemIds: ['main:item', 'main:sibling'],
    })

    expect(capture?.entries.map((entry) => entry.itemId)).toEqual(['main:layout', 'main:item', 'main:sibling'])
  })

  it('does not convert an overlay move into a local capture', () => {
    const builder = createHtmlMoveCaptureBuilder({ hostContextId: 'runner', getProjectionEpoch: () => 1 })
    const prepared: PreparedMoveFlipTransition = { duration: 1000 }

    expect(builder({
      previousScene: nestedScene(0),
      nextScene: nestedScene(100),
      deltas: [{ ...delta({ duration: 1000 }), flipMode: 'overlay-world' }],
      preparedTransitions: new Map([['main:item', prepared]]),
    })).toBeUndefined()
  })
})

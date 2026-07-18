// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { utils } from 'animejs'
import type { AutoCapsuleGridArtifact } from '@codplay/capsule-automation'

import type { AuthorApi, NodePose } from '../src/author-api'
import { createLibreAdapter } from '../src/adapters/libre-adapter'
import { createFlexAdapter, FLEX_POINT_ALIGNMENT } from '../src/adapters/flex-adapter'
import { createGridPlacementAdapter } from '../src/adapters/grid-placement-adapter'
import { createMinimalAnchor } from '../src/tracked-session'

const POSE_DEFAULTS: NodePose = { x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1, width: 0, height: 0 }

/** Reads back the pose anime.js currently holds — same accessor Player.getNodePose uses in prod. */
function readPose(node: Element): NodePose {
  const read = (prop: keyof NodePose, fallback: number): number => {
    const value = Number(utils.get(node, prop, false))
    return Number.isFinite(value) ? value : fallback
  }
  return {
    x: read('x', POSE_DEFAULTS.x),
    y: read('y', POSE_DEFAULTS.y),
    rotate: read('rotate', POSE_DEFAULTS.rotate),
    scaleX: read('scaleX', POSE_DEFAULTS.scaleX),
    scaleY: read('scaleY', POSE_DEFAULTS.scaleY),
    width: read('width', POSE_DEFAULTS.width),
    height: read('height', POSE_DEFAULTS.height)
  }
}

/**
 * Routes getNodePose/setNodePose through real anime.js (utils.get/utils.set) — same mechanism as
 * Player in prod (codplay/src/runtime/components/lib/dom.ts::readNodePose/writeNodePose) — so these
 * tests exercise the actual anime.js composition (style.transform), not a hand-rolled stand-in.
 */
function temp__createAuthorApiStub(node: Element | null): AuthorApi {
  return {
    subscribeToNode: (_persoId, cb) => {
      cb(node)
      return () => {}
    },
    subscribeToPlayerState: (cb) => {
      cb({ isPlaying: false })
      return () => {}
    },
    getPlayerState: () => ({ isPlaying: false }),
    getNodePose: () => (node === null ? null : readPose(node)),
    setNodePose: (_persoId, pose) => {
      if (node !== null) utils.set(node, pose as Parameters<typeof utils.set>[1])
    },
    getNodeSnapshot: () => null
  }
}

function temp__createGridArtifact(rows: number, cols: number): AutoCapsuleGridArtifact {
  return {
    className: 'grid',
    inlineStyle: {},
    cssRules: [],
    context: { rows, cols, mode: 'manual' }
  }
}

describe('LibreAdapter', () => {
  it('accumulates move deltas through AuthorApi.setNodePose by default', () => {
    const node = document.createElement('div')
    document.body.appendChild(node)
    const adapter = createLibreAdapter({ authorApi: temp__createAuthorApiStub(node), itemId: 'a' })

    adapter.applyMove({ dx: 10, dy: 5 })
    expect(readPose(node)).toMatchObject({ x: 10, y: 5 })

    adapter.applyMove({ dx: -3, dy: 7 })
    expect(readPose(node)).toMatchObject({ x: 7, y: 12 })

    node.remove()
  })

  it('relays onCommit straight through to options.onCommit (2026-07-18-pose-edit-architecture-study.md §7)', () => {
    const node = document.createElement('div')
    document.body.appendChild(node)
    const commits: string[] = []
    const adapter = createLibreAdapter({
      authorApi: temp__createAuthorApiStub(node),
      itemId: 'a',
      onCommit: (kind) => commits.push(kind)
    })

    adapter.onCommit?.('move')
    adapter.onCommit?.('rotate')
    expect(commits).toEqual(['move', 'rotate'])

    node.remove()
  })

  it('mutates top/left in top-left mode', () => {
    const node = document.createElement('div')
    node.style.left = '100px'
    node.style.top = '50px'
    document.body.appendChild(node)
    const adapter = createLibreAdapter({ authorApi: temp__createAuthorApiStub(node), itemId: 'a', mode: 'top-left' })

    adapter.applyMove({ dx: 20, dy: -10 })
    expect(node.style.left).toBe('120px')
    expect(node.style.top).toBe('40px')
    expect(node.style.translate).toBe('')

    node.remove()
  })

  it('applies resize deltas through AuthorApi.setNodePose', () => {
    const node = document.createElement('div')
    node.style.width = '200px'
    node.style.height = '100px'
    document.body.appendChild(node)
    const adapter = createLibreAdapter({ authorApi: temp__createAuthorApiStub(node), itemId: 'a' })

    adapter.applyResize({ dw: 30, dh: -20 })
    expect(readPose(node)).toMatchObject({ width: 230, height: 80 })

    node.remove()
  })

  it('does nothing when the node is absent (suspended)', () => {
    const adapter = createLibreAdapter({ authorApi: temp__createAuthorApiStub(null), itemId: 'a' })
    expect(() => adapter.applyMove({ dx: 5, dy: 5 })).not.toThrow()
  })

  it('does nothing when the node is present but not yet connected — the guard this session layer exists for', () => {
    // A node codplay's render() has created but not yet attached (see
    // libre-adapter.ts::pinToResolvedPx and tracked-nodes.ts) — canAct()
    // must stay false, applyMove must not touch it.
    const node = document.createElement('div')
    node.style.translate = '0px 0px'
    const adapter = createLibreAdapter({ authorApi: temp__createAuthorApiStub(node), itemId: 'a' })

    adapter.applyMove({ dx: 10, dy: 10 })
    expect(node.style.translate).toBe('0px 0px')
  })

  it('reads the pose fresh from getNodePose on every apply call, so a move never drops a rotation already on the node (the resize→rotate→move corruption a stale local cache used to cause)', () => {
    const node = document.createElement('div')
    document.body.appendChild(node)
    const adapter = createLibreAdapter({ authorApi: temp__createAuthorApiStub(node), itemId: 'a' })

    adapter.applyRotate({ dr: 66 })
    expect(readPose(node)).toMatchObject({ rotate: 66 })

    // A move must only touch x/y — the rotation already on the node (via anime.js's own
    // bookkeeping, read fresh through getNodePose) must survive untouched.
    adapter.applyMove({ dx: 5, dy: 25 })
    expect(readPose(node)).toMatchObject({ x: 5, y: 25, rotate: 66 })

    node.remove()
  })

  it('does not lose the pose across a same-node renotification — a shared session also notifies on every gesture start/end, not just a real rebuild', () => {
    let deliver: ((node: Element | null) => void) | null = null
    const node = document.createElement('div')
    document.body.appendChild(node)
    const authorApi: AuthorApi = {
      subscribeToNode: (_persoId, cb) => {
        deliver = cb
        cb(node)
        return () => {
          deliver = null
        }
      },
      subscribeToPlayerState: (cb) => {
        cb({ isPlaying: false })
        return () => {}
      },
      getPlayerState: () => ({ isPlaying: false }),
      getNodePose: () => readPose(node),
      setNodePose: (_persoId, pose) => utils.set(node, pose as Parameters<typeof utils.set>[1]),
      getNodeSnapshot: () => null
    }
    const adapter = createLibreAdapter({ authorApi, itemId: 'a' })

    adapter.applyRotate({ dr: 66 })
    expect(readPose(node)).toMatchObject({ rotate: 66 })

    // Same node, renotified — a shared TrackedSession's own subscribe fires on gesture start/end
    // too (mirrored from SelectionFrame's machine), not only on a genuine node replacement. Nothing
    // in LibreAdapter reacts to this anymore (no local cache to reset) — the pose must be untouched.
    deliver!(node)
    expect(readPose(node)).toMatchObject({ rotate: 66 })

    node.remove()
  })

  it('uses a shared anchor when given one, and never destroys it (owned by the caller)', () => {
    const node = document.createElement('div')
    document.body.appendChild(node)
    const authorApi = temp__createAuthorApiStub(node)
    const anchor = createMinimalAnchor({ authorApi, persoIds: ['a'] })
    const adapter = createLibreAdapter({ authorApi, itemId: 'a', anchor })

    adapter.applyMove({ dx: 10, dy: 5 })
    expect(readPose(node)).toMatchObject({ x: 10, y: 5 })

    adapter.destroy()
    // The shared anchor must still work after the adapter that borrowed it is gone.
    expect(anchor.canAct()).toBe(true)

    anchor.destroy()
    node.remove()
  })

  it('accumulates rotation deltas through AuthorApi.setNodePose', () => {
    const node = document.createElement('div')
    document.body.appendChild(node)
    const adapter = createLibreAdapter({ authorApi: temp__createAuthorApiStub(node), itemId: 'a' })

    adapter.applyRotate({ dr: 15 })
    expect(readPose(node)).toMatchObject({ rotate: 15 })

    adapter.applyRotate({ dr: -5 })
    expect(readPose(node)).toMatchObject({ rotate: 10 })

    node.remove()
  })

  // Skipped in jsdom: captureNodeOwnMatrix (overlay-pose.ts) reads getComputedStyle().transform and
  // expects a real browser's normalized matrix(...)/matrix3d(...) form (parseCssMatrix only parses
  // that). Now that anime.js composes rotate exclusively into `transform` (never into the discrete
  // `rotate` CSS property this test used to read before the LibreAdapter/AuthorApi.setNodePose
  // migration), jsdom's getComputedStyle().transform stays the literal, unresolved "rotate(90deg)"
  // instead of a browser's matrix(...) — parseCssMatrix can't parse that, so the compensation reads
  // an identity matrix and computes a zero delta. A real browser resolves this correctly; only
  // jsdom's own fidelity gap prevents testing it here.
  it.skip('compensates translate when the rotation origin changes on a rotated element', () => {
    const node = document.createElement('div')
    node.style.width = '100px'
    node.style.height = '100px'
    document.body.appendChild(node)
    const adapter = createLibreAdapter({ authorApi: temp__createAuthorApiStub(node), itemId: 'a' })

    // Rotate 90° around the default center — no jump, no compensation.
    adapter.applyRotate({ dr: 90, origin: { fx: 0.5, fy: 0.5 } })
    expect(readPose(node)).toMatchObject({ x: 0, y: 0 })

    // Move the origin to the top-left corner: (I − R90)·(50,50) = (100, 0).
    adapter.applyRotate({ dr: 0, origin: { fx: 0, fy: 0 } })
    const pose = readPose(node)
    expect(pose.x).toBeCloseTo(100, 3)
    expect(pose.y).toBeCloseTo(0, 3)

    node.remove()
  })

  it('transposes the rotation origin into transform-origin', () => {
    const node = document.createElement('div')
    document.body.appendChild(node)
    const adapter = createLibreAdapter({ authorApi: temp__createAuthorApiStub(node), itemId: 'a' })

    adapter.applyRotate({ dr: 10, origin: { fx: 0, fy: 1 } })
    expect(node.style.transformOrigin).toBe('0% 100%')
    expect(readPose(node)).toMatchObject({ rotate: 10 })

    adapter.applyRotate({ dr: 5 })
    expect(node.style.transformOrigin).toBe('0% 100%')
    expect(readPose(node)).toMatchObject({ rotate: 15 })

    node.remove()
  })

  it('composes scale factors through AuthorApi.setNodePose', () => {
    const node = document.createElement('div')
    document.body.appendChild(node)
    const adapter = createLibreAdapter({ authorApi: temp__createAuthorApiStub(node), itemId: 'a' })

    adapter.applyScale({ fx: 2, fy: 2 })
    expect(readPose(node)).toMatchObject({ scaleX: 2, scaleY: 2 })

    adapter.applyScale({ fx: 0.5, fy: 1 })
    expect(readPose(node)).toMatchObject({ scaleX: 1, scaleY: 2 })

    node.remove()
  })
})

describe('FlexAdapter', () => {
  it('maps the 11 interaction points onto align-self/justify-self', () => {
    expect(FLEX_POINT_ALIGNMENT.TL).toEqual({ alignSelf: 'start', justifySelf: 'start' })
    expect(FLEX_POINT_ALIGNMENT.C).toEqual({ alignSelf: 'center', justifySelf: 'center' })
    expect(FLEX_POINT_ALIGNMENT.BR).toEqual({ alignSelf: 'end', justifySelf: 'end' })
    expect(FLEX_POINT_ALIGNMENT['stretch-h']).toEqual({ justifySelf: 'stretch' })
    expect(FLEX_POINT_ALIGNMENT['stretch-v']).toEqual({ alignSelf: 'stretch' })
  })

  it('applies the clicked alignment onto the element', () => {
    const node = document.createElement('div')
    const applied: unknown[] = []
    const adapter = createFlexAdapter({
      authorApi: temp__createAuthorApiStub(node),
      itemId: 'a',
      onApplied: (alignment) => applied.push(alignment)
    })

    adapter.applyAlignment('TR')
    expect(node.style.alignSelf).toBe('start')
    expect(node.style.justifySelf).toBe('end')
    expect(applied).toHaveLength(1)
  })

  it('keeps the orthogonal axis untouched on stretch points', () => {
    const node = document.createElement('div')
    node.style.alignSelf = 'center'
    const adapter = createFlexAdapter({ authorApi: temp__createAuthorApiStub(node), itemId: 'a' })

    adapter.applyAlignment('stretch-h')
    expect(node.style.justifySelf).toBe('stretch')
    expect(node.style.alignSelf).toBe('center')
  })

  it('ignores raw move and resize deltas', () => {
    const node = document.createElement('div')
    const adapter = createFlexAdapter({ authorApi: temp__createAuthorApiStub(node), itemId: 'a' })

    adapter.applyMove({ dx: 50, dy: 50 })
    adapter.applyResize({ dw: 50, dh: 50 })
    expect(node.style.translate).toBe('')
    expect(node.style.width).toBe('')
  })
})

function temp__uniformTracks(rows: number, cols: number, sizePx: number, gapPx = 0) {
  return {
    cols: Array.from({ length: cols }, () => sizePx),
    rows: Array.from({ length: rows }, () => sizePx),
    columnGap: gapPx,
    rowGap: gapPx
  }
}

describe('GridPlacementAdapter', () => {
  it('converts pixel deltas into cell placement changes', () => {
    const placements: unknown[] = []
    const adapter = createGridPlacementAdapter({
      grid: temp__createGridArtifact(4, 4),
      getTrackGeometry: () => temp__uniformTracks(4, 4, 100),
      initialPlacement: { row: 1, col: 1 },
      onPlacement: (placement) => placements.push(placement)
    })

    adapter.applyMove({ dx: 100, dy: 0 })
    expect(adapter.getPlacement()).toMatchObject({ row: 1, col: 2 })

    adapter.applyMove({ dx: 0, dy: 200 })
    expect(adapter.getPlacement()).toMatchObject({ row: 3, col: 2 })
    expect(placements).toHaveLength(2)
  })

  it('accumulates sub-cell movement until a boundary is crossed', () => {
    const adapter = createGridPlacementAdapter({
      grid: temp__createGridArtifact(4, 4),
      getTrackGeometry: () => temp__uniformTracks(4, 4, 100),
      initialPlacement: { row: 1, col: 1 },
      onPlacement: () => {}
    })

    adapter.applyMove({ dx: 30, dy: 0 })
    expect(adapter.getPlacement()).toMatchObject({ col: 1 })

    adapter.applyMove({ dx: 30, dy: 0 })
    expect(adapter.getPlacement()).toMatchObject({ col: 2 })
  })

  it('clamps placement to the grid bounds', () => {
    const adapter = createGridPlacementAdapter({
      grid: temp__createGridArtifact(2, 2),
      getTrackGeometry: () => temp__uniformTracks(2, 2, 100),
      initialPlacement: { row: 1, col: 1 },
      onPlacement: () => {}
    })

    adapter.applyMove({ dx: 10_000, dy: 10_000 })
    expect(adapter.getPlacement()).toMatchObject({ row: 2, col: 2 })

    adapter.applyMove({ dx: -10_000, dy: -10_000 })
    expect(adapter.getPlacement()).toMatchObject({ row: 1, col: 1 })
  })

  it('converts resize deltas into span changes within bounds', () => {
    const adapter = createGridPlacementAdapter({
      grid: temp__createGridArtifact(4, 4),
      getTrackGeometry: () => temp__uniformTracks(4, 4, 100),
      initialPlacement: { row: 1, col: 1 },
      onPlacement: () => {}
    })

    adapter.applyResize({ dw: 200, dh: 100 })
    expect(adapter.getPlacement()).toMatchObject({ colSpan: 3, rowSpan: 2 })

    adapter.applyResize({ dw: 10_000, dh: 10_000 })
    expect(adapter.getPlacement()).toMatchObject({ colSpan: 4, rowSpan: 4 })
  })

  it('accumulates small continuous resize increments until a cell boundary is crossed', () => {
    const adapter = createGridPlacementAdapter({
      grid: temp__createGridArtifact(4, 4),
      getTrackGeometry: () => temp__uniformTracks(4, 4, 100),
      initialPlacement: { row: 1, col: 1 },
      onPlacement: () => {}
    })

    // 60 increments of 1px: each alone is below the boundary — the
    // accumulation must reach the nearest-extent switch (150px on 100px tracks).
    for (let index = 0; index < 60; index += 1) {
      adapter.applyResize({ dw: 1, dh: 0 })
    }
    expect(adapter.getPlacement()).toMatchObject({ colSpan: 2 })
  })

  it('applyCellDrop lands exactly on the given cell (drop contract)', () => {
    const placements: unknown[] = []
    const adapter = createGridPlacementAdapter({
      grid: temp__createGridArtifact(4, 4),
      getTrackGeometry: () => temp__uniformTracks(4, 4, 100),
      initialPlacement: { row: 1, col: 1 },
      onPlacement: (placement) => placements.push(placement)
    })

    adapter.applyCellDrop!({ row: 3, col: 4 })
    expect(adapter.getPlacement()).toMatchObject({ row: 3, col: 4 })

    // Clamped so the span stays inside the grid.
    adapter.applyCellDrop!({ row: 1, col: 1 })
    adapter.applyResize({ dw: 180, dh: 0 })
    expect(adapter.getPlacement()).toMatchObject({ colSpan: 3 })
    adapter.applyCellDrop!({ row: 1, col: 4 })
    expect(adapter.getPlacement()).toMatchObject({ row: 1, col: 2, colSpan: 3 })
    expect(placements.length).toBeGreaterThan(0)
  })

  it('accounts for gaps in the track anchors', () => {
    const adapter = createGridPlacementAdapter({
      grid: temp__createGridArtifact(2, 2),
      // 200px tracks, 20px gap: anchors at 0 and 220.
      getTrackGeometry: () => temp__uniformTracks(2, 2, 200, 20),
      initialPlacement: { row: 1, col: 1 },
      onPlacement: () => {}
    })

    adapter.applyMove({ dx: 100, dy: 0 })
    expect(adapter.getPlacement()).toMatchObject({ col: 1 })

    adapter.applyMove({ dx: 120, dy: 0 })
    expect(adapter.getPlacement()).toMatchObject({ col: 2 })
  })

  it('resolves placement on irregular tracks (nearest anchor and extent)', () => {
    const irregular = {
      cols: [50, 200, 100, 150],
      rows: [80, 40, 120, 60],
      columnGap: 10,
      rowGap: 10
    }
    const adapter = createGridPlacementAdapter({
      grid: temp__createGridArtifact(4, 4),
      getTrackGeometry: () => irregular,
      initialPlacement: { row: 1, col: 1 },
      onPlacement: () => {}
    })

    // Column anchors: 0, 60, 270, 380. A 55px move is nearest to anchor 60.
    adapter.applyMove({ dx: 55, dy: 0 })
    expect(adapter.getPlacement()).toMatchObject({ col: 2 })

    // From col 2, extents: 200, 310, 470. A +170px resize targets 370 → span 2.
    adapter.applyResize({ dw: 170, dh: 0 })
    expect(adapter.getPlacement()).toMatchObject({ colSpan: 2 })
  })

  it('applyCellArea applies one atomic footprint (origin moved by north/west handles)', () => {
    const placements: unknown[] = []
    const adapter = createGridPlacementAdapter({
      grid: temp__createGridArtifact(4, 4),
      getTrackGeometry: () => temp__uniformTracks(4, 4, 100),
      initialPlacement: { row: 2, col: 2, rowSpan: 2, colSpan: 2 },
      onPlacement: (placement) => placements.push(placement)
    })

    // North-handle gesture: the origin moves up, the bottom edge stays fixed.
    adapter.applyCellArea!({ row: 1, col: 2, rowSpan: 3, colSpan: 2 })
    expect(adapter.getPlacement()).toEqual({ row: 1, col: 2, rowSpan: 3, colSpan: 2 })

    // Out-of-grid areas are clamped back inward, spans preserved when possible.
    adapter.applyCellArea!({ row: 3, col: 3, rowSpan: 3, colSpan: 3 })
    expect(adapter.getPlacement()).toEqual({ row: 2, col: 2, rowSpan: 3, colSpan: 3 })
    expect(placements).toHaveLength(2)
  })

  it('resets accumulation on resetTo', () => {
    const adapter = createGridPlacementAdapter({
      grid: temp__createGridArtifact(4, 4),
      getTrackGeometry: () => temp__uniformTracks(4, 4, 100),
      initialPlacement: { row: 2, col: 2 },
      onPlacement: () => {}
    })

    adapter.applyMove({ dx: 40, dy: 0 })
    adapter.resetTo({ row: 1, col: 1 })
    adapter.applyMove({ dx: 40, dy: 0 })
    expect(adapter.getPlacement()).toMatchObject({ row: 1, col: 1 })
  })
})

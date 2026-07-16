// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'

import type { AuthorApi } from '../src/author-api'
import { createZoneEditor } from '../src/zone-editor'
import type { ZoneEditorState } from '../src/zone-model'

const temp__emittedNodes = new Set<Element>()

afterEach(() => {
  for (const node of temp__emittedNodes) node.remove()
  temp__emittedNodes.clear()
})

// Same polyfill as selection-frame.spec.ts — jsdom does not implement the
// Pointer Capture API, which gesture-session.ts relies on.
if (typeof HTMLElement.prototype.setPointerCapture !== 'function') {
  const captured = new WeakMap<HTMLElement, Set<number>>()
  HTMLElement.prototype.setPointerCapture = function (pointerId: number): void {
    let set = captured.get(this)
    if (set === undefined) {
      set = new Set()
      captured.set(this, set)
    }
    set.add(pointerId)
  }
  HTMLElement.prototype.hasPointerCapture = function (pointerId: number): boolean {
    return captured.get(this)?.has(pointerId) ?? false
  }
  HTMLElement.prototype.releasePointerCapture = function (pointerId: number): void {
    captured.get(this)?.delete(pointerId)
  }
}

function temp__createAuthorApiStub(): AuthorApi & { emitNode: (persoId: string, node: Element | null) => void } {
  const subscribers = new Map<string, Set<(node: Element | null) => void>>()
  const current = new Map<string, Element | null>()

  return {
    subscribeToNode: (persoId, cb) => {
      let set = subscribers.get(persoId)
      if (set === undefined) {
        set = new Set()
        subscribers.set(persoId, set)
      }
      set.add(cb)
      cb(current.get(persoId) ?? null)
      return () => set!.delete(cb)
    },
    subscribeToPlayerState: (cb) => {
      cb({ isPlaying: false })
      return () => {}
    },
    getPlayerState: () => ({ isPlaying: false }),
    getNodePose: () => null,
    emitNode(persoId, node) {
      if (node !== null && !node.isConnected) {
        document.body.appendChild(node)
        temp__emittedNodes.add(node)
      }
      current.set(persoId, node)
      for (const cb of subscribers.get(persoId) ?? []) cb(node)
    },
  }
}

/** MouseEvent stand-in for a PointerEvent — same convention as selection-frame.spec.ts. */
function temp__firePointer(target: Element, type: string, init: { clientX?: number; clientY?: number; shiftKey?: boolean; altKey?: boolean }): void {
  const event = new MouseEvent(type, { button: 0, bubbles: true, clientX: init.clientX ?? 0, clientY: init.clientY ?? 0, shiftKey: init.shiftKey ?? false, altKey: init.altKey ?? false })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  Object.defineProperty(event, 'buttons', { value: type === 'pointerup' ? 0 : 1 })
  target.dispatchEvent(event)
}

/**
 * A container node sized via explicit inline style — jsdom resolves
 * `getComputedStyle(...).width/height` for an inline style (unlike
 * offsetWidth/clientWidth, always 0 without a real layout engine), which is
 * what `captureOverlayPose`'s own `measureLocalBox` reads. A 400x400 container
 * over a 4x4 grid gives clean 100px cells for gesture math.
 */
function temp__sizedContainer(width = 400, height = 400): HTMLElement {
  const node = document.createElement('div')
  node.style.width = `${width}px`
  node.style.height = `${height}px`
  return node
}

function temp__editorRoot(): HTMLElement | null {
  return document.querySelector('[data-zone-editor="capsule-1"]')
}

function stateOf(rows: number, cols: number, zones: ZoneEditorState['zones'] = []): ZoneEditorState {
  return { grid: { rows, cols }, zones }
}

describe('createZoneEditor — geste : tracer une zone', () => {
  it('a drag on the macro-grid creates a zone at the traced cell-area, with a default z{n} name', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const changes: ZoneEditorState[] = []
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4),
      onZonesChange: (state) => changes.push(state),
      onSelectionChange: () => {},
    })

    const macroGrid = temp__editorRoot()!.querySelector('[data-zone-editor-grid-background]')!

    temp__firePointer(macroGrid, 'pointerdown', { clientX: 20, clientY: 20 })
    temp__firePointer(macroGrid, 'pointermove', { clientX: 120, clientY: 220 })
    temp__firePointer(macroGrid, 'pointerup', { clientX: 120, clientY: 220 })

    expect(handle.getState().zones).toHaveLength(1)
    const zone = handle.getState().zones[0]!
    expect(zone.name).toBe('z1')
    // 20px..120px on a 100px/cell axis spans cell 1 to cell 2; 20px..220px spans cell 1 to cell 3.
    expect(zone.col).toBe(1)
    expect(zone.colSpan).toBe(2)
    expect(zone.row).toBe(1)
    expect(zone.rowSpan).toBe(3)
    expect(changes).toHaveLength(1)

    handle.destroy()
  })

  it('selects the newly-traced zone', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const selections: string[][] = []
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4),
      onZonesChange: () => {},
      onSelectionChange: (names) => selections.push(names),
    })

    const macroGrid = temp__editorRoot()!.querySelector('[data-zone-editor-grid-background]')!
    temp__firePointer(macroGrid, 'pointerdown', { clientX: 20, clientY: 20 })
    temp__firePointer(macroGrid, 'pointerup', { clientX: 20, clientY: 20 })

    expect(selections.at(-1)).toEqual(['z1'])
    handle.destroy()
  })

  it('removes the trace preview node once the gesture ends', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })

    const macroGrid = temp__editorRoot()!.querySelector('[data-zone-editor-grid-background]')!
    temp__firePointer(macroGrid, 'pointerdown', { clientX: 20, clientY: 20 })
    temp__firePointer(macroGrid, 'pointermove', { clientX: 120, clientY: 20 })
    temp__firePointer(macroGrid, 'pointerup', { clientX: 120, clientY: 20 })

    expect(temp__editorRoot()!.querySelector('[data-zone-editor-trace-preview]')).toBeNull()
    handle.destroy()
  })
})

describe('createZoneEditor — geste : sélectionner (clic / Shift+clic)', () => {
  it('a plain click on a zone selects it alone, replacing any prior selection', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const selections: string[][] = []
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4, [
        { name: 'a', row: 1, col: 1, rowSpan: 1, colSpan: 1 },
        { name: 'b', row: 2, col: 2, rowSpan: 1, colSpan: 1 },
      ]),
      onZonesChange: () => {},
      onSelectionChange: (names) => selections.push(names),
    })

    const zoneA = temp__editorRoot()!.querySelector('[data-zone-editor-zone="a"]')!
    temp__firePointer(zoneA, 'pointerdown', { clientX: 50, clientY: 50 })
    temp__firePointer(zoneA, 'pointerup', { clientX: 50, clientY: 50 })

    expect(selections.at(-1)).toEqual(['a'])
    handle.destroy()
  })

  it('Shift+click toggles a zone into/out of a multi-selection without clearing it', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const selections: string[][] = []
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4, [
        { name: 'a', row: 1, col: 1, rowSpan: 1, colSpan: 1 },
        { name: 'b', row: 2, col: 2, rowSpan: 1, colSpan: 1 },
      ]),
      onZonesChange: () => {},
      onSelectionChange: (names) => selections.push(names),
    })

    handle.select(['a'])
    const zoneB = temp__editorRoot()!.querySelector('[data-zone-editor-zone="b"]')!
    temp__firePointer(zoneB, 'pointerdown', { clientX: 250, clientY: 250, shiftKey: true })
    temp__firePointer(zoneB, 'pointerup', { clientX: 250, clientY: 250, shiftKey: true })

    expect(selections.at(-1)?.sort()).toEqual(['a', 'b'])
    handle.destroy()
  })

  it('renders 8 resize handles only on the selected zone, none on the others', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4, [
        { name: 'a', row: 1, col: 1, rowSpan: 1, colSpan: 1 },
        { name: 'b', row: 2, col: 2, rowSpan: 1, colSpan: 1 },
      ]),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })

    handle.select(['a'])
    const zoneA = temp__editorRoot()!.querySelector('[data-zone-editor-zone="a"]')!
    const zoneB = temp__editorRoot()!.querySelector('[data-zone-editor-zone="b"]')!
    expect(zoneA.querySelectorAll('[data-zone-editor-handle]')).toHaveLength(8)
    expect(zoneB.querySelectorAll('[data-zone-editor-handle]')).toHaveLength(0)

    handle.destroy()
  })
})

describe('createZoneEditor — geste : Alt+clic cycle les zones chevauchées', () => {
  it('Alt+click on the topmost of 2 overlapping zones selects the OTHER one, replacing the selection', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const selections: string[][] = []
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      // 'a' and 'b' fully overlap — 'b' renders last, so a plain click always hits it first.
      initialState: stateOf(4, 4, [
        { name: 'a', row: 1, col: 1, rowSpan: 2, colSpan: 2 },
        { name: 'b', row: 1, col: 1, rowSpan: 2, colSpan: 2 },
      ]),
      onZonesChange: () => {},
      onSelectionChange: (names) => selections.push(names),
    })

    handle.select(['b'])
    const zoneB = temp__editorRoot()!.querySelector('[data-zone-editor-zone="b"]')!
    temp__firePointer(zoneB, 'pointerdown', { clientX: 50, clientY: 50, altKey: true })
    temp__firePointer(zoneB, 'pointerup', { clientX: 50, clientY: 50, altKey: true })

    expect(selections.at(-1)).toEqual(['a'])
    handle.destroy()
  })

  it('Alt+click cycles back to the first candidate once the last overlapping zone is reached', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const selections: string[][] = []
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4, [
        { name: 'a', row: 1, col: 1, rowSpan: 2, colSpan: 2 },
        { name: 'b', row: 1, col: 1, rowSpan: 2, colSpan: 2 },
      ]),
      onZonesChange: () => {},
      onSelectionChange: (names) => selections.push(names),
    })

    const zoneB = temp__editorRoot()!.querySelector('[data-zone-editor-zone="b"]')!
    // No pre-selection: the cycle advances from the topmost candidate ('b', what DOM hit-testing
    // resolves), landing on 'a' the first time. The second click (same click, same DOM node —
    // real editors, e.g. Figma/Illustrator, repeat Alt+click at the same screen point to walk
    // further down the stack each time) advances from the now-CURRENT selection ('a') to 'b'.
    temp__firePointer(zoneB, 'pointerdown', { clientX: 50, clientY: 50, altKey: true })
    temp__firePointer(zoneB, 'pointerup', { clientX: 50, clientY: 50, altKey: true })
    expect(selections.at(-1)).toEqual(['a'])

    temp__firePointer(zoneB, 'pointerdown', { clientX: 50, clientY: 50, altKey: true })
    temp__firePointer(zoneB, 'pointerup', { clientX: 50, clientY: 50, altKey: true })
    expect(selections.at(-1)).toEqual(['b'])

    handle.destroy()
  })

  it('Alt+Shift+click ADDS the next overlapping zone without dropping the current selection', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const selections: string[][] = []
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4, [
        { name: 'a', row: 1, col: 1, rowSpan: 2, colSpan: 2 },
        { name: 'b', row: 1, col: 1, rowSpan: 2, colSpan: 2 },
        { name: 'c', row: 3, col: 3, rowSpan: 1, colSpan: 1 },
      ]),
      onZonesChange: () => {},
      onSelectionChange: (names) => selections.push(names),
    })

    handle.select(['c'])
    const zoneB = temp__editorRoot()!.querySelector('[data-zone-editor-zone="b"]')!
    temp__firePointer(zoneB, 'pointerdown', { clientX: 50, clientY: 50, altKey: true, shiftKey: true })
    temp__firePointer(zoneB, 'pointerup', { clientX: 50, clientY: 50, altKey: true, shiftKey: true })

    // 'c' (pre-existing selection) stays; 'a' (the next candidate after 'b') is added.
    expect(selections.at(-1)?.sort()).toEqual(['a', 'c'])
    handle.destroy()
  })

  it('Alt+click never starts a move gesture — the zone stays at its own placement', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const changes: ZoneEditorState[] = []
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4, [
        { name: 'a', row: 1, col: 1, rowSpan: 2, colSpan: 2 },
        { name: 'b', row: 1, col: 1, rowSpan: 2, colSpan: 2 },
      ]),
      onZonesChange: (state) => changes.push(state),
      onSelectionChange: () => {},
    })

    const zoneB = temp__editorRoot()!.querySelector('[data-zone-editor-zone="b"]')!
    temp__firePointer(zoneB, 'pointerdown', { clientX: 50, clientY: 50, altKey: true })
    temp__firePointer(zoneB, 'pointermove', { clientX: 250, clientY: 250, altKey: true })
    temp__firePointer(zoneB, 'pointerup', { clientX: 250, clientY: 250, altKey: true })

    expect(changes).toHaveLength(0)
    expect(handle.getState().zones).toEqual([
      { name: 'a', row: 1, col: 1, rowSpan: 2, colSpan: 2 },
      { name: 'b', row: 1, col: 1, rowSpan: 2, colSpan: 2 },
    ])

    handle.destroy()
  })
})

describe('createZoneEditor — geste : déplacer une zone', () => {
  it('dragging a zone body moves its origin, keeping its spans, and emits onZonesChange', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const changes: ZoneEditorState[] = []
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4, [{ name: 'a', row: 1, col: 1, rowSpan: 1, colSpan: 1 }]),
      onZonesChange: (state) => changes.push(state),
      onSelectionChange: () => {},
    })

    const zoneA = temp__editorRoot()!.querySelector('[data-zone-editor-zone="a"]')!
    temp__firePointer(zoneA, 'pointerdown', { clientX: 50, clientY: 50 })
    temp__firePointer(zoneA, 'pointermove', { clientX: 250, clientY: 250 })
    temp__firePointer(zoneA, 'pointerup', { clientX: 250, clientY: 250 })

    const zone = handle.getState().zones[0]!
    expect(zone).toMatchObject({ row: 3, col: 3, rowSpan: 1, colSpan: 1 })
    expect(changes.length).toBeGreaterThan(0)

    handle.destroy()
  })

  it('dragging one zone of a multi-selection moves every selected zone by the same delta', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4, [
        { name: 'a', row: 1, col: 1, rowSpan: 1, colSpan: 1 },
        { name: 'b', row: 1, col: 3, rowSpan: 1, colSpan: 1 },
      ]),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })

    handle.select(['a', 'b'])
    const zoneA = temp__editorRoot()!.querySelector('[data-zone-editor-zone="a"]')!
    temp__firePointer(zoneA, 'pointerdown', { clientX: 50, clientY: 50 })
    temp__firePointer(zoneA, 'pointermove', { clientX: 150, clientY: 150 })
    temp__firePointer(zoneA, 'pointerup', { clientX: 150, clientY: 150 })

    const zoneAAfter = handle.getState().zones.find((z) => z.name === 'a')!
    const zoneBAfter = handle.getState().zones.find((z) => z.name === 'b')!
    // Both moved by the same +1 row / +1 col delta — b keeps its own 2-column offset from a.
    expect(zoneAAfter).toMatchObject({ row: 2, col: 2 })
    expect(zoneBAfter).toMatchObject({ row: 2, col: 4 })

    handle.destroy()
  })

  it('a multi-selection group move clamps each zone independently against the grid edge', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4, [
        { name: 'a', row: 1, col: 1, rowSpan: 1, colSpan: 1 },
        { name: 'b', row: 1, col: 4, rowSpan: 1, colSpan: 1 },
      ]),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })

    handle.select(['a', 'b'])
    const zoneA = temp__editorRoot()!.querySelector('[data-zone-editor-zone="a"]')!
    // Drag far to the right — 'a' alone could move freely, but 'b' is already at the last column.
    temp__firePointer(zoneA, 'pointerdown', { clientX: 50, clientY: 50 })
    temp__firePointer(zoneA, 'pointermove', { clientX: 390, clientY: 50 })
    temp__firePointer(zoneA, 'pointerup', { clientX: 390, clientY: 50 })

    const zoneBAfter = handle.getState().zones.find((z) => z.name === 'b')!
    // 'b' never crosses the grid edge, regardless of how far the primary drag went.
    expect(zoneBAfter.col).toBeLessThanOrEqual(4)

    handle.destroy()
  })

  it('a plain (non-multi) drag never moves a DIFFERENT, unselected zone', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4, [
        { name: 'a', row: 1, col: 1, rowSpan: 1, colSpan: 1 },
        { name: 'b', row: 1, col: 3, rowSpan: 1, colSpan: 1 },
      ]),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })

    // 'b' is never selected — only 'a' is dragged.
    const zoneA = temp__editorRoot()!.querySelector('[data-zone-editor-zone="a"]')!
    temp__firePointer(zoneA, 'pointerdown', { clientX: 50, clientY: 50 })
    temp__firePointer(zoneA, 'pointermove', { clientX: 150, clientY: 150 })
    temp__firePointer(zoneA, 'pointerup', { clientX: 150, clientY: 150 })

    const zoneBAfter = handle.getState().zones.find((z) => z.name === 'b')!
    expect(zoneBAfter).toMatchObject({ row: 1, col: 3 })

    handle.destroy()
  })

  it('a move is clamped so the zone never crosses the grid edge', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4, [{ name: 'a', row: 1, col: 1, rowSpan: 2, colSpan: 2 }]),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })

    const zoneA = temp__editorRoot()!.querySelector('[data-zone-editor-zone="a"]')!
    temp__firePointer(zoneA, 'pointerdown', { clientX: 50, clientY: 50 })
    temp__firePointer(zoneA, 'pointermove', { clientX: 390, clientY: 390 })
    temp__firePointer(zoneA, 'pointerup', { clientX: 390, clientY: 390 })

    const zone = handle.getState().zones[0]!
    // A 2-span zone on a 4-track grid can only originate at row/col 1..3.
    expect(zone.row).toBeLessThanOrEqual(3)
    expect(zone.col).toBeLessThanOrEqual(3)
    expect(zone.rowSpan).toBe(2)
    expect(zone.colSpan).toBe(2)

    handle.destroy()
  })

  it('a click without movement selects but does not emit onZonesChange (nothing actually moved)', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const changes: ZoneEditorState[] = []
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4, [{ name: 'a', row: 1, col: 1, rowSpan: 1, colSpan: 1 }]),
      onZonesChange: (state) => changes.push(state),
      onSelectionChange: () => {},
    })

    const zoneA = temp__editorRoot()!.querySelector('[data-zone-editor-zone="a"]')!
    temp__firePointer(zoneA, 'pointerdown', { clientX: 50, clientY: 50 })
    temp__firePointer(zoneA, 'pointerup', { clientX: 50, clientY: 50 })

    expect(changes).toHaveLength(0)
    expect(handle.getState().zones[0]).toMatchObject({ row: 1, col: 1 })

    handle.destroy()
  })
})

describe('createZoneEditor — geste : redimensionner (poignées)', () => {
  it('dragging the se handle grows the zone from its own origin, keeping the opposite corner fixed', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4, [{ name: 'a', row: 1, col: 1, rowSpan: 1, colSpan: 1 }]),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })

    handle.select(['a'])
    const seHandle = temp__editorRoot()!.querySelector('[data-zone-editor-zone="a"] [data-zone-editor-handle="se"]')!
    temp__firePointer(seHandle, 'pointerdown', { clientX: 90, clientY: 90 })
    temp__firePointer(seHandle, 'pointermove', { clientX: 290, clientY: 290 })
    temp__firePointer(seHandle, 'pointerup', { clientX: 290, clientY: 290 })

    const zone = handle.getState().zones[0]!
    expect(zone.row).toBe(1)
    expect(zone.col).toBe(1)
    expect(zone.rowSpan).toBe(3)
    expect(zone.colSpan).toBe(3)

    handle.destroy()
  })

  it('dragging the nw handle moves the origin while keeping the opposite (se) corner fixed', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4, [{ name: 'a', row: 3, col: 3, rowSpan: 2, colSpan: 2 }]),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })

    handle.select(['a'])
    const nwHandle = temp__editorRoot()!.querySelector('[data-zone-editor-zone="a"] [data-zone-editor-handle="nw"]')!
    temp__firePointer(nwHandle, 'pointerdown', { clientX: 210, clientY: 210 })
    temp__firePointer(nwHandle, 'pointermove', { clientX: 10, clientY: 10 })
    temp__firePointer(nwHandle, 'pointerup', { clientX: 10, clientY: 10 })

    const zone = handle.getState().zones[0]!
    // Opposite corner (se) was row+rowSpan-1=4, col+colSpan-1=4 — must stay there.
    expect(zone.row + zone.rowSpan - 1).toBe(4)
    expect(zone.col + zone.colSpan - 1).toBe(4)
    expect(zone.row).toBe(1)
    expect(zone.col).toBe(1)

    handle.destroy()
  })

  it('a resize never shrinks a span below 1', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4, [{ name: 'a', row: 2, col: 2, rowSpan: 2, colSpan: 2 }]),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })

    handle.select(['a'])
    const seHandle = temp__editorRoot()!.querySelector('[data-zone-editor-zone="a"] [data-zone-editor-handle="se"]')!
    // Drag the se handle far past the nw corner — must clamp to span 1, not collapse/invert.
    temp__firePointer(seHandle, 'pointerdown', { clientX: 290, clientY: 290 })
    temp__firePointer(seHandle, 'pointermove', { clientX: 10, clientY: 10 })
    temp__firePointer(seHandle, 'pointerup', { clientX: 10, clientY: 10 })

    const zone = handle.getState().zones[0]!
    expect(zone.rowSpan).toBeGreaterThanOrEqual(1)
    expect(zone.colSpan).toBeGreaterThanOrEqual(1)

    handle.destroy()
  })
})

describe('createZoneEditor — commandes programmatiques (même chemin de mutation que les gestes)', () => {
  it('addZone/removeZone/renameZone mutate state and emit onZonesChange', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const changes: ZoneEditorState[] = []
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4),
      onZonesChange: (state) => changes.push(state),
      onSelectionChange: () => {},
    })

    const name = handle.addZone({ row: 1, col: 1, rowSpan: 1, colSpan: 1 })
    expect(name).toBe('z1')
    handle.renameZone('z1', 'titre')
    expect(handle.getState().zones[0]!.name).toBe('titre')
    handle.removeZone('titre')
    expect(handle.getState().zones).toHaveLength(0)
    expect(changes).toHaveLength(3)

    handle.destroy()
  })

  it('divideZone / resizeContainerAxis / breakContainer via commands round-trip through ZoneEditorHandle', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(1, 6, [{ name: 'z1', row: 1, col: 1, rowSpan: 1, colSpan: 6 }]),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })

    // The SAME zone gains `container` — never removed, never a new entry (design doc §Cycle de vie).
    handle.divideZone('z1')
    const divided = handle.getState().zones.find((z) => z.name === 'z1')!
    expect(divided.container).toBeDefined()
    expect(divided.container!.grid).toMatchObject({ rows: 1, cols: 2 })
    // A measurable main-grid container (temp__sizedContainer's own real width/height, resolved
    // through the same uniform-track fallback jsdom always takes) applies a default gap aligned
    // with a main-grid track size (design doc §Rendu — Valeur de gap par défaut).
    expect(divided.container!.grid.gap).toBeDefined()

    handle.resizeContainerAxis('z1', 'col', 3)
    const resized = handle.getState().zones.find((z) => z.name === 'z1')!
    expect(resized.container!.grid).toMatchObject({ rows: 1, cols: 3 })
    // "Les zones-enfants correspondent aux cellules d'une grille" — growing an axis regenerates
    // children to exactly match the new rows×cols (3 cells now, not still 2).
    expect(resized.container!.children).toHaveLength(3)

    const created = handle.breakContainer('z1')
    expect(created).toEqual(['z1.1.1', 'z1.1.2', 'z1.1.3'])
    expect(handle.getState().zones.some((z) => z.name === 'z1')).toBe(false)
    expect(handle.getState().zones.map((z) => z.name).sort()).toEqual(['z1.1.1', 'z1.1.2', 'z1.1.3'])

    handle.destroy()
  })

  it('listAllZoneNames surfaces both leaves and container children, distinguishing their kind', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4, [{ name: 'a', row: 1, col: 1, rowSpan: 1, colSpan: 1 }]),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })
    handle.addZone({ row: 2, col: 1, rowSpan: 1, colSpan: 4 }, 'z1')
    handle.divideZone('z1')

    const listed = handle.listAllZoneNames()
    // 'z1' itself is still `kind: 'leaf'` — carrying `container` doesn't change its own listing kind.
    expect(listed.filter((z) => z.kind === 'leaf').map((z) => z.name).sort()).toEqual(['a', 'z1'])
    expect(listed.filter((z) => z.kind === 'container-child')).toHaveLength(2)

    handle.destroy()
  })

  it('mergeZones via command replaces the sources with their bounding footprint', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4, [
        { name: 'a', row: 1, col: 1, rowSpan: 1, colSpan: 1 },
        { name: 'b', row: 3, col: 4, rowSpan: 2, colSpan: 1 },
      ]),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })

    const mergedName = handle.mergeZones(['a', 'b'])
    expect(mergedName).toBe('a')
    expect(handle.getState().zones).toEqual([{ name: 'a', row: 1, col: 1, rowSpan: 4, colSpan: 4 }])

    handle.destroy()
  })

  it('setGrid replaces the base grid and re-projects the display', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })

    const background = temp__editorRoot()!.querySelector('[data-zone-editor-grid-background]') as HTMLElement
    const before = background.style.backgroundImage

    handle.setGrid({ rows: 2, cols: 2 })
    expect(handle.getState().grid).toEqual({ rows: 2, cols: 2 })
    expect(background.style.backgroundImage).not.toBe(before)

    handle.destroy()
  })

  it('setState replaces grid + zones together (a card / a constraint switch)', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })

    const card = stateOf(3, 3, [
      { name: 'titre', row: 1, col: 1, rowSpan: 1, colSpan: 3 },
      { name: 'corps', row: 2, col: 1, rowSpan: 1, colSpan: 3 },
      { name: 'footer', row: 3, col: 1, rowSpan: 1, colSpan: 3 },
    ])
    handle.setState(card)
    expect(handle.getState()).toEqual(card)
    expect(temp__editorRoot()!.querySelectorAll('[data-zone-editor-zone]')).toHaveLength(3)

    handle.destroy()
  })
})

describe('createZoneEditor — geste clavier : ajuster rows/cols de la zone sélectionnée', () => {
  function fireKey(key: string): void {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  }

  it('ArrowRight grows cols by 1 on the selected zone\'s own container, regenerating its cells', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(1, 6, [{ name: 'z1', row: 1, col: 1, rowSpan: 1, colSpan: 6 }]),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })
    handle.divideZone('z1') // cols: 2
    handle.select(['z1'])

    fireKey('ArrowRight')
    const zone = handle.getState().zones.find((z) => z.name === 'z1')!
    expect(zone.container!.grid).toMatchObject({ cols: 3, rows: 1 })
    expect(zone.container!.children).toHaveLength(3)

    handle.destroy()
  })

  it('ArrowLeft shrinks cols by 1, stopping at the divider\'s own floor of 2', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(1, 6, [{ name: 'z1', row: 1, col: 1, rowSpan: 1, colSpan: 6 }]),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })
    handle.divideZone('z1') // cols: 2
    handle.select(['z1'])

    fireKey('ArrowLeft') // already at the floor — silent no-op
    expect(handle.getState().zones.find((z) => z.name === 'z1')!.container!.grid.cols).toBe(2)

    handle.destroy()
  })

  it('ArrowUp grows rows, ArrowDown shrinks it ("haut = plus, bas = moins") — the OTHER axis, independent of cols', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(6, 1, [{ name: 'z1', row: 1, col: 1, rowSpan: 6, colSpan: 1 }]),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })
    handle.divideZone('z1', 'row') // rows: 2
    handle.select(['z1'])

    fireKey('ArrowUp')
    expect(handle.getState().zones.find((z) => z.name === 'z1')!.container!.grid).toMatchObject({ rows: 3, cols: 1 })

    fireKey('ArrowDown')
    expect(handle.getState().zones.find((z) => z.name === 'z1')!.container!.grid).toMatchObject({ rows: 2, cols: 1 })

    handle.destroy()
  })

  it('does nothing when the selected zone does not carry a container', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4, [{ name: 'a', row: 1, col: 1, rowSpan: 1, colSpan: 1 }]),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })
    handle.select(['a'])

    fireKey('ArrowRight')
    expect(handle.getState().zones.find((z) => z.name === 'a')!.container).toBeUndefined()

    handle.destroy()
  })

  it('does nothing when more than one zone is selected', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(1, 6, [{ name: 'z1', row: 1, col: 1, rowSpan: 1, colSpan: 6 }]),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })
    handle.divideZone('z1')
    handle.addZone({ row: 1, col: 1, rowSpan: 1, colSpan: 1 }, 'a')
    handle.select(['z1', 'a'])

    fireKey('ArrowRight')
    expect(handle.getState().zones.find((z) => z.name === 'z1')!.container!.grid.cols).toBe(2)

    handle.destroy()
  })

  it('a non-arrow key is a no-op', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(1, 6, [{ name: 'z1', row: 1, col: 1, rowSpan: 1, colSpan: 6 }]),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })
    handle.divideZone('z1')
    handle.select(['z1'])

    fireKey('Enter')
    expect(handle.getState().zones.find((z) => z.name === 'z1')!.container!.grid.cols).toBe(2)

    handle.destroy()
  })

  it('the listener is removed on destroy — no further mutation after that', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(1, 6, [{ name: 'z1', row: 1, col: 1, rowSpan: 1, colSpan: 6 }]),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })
    handle.divideZone('z1')
    handle.select(['z1'])
    const stateBeforeDestroy = handle.getState()

    handle.destroy()
    fireKey('ArrowRight') // must not throw despite `destroyed` guard, and must not mutate anything observable

    expect(handle.getState()).toEqual(stateBeforeDestroy)
  })

  it('is machine-gated — a keypress mid-drag (pointer capture already held elsewhere) is a no-op', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4, [
        { name: 'z1', row: 1, col: 1, rowSpan: 1, colSpan: 2 },
        { name: 'other', row: 3, col: 3, rowSpan: 1, colSpan: 1 },
      ]),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })
    handle.divideZone('z1')
    handle.select(['z1'])

    // Start a real drag on the OTHER zone — the machine is now `{ active: 'moving' }`, not `still`.
    const otherNode = temp__editorRoot()!.querySelector('[data-zone-editor-zone="other"]')!
    temp__firePointer(otherNode, 'pointerdown', { clientX: 50, clientY: 50 })
    temp__firePointer(otherNode, 'pointermove', { clientX: 100, clientY: 100 })

    fireKey('ArrowRight')
    expect(handle.getState().zones.find((z) => z.name === 'z1')!.container!.grid.cols).toBe(2)

    handle.destroy()
  })
})

describe('createZoneEditor — geste clavier : Delete/Backspace efface la sélection', () => {
  function fireKey(key: string): void {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  }

  it('Delete removes every currently selected zone, including one carrying a container', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4, [
        { name: 'a', row: 1, col: 1, rowSpan: 1, colSpan: 1 },
        { name: 'z1', row: 2, col: 1, rowSpan: 1, colSpan: 2 },
      ]),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })
    handle.divideZone('z1')
    handle.select(['a', 'z1'])

    fireKey('Delete')
    expect(handle.getState().zones).toHaveLength(0)

    handle.destroy()
  })

  it('Backspace has the same effect as Delete', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4, [{ name: 'a', row: 1, col: 1, rowSpan: 1, colSpan: 1 }]),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })
    handle.select(['a'])

    fireKey('Backspace')
    expect(handle.getState().zones).toHaveLength(0)

    handle.destroy()
  })

  it('clears the selection after removing it', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const selections: string[][] = []
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4, [{ name: 'a', row: 1, col: 1, rowSpan: 1, colSpan: 1 }]),
      onZonesChange: () => {},
      onSelectionChange: (names) => selections.push(names),
    })
    handle.select(['a'])

    fireKey('Delete')
    expect(selections.at(-1)).toEqual([])

    handle.destroy()
  })

  it('is a no-op with nothing selected', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4, [{ name: 'a', row: 1, col: 1, rowSpan: 1, colSpan: 1 }]),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })

    fireKey('Delete')
    expect(handle.getState().zones).toHaveLength(1)

    handle.destroy()
  })

  it('a non-delete key is a no-op', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4, [{ name: 'a', row: 1, col: 1, rowSpan: 1, colSpan: 1 }]),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })
    handle.select(['a'])

    fireKey('Enter')
    expect(handle.getState().zones).toHaveLength(1)

    handle.destroy()
  })

  it('is machine-gated — a keypress mid-drag (pointer capture already held elsewhere) is a no-op', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4, [
        { name: 'a', row: 1, col: 1, rowSpan: 1, colSpan: 1 },
        { name: 'other', row: 3, col: 3, rowSpan: 1, colSpan: 1 },
      ]),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })
    handle.select(['a'])

    const otherNode = temp__editorRoot()!.querySelector('[data-zone-editor-zone="other"]')!
    temp__firePointer(otherNode, 'pointerdown', { clientX: 50, clientY: 50 })
    temp__firePointer(otherNode, 'pointermove', { clientX: 100, clientY: 100 })

    fireKey('Delete')
    expect(handle.getState().zones).toHaveLength(2)

    handle.destroy()
  })

  it('the listener is removed on destroy — no further mutation after that', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', temp__sizedContainer())
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4, [{ name: 'a', row: 1, col: 1, rowSpan: 1, colSpan: 1 }]),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })
    handle.select(['a'])

    handle.destroy()
    fireKey('Delete') // must not throw despite `destroyed` guard

    expect(handle.getState().zones).toHaveLength(1)
  })
})

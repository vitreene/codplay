// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import type { AutoCapsuleGridArtifact } from '@codplay/capsule-automation'

import type { AuthorApi } from '../src/author-api'
import { createSelectionFrame } from '../src/selection-frame'
import { createMultiSelectionFrame } from '../src/multi-selection-frame'
import type { CsValueAdapter } from '../src/types'

function temp__createGridArtifact(rows: number, cols: number): AutoCapsuleGridArtifact {
  return {
    className: 'grid',
    inlineStyle: {},
    cssRules: [],
    context: { rows, cols, mode: 'manual' }
  }
}

// jsdom does not implement the Pointer Capture API — polyfill the minimal
// surface gesture-session.ts relies on so trace/drag/resize gestures can be
// exercised with real pointerdown/pointermove/pointerup sequences.
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

/**
 * jsdom does not implement `elementsFromPoint` (no real layout engine to resolve a point against)
 * — a fixed stack is set once per test via `temp__setElementsFromPointStack`, letting Alt+click
 * cycle tests prove the module correctly CONSUMES and FILTERS the result, without needing real
 * geometry (which `resolveAltClickCandidates` itself never computes — it's a pure pass-through
 * over whatever elementsFromPoint returns).
 */
let temp__elementsFromPointStack: Element[] = []
function temp__setElementsFromPointStack(stack: Element[]): void {
  temp__elementsFromPointStack = stack
}
if (typeof document.elementsFromPoint !== 'function') {
  document.elementsFromPoint = () => temp__elementsFromPointStack
}

/**
 * AuthorApi stub with controllable node lifecycle per persoId.
 */
function temp__createAuthorApiStub(): AuthorApi & {
  emitNode: (persoId: string, node: Element | null) => void
} {
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
    emitNode(persoId, node) {
      current.set(persoId, node)
      for (const cb of subscribers.get(persoId) ?? []) cb(node)
    }
  }
}

function temp__createNoopAdapter(): CsValueAdapter {
  return { applyMove: () => {}, applyResize: () => {}, applyRotate: () => {}, applyScale: () => {} }
}

function temp__csRoot(itemId: string): HTMLElement | null {
  return document.querySelector(`[data-selection-frame="${itemId}"]`)
}

function temp__creationSurface(): HTMLElement | null {
  return document.querySelector('[data-cs-creation-surface]')
}

/** MouseEvent stand-in for a PointerEvent (jsdom convention already used by the alt-click test below) — pointerId is attached separately since MouseEventInit doesn't declare it. */
function temp__firePointer(target: Element, type: string, init: { clientX?: number; clientY?: number; shiftKey?: boolean; altKey?: boolean }): void {
  const event = new MouseEvent(type, { button: 0, bubbles: true, clientX: init.clientX ?? 0, clientY: init.clientY ?? 0, shiftKey: init.shiftKey ?? false, altKey: init.altKey ?? false })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  Object.defineProperty(event, 'buttons', { value: type === 'pointerup' ? 0 : 1 })
  target.dispatchEvent(event)
}

describe('createSelectionFrame', () => {
  it('creates the cs hidden while no node is present, shows it on node appearance', () => {
    const authorApi = temp__createAuthorApiStub()
    const handle = createSelectionFrame({
      itemId: 'item-1',
      authorApi,
      sceneRoot: document.body,
      adapter: temp__createNoopAdapter()
    })

    const cs = temp__csRoot('item-1')
    expect(cs).not.toBeNull()
    expect(cs!.style.display).toBe('none')

    authorApi.emitNode('item-1', document.createElement('div'))
    expect(cs!.style.display).not.toBe('none')

    handle.destroy()
  })

  it('never calibrates the cs while it is display:none on first attach (same path attachItem uses for a synchronously-resolved node)', () => {
    const authorApi = temp__createAuthorApiStub()
    const violations: string[] = []
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      if (this.hasAttribute('data-selection-frame') && this.style.display === 'none') {
        violations.push('measured a display:none cs')
      }
      return originalGetBoundingClientRect.call(this)
    }

    try {
      // A node already resolved BEFORE construction is delivered synchronously
      // by subscribeToNode — the exact same timing as create mode's attachItem,
      // which subscribes to an already-registered synthetic node.
      authorApi.emitNode('item-1', document.createElement('div'))
      const handle = createSelectionFrame({
        itemId: 'item-1',
        authorApi,
        sceneRoot: document.body,
        adapter: temp__createNoopAdapter()
      })

      expect(violations).toEqual([])
      handle.destroy()
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
    }
  })

  it('suspends the cs when the node disappears and reattaches on return', () => {
    const authorApi = temp__createAuthorApiStub()
    const node = document.createElement('div')
    authorApi.emitNode('item-1', node)

    const handle = createSelectionFrame({
      itemId: 'item-1',
      authorApi,
      sceneRoot: document.body,
      adapter: temp__createNoopAdapter()
    })
    const cs = temp__csRoot('item-1')!
    expect(cs.style.display).not.toBe('none')

    authorApi.emitNode('item-1', null)
    expect(cs.style.display).toBe('none')

    authorApi.emitNode('item-1', node)
    expect(cs.style.display).not.toBe('none')

    handle.destroy()
  })

  it('setPartVisibility("cs") hides the frame without losing the selection', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('item-1', document.createElement('div'))

    const handle = createSelectionFrame({
      itemId: 'item-1',
      authorApi,
      sceneRoot: document.body,
      adapter: temp__createNoopAdapter()
    })
    const cs = temp__csRoot('item-1')!

    handle.setPartVisibility('cs', false)
    expect(cs.style.display).toBe('none')

    handle.setPartVisibility('cs', true)
    expect(cs.style.display).not.toBe('none')

    handle.destroy()
  })

  it('setPartVisibility("element") toggles the element visibility', () => {
    const authorApi = temp__createAuthorApiStub()
    const node = document.createElement('div')
    authorApi.emitNode('item-1', node)

    const handle = createSelectionFrame({
      itemId: 'item-1',
      authorApi,
      sceneRoot: document.body,
      adapter: temp__createNoopAdapter()
    })

    handle.setPartVisibility('element', false)
    expect(node.style.visibility).toBe('hidden')

    handle.setPartVisibility('element', true)
    expect(node.style.visibility).toBe('')

    handle.destroy()
  })

  it('setPartActive("cs", false) disables pointer events on the frame', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('item-1', document.createElement('div'))

    const handle = createSelectionFrame({
      itemId: 'item-1',
      authorApi,
      sceneRoot: document.body,
      adapter: temp__createNoopAdapter()
    })
    const cs = temp__csRoot('item-1')!

    handle.setPartActive('cs', false)
    expect(cs.style.pointerEvents).toBe('none')

    handle.setPartActive('cs', true)
    expect(cs.style.pointerEvents).toBe('auto')

    handle.destroy()
  })

  it('applyPreset hides resize handles when resize/scale are absent', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('item-1', document.createElement('div'))

    const handle = createSelectionFrame({
      itemId: 'item-1',
      authorApi,
      sceneRoot: document.body,
      adapter: temp__createNoopAdapter()
    })
    const cs = temp__csRoot('item-1')!
    const anyHandle = cs.querySelector<HTMLElement>('[data-cs-handle]')!
    expect(anyHandle.style.display).not.toBe('none')

    handle.applyPreset({ name: 'move-only', capabilities: ['move'] })
    expect(anyHandle.style.display).toBe('none')

    handle.destroy()
  })

  it('alt-click toggles a handle between resize and scale with a thicker border', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('item-1', document.createElement('div'))

    const handle = createSelectionFrame({
      itemId: 'item-1',
      authorApi,
      sceneRoot: document.body,
      adapter: temp__createNoopAdapter()
    })
    const cs = temp__csRoot('item-1')!
    const cornerHandle = cs.querySelector<HTMLElement>('[data-cs-handle="se"]')!
    expect(cornerHandle.style.borderWidth).toBe('1px')

    cornerHandle.dispatchEvent(new MouseEvent('pointerdown', { altKey: true, button: 0, bubbles: true }))
    expect(cornerHandle.style.borderWidth).toBe('3px')

    cornerHandle.dispatchEvent(new MouseEvent('pointerdown', { altKey: true, button: 0, bubbles: true }))
    expect(cornerHandle.style.borderWidth).toBe('1px')

    handle.destroy()
  })

  it('preset can forbid the swap or assign a fixed mode to handles', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('item-1', document.createElement('div'))

    const handle = createSelectionFrame({
      itemId: 'item-1',
      authorApi,
      sceneRoot: document.body,
      adapter: temp__createNoopAdapter()
    })
    const cs = temp__csRoot('item-1')!
    const cornerHandle = cs.querySelector<HTMLElement>('[data-cs-handle="se"]')!
    const sideHandle = cs.querySelector<HTMLElement>('[data-cs-handle="e"]')!

    handle.applyPreset({
      name: 'locked',
      capabilities: ['move', 'resize', 'scale'],
      handles: {
        corners: { allowSwap: false },
        sides: { mode: 'scale' }
      }
    })

    // Corners: swap forbidden — alt-click has no effect.
    cornerHandle.dispatchEvent(new MouseEvent('pointerdown', { altKey: true, button: 0, bubbles: true }))
    expect(cornerHandle.style.borderWidth).toBe('1px')

    // Sides: fixed scale mode — thicker border from the preset itself.
    expect(sideHandle.style.borderWidth).toBe('3px')

    handle.destroy()
  })

  it('destroy removes the cs from the overlay and unsubscribes', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('item-1', document.createElement('div'))

    const handle = createSelectionFrame({
      itemId: 'item-1',
      authorApi,
      sceneRoot: document.body,
      adapter: temp__createNoopAdapter()
    })
    expect(temp__csRoot('item-1')).not.toBeNull()

    handle.destroy()
    expect(temp__csRoot('item-1')).toBeNull()
  })
})

describe('createSelectionFrame — create mode', () => {
  it('requires itemId+adapter unless creation is provided', () => {
    const authorApi = temp__createAuthorApiStub()
    expect(() =>
      createSelectionFrame({
        authorApi,
        sceneRoot: document.body
      } as never)
    ).toThrow()
  })

  it('arms a hidden creation surface and keeps the cs hidden until a geometry exists', () => {
    const authorApi = temp__createAuthorApiStub()
    const onCreate = () => {}

    const handle = createSelectionFrame({
      authorApi,
      sceneRoot: document.body,
      creation: { onCreate }
    })

    const surface = temp__creationSurface()
    expect(surface).not.toBeNull()
    expect(surface!.style.display).not.toBe('none')

    handle.destroy()
  })

  it('a libre trace on the creation surface emits one rect result and keeps the cs visible', () => {
    const authorApi = temp__createAuthorApiStub()
    const results: Array<{ kind: string }> = []

    const handle = createSelectionFrame({
      authorApi,
      sceneRoot: document.body,
      creation: { onCreate: (result) => results.push(result) }
    })
    const surface = temp__creationSurface()!

    temp__firePointer(surface, 'pointerdown', { clientX: 10, clientY: 10 })
    temp__firePointer(surface, 'pointermove', { clientX: 60, clientY: 50 })
    temp__firePointer(surface, 'pointerup', { clientX: 60, clientY: 50 })

    expect(results).toHaveLength(1)
    expect(results[0]!.kind).toBe('rect')

    // The cs stays displayed through awaitingItem — "le cadre reste affiché".
    const cs = document.querySelector<HTMLElement>('[data-selection-frame]')!
    expect(cs.style.display).not.toBe('none')

    handle.destroy()
  })

  it('never calibrates the cs while it is display:none (a hidden element always measures as an all-zero rect, corrupting the calibration loop)', () => {
    const authorApi = temp__createAuthorApiStub()
    const violations: string[] = []
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      if (this.hasAttribute('data-selection-frame') && this.style.display === 'none') {
        violations.push('measured a display:none cs')
      }
      return originalGetBoundingClientRect.call(this)
    }

    try {
      const handle = createSelectionFrame({
        authorApi,
        sceneRoot: document.body,
        creation: { onCreate: () => {} }
      })
      const surface = temp__creationSurface()!

      temp__firePointer(surface, 'pointerdown', { clientX: 10, clientY: 10 })
      temp__firePointer(surface, 'pointermove', { clientX: 60, clientY: 50 })
      temp__firePointer(surface, 'pointerup', { clientX: 60, clientY: 50 })

      expect(violations).toEqual([])
      handle.destroy()
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
    }
  })

  it('creation.context "libre" forces a rect trace even inside a configured grid container', () => {
    const authorApi = temp__createAuthorApiStub()
    const containerNode = document.createElement('div')
    authorApi.emitNode('grid-container', containerNode)
    const results: Array<{ kind: string }> = []

    const handle = createSelectionFrame({
      authorApi,
      sceneRoot: document.body,
      containerId: 'grid-container',
      creation: { onCreate: (result) => results.push(result), context: 'libre' }
    })
    handle.setContainerGrid(temp__createGridArtifact(4, 4))
    const surface = temp__creationSurface()!

    temp__firePointer(surface, 'pointerdown', { clientX: 10, clientY: 10 })
    temp__firePointer(surface, 'pointermove', { clientX: 60, clientY: 50 })
    temp__firePointer(surface, 'pointerup', { clientX: 60, clientY: 50 })

    expect(results).toHaveLength(1)
    expect(results[0]!.kind).toBe('rect')

    handle.destroy()
  })

  it('without an explicit context, a configured grid container traces a cell-area', () => {
    const authorApi = temp__createAuthorApiStub()
    const containerNode = document.createElement('div')
    authorApi.emitNode('grid-container', containerNode)
    const results: Array<{ kind: string }> = []

    const handle = createSelectionFrame({
      authorApi,
      sceneRoot: document.body,
      containerId: 'grid-container',
      creation: { onCreate: (result) => results.push(result) }
    })
    handle.setContainerGrid(temp__createGridArtifact(4, 4))
    const surface = temp__creationSurface()!

    temp__firePointer(surface, 'pointerdown', { clientX: 10, clientY: 10 })
    temp__firePointer(surface, 'pointermove', { clientX: 60, clientY: 50 })
    temp__firePointer(surface, 'pointerup', { clientX: 60, clientY: 50 })

    expect(results).toHaveLength(1)
    expect(results[0]!.kind).toBe('cell-area')

    handle.destroy()
  })

  it('a trace under minTraceSizePx is discarded — no emission, no lingering cs', () => {
    const authorApi = temp__createAuthorApiStub()
    const onCreate = () => {
      throw new Error('should not be called for a too-small trace')
    }

    const handle = createSelectionFrame({
      authorApi,
      sceneRoot: document.body,
      creation: { onCreate, minTraceSizePx: 20 }
    })
    const surface = temp__creationSurface()!

    temp__firePointer(surface, 'pointerdown', { clientX: 10, clientY: 10 })
    temp__firePointer(surface, 'pointermove', { clientX: 12, clientY: 11 })
    temp__firePointer(surface, 'pointerup', { clientX: 12, clientY: 11 })

    handle.destroy()
  })

  it('applyCreationGeometry emits immediately without a trace gesture', () => {
    const authorApi = temp__createAuthorApiStub()
    const results: Array<{ kind: string }> = []

    const handle = createSelectionFrame({
      authorApi,
      sceneRoot: document.body,
      creation: { onCreate: (result) => results.push(result) }
    })

    handle.applyCreationGeometry({ rect: { fx: 0, fy: 0, fw: 1, fh: 1 } })

    expect(results).toHaveLength(1)
    expect(results[0]!.kind).toBe('rect')

    handle.destroy()
  })

  it('attachItem hands off the SAME cs node to regular selection via subscribeToNode', () => {
    const authorApi = temp__createAuthorApiStub()
    const handle = createSelectionFrame({
      authorApi,
      sceneRoot: document.body,
      creation: { onCreate: () => {} }
    })

    handle.applyCreationGeometry({ rect: { fx: 0, fy: 0, fw: 1, fh: 1 } })
    const csBefore = document.querySelector<HTMLElement>('[data-selection-frame]')!

    handle.attachItem({ itemId: 'new-item', adapter: temp__createNoopAdapter() })
    expect(temp__creationSurface()).toBeNull()

    const node = document.createElement('div')
    authorApi.emitNode('new-item', node)

    const csAfter = temp__csRoot('new-item')!
    expect(csAfter).toBe(csBefore)
    expect(csAfter.style.display).not.toBe('none')

    handle.destroy()
  })

  it('applyCreationGeometry and attachItem are inert outside create mode', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('item-1', document.createElement('div'))

    const handle = createSelectionFrame({
      itemId: 'item-1',
      authorApi,
      sceneRoot: document.body,
      adapter: temp__createNoopAdapter()
    })

    expect(() => {
      handle.applyCreationGeometry({ rect: { fx: 0, fy: 0, fw: 1, fh: 1 } })
      handle.attachItem({ itemId: 'other', adapter: temp__createNoopAdapter() })
    }).not.toThrow()

    handle.destroy()
  })
})

describe('createSelectionFrame — Alt+click cycle (item stacked underneath)', () => {
  it('Alt+click resolves the stacked candidates (topmost first) and hands them to onAltClickCycle, additive:false', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('item-1', document.createElement('div'))
    const calls: Array<{ candidateItemIds: string[]; additive: boolean }> = []

    const handle = createSelectionFrame({
      itemId: 'item-1',
      authorApi,
      sceneRoot: document.body,
      adapter: temp__createNoopAdapter(),
      onAltClickCycle: (candidateItemIds, additive) => calls.push({ candidateItemIds, additive })
    })

    const underneath = document.createElement('div')
    underneath.id = 'item-2'
    document.body.appendChild(underneath)
    const topmost = document.createElement('div')
    topmost.id = 'item-1'
    document.body.appendChild(topmost)
    temp__setElementsFromPointStack([topmost, underneath])

    const cs = temp__csRoot('item-1')!
    temp__firePointer(cs, 'pointerdown', { clientX: 10, clientY: 10, altKey: true })
    temp__firePointer(cs, 'pointerup', { clientX: 10, clientY: 10, altKey: true })

    expect(calls).toEqual([{ candidateItemIds: ['item-1', 'item-2'], additive: false }])

    handle.destroy()
    underneath.remove()
    topmost.remove()
  })

  it('Alt+Shift+click reports additive:true', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('item-1', document.createElement('div'))
    const calls: Array<{ candidateItemIds: string[]; additive: boolean }> = []

    const handle = createSelectionFrame({
      itemId: 'item-1',
      authorApi,
      sceneRoot: document.body,
      adapter: temp__createNoopAdapter(),
      onAltClickCycle: (candidateItemIds, additive) => calls.push({ candidateItemIds, additive })
    })

    const topmost = document.createElement('div')
    topmost.id = 'item-1'
    document.body.appendChild(topmost)
    temp__setElementsFromPointStack([topmost])

    const cs = temp__csRoot('item-1')!
    temp__firePointer(cs, 'pointerdown', { clientX: 10, clientY: 10, altKey: true, shiftKey: true })
    temp__firePointer(cs, 'pointerup', { clientX: 10, clientY: 10, altKey: true, shiftKey: true })

    expect(calls).toEqual([{ candidateItemIds: ['item-1'], additive: true }])

    handle.destroy()
    topmost.remove()
  })

  it('excludes the cs\'s own overlay nodes (the shared overlay layer) from the candidate list', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('item-1', document.createElement('div'))
    const calls: Array<{ candidateItemIds: string[]; additive: boolean }> = []

    const handle = createSelectionFrame({
      itemId: 'item-1',
      authorApi,
      sceneRoot: document.body,
      adapter: temp__createNoopAdapter(),
      onAltClickCycle: (candidateItemIds, additive) => calls.push({ candidateItemIds, additive })
    })

    const cs = temp__csRoot('item-1')!
    // The cs itself (an overlay node, no meaningful `id` here) is first in the stack — it must
    // never appear as a candidate, even though it happens to sit at the very click point.
    temp__setElementsFromPointStack([cs])

    temp__firePointer(cs, 'pointerdown', { clientX: 10, clientY: 10, altKey: true })
    temp__firePointer(cs, 'pointerup', { clientX: 10, clientY: 10, altKey: true })

    expect(calls).toEqual([{ candidateItemIds: [], additive: false }])

    handle.destroy()
  })

  it('Alt+click never starts a body drag — the element stays at its own placement', () => {
    const authorApi = temp__createAuthorApiStub()
    const element = document.createElement('div')
    authorApi.emitNode('item-1', element)
    const moves: unknown[] = []
    const adapter = { ...temp__createNoopAdapter(), applyMove: (diff: unknown) => moves.push(diff) }

    const handle = createSelectionFrame({
      itemId: 'item-1',
      authorApi,
      sceneRoot: document.body,
      adapter,
      onAltClickCycle: () => {}
    })

    const cs = temp__csRoot('item-1')!
    temp__setElementsFromPointStack([])
    temp__firePointer(cs, 'pointerdown', { clientX: 10, clientY: 10, altKey: true })
    temp__firePointer(cs, 'pointermove', { clientX: 60, clientY: 60, altKey: true })
    temp__firePointer(cs, 'pointerup', { clientX: 60, clientY: 60, altKey: true })

    expect(moves).toHaveLength(0)

    handle.destroy()
  })
})

describe('createMultiSelectionFrame', () => {
  it('shows one shared cs once at least one node is present', () => {
    const authorApi = temp__createAuthorApiStub()
    const handle = createMultiSelectionFrame({
      items: [
        { itemId: 'a', adapter: temp__createNoopAdapter() },
        { itemId: 'b', adapter: temp__createNoopAdapter() }
      ],
      authorApi,
      sceneRoot: document.body
    })

    const cs = document.querySelector<HTMLElement>('[data-selection-frame-multi]')!
    expect(cs.style.display).toBe('none')

    authorApi.emitNode('a', document.createElement('div'))
    expect(cs.style.display).not.toBe('none')

    handle.destroy()
  })

  it('recomputes on partial suspension and hides when all nodes vanish', () => {
    const authorApi = temp__createAuthorApiStub()
    const nodeA = document.createElement('div')
    const nodeB = document.createElement('div')
    authorApi.emitNode('a', nodeA)
    authorApi.emitNode('b', nodeB)

    const handle = createMultiSelectionFrame({
      items: [
        { itemId: 'a', adapter: temp__createNoopAdapter() },
        { itemId: 'b', adapter: temp__createNoopAdapter() }
      ],
      authorApi,
      sceneRoot: document.body
    })
    const cs = document.querySelector<HTMLElement>('[data-selection-frame-multi]')!
    expect(cs.style.display).not.toBe('none')

    authorApi.emitNode('a', null)
    expect(cs.style.display).not.toBe('none')

    authorApi.emitNode('b', null)
    expect(cs.style.display).toBe('none')

    handle.destroy()
  })

  it('keeps applyPreset and setAdapter inert', () => {
    const authorApi = temp__createAuthorApiStub()
    const handle = createMultiSelectionFrame({
      items: [{ itemId: 'a', adapter: temp__createNoopAdapter() }],
      authorApi,
      sceneRoot: document.body
    })

    expect(() => {
      handle.applyPreset({ name: 'x', capabilities: ['positioning'] })
      handle.setAdapter(temp__createNoopAdapter())
      handle.setContainerGrid(null)
    }).not.toThrow()

    handle.destroy()
  })

  it('a drag on the shared cs broadcasts the same move diff to every present item\'s own adapter (migrated to bindGestureSession, 2026-07-10)', () => {
    const authorApi = temp__createAuthorApiStub()
    const movesA: Array<{ dx: number; dy: number }> = []
    const movesB: Array<{ dx: number; dy: number }> = []
    const adapterA: CsValueAdapter = { ...temp__createNoopAdapter(), applyMove: (diff) => movesA.push(diff) }
    const adapterB: CsValueAdapter = { ...temp__createNoopAdapter(), applyMove: (diff) => movesB.push(diff) }

    authorApi.emitNode('a', document.createElement('div'))
    authorApi.emitNode('b', document.createElement('div'))

    const handle = createMultiSelectionFrame({
      items: [
        { itemId: 'a', adapter: adapterA },
        { itemId: 'b', adapter: adapterB }
      ],
      authorApi,
      sceneRoot: document.body
    })

    const cs = document.querySelector<HTMLElement>('[data-selection-frame-multi]')!
    temp__firePointer(cs, 'pointerdown', { clientX: 10, clientY: 10 })
    temp__firePointer(cs, 'pointermove', { clientX: 60, clientY: 40 })
    temp__firePointer(cs, 'pointerup', { clientX: 60, clientY: 40 })

    // Both items receive a move — same broadcast diff, per-item adapter.
    expect(movesA.length).toBeGreaterThan(0)
    expect(movesB.length).toBeGreaterThan(0)
    expect(movesA).toEqual(movesB)

    handle.destroy()
  })

  it('a drag ending via lostpointercapture still applies the move (not silently swallowed as an abort)', () => {
    const authorApi = temp__createAuthorApiStub()
    const moves: Array<{ dx: number; dy: number }> = []
    const adapter: CsValueAdapter = { ...temp__createNoopAdapter(), applyMove: (diff) => moves.push(diff) }
    authorApi.emitNode('a', document.createElement('div'))

    const handle = createMultiSelectionFrame({
      items: [{ itemId: 'a', adapter }],
      authorApi,
      sceneRoot: document.body
    })

    const cs = document.querySelector<HTMLElement>('[data-selection-frame-multi]')!
    temp__firePointer(cs, 'pointerdown', { clientX: 10, clientY: 10 })
    temp__firePointer(cs, 'pointermove', { clientX: 60, clientY: 40 })
    cs.dispatchEvent(new Event('lostpointercapture'))

    expect(moves.length).toBeGreaterThan(0)

    handle.destroy()
  })
})

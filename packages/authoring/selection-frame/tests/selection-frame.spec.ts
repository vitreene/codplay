// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import type { AuthorApi } from '../src/author-api'
import { createSelectionFrame } from '../src/selection-frame'
import { createMultiSelectionFrame } from '../src/multi-selection-frame'
import type { CsValueAdapter } from '../src/types'

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
})

// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { createListDndModule } from '../../src/runtime/modules/list-dnd'
import type { ListDndRegistries } from '../../src/runtime/modules/list-dnd'
import type { RuntimeListComponent } from '../../src/runtime/components/types'

const originalGetBoundingClientRect = globalThis.HTMLElement?.prototype.getBoundingClientRect

/** Builds one DOMRect-like object for deterministic jsdom geometry. */
function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    x: left,
    y: top,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({ left, top, width, height })
  } as DOMRect
}

/** Installs deterministic geometry keyed by element id. */
function installGeometryStub(rectsById: Record<string, DOMRect>): void {
  globalThis.HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
    return rectsById[(this as HTMLElement).id] ?? rect(0, 0, 0, 0)
  }
}

/** Builds one fake list component exposing only the children order the module reads. */
function fakeList(childIds: string[]): RuntimeListComponent {
  return { getChildrenSnapshot: () => childIds } as unknown as RuntimeListComponent
}

/** Creates real DOM elements for each id, appended to `document.body`, and a node lookup map. */
function mountNodes(ids: string[]): Map<string, HTMLElement> {
  const nodeById = new Map<string, HTMLElement>()
  for (const id of ids) {
    const node = document.createElement('div')
    node.id = id
    document.body.append(node)
    nodeById.set(id, node)
  }
  return nodeById
}

/**
 * Builds one minimal `ListDndRegistries` (the same shape as `RuntimeModuleHost
 * ['registries']`, never the public-facing `RuntimeRegistrySnapshot` facade)
 * for `resolveDropTarget`-only tests — `container.set`/`delete` and
 * `mounted.set` are never read by `resolveDropTarget`, so they are no-ops.
 */
function makeRegistries(input: {
  nodeById: Map<string, HTMLElement>
  listsById: Record<string, RuntimeListComponent>
  isMounted?: (id: string) => boolean
}): ListDndRegistries {
  return {
    node: { get: (id) => input.nodeById.get(id) ?? null },
    component: { get: () => null },
    container: {
      get: (id) => input.listsById[id] ?? null,
      set: () => {},
      delete: () => {},
      getParentId: () => null,
      setParentId: () => {}
    },
    mounted: {
      get: (id) => input.isMounted?.(id) ?? true,
      set: () => {}
    }
  }
}

describe('Lot 20 - list-dnd module: resolveDropTarget', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    if (originalGetBoundingClientRect !== undefined) {
      globalThis.HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
    }
  })

  it('resolves the list and a start index when the point lands above every child', () => {
    installGeometryStub({
      'list-a': rect(0, 0, 100, 300),
      'item-1': rect(10, 10, 80, 40),
      'item-2': rect(10, 60, 80, 40)
    })
    const nodeById = mountNodes(['list-a', 'item-1', 'item-2'])
    const module = createListDndModule(makeRegistries({
      nodeById,
      listsById: { 'list-a': fakeList(['item-1', 'item-2']) }
    }))

    const result = module.resolveDropTarget({
      clientX: 50,
      clientY: 15,
      draggedPersoId: 'item-3',
      candidateListIds: ['list-a']
    })

    expect(result).toEqual({ listId: 'list-a', index: 0 })
  })

  it('resolves an index between two children based on vertical midpoint', () => {
    installGeometryStub({
      'list-a': rect(0, 0, 100, 300),
      'item-1': rect(10, 10, 80, 40), // midpoint y=30
      'item-2': rect(10, 60, 80, 40) // midpoint y=80
    })
    const nodeById = mountNodes(['list-a', 'item-1', 'item-2'])
    const module = createListDndModule(makeRegistries({
      nodeById,
      listsById: { 'list-a': fakeList(['item-1', 'item-2']) }
    }))

    const result = module.resolveDropTarget({
      clientX: 50,
      clientY: 55, // between item-1's midpoint (30) and item-2's midpoint (80)
      draggedPersoId: 'item-3',
      candidateListIds: ['list-a']
    })

    expect(result).toEqual({ listId: 'list-a', index: 1 })
  })

  it('resolves the end index when the point lands below every child', () => {
    installGeometryStub({
      'list-a': rect(0, 0, 100, 300),
      'item-1': rect(10, 10, 80, 40),
      'item-2': rect(10, 60, 80, 40)
    })
    const nodeById = mountNodes(['list-a', 'item-1', 'item-2'])
    const module = createListDndModule(makeRegistries({
      nodeById,
      listsById: { 'list-a': fakeList(['item-1', 'item-2']) }
    }))

    const result = module.resolveDropTarget({
      clientX: 50,
      clientY: 200,
      draggedPersoId: 'item-3',
      candidateListIds: ['list-a']
    })

    expect(result).toEqual({ listId: 'list-a', index: 2 })
  })

  it('excludes the dragged item from the candidate children it is hit-tested against', () => {
    installGeometryStub({
      'list-a': rect(0, 0, 100, 300),
      'item-1': rect(10, 10, 80, 40), // midpoint y=30
      'item-2': rect(10, 60, 80, 40) // midpoint y=80 — this is the dragged item
    })
    const nodeById = mountNodes(['list-a', 'item-1', 'item-2'])
    const module = createListDndModule(makeRegistries({
      nodeById,
      listsById: { 'list-a': fakeList(['item-1', 'item-2']) }
    }))

    // Without excluding item-2, clientY=55 would land at index 1 (between
    // item-1 and item-2's midpoints). Excluding item-2 (the dragged item),
    // only item-1 remains as a candidate — its midpoint is 30, so 55 lands past it.
    const result = module.resolveDropTarget({
      clientX: 50,
      clientY: 55,
      draggedPersoId: 'item-2',
      candidateListIds: ['list-a']
    })

    expect(result).toEqual({ listId: 'list-a', index: 1 })
  })

  it('returns null when the point lands outside every candidate list', () => {
    installGeometryStub({ 'list-a': rect(0, 0, 100, 300) })
    const nodeById = mountNodes(['list-a'])
    const module = createListDndModule(makeRegistries({
      nodeById,
      listsById: { 'list-a': fakeList([]) }
    }))

    const result = module.resolveDropTarget({
      clientX: 500,
      clientY: 500,
      draggedPersoId: 'item-1',
      candidateListIds: ['list-a']
    })

    expect(result).toBeNull()
  })

  it('picks the first matching list among several candidates', () => {
    installGeometryStub({
      'list-a': rect(0, 0, 100, 100),
      'list-b': rect(200, 0, 100, 100)
    })
    const nodeById = mountNodes(['list-a', 'list-b'])
    const module = createListDndModule(makeRegistries({
      nodeById,
      listsById: { 'list-a': fakeList([]), 'list-b': fakeList([]) }
    }))

    const result = module.resolveDropTarget({
      clientX: 250,
      clientY: 50,
      draggedPersoId: 'item-1',
      candidateListIds: ['list-a', 'list-b']
    })

    expect(result).toEqual({ listId: 'list-b', index: 0 })
  })

  it('skips a candidate list that is not mounted', () => {
    installGeometryStub({ 'list-a': rect(0, 0, 100, 100) })
    const nodeById = mountNodes(['list-a'])
    const module = createListDndModule(makeRegistries({
      nodeById,
      listsById: { 'list-a': fakeList([]) },
      isMounted: (id) => id !== 'list-a'
    }))

    const result = module.resolveDropTarget({
      clientX: 50,
      clientY: 50,
      draggedPersoId: 'item-1',
      candidateListIds: ['list-a']
    })

    expect(result).toBeNull()
  })

  it('resolves the correct index under a 180deg rotated list (screen-space order is reversed)', () => {
    // A 180deg rotation matrix: matrix(-1, 0, 0, -1, 0, 0) — top/bottom
    // and left/right are both inverted on screen relative to local space.
    // If the module compared raw screen coordinates instead of transposing
    // into the list's local space, it would resolve the wrong index here.
    const originalGetComputedStyle = globalThis.getComputedStyle
    globalThis.getComputedStyle = ((node: Element) =>
      node.id === 'list-a'
        ? ({ transform: 'matrix(-1, 0, 0, -1, 0, 0)' } as CSSStyleDeclaration)
        : originalGetComputedStyle(node)) as typeof globalThis.getComputedStyle

    try {
      installGeometryStub({
        'list-a': rect(0, 0, 100, 300),
        // In screen space, item-1 appears BELOW item-2 (top: 160 > top: 60) —
        // but under the list's 180deg rotation, item-1 is locally first.
        'item-1': rect(10, 160, 80, 40),
        'item-2': rect(10, 60, 80, 40)
      })
      const nodeById = mountNodes(['list-a', 'item-1', 'item-2'])
      const module = createListDndModule(makeRegistries({
        nodeById,
        listsById: { 'list-a': fakeList(['item-1', 'item-2']) }
      }))

      // A screen-space point just below item-1 (local: just before item-1,
      // i.e. local index 0) — naive screen-space comparison would place
      // this past both children (index 2); the rotation-aware local
      // comparison must resolve index 0.
      const result = module.resolveDropTarget({
        clientX: 50,
        clientY: 195,
        draggedPersoId: 'item-3',
        candidateListIds: ['list-a']
      })

      expect(result).toEqual({ listId: 'list-a', index: 0 })
    } finally {
      globalThis.getComputedStyle = originalGetComputedStyle
    }
  })
})

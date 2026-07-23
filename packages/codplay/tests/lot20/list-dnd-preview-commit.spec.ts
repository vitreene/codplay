// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { RuntimeComponentOrchestrator } from '../../src/runtime/components'
import type { AnimationResolvedAction } from '../../src/animation/types'
import type { RuntimeEmitEvent, RuntimePersos } from '../../src/runtime/types'
import { DEFAULT_GHOST_CLASS_NAME, resolveListDndCommitTarget } from '../../src/runtime/modules/list-dnd'

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

/**
 * Installs deterministic geometry for a two-list scene: `list-a` stacks its
 * children vertically (40px rows starting at y=0), `list-b` starts empty.
 * Rects are read from the node's id and current DOM position, so a
 * `previewAt`/`commit` reposition is reflected on the next read.
 */
function installGeometryStub(): void {
  globalThis.HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
    const node = this as HTMLElement
    if (node.id === 'list-a') {
      return rect(0, 0, 100, 300)
    }
    if (node.id === 'list-b') {
      return rect(200, 0, 100, 300)
    }

    const parent = node.parentElement
    const indexAmongSiblings = parent ? Array.from(parent.children).indexOf(node) : 0
    return rect(10, indexAmongSiblings * 40, 80, 32)
  }
}

/** Minimal two-list fixture: two items start in `list-a`, `list-b` starts empty. */
function createTwoListFixture(): RuntimePersos {
  return {
    id: 'story-list-dnd',
    persos: {
      'list-a': { id: 'list-a', type: 'list', initial: { id: 'list-a' }, actions: {} },
      'list-b': { id: 'list-b', type: 'list', initial: { id: 'list-b' }, actions: {} },
      'item-1': {
        id: 'item-1',
        type: 'tag',
        initial: { id: 'item-1', content: 'Item 1', move: { parentId: 'list-a' } },
        actions: { 'item:dropped': {} }
      },
      'item-2': {
        id: 'item-2',
        type: 'tag',
        initial: { id: 'item-2', content: 'Item 2', move: { parentId: 'list-a' } },
        actions: { 'item:dropped': {} }
      }
    }
  }
}

/** Builds one orchestrator wired with real DOM nodes (ids matching persoId) and an emit spy. */
function createOrchestrator(): { orchestrator: RuntimeComponentOrchestrator; emittedEvents: RuntimeEmitEvent[] } {
  const emittedEvents: RuntimeEmitEvent[] = []
  const orchestrator = new RuntimeComponentOrchestrator({
    warn: () => {},
    createElementOptions: {
      nodeFactory: (item) => {
        const node = document.createElement(item.type === 'list' ? 'section' : 'div')
        node.id = item.id
        document.body.append(node)
        return node
      },
      emitRuntimeEvent: (event) => { emittedEvents.push(event) },
      getCurrentTimelineMs: () => 0
    }
  })
  orchestrator.loadPersos(createTwoListFixture())
  return { orchestrator, emittedEvents }
}

/** Dispatches one `list-dnd:preview` module event, same payload shape `applyCaptureTickActions` sends. */
function dispatchPreview(orchestrator: RuntimeComponentOrchestrator, input: {
  clientX: number
  clientY: number
  draggedPersoId: string
  candidateListIds: string[]
}): void {
  orchestrator.dispatchModuleEvent('list-dnd:preview', {
    name: 'list-dnd:preview',
    payload: input,
    insertMode: 'persist-only',
    ms: 0
  })
}

/**
 * Routes one `item:dropped`-style resolved action through the real hooks
 * pipeline — a plain `move` action, exactly what `capture-runtime.ts`'s
 * `onEnd` now produces (`resolveListDndCommitTarget` reads the same
 * `lastTargetByPersoId`/`originByPersoId` cache the live preview already
 * populated, never a fresh hit-test from `clientX`/`clientY`).
 */
function routeCommit(orchestrator: RuntimeComponentOrchestrator, input: {
  eventSeq: number
  draggedPersoId: string
}): ReturnType<RuntimeComponentOrchestrator['routeUpdates']> {
  const target = resolveListDndCommitTarget(input.draggedPersoId)
  if (target === null) {
    throw new Error(`no list-dnd commit target tracked for ${input.draggedPersoId}`)
  }
  const resolvedAction: AnimationResolvedAction = {
    eventId: `evt-${input.eventSeq}`,
    eventName: 'item:dropped',
    listenerId: input.draggedPersoId,
    actionKey: 'item:dropped',
    action: { move: { parentId: target.parentId, mode: target.mode, flipMode: 'overlay-world' } }
  }
  return orchestrator.routeUpdates([{ resolvedAction, eventSeq: input.eventSeq }])
}

afterEach(() => {
  if (originalGetBoundingClientRect !== undefined) {
    globalThis.HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
  }
  document.body.innerHTML = ''
})

describe('Lot 20 - list-dnd module: preview/commit through the real RuntimeModule pipeline', () => {
  it('preview detaches the dragged item from its source list on first call (idempotent)', () => {
    installGeometryStub()
    const { orchestrator } = createOrchestrator()
    const registry = orchestrator.getRuntimeRegistrySnapshot()

    expect(registry.getParentListId('item-1')).toBe('list-a')

    dispatchPreview(orchestrator, { clientX: 250, clientY: 10, draggedPersoId: 'item-1', candidateListIds: ['list-a', 'list-b'] })
    expect(registry.getParentListId('item-1')).toBeNull()

    expect(() =>
      dispatchPreview(orchestrator, { clientX: 250, clientY: 10, draggedPersoId: 'item-1', candidateListIds: ['list-a', 'list-b'] })
    ).not.toThrow()
    expect(registry.getParentListId('item-1')).toBeNull()
  })

  it('preview repositions neighbors to open a slot, and shows a ghost with the default class', () => {
    installGeometryStub()
    const { orchestrator } = createOrchestrator()
    const registry = orchestrator.getRuntimeRegistrySnapshot()

    const listA = registry.getListById('list-a')
    expect(listA?.getChildrenSnapshot()).toEqual(['item-1', 'item-2'])

    dispatchPreview(orchestrator, {
      clientX: 50,
      clientY: 60, // past item-2's midpoint once item-1 is excluded
      draggedPersoId: 'item-1',
      candidateListIds: ['list-a', 'list-b']
    })

    expect(listA?.getChildrenSnapshot()).toEqual(['item-2'])

    const ghost = document.body.querySelector(`.${DEFAULT_GHOST_CLASS_NAME}`)
    expect(ghost).not.toBeNull()
  })

  it('commit reattaches the dragged item into the resolved list at the resolved index via a plain move action, and animates it', () => {
    installGeometryStub()
    const { orchestrator } = createOrchestrator()
    const registry = orchestrator.getRuntimeRegistrySnapshot()

    dispatchPreview(orchestrator, { clientX: 250, clientY: 10, draggedPersoId: 'item-1', candidateListIds: ['list-a', 'list-b'] })
    const result = routeCommit(orchestrator, { eventSeq: 1, draggedPersoId: 'item-1' })

    expect(registry.getParentListId('item-1')).toBe('list-b')
    expect(registry.getListById('list-b')?.getChildrenSnapshot()).toEqual(['item-1'])
    expect(registry.getListById('list-a')?.getChildrenSnapshot()).toEqual(['item-2'])

    // moveModule/list-flip did the actual attach + FLIP — no list-dnd-specific event exists anymore.
    expect(result.directTransitions.length).toBeGreaterThan(0)

    // The ghost is removed, and the floating escape style cleared, by this module's own `beforeUpdate` cleanup.
    expect(document.body.querySelector(`.${DEFAULT_GHOST_CLASS_NAME}`)).toBeNull()
    const itemNode = document.getElementById('item-1')
    expect(itemNode?.style.position).toBe('')
  })

  it('commit snaps the item back to its origin when the drop point lands outside every candidate list', () => {
    installGeometryStub()
    const { orchestrator } = createOrchestrator()
    const registry = orchestrator.getRuntimeRegistrySnapshot()

    dispatchPreview(orchestrator, { clientX: 500, clientY: 500, draggedPersoId: 'item-1', candidateListIds: ['list-a', 'list-b'] })
    expect(registry.getParentListId('item-1')).toBeNull()

    routeCommit(orchestrator, { eventSeq: 1, draggedPersoId: 'item-1' })

    // Snapped back to list-a (its origin), not left detached.
    expect(registry.getParentListId('item-1')).toBe('list-a')
    expect(registry.getListById('list-a')?.getChildrenSnapshot()).toEqual(['item-1', 'item-2'])
  })
})

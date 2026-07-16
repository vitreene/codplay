// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'

import type { AuthorApi } from '../src/author-api'
import { createTrackedNodes } from '../src/tracked-nodes'
import { createGestureLifecycleMachine, type GestureKindConfig } from '../src/gesture-lifecycle-machine'
import { createMinimalAnchor, createTrackedSession } from '../src/tracked-session'

/** Same pattern as selection-frame.spec.ts's own stub — controllable node lifecycle per persoId. */
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
    getNodePose: () => null,
    emitNode(persoId, node) {
      current.set(persoId, node)
      for (const cb of subscribers.get(persoId) ?? []) cb(node)
    }
  }
}

const CS_GESTURE_KINDS: GestureKindConfig[] = [
  { kind: 'drag', state: 'dragging', startEvent: 'DRAG_START', endEvent: 'DRAG_END' },
  { kind: 'resize', state: 'resizing', startEvent: 'RESIZE_START', endEvent: 'RESIZE_END' },
  { kind: 'rotate', state: 'rotating', startEvent: 'ROTATE_START', endEvent: 'ROTATE_END' }
]

const ZONE_GESTURE_KINDS: GestureKindConfig[] = [
  { kind: 'move', state: 'moving', startEvent: 'MOVE_START', endEvent: 'MOVE_END' },
  { kind: 'resize', state: 'resizing', startEvent: 'RESIZE_START', endEvent: 'RESIZE_END' },
  { kind: 'trace', state: 'tracing', startEvent: 'TRACE_START', endEvent: 'TRACE_END' }
]

describe('createTrackedNodes', () => {
  it('starts with no node for any tracked id', () => {
    const authorApi = temp__createAuthorApiStub()
    const nodes = createTrackedNodes(authorApi, ['a'])
    expect(nodes.getNode('a')).toBeNull()
    expect(nodes.anyConnected()).toBe(false)
    expect(nodes.allConnected()).toBe(false)
  })

  it('exposes the raw node from the latest notification, connected or not', () => {
    const authorApi = temp__createAuthorApiStub()
    const nodes = createTrackedNodes(authorApi, ['a'])
    const detached = document.createElement('div')

    authorApi.emitNode('a', detached)
    expect(nodes.getNode('a')).toBe(detached)
    // Present but not attached: matches codplay's own render-before-attach timing.
    expect(nodes.anyConnected()).toBe(false)
    expect(nodes.allConnected()).toBe(false)
  })

  it('reflects connectedness live, without needing a new notification', () => {
    const authorApi = temp__createAuthorApiStub()
    const nodes = createTrackedNodes(authorApi, ['a'])
    const node = document.createElement('div')

    authorApi.emitNode('a', node)
    expect(nodes.anyConnected()).toBe(false)

    // No new subscribeToNode notification — just the DOM catching up, as
    // codplay's own mountRootNodes()/seek() do between two loadPersos passes.
    document.body.appendChild(node)
    expect(nodes.anyConnected()).toBe(true)
    expect(nodes.allConnected()).toBe(true)

    node.remove()
  })

  it('requires every tracked id connected for allConnected, any one for anyConnected', () => {
    const authorApi = temp__createAuthorApiStub()
    const nodes = createTrackedNodes(authorApi, ['a', 'b'])
    const nodeA = document.createElement('div')
    const nodeB = document.createElement('div')
    document.body.appendChild(nodeA)

    authorApi.emitNode('a', nodeA)
    authorApi.emitNode('b', nodeB)
    expect(nodes.anyConnected()).toBe(true)
    expect(nodes.allConnected()).toBe(false)

    document.body.appendChild(nodeB)
    expect(nodes.allConnected()).toBe(true)

    nodeA.remove()
    nodeB.remove()
  })

  it('fires a new subscriber immediately with the current state, matching subscribeToNode\'s own contract', () => {
    const authorApi = temp__createAuthorApiStub()
    const nodes = createTrackedNodes(authorApi, ['a'])
    const node = document.createElement('div')
    authorApi.emitNode('a', node)

    // A late subscriber onto an already-populated tracker (e.g. SelectionFrame
    // subscribing to an anchor LibreAdapter built and populated first) must
    // not miss the state that arrived before it subscribed.
    let calls = 0
    nodes.subscribe(() => {
      calls += 1
    })
    expect(calls).toBe(1)
  })

  it('notifies subscribers on every raw callback, including same-reference renotification', () => {
    const authorApi = temp__createAuthorApiStub()
    const nodes = createTrackedNodes(authorApi, ['a'])
    const node = document.createElement('div')
    let calls = 0
    nodes.subscribe(() => {
      calls += 1
    })
    expect(calls).toBe(1) // fire-on-subscribe, no node yet

    authorApi.emitNode('a', node)
    expect(calls).toBe(2)

    // Same object, renotified (a refresh pass reusing the node) — must still fire.
    authorApi.emitNode('a', node)
    expect(calls).toBe(3)
  })

  it('destroy unsubscribes from authorApi and clears listeners', () => {
    const authorApi = temp__createAuthorApiStub()
    const nodes = createTrackedNodes(authorApi, ['a'])
    let calls = 0
    nodes.subscribe(() => {
      calls += 1
    })
    expect(calls).toBe(1) // fire-on-subscribe

    nodes.destroy()
    authorApi.emitNode('a', document.createElement('div'))
    expect(calls).toBe(1)
  })
})

describe('createGestureLifecycleMachine', () => {
  it('reproduces csMachine-shaped transitions (idle/active.still/dragging/resizing/rotating/suspended)', () => {
    const machine = createGestureLifecycleMachine(CS_GESTURE_KINDS)
    const actor = createActor(machine)
    actor.start()

    expect(actor.getSnapshot().matches('idle')).toBe(true)
    actor.send({ type: 'NODE_APPEARED' })
    expect(actor.getSnapshot().matches({ active: 'still' })).toBe(true)

    actor.send({ type: 'DRAG_START' })
    expect(actor.getSnapshot().matches({ active: 'dragging' })).toBe(true)
    actor.send({ type: 'DRAG_END' })
    expect(actor.getSnapshot().matches({ active: 'still' })).toBe(true)

    actor.send({ type: 'RESIZE_START' })
    expect(actor.getSnapshot().matches({ active: 'resizing' })).toBe(true)
    actor.send({ type: 'RESIZE_END' })

    actor.send({ type: 'ROTATE_START' })
    expect(actor.getSnapshot().matches({ active: 'rotating' })).toBe(true)

    // NODE_DISAPPEARED interrupts a gesture in progress, from the parent state.
    actor.send({ type: 'NODE_DISAPPEARED' })
    expect(actor.getSnapshot().matches('suspended')).toBe(true)

    actor.send({ type: 'NODE_APPEARED' })
    expect(actor.getSnapshot().matches({ active: 'still' })).toBe(true)
  })

  it('reproduces zoneMachine-shaped transitions (moving/resizing/tracing) from the same generator', () => {
    const machine = createGestureLifecycleMachine(ZONE_GESTURE_KINDS)
    const actor = createActor(machine)
    actor.start()
    actor.send({ type: 'NODE_APPEARED' })

    actor.send({ type: 'MOVE_START' })
    expect(actor.getSnapshot().matches({ active: 'moving' })).toBe(true)
    actor.send({ type: 'MOVE_END' })

    actor.send({ type: 'TRACE_START' })
    expect(actor.getSnapshot().matches({ active: 'tracing' })).toBe(true)
  })
})

describe('createTrackedSession — canAct', () => {
  it('is false with no node, false while present but disconnected, true once connected', () => {
    const authorApi = temp__createAuthorApiStub()
    const session = createTrackedSession({ authorApi, persoIds: ['a'], gestureKinds: CS_GESTURE_KINDS })
    expect(session.canAct()).toBe(false)

    const node = document.createElement('div')
    authorApi.emitNode('a', node)
    expect(session.canAct()).toBe(false)

    document.body.appendChild(node)
    expect(session.canAct()).toBe(true)

    node.remove()
    session.destroy()
  })

  it('requires ALL tracked targets connected for a multi-target session', () => {
    const authorApi = temp__createAuthorApiStub()
    const session = createTrackedSession({ authorApi, persoIds: ['a', 'b'], gestureKinds: CS_GESTURE_KINDS })
    const nodeA = document.createElement('div')
    const nodeB = document.createElement('div')
    document.body.append(nodeA, nodeB)

    authorApi.emitNode('a', nodeA)
    expect(session.canAct()).toBe(false)

    authorApi.emitNode('b', nodeB)
    expect(session.canAct()).toBe(true)

    nodeA.remove()
    nodeB.remove()
    session.destroy()
  })

  it('goes false again once the node disappears mid-gesture, without a new subscribeToNode notification required for the isConnected part', () => {
    const authorApi = temp__createAuthorApiStub()
    const session = createTrackedSession({ authorApi, persoIds: ['a'], gestureKinds: CS_GESTURE_KINDS })
    const node = document.createElement('div')
    document.body.appendChild(node)
    authorApi.emitNode('a', node)
    expect(session.canAct()).toBe(true)

    authorApi.emitNode('a', null)
    expect(session.canAct()).toBe(false)

    session.destroy()
  })
})

describe('createTrackedSession — gestures', () => {
  it('refuses to start a gesture when no node is present', () => {
    const authorApi = temp__createAuthorApiStub()
    const session = createTrackedSession({ authorApi, persoIds: ['a'], gestureKinds: CS_GESTURE_KINDS })
    expect(session.startGesture('drag')).toBe(false)
    expect(session.isGestureActive()).toBe(false)
  })

  it('starts and ends a declared gesture once a node is present', () => {
    const authorApi = temp__createAuthorApiStub()
    const session = createTrackedSession({ authorApi, persoIds: ['a'], gestureKinds: CS_GESTURE_KINDS })
    authorApi.emitNode('a', document.createElement('div'))

    expect(session.startGesture('drag')).toBe(true)
    expect(session.isGestureActive()).toBe(true)
    session.endGesture('drag')
    expect(session.isGestureActive()).toBe(false)
  })

  it('respects an external capability guard (canStartGesture), same role as SelectionFrame presets', () => {
    const authorApi = temp__createAuthorApiStub()
    const session = createTrackedSession({
      authorApi,
      persoIds: ['a'],
      gestureKinds: CS_GESTURE_KINDS,
      canStartGesture: (kind) => kind === 'drag'
    })
    authorApi.emitNode('a', document.createElement('div'))

    expect(session.startGesture('resize')).toBe(false)
    expect(session.startGesture('drag')).toBe(true)
  })

  it('fires onSuspend when the node disappears mid-gesture — the abort signal for gesture-session.ts', () => {
    const authorApi = temp__createAuthorApiStub()
    const session = createTrackedSession({ authorApi, persoIds: ['a'], gestureKinds: CS_GESTURE_KINDS })
    const node = document.createElement('div')
    authorApi.emitNode('a', node)
    session.startGesture('drag')

    let suspendedCalls = 0
    session.onSuspend(() => {
      suspendedCalls += 1
    })

    authorApi.emitNode('a', null)
    expect(suspendedCalls).toBe(1)
    expect(session.isGestureActive()).toBe(false)
  })

  it('does not refire onSuspend for a node that stays absent', () => {
    const authorApi = temp__createAuthorApiStub()
    const session = createTrackedSession({ authorApi, persoIds: ['a'], gestureKinds: CS_GESTURE_KINDS })
    authorApi.emitNode('a', document.createElement('div'))

    let suspendedCalls = 0
    session.onSuspend(() => {
      suspendedCalls += 1
    })

    authorApi.emitNode('a', null)
    expect(suspendedCalls).toBe(1)
    // Re-notifying "still absent" must not refire — only the edge into suspended counts.
    authorApi.emitNode('a', null)
    expect(suspendedCalls).toBe(1)
  })
})

describe('createMinimalAnchor', () => {
  it('has no gesture concept — canAct mirrors connectedness only', () => {
    const authorApi = temp__createAuthorApiStub()
    const anchor = createMinimalAnchor({ authorApi, persoIds: ['a'] })
    expect(anchor.canAct()).toBe(false)

    const node = document.createElement('div')
    authorApi.emitNode('a', node)
    expect(anchor.canAct()).toBe(false)

    document.body.appendChild(node)
    expect(anchor.canAct()).toBe(true)

    node.remove()
    anchor.destroy()
  })

  it('tracks two ids at once (element + container, FlexAnchorTool\'s shape)', () => {
    const authorApi = temp__createAuthorApiStub()
    const anchor = createMinimalAnchor({ authorApi, persoIds: ['element', 'container'] })
    const element = document.createElement('div')
    const container = document.createElement('div')
    document.body.append(element, container)

    authorApi.emitNode('element', element)
    expect(anchor.canAct()).toBe(false)

    authorApi.emitNode('container', container)
    expect(anchor.canAct()).toBe(true)

    element.remove()
    container.remove()
    anchor.destroy()
  })
})

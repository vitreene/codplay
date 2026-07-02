// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { RuntimeComponentOrchestrator } from '../../src/runtime/components'
import type { RuntimeComponentWarning } from '../../src/runtime/components'
import type { RuntimePersos } from '../../src/runtime/types'

/**
 * Conformance tests for subscribeToNode (v1-author-api-spec.md):
 * immediate synchronous call, replacement notification, destroy → null,
 * subscription survival across scene rebuilds, idempotent unsubscribe.
 */

function temp__createStoryFixture(): RuntimePersos {
  return {
    id: 'story-subscribe',
    persos: {
      'perso-a': {
        id: 'perso-a',
        type: 'tag',
        initial: { id: 'perso-a', content: 'A' },
        actions: {}
      },
      'perso-b': {
        id: 'perso-b',
        type: 'tag',
        initial: { id: 'perso-b', content: 'B' },
        actions: {}
      }
    }
  }
}

function temp__createOrchestrator(): RuntimeComponentOrchestrator {
  const warnings: RuntimeComponentWarning[] = []
  return new RuntimeComponentOrchestrator({
    warn: (warning) => {
      warnings.push(warning)
    },
    createElementOptions: {
      nodeFactory: () => document.createElement('div')
    }
  })
}

describe('V1 author-api - subscribeToNode', () => {
  it('calls back synchronously with the current node when the perso is loaded', () => {
    const orchestrator = temp__createOrchestrator()
    orchestrator.loadPersos(temp__createStoryFixture())

    const calls: Array<Element | null> = []
    orchestrator.subscribeToNode('perso-a', (node) => calls.push(node))

    expect(calls).toHaveLength(1)
    expect(calls[0]).toBeInstanceOf(Element)
  })

  it('calls back synchronously with null when the perso is not loaded', () => {
    const orchestrator = temp__createOrchestrator()

    const calls: Array<Element | null> = []
    orchestrator.subscribeToNode('perso-a', (node) => calls.push(node))

    expect(calls).toEqual([null])
  })

  it('notifies the node when the perso loads after subscription', () => {
    const orchestrator = temp__createOrchestrator()

    const calls: Array<Element | null> = []
    orchestrator.subscribeToNode('perso-a', (node) => calls.push(node))
    orchestrator.loadPersos(temp__createStoryFixture())

    expect(calls).toHaveLength(2)
    expect(calls[0]).toBeNull()
    expect(calls[1]).toBeInstanceOf(Element)
  })

  it('notifies null on destroy and re-notifies the new node after a rebuild', () => {
    const orchestrator = temp__createOrchestrator()
    orchestrator.loadPersos(temp__createStoryFixture())

    const calls: Array<Element | null> = []
    orchestrator.subscribeToNode('perso-a', (node) => calls.push(node))
    const firstNode = calls[0]

    orchestrator.destroy()
    expect(calls).toHaveLength(2)
    expect(calls[1]).toBeNull()

    orchestrator.loadPersos(temp__createStoryFixture())
    expect(calls).toHaveLength(3)
    expect(calls[2]).toBeInstanceOf(Element)
    expect(calls[2]).not.toBe(firstNode)
  })

  it('stops notifying after unsubscribe and unsubscribe is idempotent', () => {
    const orchestrator = temp__createOrchestrator()
    orchestrator.loadPersos(temp__createStoryFixture())

    const calls: Array<Element | null> = []
    const unsubscribe = orchestrator.subscribeToNode('perso-a', (node) => calls.push(node))

    unsubscribe()
    unsubscribe()
    orchestrator.destroy()
    orchestrator.loadPersos(temp__createStoryFixture())

    expect(calls).toHaveLength(1)
  })

  it('supports several subscribers on the same persoId', () => {
    const orchestrator = temp__createOrchestrator()
    orchestrator.loadPersos(temp__createStoryFixture())

    const callsA: Array<Element | null> = []
    const callsB: Array<Element | null> = []
    orchestrator.subscribeToNode('perso-a', (node) => callsA.push(node))
    orchestrator.subscribeToNode('perso-a', (node) => callsB.push(node))

    orchestrator.destroy()

    expect(callsA).toHaveLength(2)
    expect(callsB).toHaveLength(2)
    expect(callsA[1]).toBeNull()
    expect(callsB[1]).toBeNull()
  })

  it('exposes subscribeToNode through the runtime registry snapshot', () => {
    const orchestrator = temp__createOrchestrator()
    orchestrator.loadPersos(temp__createStoryFixture())

    const registry = orchestrator.getRuntimeRegistrySnapshot()
    const calls: Array<Element | null> = []
    registry.subscribeToNode('perso-b', (node) => calls.push(node))

    expect(calls).toHaveLength(1)
    expect(calls[0]).toBeInstanceOf(Element)
  })
})

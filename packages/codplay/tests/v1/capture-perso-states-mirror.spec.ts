// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { createRealAnimeImplementation } from '../../src/animation/create-default-adapter'
import { capturePersoStatesMirror } from '../../src/animation/perso-state-mirror'
import { setContainerQueryRootNode } from '../../src/runtime/components/lib/container-query-units'
import type { TransitionRequest } from '../../src/animation/types'

/**
 * `2026-07-25-perso-state-at-t-plan.md` §4.2/§5 — `capturePersoStatesMirror` must reconstruct,
 * for every perso concerned by an active transition, its state in the perso's OWN unit (raw
 * `cqw`/number, never px) — never by reading the real node, never by reading anime.js's cache for
 * the real node. Uses `createRealAnimeImplementation` — the SAME bridge the real, DOM-facing
 * adapter uses — never a re-implementation, so fidelity to the real interpolation is by
 * construction, not by coincidence.
 */

function temp__createSceneRootWithChild(rect: { width: number; height: number }): HTMLElement {
  const container = document.createElement('div')
  Object.defineProperty(container, 'getBoundingClientRect', { value: () => rect })
  document.body.appendChild(container)
  setContainerQueryRootNode(container)
  return container
}

function temp__makeTransitionRequest(partial: Partial<TransitionRequest>): TransitionRequest {
  return {
    transitionId: 'transition-1',
    eventId: 'evt-1',
    eventName: 'intro',
    listenerId: 'item-1',
    property: 'width',
    target: null,
    to: 0,
    duration: 1000,
    easing: 'linear',
    ...partial
  }
}

describe('V1 - capturePersoStatesMirror reconstructs perso state at t, in the perso native unit', () => {
  it('returns the raw cqw value at the midpoint, for a single perso/property', () => {
    const eventMsByEventId = new Map([['evt-1', 0]])
    const transitions = [
      temp__makeTransitionRequest({ listenerId: 'item-1', property: 'width', from: '0cqw', to: '100cqw', duration: 1000 })
    ]

    const states = capturePersoStatesMirror(transitions, eventMsByEventId, 500, createRealAnimeImplementation())

    expect(states.size).toBe(1)
    const state = states.get('item-1')
    expect(state).toBeDefined()
    expect(String(state!.width).endsWith('cqw')).toBe(true)
    const widthCqw = Number.parseFloat(String(state!.width))
    expect(widthCqw).toBeGreaterThan(40)
    expect(widthCqw).toBeLessThan(60)
  })

  it('handles multiple persos and multiple properties independently', () => {
    const eventMsByEventId = new Map([['evt-1', 0], ['evt-2', 0]])
    const transitions = [
      temp__makeTransitionRequest({ transitionId: 't1', eventId: 'evt-1', listenerId: 'item-1', property: 'width', from: '0cqw', to: '100cqw', duration: 1000 }),
      temp__makeTransitionRequest({ transitionId: 't2', eventId: 'evt-1', listenerId: 'item-1', property: 'x', from: 0, to: 100, duration: 1000 }),
      temp__makeTransitionRequest({ transitionId: 't3', eventId: 'evt-2', listenerId: 'item-2', property: 'height', from: '0cqw', to: '50cqw', duration: 1000 })
    ]

    const states = capturePersoStatesMirror(transitions, eventMsByEventId, 500, createRealAnimeImplementation())

    expect(states.size).toBe(2)
    const item1 = states.get('item-1')!
    expect(Number.parseFloat(String(item1.width))).toBeCloseTo(50, 0)
    expect(Number(item1.x)).toBeCloseTo(50, 0)

    const item2 = states.get('item-2')!
    expect(Number.parseFloat(String(item2.height))).toBeCloseTo(25, 0)
  })

  it('never converts cqw to px — the mirror target is never an Element, unlike the real node', () => {
    // A container-query root exists in the scene, but the mirror path never consults it: its
    // target is a plain object, never the real node — `resolveTransitionValue` stays a no-op.
    temp__createSceneRootWithChild({ width: 1000, height: 500 })
    const eventMsByEventId = new Map([['evt-1', 0]])
    const transitions = [
      temp__makeTransitionRequest({ listenerId: 'item-1', property: 'width', from: '0cqw', to: '100cqw', duration: 1000 })
    ]

    const states = capturePersoStatesMirror(transitions, eventMsByEventId, 1000, createRealAnimeImplementation())

    expect(String(states.get('item-1')!.width)).toBe('100cqw')
    setContainerQueryRootNode(null)
  })

  it('returns an empty map when there is no active transition', () => {
    const states = capturePersoStatesMirror([], new Map(), 500, createRealAnimeImplementation())
    expect(states.size).toBe(0)
  })
})

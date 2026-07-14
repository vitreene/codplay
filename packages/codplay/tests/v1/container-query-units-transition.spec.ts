// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createAnimationAdapter } from '../../src/animation/adapter'
import { setContainerQueryRootNode } from '../../src/runtime/components/lib/container-query-units'
import type { TransitionRequest } from '../../src/animation/types'

function temp__createSceneRootWithChild(rect: { width: number; height: number }): HTMLElement {
  const container = document.createElement('div')
  vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(rect as DOMRect)

  const child = document.createElement('div')
  container.appendChild(child)
  document.body.appendChild(container)

  setContainerQueryRootNode(container)

  return child
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
    duration: 500,
    ...partial
  }
}

describe('V1 - createAnimationAdapter resolves container query units before calling anime.js', () => {
  afterEach(() => {
    setContainerQueryRootNode(null)
  })

  it('converts a cqw `to` value into a resolved px number before the anime call', () => {
    const child = temp__createSceneRootWithChild({ width: 1000, height: 500 })
    const animeImplementation = vi.fn((_parameters: Record<string, unknown>) => ({ pause: vi.fn() }))
    const adapter = createAnimationAdapter(animeImplementation)

    adapter.run([
      temp__makeTransitionRequest({ target: child, property: 'width', to: '10cqw' })
    ])

    expect(animeImplementation).toHaveBeenCalledTimes(1)
    const parameters = animeImplementation.mock.calls[0][0] as Record<string, unknown>
    expect(parameters.width).toEqual({ to: '100px' })
  })

  it('converts both `from` and `to` cqw values before the anime call', () => {
    const child = temp__createSceneRootWithChild({ width: 1000, height: 500 })
    const animeImplementation = vi.fn((_parameters: Record<string, unknown>) => ({ pause: vi.fn() }))
    const adapter = createAnimationAdapter(animeImplementation)

    adapter.run([
      temp__makeTransitionRequest({ target: child, property: 'width', from: '5cqw', to: '10cqw' })
    ])

    const parameters = animeImplementation.mock.calls[0][0] as Record<string, unknown>
    expect(parameters.width).toEqual({ from: '50px', to: '100px' })
  })

  it('leaves non-container-query values (plain numbers) untouched', () => {
    const child = temp__createSceneRootWithChild({ width: 1000, height: 500 })
    const animeImplementation = vi.fn((_parameters: Record<string, unknown>) => ({ pause: vi.fn() }))
    const adapter = createAnimationAdapter(animeImplementation)

    adapter.run([
      temp__makeTransitionRequest({ target: child, property: 'opacity', from: 0, to: 1 })
    ])

    const parameters = animeImplementation.mock.calls[0][0] as Record<string, unknown>
    expect(parameters.opacity).toEqual({ from: 0, to: 1 })
  })
})

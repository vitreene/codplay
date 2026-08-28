// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveContainerQueryValue, setContainerQueryRootNode } from '../../src/runtime/components/lib/container-query-units'

/**
 * Builds a root container with a stubbed rect, and one child node inside it
 * — jsdom never computes real layout, so every test that needs a resolved
 * dimension stubs `getBoundingClientRect` itself. The root is registered via
 * `setContainerQueryRootNode`, the same way the player does after mount —
 * never discovered by class name.
 */
function temp__createSceneRootWithChild(rect: { width: number; height: number }): { container: HTMLElement; child: HTMLElement } {
  const container = document.createElement('div')
  vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(rect as DOMRect)

  const child = document.createElement('div')
  container.appendChild(child)
  document.body.appendChild(container)

  setContainerQueryRootNode(container)

  return { container, child }
}

describe('V1 - resolveContainerQueryValue', () => {
  afterEach(() => {
    setContainerQueryRootNode(null)
  })

  it('resolves cqw against the container width', () => {
    const { child } = temp__createSceneRootWithChild({ width: 1000, height: 500 })

    expect(resolveContainerQueryValue(child, '10cqw')).toBe('100px')
  })

  it('resolves cqh against the container height', () => {
    const { child } = temp__createSceneRootWithChild({ width: 1000, height: 500 })

    expect(resolveContainerQueryValue(child, '10cqh')).toBe('50px')
  })

  it('resolves cqi as an alias of cqw (inline-size)', () => {
    const { child } = temp__createSceneRootWithChild({ width: 1000, height: 500 })

    expect(resolveContainerQueryValue(child, '10cqi')).toBe('100px')
  })

  it('resolves cqb as an alias of cqh (block-size)', () => {
    const { child } = temp__createSceneRootWithChild({ width: 1000, height: 500 })

    expect(resolveContainerQueryValue(child, '10cqb')).toBe('50px')
  })

  it('resolves cqmin against the smaller container dimension', () => {
    const { child } = temp__createSceneRootWithChild({ width: 1000, height: 500 })

    expect(resolveContainerQueryValue(child, '10cqmin')).toBe('50px')
  })

  it('resolves cqmax against the larger container dimension', () => {
    const { child } = temp__createSceneRootWithChild({ width: 1000, height: 500 })

    expect(resolveContainerQueryValue(child, '10cqmax')).toBe('100px')
  })

  it('leaves non-container-query values untouched', () => {
    const { child } = temp__createSceneRootWithChild({ width: 1000, height: 500 })

    expect(resolveContainerQueryValue(child, '50%')).toBe('50%')
    expect(resolveContainerQueryValue(child, '10px')).toBe('10px')
    expect(resolveContainerQueryValue(child, 42)).toBe(42)
    expect(resolveContainerQueryValue(child, '#ff0000')).toBe('#ff0000')
  })

  it('leaves a container-query value untouched when no root node is registered', () => {
    const orphan = document.createElement('div')
    document.body.appendChild(orphan)

    expect(resolveContainerQueryValue(orphan, '10cqw')).toBe('10cqw')
  })
})

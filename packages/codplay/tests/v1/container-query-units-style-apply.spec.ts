// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'

import { applyStylePatch } from '../../src/runtime/components/lib/dom-component-adapter'
import { applyStyleProps } from '../../src/runtime/components/lib/dom'

function temp__createSceneRootWithChild(rect: { width: number; height: number }): HTMLElement {
  const container = document.createElement('div')
  container.className = 'ac-scene-root'
  vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(rect as DOMRect)

  const child = document.createElement('div')
  container.appendChild(child)
  document.body.appendChild(container)

  return child
}

describe('V1 - applyStyleProps/applyStylePatch resolve container query units before anime.js', () => {
  it('applyStyleProps converts a cqw width into a plain px number', () => {
    const child = temp__createSceneRootWithChild({ width: 1000, height: 500 })

    applyStyleProps(child, { width: '10cqw' })

    expect(child.style.width).toBe('100px')
  })

  it('applyStylePatch converts cqw x/y into resolved px before the transform is composed', () => {
    const child = temp__createSceneRootWithChild({ width: 1000, height: 500 })

    applyStylePatch(child, { x: '10cqw', y: '10cqh' })

    expect(child.style.transform).toBe('translate(100px,50px)')
  })

  it('a node outside any .ac-scene-root is left with the raw cqw value passed through unresolved', () => {
    const orphan = document.createElement('div')
    document.body.appendChild(orphan)

    applyStyleProps(orphan, { width: '10cqw' })

    expect(orphan.style.width).toBe('10cqw')
  })
})

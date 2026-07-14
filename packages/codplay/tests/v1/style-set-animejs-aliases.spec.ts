// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { applyStyleProps } from '../../src/runtime/components/lib/dom'
import { applyStylePatch } from '../../src/runtime/components/lib/dom-component-adapter'

describe('V1 - style set (initial/action, no transition) resolves x/y aliases', () => {
  it('applyStyleProps composes x/y into transform with px units', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)

    applyStyleProps(el, { x: 100, y: 50 })

    expect(el.style.transform).toBe('translate(100px,50px)')
  })

  it('applyStylePatch (sub-part nodes) composes x/y the same way', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)

    applyStylePatch(el, { x: 10, y: 20 })

    expect(el.style.transform).toBe('translate(10px,20px)')
  })

  it('non-transform properties still apply as before (opacity, backgroundColor)', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)

    applyStyleProps(el, { opacity: 0.5, backgroundColor: '#ff0000' })

    expect(el.style.opacity).toBe('0.5')
    expect(el.style.backgroundColor).toBe('rgb(255, 0, 0)')
  })

  it('undefined/null values still remove the property', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    el.style.opacity = '0.5'

    applyStyleProps(el, { opacity: undefined })

    expect(el.style.opacity).toBe('')
  })

  it('non-DOM plain object node still uses the manual fallback, not animejs', () => {
    const objectNode: Record<string, unknown> = { tagName: 'DIV', style: {}, attributes: {} }

    applyStyleProps(objectNode, { x: 100 })

    expect((objectNode.style as Record<string, unknown>).x).toBe(100)
  })
})

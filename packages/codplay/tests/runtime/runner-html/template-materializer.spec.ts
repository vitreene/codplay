/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest'
import { materializeTemplateString } from '../../../src/runtime/runner-html/template-materializer'

describe('HTML template materializer', () => {
  it('uses the browser parser and consumes data-part markers', () => {
    const result = materializeTemplateString(`
      <fieldset>
        <legend data-part="content">Question</legend>
        <main data-part="aside"></main>
      </fieldset>
    `)

    expect(result.rootNode).toBeInstanceOf(HTMLElement)
    expect(result.parts.map((part) => part.partId)).toEqual(['content', 'aside'])
    expect((result.rootNode as Element).querySelector('legend')?.textContent).toBe('Question')
    expect((result.rootNode as Element).querySelector('[data-part]')).toBeNull()
  })

  it('keeps comment part anchors and classifies them separately from element outlets', () => {
    const result = materializeTemplateString(`
      <main id="layout-root">
        <!-- data-part="first" -->
        <section data-part="second"></section>
      </main>
    `)

    expect(result.parts.map((part) => ({ id: part.partId, kind: part.kind }))).toEqual([
      { id: 'first', kind: 'anchor' },
      { id: 'second', kind: 'outlet' },
    ])
    expect((result.rootNode as Element).querySelector('[data-part]')).toBeNull()
    expect(Array.from((result.rootNode as Element).childNodes).some((node) => {
      return node.nodeType === 8 && node.textContent?.trim() === 'data-part="first"'
    })).toBe(true)
  })

  it('uses a configured prefix for comment part anchors', () => {
    const result = materializeTemplateString(
      '<main id="layout-root"><!-- __part="first" --></main>',
      { partMarkerPrefix: '__' },
    )

    expect(result.parts).toEqual([{
      partId: 'first',
      nodeRef: expect.any(Comment),
      kind: 'anchor',
    }])
  })

  it('retains multiple real roots as an ordered fragment without generating a wrapper', () => {
    const result = materializeTemplateString(
      '<span data-part="first"></span><span data-part="second"></span>',
    )

    expect(Array.isArray(result.rootNode)).toBe(true)
    const roots = result.rootNode as readonly Node[]
    expect(roots).toHaveLength(2)
    expect(roots.every((root) => root instanceof HTMLElement)).toBe(true)
    expect(roots.map((root) => (root as Element).tagName)).toEqual(['SPAN', 'SPAN'])
    expect(result.parts.map((part) => part.partId)).toEqual(['first', 'second'])
    expect(roots[0]?.parentNode).toBeInstanceOf(DocumentFragment)

    const host = document.createElement('div')
    for (const root of roots) host.appendChild(root)
    expect(Array.from(host.childNodes)).toEqual([...roots])
    expect(host.firstElementChild?.tagName).toBe('SPAN')
    expect(host.lastElementChild?.tagName).toBe('SPAN')
    expect(host.querySelector('[data-part]')).toBeNull()
  })
})

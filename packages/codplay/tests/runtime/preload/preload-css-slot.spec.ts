/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import { CodPlay } from '../../../src'
import { createRuntimePreload } from '../../../src/runtime/preload'

describe('RuntimePreload CSS slots', () => {
  afterEach(() => {
    document.head.querySelectorAll('style[data-codplay-preload-css-slot]').forEach((style) => style.remove())
    document.body.replaceChildren()
  })

  it('sets one scoped stylesheet synchronously and replaces it without accumulation', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const preload = createRuntimePreload()

    preload.css.set({ slot: 'editor-scene', cssText: '.first { color: red; }', container })
    const firstStyle = document.head.querySelector('style[data-codplay-preload-css-slot="editor-scene"]')
    expect(firstStyle).not.toBeNull()
    expect(firstStyle?.textContent).toContain('@scope ([data-codplay-scope="cp-scope-')
    expect(firstStyle?.textContent).toContain('.first { color: red; }')

    preload.css.set({ slot: 'editor-scene', cssText: '.second { color: blue; }', container })
    const styles = document.head.querySelectorAll('style[data-codplay-preload-css-slot="editor-scene"]')
    expect(styles).toHaveLength(1)
    expect(styles[0]?.textContent).toContain('.second { color: blue; }')
    expect(styles[0]?.textContent).not.toContain('.first { color: red; }')
  })

  it('clears one slot or all slots idempotently', () => {
    const sceneA = document.createElement('div')
    const sceneB = document.createElement('div')
    document.body.append(sceneA, sceneB)
    const preload = createRuntimePreload()
    preload.css.set({ slot: 'one', cssText: '.one {}', container: sceneA })
    preload.css.set({ slot: 'two', cssText: '.two {}', container: sceneB })

    preload.css.clear('one')
    expect(document.head.querySelector('style[data-codplay-preload-css-slot="one"]')).toBeNull()
    const remainingStyle = document.head.querySelector('style[data-codplay-preload-css-slot="two"]')
    expect(remainingStyle).not.toBeNull()
    expect(remainingStyle?.textContent).toContain('.two {}')
    expect(remainingStyle?.textContent).toContain(`data-codplay-scope="${sceneB.getAttribute('data-codplay-scope')}"`)

    preload.css.clear()
    preload.css.clear()
    expect(document.head.querySelectorAll('style[data-codplay-preload-css-slot]')).toHaveLength(0)
  })

  it('clears CSS slots when the owning CodPlay facade is destroyed', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const codplay = new CodPlay()
    codplay.preload.css.set({ slot: 'editor-scene', cssText: '.scene {}', container })

    codplay.destroy()

    expect(document.head.querySelector('style[data-codplay-preload-css-slot="editor-scene"]')).toBeNull()
  })

  it('rejects an empty slot before creating a stylesheet', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const preload = createRuntimePreload()

    expect(() => preload.css.set({ slot: '  ', cssText: '.scene {}', container })).toThrow(/slot must not be empty/)
    expect(document.head.querySelectorAll('style[data-codplay-preload-css-slot]')).toHaveLength(0)
  })
})

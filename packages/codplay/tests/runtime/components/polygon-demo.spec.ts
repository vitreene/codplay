/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'

import { createCoreRuntimeCatalog } from '../../../src/runtime/catalog'
import { resolvePolygonPathString } from '../../../src/runtime/components/polygon/polygon-geometry'
import { HtmlPlayerRunner } from '../../../src/runtime/runner-html'
import { SceneBuilder } from '../../../src/scene/compiled'
import { createScene } from '../../../../demos/src/v2/demos/polygon/main'

/** Lets the delegated DOM emit adapter complete its queued dispatch. */
function flushDomEmit(): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, 0))
}

describe('polygon V2 demo', () => {
  let runner: HtmlPlayerRunner | undefined

  afterEach(() => {
    runner?.destroy()
    runner = undefined
    document.body.replaceChildren()
  })

  it('builds and runs the polygon through the real DOM emit and transform path', async () => {
    const root = document.createElement('main')
    document.body.append(root)
    const catalog = createCoreRuntimeCatalog()
    const build = new SceneBuilder(catalog.validationSnapshot(), {
      createdAt: '2026-08-29T00:00:00.000Z',
    }).build(createScene())
    expect(build.ok).toBe(true)
    if (!build.ok) return

    runner = new HtmlPlayerRunner({
      id: 'v2-polygon-demo-test',
      compiledScene: build.compiledScene,
      root,
      rootTargets: [{ id: 'root-host', storyId: 'main' }],
      catalog,
      functions: build.functions,
    })
    expect(runner.init().ok).toBe(true)
    expect(runner.getPersoNode('main:item-1')).toBeUndefined()
    const mainLayout = root.querySelector('.polygon-demo-main')
    expect(mainLayout?.querySelector('.polygon-demo-shape')).not.toBeNull()
    expect(mainLayout?.querySelector('.polygon-demo-controls')).not.toBeNull()
    expect(root.textContent).not.toContain('Nouvel item')
    runner.player.play()
    runner.advance(0)

    const polygon = runner.getPersoNode('main:polygon-shape') as SVGSVGElement
    const morphTest = runner.getPersoNode('main:polygon-morph-test') as SVGSVGElement
    const range = runner.getPersoNode('main:polygon-range-sides') as HTMLLabelElement
    const input = range.querySelector('input') as HTMLInputElement
    const output = runner.getPersoNode('main:polygon-value-sides') as HTMLOutputElement
    expect(polygon.querySelector('path')?.getAttribute('d')).toMatch(/^M /)
    expect(output.textContent).toBe('5')

    input.value = '8'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await flushDomEmit()

    expect(output.textContent).toBe('8')
    expect(input.value).toBe('8')
    expect(polygon.querySelector('text')?.textContent).toBe('8')
    expect(runner.player.trackJournal.getAllEvents().map((event) => event.name)).toEqual([
      'polygon:sides:raw',
      'polygon:update',
      'polygon:value:sides',
    ])

    const reset = runner.getPersoNode('main:polygon-btn-sides') as HTMLButtonElement
    reset.click()
    await flushDomEmit()
    expect(output.textContent).toBe('5')
    expect(polygon.querySelector('text')?.textContent).toBe('5')

    morphTest.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushDomEmit()
    expect(morphTest.querySelector('text')?.textContent).toBe('done')
    const morphStartPath = morphTest.querySelector('path')?.getAttribute('d')
    runner.advance(350)
    const morphMiddlePath = morphTest.querySelector('path')?.getAttribute('d')
    runner.advance(700)
    const morphEndPath = morphTest.querySelector('path')?.getAttribute('d')
    expect(morphStartPath).toMatch(/^M /)
    expect(morphMiddlePath).not.toBe(morphStartPath)
    expect(morphEndPath).toBe(resolvePolygonPathString({
      sides: 8,
      inner: null,
      outer: 42,
      rotationDeg: 22.5,
      inflexion: 0,
    }))

    morphTest.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushDomEmit()
    const returnStartPath = morphTest.querySelector('path')?.getAttribute('d')
    runner.advance(1050)
    const returnMiddlePath = morphTest.querySelector('path')?.getAttribute('d')
    runner.advance(1750)
    const returnEndPath = morphTest.querySelector('path')?.getAttribute('d')
    expect(returnStartPath).toBe(morphEndPath)
    expect(returnMiddlePath).not.toBe(returnStartPath)
    expect(returnEndPath).toBe(resolvePolygonPathString({
      sides: 5,
      inner: 18,
      outer: 42,
      rotationDeg: -18,
      inflexion: 0,
    }))
  })
})

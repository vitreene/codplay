/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'

import { createCoreRuntimeCatalog } from '../../../src/runtime/catalog'
import { HtmlPlayerRunner } from '../../../src/runtime/runner-html'
import { SceneBuilder } from '../../../src/scene/compiled'
import { createComponentsScene } from '../../../demos/validation/components/components-scene'

describe('V2 core components demo', () => {
  let runner: HtmlPlayerRunner | undefined

  afterEach(() => {
    runner?.destroy()
    runner = undefined
    document.body.replaceChildren()
  })

  it('builds and presents image, input slots, and polygon through the real runner', () => {
    const root = document.createElement('main')
    document.body.appendChild(root)
    const catalog = createCoreRuntimeCatalog()
    const layout = catalog.getComponent('layout')
    expect(layout).toBeDefined()
    catalog.overrideComponent({
      ...layout!,
      mountableParts: ['visual-outlet', 'quiz-outlet'],
    })

    const build = new SceneBuilder(catalog.validationSnapshot(), {
      createdAt: '2026-08-24T00:00:00.000Z',
    }).build(createComponentsScene())
    expect(build.ok).toBe(true)
    if (!build.ok) return

    runner = new HtmlPlayerRunner({
      id: 'v2-components-demo-test',
      compiledScene: build.compiledScene,
      root,
      rootTargets: [{ id: 'root-host', storyId: 'main' }],
      catalog,
    })
    expect(runner.init().ok).toBe(true)

    const image = runner.getPersoNode('main:components-image') as HTMLElement
    const polygon = runner.getPersoNode('main:components-polygon') as SVGSVGElement
    const answer = runner.getPersoNode('main:components-answer-a') as HTMLLabelElement
    expect(image.querySelector('img')).not.toBeNull()
    expect(polygon.namespaceURI).toBe('http://www.w3.org/2000/svg')
    expect(polygon.querySelector('path')?.getAttribute('d')).toMatch(/^M /)
    expect(answer.querySelector('.components-question__selection-icon')).not.toBeNull()

    expect(runner.seek(2000).ok).toBe(true)
    expect(answer.className).toContain('input--selected')
    expect(answer.querySelector('.components-question__selection-icon')?.textContent).toBe('●')

    expect(runner.seek(3000).ok).toBe(true)
    expect(answer.className).toContain('input--revealed-correct')
    expect(answer.querySelector('.components-question__correction-icon')?.textContent).toBe('✓')
    expect(polygon.querySelector('text')?.textContent).toBe('SVG')
  })
})

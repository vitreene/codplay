/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import { createCoreRuntimeCatalog } from '../../../src/runtime/catalog'
import { resolvePolygonPathString } from '../../../src/runtime/components/polygon/polygon-geometry'
import { sanitizePolygonInitial } from '../../../src/runtime/components/polygon'
import type { PolygonState } from '../../../src/runtime/components'
import { HtmlPlayerRunner } from '../../../src/runtime/runner-html'
import { SceneBuilder } from '../../../src/scene/compiled'
import type { SceneDoc } from '../../../src/scene/types'

/** Declares one triangle that morphs into a pentagon over one second, from an authored eventime. */
function createMorphScene(): SceneDoc<string> {
  return {
    id: 'polygon-morph-scene',
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: 'shape',
          type: 'polygon',
          initial: { move: '@root', sides: 3, outer: 40, diameter: 120, content: 'triangle' },
          actions: { morph: { sides: 5, outer: 40, content: 'pentagon', morph: { duration: 1000 } } },
        }],
        eventimes: [{ name: 'morph', startAt: 0 }],
      },
    },
  }
}

describe('polygon morph during Play', () => {
  let runner: HtmlPlayerRunner | undefined

  afterEach(() => {
    runner?.destroy()
    runner = undefined
    document.body.replaceChildren()
  })

  it('moves the SVG path from the initial shape to the target shape through the real runner', () => {
    const root = document.createElement('main')
    document.body.append(root)
    const catalog = createCoreRuntimeCatalog()
    const build = new SceneBuilder(catalog.validationSnapshot(), { createdAt: '2026-11-27T00:00:00.000Z' })
      .build(createMorphScene())
    expect(build.ok).toBe(true)
    if (!build.ok) return
    runner = new HtmlPlayerRunner({
      id: 'polygon-morph-play-test',
      compiledScene: build.compiledScene,
      root,
      catalog,
      functions: build.functions,
    })
    expect(runner.init().ok).toBe(true)
    runner.player.play()
    runner.advance(0)

    const polygon = runner.getPersoNode('main:shape') as SVGSVGElement
    const readPath = (): string | null => polygon.querySelector('path')?.getAttribute('d') ?? null
    const startPath = readPath()
    expect(startPath).toMatch(/^M /)

    runner.advance(500)
    expect(readPath()).not.toBe(startPath)

    runner.advance(1000)
    const target = sanitizePolygonInitial({ sides: 5, outer: 40, diameter: 120, content: 'pentagon' }) as PolygonState
    expect(readPath()).toBe(resolvePolygonPathString(target))
    expect(polygon.querySelector('text')?.textContent).toBe('pentagon')
  })
})

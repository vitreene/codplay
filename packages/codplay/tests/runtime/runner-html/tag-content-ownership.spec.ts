/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import { createCoreRuntimeCatalog } from '../../../src/runtime/catalog'
import { HtmlPlayerRunner } from '../../../src/runtime/runner-html'
import { SceneBuilder } from '../../../src/scene/compiled'

describe('Tag content ownership through the real player', () => {
  let runner: HtmlPlayerRunner | undefined

  afterEach(() => {
    runner?.destroy()
    document.body.replaceChildren()
  })

  it('preserves child identity through parent updates, reparent, Seek, resize and replay', () => {
    const catalog = createCoreRuntimeCatalog()
    const build = new SceneBuilder(catalog.validationSnapshot()).build({
      id: 'tag-content-ownership',
      stories: {
        main: {
          id: 'main',
          persos: [
            {
              id: 'first-host',
              type: 'tag',
              initial: { tag: 'section', attr: { id: 'first-host' }, move: '@root' },
              actions: { restyle: { style: { opacity: 0.8 } } },
            },
            {
              id: 'second-host',
              type: 'tag',
              initial: { tag: 'section', attr: { id: 'second-host' }, move: '@root' },
              actions: { restyle: { style: { opacity: 0.8 } } },
            },
            {
              id: 'child',
              type: 'tag',
              initial: { tag: 'p', content: 'Retained content', move: 'first-host' },
              actions: { relocate: { move: 'second-host' } },
            },
          ],
          eventimes: [{ name: 'restyle', startAt: 50 }, { name: 'relocate', startAt: 100 }],
        },
      },
      eventimes: [{ name: 'sequence:end', startAt: 300 }],
    })
    expect(build.ok).toBe(true)
    if (!build.ok) return
    const root = document.createElement('main')
    root.id = 'tag-content-test-root'
    document.body.append(root)
    runner = new HtmlPlayerRunner({ id: 'tag-content-player', compiledScene: build.compiledScene, root, catalog })
    expect(runner.init().ok).toBe(true)
    const first = runner.getPersoNode('main:first-host')
    const second = runner.getPersoNode('main:second-host')
    const child = runner.getPersoNode('main:child') as HTMLElement
    runner.player.play()
    runner.advance(0)
    runner.advance(75)
    expect(child.parentNode).toBe(first)
    expect(child.textContent).toBe('Retained content')
    runner.advance(150)
    expect(child.parentNode).toBe(second)
    runner.resize()
    expect(child.parentNode).toBe(second)
    expect(runner.seek(25).ok).toBe(true)
    expect(child.parentNode).toBe(first)
    expect(runner.seek(150).ok).toBe(true)
    expect(child.parentNode).toBe(second)
    runner.reset()
    runner.player.play()
    runner.advance(150)
    runner.advance(225)
    expect(runner.getPersoNode('main:child')).toBe(child)
    expect(child.parentNode).toBe(first)
    expect(child.textContent).toBe('Retained content')
    runner.destroy()
    expect(root.textContent).toBe('')
  })
})

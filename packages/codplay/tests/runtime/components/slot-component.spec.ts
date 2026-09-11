/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import { createCoreRuntimeCatalog } from '../../../src/runtime/catalog'
import { HtmlPlayerRunner } from '../../../src/runtime/runner-html'
import { SceneBuilder } from '../../../src/scene/compiled'

describe('V2 slot component', () => {
  let runner: HtmlPlayerRunner | undefined

  afterEach(() => {
    runner?.destroy()
    runner = undefined
    document.body.replaceChildren()
  })

  it('requires a root name and keeps it outside the initial state', () => {
    const catalog = createCoreRuntimeCatalog()
    const builder = new SceneBuilder(catalog.validationSnapshot(), {
      createdAt: '2026-09-11T00:00:00.000Z',
    })
    const valid = builder.build({
      id: 'slot-scene',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'host',
            name: 'body',
            type: 'slot',
            initial: { move: '@root', content: { source: 'child-scene', roots: ['root-a'] } },
          }],
        },
      },
    })

    expect(valid.ok).toBe(true)
    if (valid.ok) {
      expect(valid.compiledScene.scene.stories.main?.persos[0]).toMatchObject({
        id: 'host',
        name: 'body',
        type: 'slot',
        initial: {
          tag: 'div',
          move: '@root',
          content: { source: 'child-scene', roots: ['root-a'] },
        },
      })
    }

    const missing = builder.build({
      id: 'slot-scene-invalid',
      stories: { main: { id: 'main', persos: [{ id: 'host', type: 'slot' }] } },
    })
    expect(missing.ok).toBe(false)
    if (!missing.ok) {
      expect(missing.diagnostics.errors.map((diagnostic) => diagnostic.code))
        .toContain('AUTHOR_SLOT_NAME_REQUIRED')
    }
  })

  it('exposes foreign roots through the materializer-owned host surface', () => {
    const root = document.createElement('main')
    document.body.appendChild(root)
    const catalog = createCoreRuntimeCatalog()
    const build = new SceneBuilder(catalog.validationSnapshot(), {
      createdAt: '2026-09-11T00:00:00.000Z',
    }).build({
      id: 'slot-runtime-scene',
      stories: {
        main: {
          id: 'main',
          persos: [{ id: 'host', name: 'body', type: 'slot', initial: { move: '@root' } }],
        },
      },
    })
    expect(build.ok).toBe(true)
    if (!build.ok) return

    runner = new HtmlPlayerRunner({
      id: 'slot-runtime-player',
      compiledScene: build.compiledScene,
      root,
      catalog,
    })
    expect(runner.init().ok).toBe(true)

    const host = runner.getPersoNode('main:host') as HTMLDivElement
    const foreignA = document.createElement('section')
    const foreignB = document.createElement('aside')
    const reference = document.createElement('p')
    host.append(reference)
    const surface = runner.getComponentSurface('main:host', 'foreignContent')

    expect(host.tagName).toBe('DIV')
    expect(surface).toBeDefined()
    expect(catalog.getComponent('slot')?.component.declaredServices).toEqual(['className', 'style', 'attr'])

    surface?.attach([foreignA, foreignB])
    expect([...host.children]).toEqual([reference, foreignA, foreignB])

    surface?.detach()
    expect(host.children).toHaveLength(1)
    expect(host.firstElementChild).toBe(reference)
    expect(foreignA.parentNode).toBeNull()
    expect(foreignB.parentNode).toBeNull()

    surface?.attach([foreignA, foreignB], reference)
    expect([...host.children]).toEqual([foreignA, foreignB, reference])

    runner.destroy()
    runner = undefined
    expect(foreignA.parentNode).toBeNull()
    expect(foreignB.parentNode).toBeNull()
  })

  it('accepts and ignores split replacement declarations', () => {
    const catalog = createCoreRuntimeCatalog()
    const result = new SceneBuilder(catalog.validationSnapshot()).build({
      id: 'slot-replace-split-ignored',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'host',
            name: 'body',
            type: 'slot',
            initial: { content: { source: 'first' } },
            actions: {
              swap: {
                content: { source: 'second' },
                replace: { transition: 'fade', split: 'cells' },
              },
            },
          }],
        },
      },
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.compiledScene.requirements.modules).toContain('replace')
  })

  it('rejects attempts to move the root name into state or an action', () => {
    const catalog = createCoreRuntimeCatalog()
    const result = new SceneBuilder(catalog.validationSnapshot()).build({
      id: 'slot-name-immutable',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'host',
            name: 'body',
            type: 'slot',
            initial: { name: 'other' } as never,
            actions: { rename: { name: 'other' } as never },
          }],
        },
      },
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.diagnostics.errors.map((diagnostic) => diagnostic.code)).toEqual(expect.arrayContaining([
        'AUTHOR_SLOT_NAME_ROOT_ONLY',
        'AUTHOR_SLOT_NAME_IMMUTABLE',
      ]))
    }
  })
})

import { describe, expect, it, vi } from 'vitest'

import { isPreparedPath, prepareSvgPath } from '../../../src/ace'
import { createCoreRuntimeCatalog } from '../../../src/runtime/catalog'
import type { RuntimeCapabilityCatalog } from '../../../src/runtime/catalog'
import { TagComponent } from '../../../src/runtime/components'
import { compileMovePath, SceneBuilder } from '../../../src/scene/compiled'
import type { SceneDoc } from '../../../src/scene/types'
import { demoSceneFixtures } from '../../fixtures/demo-scene-fixtures'

function createCatalogForFixtures(): RuntimeCapabilityCatalog {
  const catalog = createCoreRuntimeCatalog()
  for (const type of ['text', 'media']) {
    catalog.registerComponent({
      type,
      services: ['style', 'className', 'attr'],
      modules: [],
      validateInitial: () => undefined,
      validateAction: () => undefined,
      create: (input) => new TagComponent(input as never),
    })
  }
  return catalog
}

describe('SceneBuilder', () => {
  it('exposes the pure path transformation for future strap payloads', () => {
    const path = prepareSvgPath('M 0 0 L 0.5 0.8 L 1 0')
    const transformed = compileMovePath({
      move: { target: '@root', transition: { path: 'M 0 0 L 0.5 0.8 L 1 0' } },
    }, 'strap.output')

    expect(isPreparedPath(path)).toBe(true)
    expect(transformed).toMatchObject({
      move: { transition: { path: { kind: 'segments', traversal: 'arc-length' } } },
    })

    const sequence = compileMovePath([{
      durationMs: 120,
      action: { move: { target: '@root', transition: { path: 'M 0 0 L 1 1' } } },
    }], 'sequence')
    expect(sequence).toMatchObject([{
      action: { move: { transition: { path: { kind: 'segments' } } } },
    }])
  })

  it('builds representative demo scenes with requirements, roots, and resources', () => {
    const builder = new SceneBuilder(createCatalogForFixtures().validationSnapshot(), {
      createdAt: '2026-07-31T00:00:00.000Z',
      diagnosticOutput: vi.fn(),
    })

    for (const fixture of demoSceneFixtures) {
      const result = builder.build(fixture.scene)

      expect(result.ok, fixture.id).toBe(true)
      if (!result.ok) continue
      expect(result.compiledScene.scene.id).toBe(fixture.scene.id)
      expect(result.compiledScene.createdAt).toBe('2026-07-31T00:00:00.000Z')
      expect(result.compiledScene.scene.stories).toBeDefined()
    }

    const s4 = builder.build(demoSceneFixtures[3]!.scene)
    expect(s4.ok).toBe(true)
    if (s4.ok) {
      expect(s4.compiledScene.rootNodeIds).toEqual(['quiz-layout'])
      expect(s4.compiledScene.resources.entries).toEqual([
        expect.objectContaining({ url: '/assets/quiz.mp4', type: 'video' }),
      ])
      expect(s4.compiledScene.requirements.components).toEqual(['layout', 'media'])
    }
  })

  it('extracts functions and leaves the compiled payload JSON-safe', () => {
    const transform = () => [{ type: 'START' }]
    const init = () => undefined
    const scene: SceneDoc = {
      id: 'function-scene',
      init,
      stories: {
        main: {
          id: 'main',
          listen: [{ on: 'start', transform: [transform] }],
          persos: [{ id: 'title', type: 'text', actions: { start: { style: { opacity: init } } } }],
        },
      },
    }
    const builder = new SceneBuilder(createCatalogForFixtures().validationSnapshot(), { diagnosticOutput: vi.fn() })

    const result = builder.build(scene)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(Object.keys(result.functions)).toHaveLength(3)
      expect(JSON.stringify(result.compiledScene)).not.toContain('=>')
      expect(result.compiledScene.scene.init).toMatchObject({ ref: expect.stringContaining('fn:') })
      expect(result.compiledScene.scene.stories.main.listen[0]?.transform).toHaveLength(1)
    }
  })

  it('normalizes author SVG move paths into compact prepared segments', () => {
    const builder = new SceneBuilder(createCatalogForFixtures().validationSnapshot(), { diagnosticOutput: vi.fn() })
    const result = builder.build({
      id: 'svg-path-scene',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'item',
            type: 'text',
            initial: { move: '@root' },
            actions: {
              move: {
                move: {
                  target: '@root',
                  transition: { duration: 100, path: 'M 10 20 L 20 30 L 30 20' },
                },
              },
            },
          }],
        },
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const path = result.compiledScene.scene.stories.main?.persos[0]?.actions.move
    const pathValue = (path as Record<string, unknown>).move && ((path as Record<string, unknown>).move as Record<string, unknown>).transition
      ? (((path as Record<string, unknown>).move as Record<string, unknown>).transition as Record<string, unknown>).path
      : undefined

    expect(isPreparedPath(pathValue)).toBe(true)
    if (isPreparedPath(pathValue)) {
      expect(pathValue.kind).toBe('segments')
      expect(pathValue.segments?.[0]?.to).toEqual([0.5, 0.5])
      expect(pathValue.segments?.at(-1)?.to).toEqual([1, 0])
    }
  })

  it('derives resource types from configured URL extensions rather than perso type', () => {
    const builder = new SceneBuilder(createCatalogForFixtures().validationSnapshot(), { diagnosticOutput: vi.fn() })
    const result = builder.build({
      id: 'resource-scene',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'media',
            type: 'text',
            initial: { src: '/assets/sound.mp3' },
            actions: { unknown: { src: '/assets/runtime.bin' } },
          }],
        },
      },
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.compiledScene.resources.entries).toEqual([
        expect.objectContaining({ url: '/assets/sound.mp3', type: 'audio' }),
      ])
    }
  })

  it('derives ModuleService requirements from component capability declarations', () => {
    const catalog = createCoreRuntimeCatalog()
    catalog.registerComponent({
      type: 'list-item',
      services: [],
      modules: ['list'],
      validateInitial: () => undefined,
      validateAction: () => undefined,
      create: (input) => new TagComponent(input as never),
    })
    const builder = new SceneBuilder(catalog.validationSnapshot(), { diagnosticOutput: vi.fn() })

    const result = builder.build({
      id: 'module-service-scene',
      stories: {
        main: {
          id: 'main',
          persos: [{ id: 'item', type: 'list-item' }],
        },
      },
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.compiledScene.requirements.modules).toEqual(['list'])
  })

  it('derives the layout module requirement from the layout component definition', () => {
    const catalog = createCoreRuntimeCatalog()
    catalog.overrideComponent({
      type: 'layout',
      services: [],
      modules: ['markup'],
      validateInitial: () => undefined,
      validateAction: () => undefined,
      create: (input) => new TagComponent(input as never),
    })
    const builder = new SceneBuilder(catalog.validationSnapshot(), { diagnosticOutput: vi.fn() })

    const result = builder.build({
      id: 'layout-module-scene',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'layout',
            type: 'layout',
            initial: {
              markup: `
                <section>
                  <main data-part="page-layout:content"></main>
                </section>
              `,
            },
          }],
        },
      },
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.compiledScene.requirements.modules).toEqual(['markup'])
      const layout = result.compiledScene.scene.stories.main?.persos[0]
      expect(layout?.initial.markup).toBe('<section><main data-part="page-layout:content"></main></section>')
    }
  })
})

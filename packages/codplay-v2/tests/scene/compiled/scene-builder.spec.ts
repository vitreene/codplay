import { describe, expect, it, vi } from 'vitest'

import { ValidationCatalog } from '../../../src/scene/validation'
import { SceneBuilder } from '../../../src/scene/compiled'
import type { SceneDoc } from '../../../src/scene/types'
import { demoSceneFixtures } from '../../fixtures/demo-scene-fixtures'

function createCatalogForFixtures(): ValidationCatalog {
  const catalog = new ValidationCatalog()
  for (const type of ['text', 'list', 'layout', 'media']) {
    catalog.registerComponent({ type, services: ['style', 'className', 'attr'], validateInitial: () => undefined, validateAction: () => undefined })
  }
  return catalog
}

describe('SceneBuilder', () => {
  it('builds representative demo scenes with requirements, roots, and resources', () => {
    const builder = new SceneBuilder(createCatalogForFixtures().snapshot(), {
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
    const builder = new SceneBuilder(createCatalogForFixtures().snapshot(), { diagnosticOutput: vi.fn() })

    const result = builder.build(scene)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(Object.keys(result.functions)).toHaveLength(3)
      expect(JSON.stringify(result.compiledScene)).not.toContain('=>')
      expect(result.compiledScene.scene.init).toMatchObject({ ref: expect.stringContaining('fn:') })
      expect(result.compiledScene.scene.stories.main.listen[0]?.transform).toHaveLength(1)
    }
  })

  it('derives resource types from configured URL extensions rather than perso type', () => {
    const builder = new SceneBuilder(createCatalogForFixtures().snapshot(), { diagnosticOutput: vi.fn() })
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
    const catalog = new ValidationCatalog()
    catalog.registerComponent({
      type: 'list-item',
      services: [],
      modules: ['list'],
      validateInitial: () => undefined,
      validateAction: () => undefined,
    })
    const builder = new SceneBuilder(catalog.snapshot(), { diagnosticOutput: vi.fn() })

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
    const catalog = new ValidationCatalog()
    catalog.registerComponent({
      type: 'layout',
      services: [],
      modules: ['markup'],
      validateInitial: () => undefined,
      validateAction: () => undefined,
    })
    const builder = new SceneBuilder(catalog.snapshot(), { diagnosticOutput: vi.fn() })

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

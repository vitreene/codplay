import { describe, expect, it, vi } from 'vitest'
import { LayoutComponent } from '../../../src/runtime/components'
import { DiagnosticCollector } from '../../../src/diagnostics'
import { createCoreRuntimeCatalog } from '../../../src/runtime/catalog'
import { validatePersoWithCapabilities } from '../../../src/scene/validation'
import {
  createMarkupModuleServiceDefinition,
} from '../../../src/runtime/capabilities/markup'
import type { MarkupModuleServiceInstance } from '../../../src/runtime/capabilities/markup'
import { materializeComponentWithMarkup } from '../../../src/runtime/runner-html'
import type { CompiledScene } from '../../../src/scene/compiled'

/** Creates the minimal service boundary required by direct layout tests. */
function testServices(apply: (node: unknown, patch: Record<string, unknown>) => void = () => undefined) {
  return {
    declare: () => undefined,
    get: () => ({ apply: () => undefined }),
    apply,
  }
}

describe('LayoutComponent V2', () => {
  it('declares its template without exposing service registration methods', () => {
    const component = new LayoutComponent({
      perso: {
        id: 'page-layout',
        storyId: 'main',
        initial: {
          markup: '<section><main data-part="page-layout:content"></main></section>',
        },
      },
      services: testServices(),
    })

    expect(component.render()).toContain('data-part="page-layout:content"')
  })

  it('projects resolved state through the component root', () => {
    const apply = vi.fn()
    const component = new LayoutComponent({
      perso: {
        id: 'page-layout',
        storyId: 'main',
        initial: { markup: '<section></section>' },
      },
      services: testServices(apply),
    })
    const root = {}
    component._materialize(root, [])

    component.update({ state: { className: 'active' }, timeMs: 0 })

    expect(apply).toHaveBeenCalledWith(root, { className: 'active' })
  })

  it('rejects an empty layout profile before the component is materialized', () => {
    const diagnostics = new DiagnosticCollector({ output: vi.fn() })

    validatePersoWithCapabilities(createCoreRuntimeCatalog().validationSnapshot(), {
      id: 'empty-layout',
      type: 'layout',
      initial: { markup: '  ' },
      actions: {},
    }, diagnostics)

    expect(diagnostics.report().errors.map((entry) => entry.code)).toEqual([
      'AUTHOR_LAYOUT_MARKUP_INVALID',
    ])
  })

  it('registers public materialized parts and cleans them up with the component', () => {
    const markup = createMarkupModuleServiceDefinition().create({
      playerId: 'player',
      compiledScene: {} as CompiledScene,
    }) as MarkupModuleServiceInstance
    const component = new LayoutComponent({
      perso: {
        id: 'page-layout',
        storyId: 'main',
        initial: { markup: '<main data-part="page-layout:content"></main>' },
      },
      services: testServices(),
    })

    const cleanup = materializeComponentWithMarkup(markup, {
      component,
      identity: { componentId: 'page-layout', storyId: 'main', componentType: 'layout' },
      rootNode: {},
      parts: [{ partId: 'page-layout:content', nodeRef: {} }],
      publicParts: [{ partId: 'page-layout:content', nodeRef: {} }],
    })

    expect(markup.resolveTarget('page-layout:content')).toBeDefined()
    cleanup()
    expect(markup.resolveTarget('page-layout:content')).toBeUndefined()
  })
})

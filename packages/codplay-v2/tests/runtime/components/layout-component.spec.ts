import { describe, expect, it, vi } from 'vitest'
import { LayoutComponent } from '../../../src/runtime/components'
import {
  createMarkupModuleServiceDefinition,
  materializeComponentWithMarkup,
} from '../../../src/runtime/capabilities/markup'
import type { MarkupModuleServiceInstance } from '../../../src/runtime/capabilities/markup'
import type { CompiledScene } from '../../../src/scene/compiled'

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
      services: {
        apply: vi.fn(),
      },
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
      services: { apply },
    })
    const root = {}
    component._materialize(root, [])

    component.update({ state: { className: 'active' }, timeMs: 0 })

    expect(apply).toHaveBeenCalledWith(root, { className: 'active' })
  })

  it('rejects an empty layout template before materialization', () => {
    const component = new LayoutComponent({
      perso: { id: 'empty-layout', storyId: 'main', initial: { markup: '  ' } },
      services: { apply: () => undefined },
    })

    expect(() => component.render()).toThrow('Layout markup must not be empty: empty-layout')
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
      services: { apply: vi.fn() },
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
